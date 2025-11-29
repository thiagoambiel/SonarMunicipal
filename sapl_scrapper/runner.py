import asyncio
import json
import logging
import os
from typing import Any, Dict, Optional

import httpx

from .output import PLWriter
from .scraper import base_from_sapl_url, collect_pls_for_base


async def _scrape_one(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    item: Dict[str, Any],
    writer: PLWriter,
    page_size: int,
    with_tramitacao: bool,
) -> None:
    url: str = item.get("sapl_url") or ""
    if not url:
        return
    base = base_from_sapl_url(url)
    municipio = item.get("municipio", "")
    uf = item.get("uf", "")
    logging.getLogger(__name__).info(
        "[PL] Alvo carregado",
        extra={"sapl_url": base, "municipio": municipio, "uf": uf},
    )
    async with sem:
        async for row in collect_pls_for_base(
            client,
            base,
            municipio=municipio,
            uf=uf,
            page_size=page_size,
            with_tramitacao=with_tramitacao,
        ):
            await writer.emit(row)


async def run_scrape(
    in_jsonl: str,
    out_csv: str,
    out_json: str,
    concurrency: int,
    timeout: httpx.Timeout,
    page_size: int,
    with_tramitacao: bool,
) -> None:
    if not os.path.exists(in_jsonl):
        raise FileNotFoundError(f"Arquivo de entrada não encontrado: {in_jsonl}")

    # Saída incremental
    jsonl_path = out_json[:-5] + ".jsonl" if out_json.endswith(".json") else out_json + ".jsonl"
    writer = PLWriter(out_csv=out_csv, out_jsonl=jsonl_path)

    limits = httpx.Limits(max_keepalive_connections=0, max_connections=concurrency)
    async with httpx.AsyncClient(limits=limits, timeout=timeout, headers={"User-Agent": "SAPL-PL-Scrapper/1.0"}) as client:
        sem = asyncio.Semaphore(concurrency)

        tasks = []
        with open(in_jsonl, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    item = json.loads(line)
                except Exception:
                    continue
                tasks.append(
                    asyncio.create_task(
                        _scrape_one(
                            client,
                            sem,
                            item,
                            writer,
                            page_size=page_size,
                            with_tramitacao=with_tramitacao,
                        )
                    )
                )

        # Executa todas as coletas
        if tasks:
            await asyncio.gather(*tasks)

    # Finaliza agregados
    writer.finalize_json(out_json)
    logging.getLogger(__name__).info(
        "[OK] Extração concluída. Registros: %s | CSV: %s | JSON: %s | JSONL: %s",
        len(writer.rows),
        out_csv,
        out_json,
        jsonl_path,
    )
    writer.close()

