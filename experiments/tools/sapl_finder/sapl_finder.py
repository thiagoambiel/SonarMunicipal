"""
Script para descobrir instancias SAPL publicas no Brasil usando dados do IBGE.
"""

import os
import json

import argparse
import asyncio
import logging
import re
import unicodedata
from typing import Dict, List, Optional, Tuple

import httpx

IBGE_MUN_ENDPOINT: str = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
USER_AGENT: str = "SAPL-Discovery/1.0 (+research use; contact: thiago.ambiel@usp.br)"

CHECK_PATHS: List[str] = [
    "/materia/pesquisar-materia",
    "/sapl/materia/pesquisar-materia",
]

SAPL_MARKERS: List[str] = [
    "SAPL - Interlegis",
    "Pesquisar Materia Legislativa",
    "Materias Legislativas",
    "> SAPL <",
]


def write_json_output(found: List[Dict], 
                      out_json: str) -> None:
    """
    Salva os resultados em JSON.

    Parameters
    ----------
    found : list of dict
        Lista de resultados validados.
    out_json : str
        Caminho do JSON agregado de saida.
    """
    found = sorted(
        found,
        key=lambda x: (
            x.get("uf", ""),
            x.get("municipio", ""),
            x.get("sapl_url", ""),
        ),
    )
    out_dir = os.path.dirname(out_json)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(found, f, ensure_ascii=False, indent=2)


def build_parser() -> argparse.ArgumentParser:
    """
    Cria o parser de argumentos de linha de comando.

    Returns
    -------
    argparse.ArgumentParser
        Parser configurado com as opcoes do script.
    """
    ap = argparse.ArgumentParser(description="Descobrir instancias SAPL no Brasil via IBGE.")
    ap.add_argument("--concurrency", type=int, default=100, help="Requisicoes simultaneas (padrao: 100)")
    ap.add_argument("--timeout", type=int, default=60, help="Timeout de requisicoes em segundos (padrao: 60)")
    ap.add_argument("--out", dest="out_json", default="sapl_hosts.json", help="Arquivo JSON de saida")
    ap.add_argument("--log-level", default="INFO", help="Nivel de log (DEBUG, INFO, WARNING, ERROR)")
    return ap


def slugify(city: str) -> str:
    """
    Normaliza nome de municipio para gerar slug ASCII de host.

    Parameters
    ----------
    city : str
        Nome do municipio.

    Returns
    -------
    str
        Slug sem acentos, espacos ou simbolos.
    """
    s = unicodedata.normalize("NFKD", city)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s-]", " ", s)
    s = re.sub(r"\s+", "", s)
    s = re.sub(r"-+", "", s)
    return s


async def fetch_json(client: httpx.AsyncClient, 
                     url: str, 
                     timeout: int) -> Optional[object]:
    """
    Faz requisicao HTTP e tenta interpretar o corpo como JSON.

    Parameters
    ----------
    client : httpx.AsyncClient
        Cliente HTTP assincorno.
    url : str
        URL da requisicao.
    timeout : int
        Timeout em segundos.

    Returns
    -------
    object or None
        Objeto JSON decodificado, ou None em caso de falha.
    """
    try:
        r = await client.get(url, timeout=timeout)
    except Exception as exc:
        logging.getLogger(__name__).warning("Falha em GET", extra={"url": url})
        logging.getLogger(__name__).debug("Detalhes da falha em GET", exc_info=exc, extra={"url": url})
        return None

    if r.status_code != 200:
        logging.getLogger(__name__).debug("Status nao OK", extra={"url": url, "status": r.status_code})
        return None

    try:
        return r.json()
    except Exception as exc:
        logging.getLogger(__name__).warning("Resposta nao-JSON", extra={"url": url, "status": r.status_code})
        logging.getLogger(__name__).debug("Erro ao decodificar JSON", exc_info=exc, extra={"url": url})
        return None


async def try_get(client: httpx.AsyncClient, 
                  url: str, 
                  timeout: int) -> Tuple[int, str]:
    """
    Faz GET com redirecionamento e retorna status + HTML.

    Parameters
    ----------
    client : httpx.AsyncClient
        Cliente HTTP assincorno.
    url : str
        URL da requisicao.
    timeout : int
        Timeout em segundos.

    Returns
    -------
    tuple of (int, str)
        Status HTTP e corpo parcial da resposta.
    """
    try:

        r = await client.get(
            url=url, 
            follow_redirects=True, 
            timeout=timeout, 
            headers={"User-Agent": USER_AGENT}
        )
        text = r.text[:20000] if r.text else ""
    
        logging.getLogger(__name__).debug("GET", extra={"url": url, "status": r.status_code})

        return r.status_code, text
    
    except Exception as exc:
        logging.getLogger(__name__).debug("Erro em GET", exc_info=exc, extra={"url": url})
        return 0, ""


def looks_like_sapl(html: str) -> Tuple[bool, str]:
    """
    Verifica se o HTML contem marcadores tipicos do SAPL.

    Parameters
    ----------
    html : str
        HTML da pagina acessada.

    Returns
    -------
    tuple of (bool, str)
        Indicador de acerto e marcador que disparou a heuristica.
    """
    hit = ""
    low = (html or "").lower()
    low_norm = unicodedata.normalize("NFKD", low)
    low_norm = "".join(c for c in low_norm if not unicodedata.combining(c))
    for m in SAPL_MARKERS:
        if m.lower() in low_norm:
            hit = m
            return True, hit
    m = re.search(r"<title>([^<]+)</title>", html or "", flags=re.I)
    if m and "sapl" in m.group(1).lower():
        return True, "title contains SAPL"
    return False, ""


def build_candidates(host: str) -> List[str]:
    """
    Monta URLs candidatas a partir de um host base.

    Parameters
    ----------
    host : str
        Host do municipio.

    Returns
    -------
    list of str
        Lista de URLs com caminhos tipicos do SAPL.
    """
    return [f"https://{host}{path}" for path in CHECK_PATHS]


async def validate_host(client: httpx.AsyncClient, host: str, timeout: int) -> Optional[Tuple[str, int, str, str]]:
    """
    Valida um host testando caminhos tipicos do SAPL.

    Parameters
    ----------
    client : httpx.AsyncClient
        Cliente HTTP assincorno.
    host : str
        Host candidato.
    timeout : int
        Timeout em segundos.

    Returns
    -------
    tuple or None
        (url, status, marcador, titulo) se confirmar SAPL, senao None.
    """
    for url in build_candidates(host):
        status, html = await try_get(client, url, timeout)
        if status == 200:
            ok, marker = looks_like_sapl(html)
            if ok:
                title = ""
                m = re.search(r"<title>([^<]+)</title>", html or "", flags=re.I)
                if m:
                    title = m.group(1).strip()
                return (url, status, marker, title)
    logging.getLogger(__name__).debug("Host nao confirmou SAPL", extra={"host": host})
    return None


def get_sigla_uf(item: Dict) -> str:
    """
    Extrai sigla da UF a partir do payload do IBGE.

    Parameters
    ----------
    item : dict
        Registro do municipio do IBGE.

    Returns
    -------
    str
        Sigla da UF, ou string vazia quando indisponivel.
    """
    uf = (item.get("microrregiao", {}) or {}).get("mesorregiao", {}).get("UF", {})
    return uf.get("sigla", "")


def dedupe_results(rows: List[Dict]) -> List[Dict]:
    """
    Remove duplicatas pelo campo sapl_url.

    Parameters
    ----------
    rows : list of dict
        Resultados possivelmente duplicados.

    Returns
    -------
    list of dict
        Lista deduplicada.
    """
    seen = set()
    out = []
    for r in rows:
        key = r.get("sapl_url")
        if key and key not in seen:
            seen.add(key)
            out.append(r)
    return out


async def discover_by_ibge(
    client: httpx.AsyncClient, concurrency: int, timeout: int
) -> Tuple[List[Dict], Dict[str, int]]:
    """
    Descobre instancias SAPL usando municipios do IBGE.

    Parameters
    ----------
    client : httpx.AsyncClient
        Cliente HTTP assincorno.
    concurrency : int
        Numero maximo de tarefas simultaneas.
    timeout : int
        Timeout em segundos para requisicoes.

    Returns
    -------
    tuple of (list of dict, dict)
        Resultados validados e estatisticas de candidatos.
    """
    logging.getLogger(__name__).info("Baixando municipios do IBGE ...")
    data = await fetch_json(client, IBGE_MUN_ENDPOINT, timeout)
    if not data:
        logging.getLogger(__name__).error("Falha ao baixar municipios do IBGE")
        return [], {"total_candidates": 0, "tested_candidates": 0, "sapl_found": 0}

    valid_items = [item for item in data if item.get("nome") and get_sigla_uf(item)]
    total_candidates = len(valid_items) * 2
    stats = {"total_candidates": total_candidates, "tested_candidates": 0, "sapl_found": 0}

    logging.getLogger(__name__).info("Total de municipios carregados: %s", len(data))
    sem = asyncio.Semaphore(concurrency)
    results: List[Dict] = []
    lock = asyncio.Lock()

    async def worker(item: Dict) -> None:
        nome = item.get("nome", "")
        sigla = get_sigla_uf(item)
        if not nome or not sigla:
            return
        slug = slugify(nome)

        async with sem:
            async with lock:
                stats["tested_candidates"] += 1
            v1 = await validate_host(client, f"sapl.{slug}.{sigla.lower()}.leg.br", timeout)
        if v1:
            url, status, marker, title = v1
            row = {
                "ibge_id": item.get("id", ""),
                "municipio": nome,
                "uf": sigla,
                "source": "ibge-heuristic",
                "sapl_url": url,
                "http_status": status,
                "marker": marker,
                "title": title,
            }
            async with lock:
                results.append(row)
                stats["sapl_found"] += 1
                logging.getLogger(__name__).info(
                    "SAPL confirmado. Encontrados %s. Candidatos testados: %s/%s.",
                    stats["sapl_found"],
                    stats["tested_candidates"],
                    stats["total_candidates"],
                    extra={"host": f"sapl.{slug}.{sigla.lower()}.leg.br", "url": url, "status": status, "marker": marker},
                )

        async with sem:
            async with lock:
                stats["tested_candidates"] += 1
            v2 = await validate_host(client, f"{slug}.{sigla.lower()}.leg.br", timeout)
        if v2:
            url, status, marker, title = v2
            row = {
                "ibge_id": item.get("id", ""),
                "municipio": nome,
                "uf": sigla,
                "source": "base-host-endpoint",
                "sapl_url": url,
                "http_status": status,
                "marker": marker,
                "title": title,
            }
            async with lock:
                results.append(row)
                stats["sapl_found"] += 1
                logging.getLogger(__name__).info(
                    "SAPL confirmado. Encontrados %s. Candidatos testados: %s/%s.",
                    stats["sapl_found"],
                    stats["tested_candidates"],
                    stats["total_candidates"],
                    extra={"host": f"{slug}.{sigla.lower()}.leg.br", "url": url, "status": status, "marker": marker},
                )

    await asyncio.gather(*(worker(item) for item in valid_items))
    return results, stats


async def run_async(concurrency: int, timeout: int, out_json: str) -> None:
    """
    Executa o fluxo principal assincrono.

    Parameters
    ----------
    concurrency : int
        Numero maximo de requisicoes simultaneas.
    timeout : int
        Timeout em segundos.
    out_json : str
        Caminho do JSON de saida.
    """
    limits = httpx.Limits(max_keepalive_connections=0, max_connections=concurrency)
    timeout_cfg = httpx.Timeout(timeout)
    async with httpx.AsyncClient(limits=limits, timeout=timeout_cfg, headers={"User-Agent": USER_AGENT}) as client:
        rows, stats = await discover_by_ibge(client, concurrency=concurrency, timeout=timeout)
        rows = dedupe_results(rows)
        write_json_output(rows, out_json=out_json)
        logging.getLogger(__name__).info(
            "Concluido. Encontrados %s SAPLs. Candidatos testados: %s/%s. JSON: %s",
            len(rows),
            stats.get("tested_candidates", 0),
            stats.get("total_candidates", 0),
            out_json,
        )


def main() -> None:
    """
    Ponto de entrada do script.
    """
    args = build_parser().parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    try:
        asyncio.run(
            run_async(
                concurrency=args.concurrency,
                timeout=args.timeout,
                out_json=args.out_json,
            )
        )
    except KeyboardInterrupt:
        logging.getLogger(__name__).warning("Interrompido pelo usuario.")


if __name__ == "__main__":
    main()
