import asyncio
import logging
import re
import unicodedata
import json
from typing import Dict, List, Optional, Tuple, Callable, Awaitable

import httpx

from .config import (
    CHECK_PATHS,
    CRT_SH_QUERY,
    CRT_SH_QUERY_BASE,
    CRT_SH_PART_CHARS,
    IBGE_MUN_ENDPOINT,
    LINK_HINTS,
    SAPL_MARKERS,
    USER_AGENT,
)


logger = logging.getLogger(__name__)


def slugify(city: str) -> str:
    s = unicodedata.normalize("NFKD", city)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s-]", " ", s)
    s = re.sub(r"\s+", "", s)
    s = re.sub(r"-+", "", s)
    return s


async def fetch_json(client: httpx.AsyncClient, url: str) -> Optional[object]:
    try:
        r = await client.get(url, timeout=30)
    except Exception as exc:
        logger.warning("Falha em GET", extra={"url": url})
        logger.debug("Detalhes da falha em GET", exc_info=exc, extra={"url": url})
        return None

    if r.status_code != 200:
        logger.debug("Status não OK", extra={"url": url, "status": r.status_code})
        return None

    ct = r.headers.get("content-type", "")
    preview = (r.text or "")[:120]
    # Primeiro tenta interpretar como JSON padrão
    try:
        return r.json()
    except Exception as exc_json:
        # Fallback: alguns endpoints (ex.: crt.sh) retornam NDJSON (JSON por linha)
        text = r.text or ""
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        objs: List[object] = []
        ndjson_errors = 0
        for ln in lines:
            try:
                objs.append(json.loads(ln))
            except Exception:
                ndjson_errors += 1
        if objs and ndjson_errors == 0:
            logger.debug("Resposta tratada como NDJSON", extra={"url": url, "count": len(objs)})
            return objs

        # Último recurso: tenta embrulhar como array (se já vier objetos separados por nova linha/espaco)
        try:
            j = json.loads("[" + ",".join(lines) + "]") if lines else None
            if isinstance(j, list):
                logger.debug("Resposta tratada como JSON agregado", extra={"url": url, "count": len(j)})
                return j
        except Exception:
            pass

        # Não foi possível decodificar
        logger.warning(
            "Resposta não-JSON ou inválida",
            extra={"url": url, "status": r.status_code, "content_type": ct, "preview": preview[:120]},
        )
        logger.debug("Erro ao decodificar JSON", exc_info=exc_json, extra={"url": url})
        return None


async def try_get(client: httpx.AsyncClient, url: str) -> Tuple[int, str]:
    try:
        r = await client.get(url, follow_redirects=True, timeout=20, headers={"User-Agent": USER_AGENT})
        text = r.text[:20000] if r.text else ""
        logger.debug("GET", extra={"url": url, "status": r.status_code})
        return r.status_code, text
    except Exception as exc:
        logger.debug("Erro em GET", exc_info=exc, extra={"url": url})
        return 0, ""


def looks_like_sapl(html: str) -> Tuple[bool, str]:
    hit = ""
    low = (html or "").lower()
    for m in SAPL_MARKERS:
        if m.lower() in low:
            hit = m
            return True, hit
    m = re.search(r"<title>([^<]+)</title>", html or "", flags=re.I)
    if m and "sapl" in m.group(1).lower():
        return True, "title contains SAPL"
    return False, ""


def build_candidates(host: str) -> List[str]:
    return [f"https://{host}{path}" for path in CHECK_PATHS]


async def validate_host(client: httpx.AsyncClient, host: str) -> Optional[Tuple[str, int, str, str]]:
    for url in build_candidates(host):
        status, html = await try_get(client, url)
        if status == 200:
            ok, marker = looks_like_sapl(html)
            if ok:
                title = ""
                m = re.search(r"<title>([^<]+)</title>", html or "", flags=re.I)
                if m:
                    title = m.group(1).strip()
                logger.info(
                    "SAPL confirmado",
                    extra={"host": host, "url": url, "status": status, "marker": marker},
                )
                return (url, status, marker, title)
    logger.debug("Host não confirmou SAPL", extra={"host": host})
    return None


def dedupe_results(rows: List[Dict]) -> List[Dict]:
    seen = set()
    out = []
    for r in rows:
        key = r.get("sapl_url")
        if key and key not in seen:
            seen.add(key)
            out.append(r)
    return out


async def discover_by_ibge(
    client: httpx.AsyncClient,
    concurrency: int,
    on_found: Optional[Callable[[Dict], Awaitable[None]]] = None,
) -> List[Dict]:
    logger.info("[A] Baixando municípios do IBGE ...", extra={"strategy": "ibge"})
    data = await fetch_json(client, IBGE_MUN_ENDPOINT)
    if not data:
        logger.error("[A] Falha ao baixar municípios do IBGE", extra={"strategy": "ibge"})
        return []

    logger.info("[A] Total de municípios carregados: %s", len(data))

    sem = asyncio.Semaphore(concurrency)
    results: List[Dict] = []

    async def worker(item):
        nome = item.get("nome", "")
        uf = (item.get("microrregiao", {}) or {}).get("mesorregiao", {}).get("UF", {})
        sigla = uf.get("sigla", "")
        if not nome or not sigla:
            return
        slug = slugify(nome)
        host = f"sapl.{slug}.{sigla.lower()}.leg.br"
        async with sem:
            v = await validate_host(client, host)
        if v:
            url, status, marker, title = v
            item_row = {
                    "ibge_id": item.get("id", ""),
                    "municipio": nome,
                    "uf": sigla,
                    "source": "ibge-heuristic",
                    "sapl_url": url,
                    "http_status": status,
                    "marker": marker,
                    "title": title,
                }
            results.append(item_row)
            if on_found:
                await on_found(item_row)

        base_host = f"{slug}.{sigla.lower()}.leg.br"
        async with sem:
            v2 = await validate_host(client, base_host)
        if v2:
            url, status, marker, title = v2
            item_row = {
                    "ibge_id": item.get("id", ""),
                    "municipio": nome,
                    "uf": sigla,
                    "source": "base-host-endpoint",
                    "sapl_url": url,
                    "http_status": status,
                    "marker": marker,
                    "title": title,
                }
            results.append(item_row)
            if on_found:
                await on_found(item_row)
        else:
            home_url = f"https://{base_host}/"
            status_h, html = await try_get(client, home_url)
            if status_h in (200, 301, 302) and html:
                hrefs = set(re.findall(r'href=["\']([^"\']+)["\']', html, flags=re.I))
                candidates = []
                for h in hrefs:
                    if any(hint in h for hint in LINK_HINTS):
                        if h.startswith("http"):
                            candidates.append(h)
                        elif h.startswith("//"):
                            candidates.append("https:" + h)
                        elif h.startswith("/"):
                            candidates.append("https://" + base_host + h)
                        else:
                            candidates.append("https://" + base_host + "/" + h.lstrip("./"))
                for cand in sorted(set(candidates)):
                    if "materia/pesquisar-materia" not in cand:
                        if cand.rstrip("/").endswith("/sapl"):
                            cand = cand.rstrip("/") + "/materia/pesquisar-materia"
                    status_c, html_c = await try_get(client, cand)
                    if status_c == 200:
                        ok, marker = looks_like_sapl(html_c)
                        if ok:
                            title = ""
                            m = re.search(r"<title>([^<]+)</title>", html_c or "", flags=re.I)
                            if m:
                                title = m.group(1).strip()
                            item_row = {
                                    "ibge_id": item.get("id", ""),
                                    "municipio": nome,
                                    "uf": sigla,
                                    "source": "portal-link-scan",
                                    "sapl_url": cand,
                                    "http_status": status_c,
                                    "marker": marker,
                                    "title": title,
                                }
                            results.append(item_row)
                            if on_found:
                                await on_found(item_row)
                            logger.info(
                                "SAPL via portal link",
                                extra={
                                    "strategy": "ibge",
                                    "source": "portal-link-scan",
                                    "municipio": nome,
                                    "uf": sigla,
                                    "url": cand,
                                },
                            )
                            break

    await asyncio.gather(*(worker(item) for item in data))
    return dedupe_results(results)


async def discover_by_crtsh(
    client: httpx.AsyncClient,
    concurrency: int,
    on_found: Optional[Callable[[Dict], Awaitable[None]]] = None,
    on_candidate: Optional[Callable[[str, str], Awaitable[None]]] = None,
) -> List[Dict]:
    logger.info("[B] Consultando crt.sh ...", extra={"strategy": "crtsh"})

    async def query_crtsh(pattern: str) -> List[Dict]:
        """Consulta crt.sh para um padrão, com retries e parse robusto."""
        url = CRT_SH_QUERY_BASE + pattern
        backoff = 1.5
        for attempt in range(5):
            js_any = await fetch_json(client, url)
            if js_any:
                if isinstance(js_any, list):
                    return js_any  # já ok
                # às vezes vem um objeto único
                return [js_any]
            status_f, text_f = await try_get(client, url)
            if status_f == 200 and text_f:
                # NDJSON
                lines = [ln.strip() for ln in text_f.splitlines() if ln.strip()]
                parsed_rows: List[Dict] = []
                ndjson_ok = True
                for ln in lines:
                    try:
                        obj = json.loads(ln)
                        if isinstance(obj, dict):
                            parsed_rows.append(obj)
                        elif isinstance(obj, list):
                            parsed_rows.extend([x for x in obj if isinstance(x, dict)])
                    except Exception:
                        ndjson_ok = False
                        break
                if parsed_rows and ndjson_ok:
                    return parsed_rows

                # Regex fallback do HTML
                hosts_from_html = set(re.findall(r"\bsapl\.[a-z0-9\.-]+\.leg\.br\b", text_f, flags=re.I))
                if hosts_from_html:
                    return [{"name_value": h} for h in sorted(hosts_from_html)]

            # 503/429 ou vazio: espera com backoff
            if status_f in (429, 503) or attempt < 4:
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 20)
                continue
            break
        return []

    # Estratégia: particionar consultas por primeiro caractere após 'sapl.' para reduzir carga
    patterns = [f"sapl.{ch}%25" for ch in CRT_SH_PART_CHARS]
    all_rows: List[Dict] = []
    emitted_candidates = set()
    for p in patterns:
        rows = await query_crtsh(p)
        if rows:
            logger.info("[B] crt.sh chunk '%s' => %s linhas", p, len(rows))
            # Emite candidatos '.leg.br' deste chunk
            if on_candidate:
                try:
                    names_p: List[str] = []
                    for row in rows:
                        nv = row.get("name_value", "")
                        if not nv:
                            continue
                        names_p.extend([n.strip() for n in nv.split("\n") if n.strip()])
                    for host in sorted({n for n in names_p if n.endswith('.leg.br')}):
                        if host not in emitted_candidates:
                            emitted_candidates.add(host)
                            await on_candidate(host, p)
                except Exception:
                    pass
            all_rows.extend(rows)

    # Se nada veio das partições, tenta a consulta ampla como último recurso
    if not all_rows:
        logger.info("[B] Tentando consulta ampla única ao crt.sh", extra={"strategy": "crtsh"})
        p = "sapl.%25"
        all_rows = await query_crtsh(p)
        # Emite candidatos para a consulta ampla
        if all_rows and on_candidate:
            try:
                names_p: List[str] = []
                for row in all_rows:
                    nv = row.get("name_value", "")
                    if not nv:
                        continue
                    names_p.extend([n.strip() for n in nv.split("\n") if n.strip()])
                for host in sorted({n for n in names_p if n.endswith('.leg.br')}):
                    if host not in emitted_candidates:
                        emitted_candidates.add(host)
                        await on_candidate(host, p)
            except Exception:
                pass
        if not all_rows:
            logger.error("[B] Falha ao consultar crt.sh", extra={"strategy": "crtsh"})
            return []
    raw_names: List[str] = []
    for row in all_rows:
        nv = row.get("name_value", "")
        if not nv:
            continue
        raw_names.extend([n.strip() for n in nv.split("\n") if n.strip()])

    hosts = sorted({n for n in raw_names if n.startswith("sapl.") and n.endswith(".leg.br")})
    logger.info("[B] Possíveis hosts do CT: %s", len(hosts))

    # Emite candidatos em tempo real, se solicitado
    if on_candidate:
        for h in hosts:
            try:
                await on_candidate(h, "sapl.%25")
            except Exception:
                pass

    sem = asyncio.Semaphore(concurrency)
    results: List[Dict] = []

    async def worker(host: str):
        async with sem:
            v = await validate_host(client, host)
        if v:
            url, status, marker, title = v
            item_row = {
                    "ibge_id": "",
                    "municipio": "",
                    "uf": "",
                    "source": "crtsh",
                    "sapl_url": url,
                    "http_status": status,
                    "marker": marker,
                    "title": title,
                }
            results.append(item_row)
            if on_found:
                await on_found(item_row)

    await asyncio.gather(*(worker(h) for h in hosts))
    return dedupe_results(results)
