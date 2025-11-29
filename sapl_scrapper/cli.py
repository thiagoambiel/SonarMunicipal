import argparse
import asyncio
import logging
from typing import Optional

import httpx

from sapl_finder.logging_config import setup_logging

from .runner import run_scrape


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="Extrai Projetos de Lei (PL) de múltiplos SAPLs")
    ap.add_argument("--in-jsonl", default="sapl_hosts.jsonl", help="Arquivo JSONL gerado pelo sapl_finder")
    ap.add_argument("--out-csv", default="pl.csv", help="Arquivo CSV de saída com PLs")
    ap.add_argument("--out-json", default="pl.json", help="Arquivo JSON agregado de saída com PLs")
    ap.add_argument("--concurrency", type=int, default=20, help="Conexões simultâneas (padrão: 20)")
    ap.add_argument("--timeout", type=int, default=30, help="Timeout de requisições em segundos (padrão: 30)")
    ap.add_argument("--page-size", type=int, default=100, help="page_size para paginação na API (padrão: 100)")
    ap.add_argument("--no-tramitacao", action="store_true", help="Não consultar ultima_tramitacao para cada matéria")

    # logging
    ap.add_argument("--log-level", default="INFO", help="Nível de log (DEBUG, INFO, WARNING, ERROR)")
    ap.add_argument("--log-file", default="logs/sapl_scrapper.log", help="Arquivo de log com rotação (ou vazio para desabilitar)")
    ap.add_argument("--log-json", action="store_true", help="Emite logs em JSON (console/arquivo)")
    return ap


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    setup_logging(level=args.log_level, log_file=(args.log_file or None), json_logs=args.log_json)

    # HTTPX client
    limits = httpx.Limits(max_keepalive_connections=0, max_connections=args.concurrency)
    timeout_cfg = httpx.Timeout(args.timeout)

    try:
        asyncio.run(
            run_scrape(
                in_jsonl=args.in_jsonl,
                out_csv=args.out_csv,
                out_json=args.out_json,
                concurrency=args.concurrency,
                timeout=timeout_cfg,
                page_size=args.page_size,
                with_tramitacao=(not args.no_tramitacao),
            )
        )
    except KeyboardInterrupt:
        logging.getLogger(__name__).warning("Interrompido pelo usuário.")


if __name__ == "__main__":
    main()

