import asyncio
import logging
import re
import unicodedata
from typing import Any, AsyncIterator, Dict, Iterable, List, Optional, Tuple

import httpx


logger = logging.getLogger(__name__)


def base_from_sapl_url(url: str) -> str:
    """Extrai a base da aplicação SAPL a partir de uma URL detectada.

    Exemplos:
      - https://host/materia/pesquisar-materia -> https://host
      - https://host/sapl/materia/pesquisar-materia -> https://host/sapl
    """
    try:
        # separa em protocolo + resto
        m = re.match(r"^(https?://[^/]+)(/.*)?$", url)
        if not m:
            return url.rstrip("/")
        root, path = m.group(1), (m.group(2) or "")
        idx = path.find("/materia/")
        if idx >= 0:
            base_prefix = path[:idx]
        else:
            # fallback: se terminar com '/sapl' já está correto
            base_prefix = path
        return (root + base_prefix).rstrip("/")
    except Exception:
        return url.rstrip("/")


def norm(txt: Optional[str]) -> str:
    s = unicodedata.normalize("NFKD", (txt or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", s)


async def try_json(client: httpx.AsyncClient, url: str, params: Optional[Dict[str, Any]] = None) -> Optional[Any]:
    try:
        r = await client.get(url, params=params or {}, timeout=30)
        if r.status_code != 200:
            logger.debug("Status não OK", extra={"url": url, "status": r.status_code})
            return None
        return r.json()
    except Exception as exc:
        logger.debug("Falha GET JSON", exc_info=exc, extra={"url": url})
        return None


async def pick_materia_endpoint(client: httpx.AsyncClient, base: str) -> Optional[str]:
    for path in ("/api/materia/", "/api/materia/materialegislativa/"):
        u = base.rstrip("/") + path
        js = await try_json(client, u, params={"page_size": 1})
        if js is not None:
            return u
    return None


async def list_tipos_pl(client: httpx.AsyncClient, base: str) -> List[Dict[str, Any]]:
    from urllib.parse import urljoin

    url = base.rstrip("/") + "/api/materia/tipomaterialegislativa/"
    tipos: List[Dict[str, Any]] = []
    page_url: Optional[str] = url
    page_params: Dict[str, Any] = {"page_size": 500}
    base_url = url

    while page_url:
        try:
            r = await client.get(page_url, params=page_params, timeout=30)
            if r.status_code != 200:
                break
            data = r.json()
        except Exception:
            break

        if isinstance(data, dict) and "results" in data:
            tipos.extend([x for x in data.get("results", []) if isinstance(x, dict)])
            # Suporta paginação no estilo DRF e no estilo 'pagination' do SAPL
            next_url: Optional[str] = None
            # 1) Estilo novo: data['pagination']['links']['next']
            try:
                pag = data.get("pagination") or {}
                links = pag.get("links") or {}
                if links.get("next"):
                    next_url = urljoin(page_url, links.get("next"))
            except Exception:
                pass
            # 2) Estilo DRF clássico: data['next']
            if not next_url:
                nxt = data.get("next")
                if isinstance(nxt, str) and nxt:
                    next_url = urljoin(page_url, nxt)
            # 3) Estilo 'next_page' numérico
            if not next_url:
                try:
                    np = (data.get("pagination") or {}).get("next_page")
                    if np:
                        next_url = f"{base_url}"
                        page_params = {"page_size": page_params.get("page_size", 500), "page": np}
                except Exception:
                    pass
            if next_url:
                page_url = next_url
                # quando next_url já tem query, limpamos params
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
    for t in tipos:
        label = " ".join(str(t.get(k, "")) for k in ("sigla", "descricao", "nome"))
        lab = norm(label)
        if "projeto de lei" in lab:
            out.append({"id": t.get("id") or t.get("pk"), "rotulo": label})
    return out


async def pager(client: httpx.AsyncClient, url: str, params: Dict[str, Any]) -> AsyncIterator[Dict[str, Any]]:
    from urllib.parse import urljoin

    base_url = url
    base_params = dict(params)
    page_url = base_url
    page_params = dict(base_params)
    last_sig: Optional[tuple] = None

    while True:
        try:
            r = await client.get(page_url, params=page_params, timeout=60)
            if r.status_code != 200:
                return
            data = r.json()
        except Exception:
            return

        # Emite itens desta página
        if isinstance(data, dict) and "results" in data:
            for it in data.get("results", []) or []:
                if isinstance(it, dict):
                    yield it

            # Determina próxima página com prioridade para o contador numérico
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
                # Tenta links de próxima página (relativo/absoluto)
                next_url: Optional[str] = None
                try:
                    links = pag.get("links") or {}
                    if links.get("next"):
                        next_url = urljoin(page_url, links.get("next"))
                except Exception:
                    pass
                if not next_url:
                    nxt = data.get("next")
                    if isinstance(nxt, str) and nxt:
                        next_url = urljoin(page_url, nxt)

                if next_url:
                    page_url = next_url
                    # Quando a URL já contém query string, usamos a URL diretamente
                    page_params = {}
                else:
                    return

            # Guarda assinatura para evitar loops (mesmo alvo + mesmos params)
            sig = (page_url, tuple(sorted(page_params.items())))
            if sig == last_sig:
                logger.warning("Loop de paginação detectado; interrompendo.", extra={"url": page_url})
                return
            last_sig = sig

            continue
        elif isinstance(data, list):
            for it in data:
                if isinstance(it, dict):
                    yield it
            return
        else:
            return


async def ultima_tramitacao(client: httpx.AsyncClient, base: str, materia_id: Any) -> Dict[str, Any]:
    url = f"{base.rstrip('/')}/api/materia/materialegislativa/{materia_id}/ultima_tramitacao/"
    try:
        r = await client.get(url, timeout=20)
        if r.status_code != 200:
            return {}
        js = r.json()
        return js if isinstance(js, dict) else {}
    except Exception:
        return {}


def build_link_publico(base: str, materia_id: Any) -> str:
    return f"{base.rstrip('/')}/materia/{materia_id}/acompanhar-materia/"


def extract_tramitacao_fields(tram: Dict[str, Any]) -> Tuple[str, str]:
    """Extrai campos amigáveis para CSV a partir da última tramitação."""
    data = ""
    status = ""
    # Campos variam por versão; tentamos chaves comuns
    for k in ("data_tramitacao", "data", "data_registro"):
        v = tram.get(k)
        if isinstance(v, str) and v:
            data = v
            break
    for k in ("status", "texto", "descricao"):
        v = tram.get(k)
        if isinstance(v, str) and v:
            status = v
            break
    return data, status


async def collect_pls_for_base(
    client: httpx.AsyncClient,
    base: str,
    municipio: str,
    uf: str,
    page_size: int = 100,
    with_tramitacao: bool = True,
) -> AsyncIterator[Dict[str, Any]]:
    logger.info("[PL] Iniciando extração", extra={"sapl_url": base, "municipio": municipio, "uf": uf})
    materias_endpoint = await pick_materia_endpoint(client, base)
    if not materias_endpoint:
        logger.warning("Endpoint de matérias não encontrado", extra={"sapl_url": base})
        return

    tipos = await list_tipos_pl(client, base)
    logger.info(
        "Tipos PL identificados: %s",
        len(tipos),
        extra={"sapl_url": base, "count": len(tipos)},
    )

    for tp in tipos:
        tipo_id = tp.get("id")
        tipo_label = tp.get("rotulo", "")
        if not tipo_id:
            continue
        logger.info(
            "Coletando matérias do tipo",
            extra={"sapl_url": base, "tipo_id": tipo_id, "tipo_label": tipo_label},
        )
        # Sem parâmetro de ordenação por padrão para evitar bugs de paginação
        params = {"tipo": tipo_id, "page_size": page_size}
        async for m in pager(client, materias_endpoint, params):
            mid = m.get("id")
            row: Dict[str, Any] = {
                "sapl_base": base,
                "sapl_url": base,  # mantemos sapl_url igual à base para consistência
                "municipio": municipio,
                "uf": uf,
                "tipo_id": tipo_id,
                "tipo_label": tipo_label,
                "materia_id": mid,
                "numero": m.get("numero"),
                "ano": m.get("ano"),
                "ementa": m.get("ementa") or m.get("observacao"),
                "data_apresentacao": m.get("data_apresentacao") or m.get("data_recebimento"),
                "em_tramitacao": m.get("em_tramitacao"),
                "situacao": m.get("status") or m.get("situacao"),
                "link_publico": build_link_publico(base, mid) if mid is not None else "",
            }

            if with_tramitacao and mid is not None:
                tram = await ultima_tramitacao(client, base, mid)
                row["ultima_tramitacao"] = tram
                d, st = extract_tramitacao_fields(tram)
                if d:
                    row["ultima_tramitacao_data"] = d
                if st:
                    row["ultima_tramitacao_status"] = st

            yield row
