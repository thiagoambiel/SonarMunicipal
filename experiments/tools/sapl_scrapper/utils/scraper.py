import logging
import re
import unicodedata
from typing import Any, AsyncIterator, Dict, List, Optional
from urllib.parse import urljoin

import httpx


logger = logging.getLogger("sapl_scrapper.scraper")


def base_from_sapl_url(url: str) -> str:
    """Extrai a base do SAPL a partir de uma URL conhecida.

    Parameters
    ----------
    url : str
        URL de referencia detectada pelo sapl_finder.

    Returns
    -------
    str
        Base da instancia SAPL, preservando o sufixo /sapl quando existir.
    """
    try:
        match = re.match(r"^(https?://[^/]+)(/.*)?$", url)
        if not match:
            return url.rstrip("/")
        root, path = match.group(1), (match.group(2) or "")
        idx = path.find("/materia/")
        base_prefix = path[:idx] if idx >= 0 else path
        return (root + base_prefix).rstrip("/")
    except Exception:
        return url.rstrip("/")


def normalize_text(txt: Optional[str]) -> str:
    """Normaliza texto para comparacao de rotulos.

    Parameters
    ----------
    txt : str or None
        Texto original.

    Returns
    -------
    str
        Texto em minusculas, sem acentos e sem pontuacao.
    """
    raw = unicodedata.normalize("NFKD", (txt or ""))
    raw = raw.encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", raw)


async def try_json(client: httpx.AsyncClient, url: str, params: Optional[Dict[str, Any]] = None) -> Optional[Any]:
    """Faz uma requisicao GET e tenta retornar JSON.

    Parameters
    ----------
    client : httpx.AsyncClient
        Cliente HTTP configurado.
    url : str
        URL do recurso.
    params : dict or None
        Parametros de query string.

    Returns
    -------
    object or None
        JSON parseado quando a resposta eh valida, caso contrario None.
    """
    try:
        resp = await client.get(url, params=params or {})
        if resp.status_code != 200:
            logger.debug("Status nao OK", extra={"url": url, "status": resp.status_code})
            return None
        return resp.json()
    except Exception as exc:
        logger.debug("Falha GET JSON", exc_info=exc, extra={"url": url})
        return None


async def pick_matter_endpoint(client: httpx.AsyncClient, base: str) -> Optional[str]:
    """Descobre o endpoint de materias disponivel na instancia.

    Parameters
    ----------
    client : httpx.AsyncClient
        Cliente HTTP configurado.
    base : str
        Base do SAPL.

    Returns
    -------
    str or None
        URL do endpoint de materias encontrado, ou None se nenhum responder.
    """
    for path in ("/api/materia/", "/api/materia/materialegislativa/"):
        url = base.rstrip("/") + path
        js = await try_json(client, url, params={"page_size": 1})
        if js is not None:
            return url
    return None


async def list_pl_types(client: httpx.AsyncClient, base: str) -> List[Dict[str, Any]]:
    """Lista tipos de materia legislativa que correspondem a projetos de lei.

    Parameters
    ----------
    client : httpx.AsyncClient
        Cliente HTTP configurado.
    base : str
        Base do SAPL.

    Returns
    -------
    list of dict
        Lista com itens no formato {"id": ..., "rotulo": "..."}.
    """
    url = base.rstrip("/") + "/api/materia/tipomaterialegislativa/"
    tipos: List[Dict[str, Any]] = []
    page_url: Optional[str] = url
    page_params: Dict[str, Any] = {"page_size": 500}
    base_url = url

    while page_url:
        try:
            resp = await client.get(page_url, params=page_params)
            if resp.status_code != 200:
                break
            data = resp.json()
        except Exception:
            break

        if isinstance(data, dict) and "results" in data:
            tipos.extend([x for x in data.get("results", []) if isinstance(x, dict)])

            next_url: Optional[str] = None
            pag = data.get("pagination") or {}
            links = pag.get("links") or {}
            if links.get("next"):
                next_url = urljoin(page_url, links.get("next"))

            if not next_url:
                nxt = data.get("next")
                if isinstance(nxt, str) and nxt:
                    next_url = urljoin(page_url, nxt)

            if not next_url:
                try:
                    np = (data.get("pagination") or {}).get("next_page")
                    if np:
                        next_url = f"{base_url}"
                        page_params = {"page_size": page_params.get("page_size", 500), "page": int(np)}
                except Exception:
                    pass

            if next_url:
                page_url = next_url
                if "?" in next_url:
                    page_params = {}
            else:
                page_url = None
        elif isinstance(data, list):
            tipos.extend([x for x in data if isinstance(x, dict)])
            page_url = None
        else:
            break

    out: List[Dict[str, Any]] = []
    for tipo in tipos:
        label = " ".join(str(tipo.get(k, "")) for k in ("sigla", "descricao", "nome"))
        if "projeto de lei" in normalize_text(label):
            out.append({"id": tipo.get("id") or tipo.get("pk"), "rotulo": label})
    return out


async def pager(client: httpx.AsyncClient, url: str, params: Dict[str, Any]) -> AsyncIterator[Dict[str, Any]]:
    """Itera sobre paginas do SAPL e emite cada materia.

    Parameters
    ----------
    client : httpx.AsyncClient
        Cliente HTTP configurado.
    url : str
        URL base do recurso de materias.
    params : dict
        Parametros da primeira pagina (tipo, page_size, etc).

    Yields
    ------
    dict
        Materia legislativa retornada pela API.
    """
    base_url = url
    base_params = dict(params)
    page_url = base_url
    page_params = dict(base_params)
    last_sig: Optional[Tuple[str, Tuple[Tuple[str, Any], ...]]] = None

    while True:
        try:
            resp = await client.get(page_url, params=page_params)
            if resp.status_code != 200:
                return
            data = resp.json()
        except Exception:
            return

        if isinstance(data, dict) and "results" in data:
            for item in data.get("results", []) or []:
                if isinstance(item, dict):
                    yield item

            next_page_val = None
            pag = data.get("pagination") or {}
            try:
                np = pag.get("next_page")
                if isinstance(np, int) or (isinstance(np, str) and np):
                    next_page_val = int(np)
            except Exception:
                next_page_val = None

            if next_page_val:
                page_url = base_url
                page_params = dict(base_params)
                page_params["page"] = next_page_val
            else:
                next_url: Optional[str] = None
                links = pag.get("links") or {}
                if links.get("next"):
                    next_url = urljoin(page_url, links.get("next"))
                if not next_url:
                    nxt = data.get("next")
                    if isinstance(nxt, str) and nxt:
                        next_url = urljoin(page_url, nxt)

                if next_url:
                    page_url = next_url
                    page_params = {}
                else:
                    return

            sig = (page_url, tuple(sorted(page_params.items())))
            if sig == last_sig:
                logger.warning("Loop de paginacao detectado; interrompendo.", extra={"url": page_url})
                return
            last_sig = sig
            continue
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    yield item
            return
        return


def build_public_link(base: str, materia_id: Any) -> str:
    """Monta o link publico de acompanhamento da materia.

    Parameters
    ----------
    base : str
        Base do SAPL.
    materia_id : Any
        Identificador da materia.

    Returns
    -------
    str
        URL publica para acompanhamento da materia.
    """
    return f"{base.rstrip('/')}/materia/{materia_id}/acompanhar-materia/"


async def collect_pls_for_base(
    client: httpx.AsyncClient,
    base: str,
    municipio: str,
    uf: str,
    ibge_id: Optional[Any] = None,
    page_size: int = 100,
) -> AsyncIterator[Dict[str, Any]]:
    """Coleta todos os PLs de uma instancia SAPL.

    Parameters
    ----------
    client : httpx.AsyncClient
        Cliente HTTP configurado.
    base : str
        Base do SAPL.
    municipio : str
        Nome do municipio (para contexto no output).
    uf : str
        UF do municipio (para contexto no output).
    ibge_id : Any, optional
        Identificador IBGE do municipio (para contexto no output).
    page_size : int, optional
        Tamanho da pagina na API do SAPL.

    Yields
    ------
    dict
        Registro completo da materia com campos prontos para o CSV.
    """
    logger.info("Iniciando extracao", extra={"sapl_url": base, "municipio": municipio, "uf": uf})
    materias_endpoint = await pick_matter_endpoint(client, base)
    if not materias_endpoint:
        logger.warning("Endpoint de materias nao encontrado", extra={"sapl_url": base})
        return

    tipos = await list_pl_types(client, base)
    logger.info("Tipos PL identificados: %s", len(tipos), extra={"sapl_url": base})

    for tipo in tipos:
        tipo_id = tipo.get("id")
        tipo_label = tipo.get("rotulo", "")
        if not tipo_id:
            continue
        logger.info(
            "Coletando materias do tipo",
            extra={"sapl_url": base, "tipo_id": tipo_id, "tipo_label": tipo_label},
        )
        params = {"tipo": tipo_id, "page_size": page_size}
        async for materia in pager(client, materias_endpoint, params):
            mid = materia.get("id")
            row: Dict[str, Any] = {
                "municipio": municipio,
                "uf": uf,
                "ibge_id": ibge_id,
                "ementa": materia.get("ementa") or materia.get("observacao"),
                "data_apresentacao": materia.get("data_apresentacao") or materia.get("data_recebimento"),
                "link_publico": build_public_link(base, mid) if mid is not None else "",
            }

            yield row
