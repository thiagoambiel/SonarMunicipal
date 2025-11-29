import argparse
import asyncio
import logging
from typing import Dict, List

import httpx

from .logging_config import setup_logging
from .output import ProgressWriter, CandidatesWriter
from .scraper import discover_by_crtsh, discover_by_ibge, dedupe_results
from .config import USER_AGENT


async def run_async(
    strategy: str,
    concurrency: int,
    timeout: int,
    out_csv: str,
    out_json: str,
) -> None:
    limits = httpx.Limits(max_keepalive_connections=0, max_connections=concurrency)
    timeout_cfg = httpx.Timeout(timeout)
    async with httpx.AsyncClient(limits=limits, timeout=timeout_cfg, headers={"User-Agent": USER_AGENT}) as client:
        # Escrita incremental durante scraping
        jsonl_path = out_json[:-5] + ".jsonl" if out_json.endswith(".json") else out_json + ".jsonl"
        writer = ProgressWriter(out_csv=out_csv, out_jsonl=jsonl_path)
        # Candidatos do crt.sh: sempre ativo quando a estratégia inclui crtsh
        cand_writer: CandidatesWriter | None = None
        if strategy in ("crtsh", "all"):
            cand_jsonl = out_json[:-5] + "_candidates.jsonl" if out_json.endswith(".json") else out_json + "_candidates.jsonl"
            cand_writer = CandidatesWriter(out_jsonl=cand_jsonl)
        try:
            if strategy in ("ibge", "all"):
                await discover_by_ibge(client, concurrency, on_found=writer.on_found)
            if strategy in ("crtsh", "all"):
                async def on_cand(host: str, pattern: str):
                    if cand_writer:
                        await cand_writer.emit(host, pattern)
                await discover_by_crtsh(client, concurrency, on_found=writer.on_found, on_candidate=on_cand)
            # Gera JSON final agregado ao término
            writer.finalize_json(out_json)
            logging.getLogger(__name__).info(
                "[OK] Encontrados %s endpoints SAPL válidos. CSV: %s JSON: %s JSONL: %s",
                len(writer.rows),
                out_csv,
                out_json,
                jsonl_path,
            )
        finally:
            writer.close()
            if cand_writer:
                cand_writer.close()


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="Descobrir instâncias SAPL no Brasil")
    ap.add_argument("--strategy", choices=["ibge", "crtsh", "all"], default="all", help="Rota de descoberta")
    ap.add_argument("--concurrency", type=int, default=100, help="Conexões simultâneas (padrão: 100)")
    ap.add_argument("--timeout", type=int, default=20, help="Timeout de requisições em segundos (padrão: 20)")
    ap.add_argument("--out-csv", default="sapl_hosts.csv", help="Arquivo CSV de saída")
    ap.add_argument("--out-json", default="sapl_hosts.json", help="Arquivo JSON de saída")

    # logging
    ap.add_argument("--log-level", default="INFO", help="Nível de log (DEBUG, INFO, WARNING, ERROR)")
    ap.add_argument("--log-file", default="logs/sapl_finder.log", help="Arquivo de log com rotação (ou vazio para desabilitar)")
    ap.add_argument("--log-json", action="store_true", help="Emite logs em JSON (console/arquivo)")
    return ap


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    setup_logging(level=args.log_level, log_file=(args.log_file or None), json_logs=args.log_json)
    try:
        asyncio.run(
            run_async(
                strategy=args.strategy,
                concurrency=args.concurrency,
                timeout=args.timeout,
                out_csv=args.out_csv,
                out_json=args.out_json,
            )
        )
    except KeyboardInterrupt:
        logging.getLogger(__name__).warning("Interrompido pelo usuário.")


if __name__ == "__main__":
    main()
