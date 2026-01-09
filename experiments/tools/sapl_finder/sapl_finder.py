"""
Script para descobrir instancias SAPL publicas no Brasil usando dados do IBGE.
"""

import argparse
import asyncio
import json
import logging
import os
import re
import unicodedata
from typing import Dict, List, Optional, Tuple

import httpx

IBGE_MUN_ENDPOINT = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
USER_AGENT = "SAPL-Discovery/1.0 (+research use; contact: thiago.ambiel@usp.br)"

CHECK_PATHS = [
    "/materia/pesquisar-materia",
    "/sapl/materia/pesquisar-materia",
]

SAPL_MARKERS = [
    "SAPL - Interlegis",
    "Pesquisar Materia Legislativa",
    "Materias Legislativas",
    "> SAPL <",
]


class JsonlWriter:
    """Escreve resultados em JSONL com flush imediato.

    Notes
    -----
    Cada linha e gravada assim que o host e confirmado, garantindo progresso
    em tempo real.
    """

    def __init__(self, out_jsonl: str) -> None:
        """Inicializa o escritor JSONL.

        Parameters
        ----------
        out_jsonl : str
            Caminho do arquivo JSONL de saida.
        """
        out_dir = os.path.dirname(out_jsonl)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        self._fp = open(out_jsonl, "w", encoding="utf-8")
        self._count = 0

    @property
    def count(self) -> int:
        """Retorna o total de linhas gravadas.

        Returns
        -------
        int
            Quantidade de registros gravados no JSONL.
        """
        return self._count

    def write(self, row: Dict) -> None:
        """Grava um registro no JSONL.

        Parameters
        ----------
        row : dict
            Registro validado do SAPL.

        Returns
        -------
        None
            Este metodo escreve no disco e nao retorna valor.
        """
        self._fp.write(json.dumps(row, ensure_ascii=False) + "\n")
        self._fp.flush()
        self._count += 1

    def close(self) -> None:
        """Fecha o arquivo JSONL.

        Returns
        -------
        None
            Este metodo fecha o descritor de arquivo.
        """
        if self._fp:
            self._fp.close()


def build_parser() -> argparse.ArgumentParser:
    """Cria o parser de argumentos de linha de comando.

    Returns
    -------
    argparse.ArgumentParser
        Parser configurado com as opcoes do script.
    """
    parser = argparse.ArgumentParser(description="Descobrir instancias SAPL no Brasil via IBGE.")
    parser.add_argument("--concurrency", type=int, default=50, help="Requisicoes simultaneas (padrao: 50)")
    parser.add_argument("--timeout", type=int, default=60, help="Timeout de requisicoes em segundos (padrao: 60)")
    parser.add_argument("--out-jsonl", default="sapl_hosts.jsonl", help="Arquivo JSONL de saida")
    parser.add_argument("--log-level", default="INFO", help="Nivel de log (DEBUG, INFO, WARNING, ERROR)")
    return parser


def slugify(city: str) -> str:
    """Normaliza nome de municipio para gerar slug ASCII de host.

    Parameters
    ----------
    city : str
        Nome do municipio.

    Returns
    -------
    str
        Slug sem acentos, espacos ou simbolos.
    """
    text = unicodedata.normalize("NFKD", city)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"[^a-z0-9\\s-]", " ", text)
    text = re.sub(r"\\s+", "", text)
    text = re.sub(r"-+", "", text)
    return text


async def fetch_json(client: httpx.AsyncClient, url: str, timeout: int) -> Optional[object]:
    """Faz requisicao HTTP e tenta interpretar o corpo como JSON.

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
        resp = await client.get(url, timeout=timeout)
    except Exception as exc:
        logging.getLogger(__name__).warning("Falha em GET", extra={"url": url})
        logging.getLogger(__name__).debug("Detalhes da falha em GET", exc_info=exc, extra={"url": url})
        return None

    if resp.status_code != 200:
        logging.getLogger(__name__).debug("Status nao OK", extra={"url": url, "status": resp.status_code})
        return None

    try:
        return resp.json()
    except Exception as exc:
        logging.getLogger(__name__).warning("Resposta nao-JSON", extra={"url": url, "status": resp.status_code})
        logging.getLogger(__name__).debug("Erro ao decodificar JSON", exc_info=exc, extra={"url": url})
        return None


async def try_get(client: httpx.AsyncClient, url: str, timeout: int) -> Tuple[int, str]:
    """Faz GET com redirecionamento e retorna status + HTML.

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
        resp = await client.get(
            url=url,
            follow_redirects=True,
            timeout=timeout,
            headers={"User-Agent": USER_AGENT},
        )
        text = resp.text[:20000] if resp.text else ""
        logging.getLogger(__name__).debug("GET", extra={"url": url, "status": resp.status_code})
        return resp.status_code, text
    except Exception as exc:
        logging.getLogger(__name__).debug("Erro em GET", exc_info=exc, extra={"url": url})
        return 0, ""


def looks_like_sapl(html: str) -> Tuple[bool, str]:
    """Verifica se o HTML contem marcadores tipicos do SAPL.

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
    for marker in SAPL_MARKERS:
        if marker.lower() in low_norm:
            hit = marker
            return True, hit
    match = re.search(r"<title>([^<]+)</title>", html or "", flags=re.I)
    if match and "sapl" in match.group(1).lower():
        return True, "title contains SAPL"
    return False, ""


def build_candidates(host: str) -> List[str]:
    """Monta URLs candidatas a partir de um host base.

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


async def validate_host(
    client: httpx.AsyncClient, host: str, timeout: int
) -> Optional[Tuple[str, int, str, str]]:
    """Valida um host testando caminhos tipicos do SAPL.

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
                match = re.search(r"<title>([^<]+)</title>", html or "", flags=re.I)
                if match:
                    title = match.group(1).strip()
                return (url, status, marker, title)
    logging.getLogger(__name__).debug("Host nao confirmou SAPL", extra={"host": host})
    return None


def get_uf_code(item: Dict) -> str:
    """Extrai sigla da UF a partir do payload do IBGE.

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


async def discover_by_ibge(
    client: httpx.AsyncClient, concurrency: int, timeout: int, writer: JsonlWriter
) -> Dict[str, int]:
    """Descobre instancias SAPL usando municipios do IBGE.

    Parameters
    ----------
    client : httpx.AsyncClient
        Cliente HTTP assincorno.
    concurrency : int
        Numero maximo de tarefas simultaneas.
    timeout : int
        Timeout em segundos para requisicoes.
    writer : JsonlWriter
        Escritor JSONL para registrar resultados.

    Returns
    -------
    dict
        Estatisticas da execucao (candidatos testados e SAPLs encontrados).
    """
    logging.getLogger(__name__).info("Baixando municipios do IBGE ...")
    data = await fetch_json(client, IBGE_MUN_ENDPOINT, timeout)
    if not data:
        logging.getLogger(__name__).error("Falha ao baixar municipios do IBGE")
        return {"tested": 0, "found": 0, "total": 0}

    valid_items = [item for item in data if item.get("nome") and get_uf_code(item)]
    stats = {"tested": 0, "found": 0, "total": len(valid_items) * 2}
    logging.getLogger(__name__).info("Total de municipios carregados: %s", len(data))

    sem = asyncio.Semaphore(concurrency)
    lock = asyncio.Lock()
    seen: set[str] = set()

    async def register_result(row: Dict, url: str) -> None:
        """Registra um resultado validado com deduplicacao.

        Parameters
        ----------
        row : dict
            Registro validado do SAPL.
        url : str
            URL do endpoint confirmado.

        Returns
        -------
        None
            Atualiza estado interno e escreve no JSONL.
        """
        async with lock:
            if url in seen:
                return
            seen.add(url)
            writer.write(row)
            stats["found"] += 1

    async def check_host(host: str, item: Dict, source: str) -> None:
        """Valida um host candidato e registra resultado se confirmado.

        Parameters
        ----------
        host : str
            Host candidato a SAPL.
        item : dict
            Registro do municipio do IBGE.
        source : str
            Origem do host (heuristica usada).

        Returns
        -------
        None
            Registra no JSONL quando confirmado.
        """
        async with sem:
            async with lock:
                stats["tested"] += 1
            result = await validate_host(client, host, timeout)
        status = result[1] if result else 0
        logging.getLogger(__name__).info(
            "Progresso: %s encontrados | %s/%s testados | status=%s",
            stats["found"],
            stats["tested"],
            stats["total"],
            status,
            extra={"host": host},
        )
        if not result:
            return
        url, status, marker, title = result
        row = {
            "ibge_id": item.get("id", ""),
            "municipio": item.get("nome", ""),
            "uf": get_uf_code(item),
            "source": source,
            "sapl_url": url,
            "http_status": status,
            "marker": marker,
            "title": title,
        }
        await register_result(row, url)
        logging.getLogger(__name__).info(
            "SAPL confirmado. Encontrados %s. Candidatos testados: %s/%s.",
            stats["found"],
            stats["tested"],
            stats["total"],
            extra={"host": host, "url": url, "status": status, "marker": marker},
        )

    async def worker(item: Dict) -> None:
        """Processa um municipio, testando os dois hosts padrao.

        Parameters
        ----------
        item : dict
            Registro do municipio do IBGE.

        Returns
        -------
        None
            Dispara validacoes para os hosts derivados.
        """
        nome = item.get("nome", "")
        sigla = get_uf_code(item)
        if not nome or not sigla:
            return
        slug = slugify(nome)
        await check_host(f"sapl.{slug}.{sigla.lower()}.leg.br", item, "ibge-heuristic")
        await check_host(f"{slug}.{sigla.lower()}.leg.br", item, "base-host-endpoint")

    await asyncio.gather(*(worker(item) for item in valid_items))
    return stats


async def run(concurrency: int, timeout: int, out_jsonl: str) -> None:
    """Executa o fluxo principal assincrono.

    Parameters
    ----------
    concurrency : int
        Numero maximo de requisicoes simultaneas.
    timeout : int
        Timeout em segundos.
    out_jsonl : str
        Caminho do JSONL de saida.

    Returns
    -------
    None
        Executa o fluxo completo e nao retorna valor.
    """
    limits = httpx.Limits(max_keepalive_connections=0, max_connections=concurrency)
    timeout_cfg = httpx.Timeout(timeout)
    writer = JsonlWriter(out_jsonl)
    try:
        async with httpx.AsyncClient(
            limits=limits, timeout=timeout_cfg, headers={"User-Agent": USER_AGENT}
        ) as client:
            stats = await discover_by_ibge(client, concurrency=concurrency, timeout=timeout, writer=writer)
            logging.getLogger(__name__).info(
                "Concluido. Encontrados %s SAPLs. Candidatos testados: %s/%s. JSONL: %s",
                writer.count,
                stats.get("tested", 0),
                stats.get("total", 0),
                out_jsonl,
            )
    finally:
        writer.close()


def main() -> None:
    """Ponto de entrada do script.

    Returns
    -------
    None
        Executa a CLI e nao retorna valor.
    """
    args = build_parser().parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    try:
        asyncio.run(
            run(
                concurrency=args.concurrency,
                timeout=args.timeout,
                out_jsonl=args.out_jsonl,
            )
        )
    except KeyboardInterrupt:
        logging.getLogger(__name__).warning("Interrompido pelo usuario.")


if __name__ == "__main__":
    main()
