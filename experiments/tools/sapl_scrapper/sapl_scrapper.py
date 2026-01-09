import argparse
import asyncio
import json
import logging
import os
from typing import Any, Dict, Iterable

import httpx

from output import JsonlWriter
from scraper import base_from_sapl_url, collect_pls_for_base


logger = logging.getLogger("sapl_scrapper")


def setup_logging(level: str) -> None:
    """Configura o logging basico do script.

    Parameters
    ----------
    level : str
        Nivel do log (DEBUG, INFO, WARNING, ERROR, CRITICAL).

    Returns
    -------
    None
        Configura o logging global e nao retorna valor.
    """
    normalized = (level or "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, normalized, logging.INFO),
        format="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)


def build_parser() -> argparse.ArgumentParser:
    """Monta o parser de argumentos da linha de comando.

    Returns
    -------
    argparse.ArgumentParser
        Parser configurado para o script.
    """
    parser = argparse.ArgumentParser(description="Extrai Projetos de Lei (PL) de instancias SAPL")
    parser.add_argument("--in-jsonl", default="sapl_hosts.jsonl", help="Arquivo JSONL do sapl_finder")
    parser.add_argument("--out-jsonl", default="pl.jsonl", help="Arquivo JSONL de saida")
    parser.add_argument("--concurrency", type=int, default=20, help="Numero de bases processadas em paralelo")
    parser.add_argument("--timeout", type=int, default=30, help="Timeout das requisicoes em segundos")
    parser.add_argument("--page-size", type=int, default=100, help="page_size usado na API do SAPL")
    parser.add_argument("--no-tramitacao", action="store_true", help="Nao consultar ultima tramitacao")
    parser.add_argument("--log-level", default="INFO", help="Nivel de log (DEBUG, INFO, WARNING, ERROR)")
    return parser


def load_inputs(path: str) -> Iterable[Dict[str, Any]]:
    """Carrega as entradas a partir de um arquivo JSONL.

    Parameters
    ----------
    path : str
        Caminho do arquivo JSONL do sapl_finder.

    Returns
    -------
    iterable of dict
        Iterador com registros de entrada.

    Raises
    ------
    FileNotFoundError
        Se o arquivo nao existir.
    ValueError
        Se o arquivo nao tiver extensao .jsonl.
    """
    if not path.lower().endswith(".jsonl"):
        raise ValueError("O arquivo de entrada deve ser JSONL (.jsonl).")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Arquivo de entrada nao encontrado: {path}")

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
            except Exception:
                continue
            if isinstance(item, dict):
                yield item


async def scrape_base(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    item: Dict[str, Any],
    writer: JsonlWriter,
    page_size: int,
    with_tramitacao: bool,
) -> None:
    """Raspa uma unica base SAPL a partir de um item do sapl_finder.

    Parameters
    ----------
    client : httpx.AsyncClient
        Cliente HTTP configurado.
    sem : asyncio.Semaphore
        Semaforo que controla concorrencia.
    item : dict
        Registro de entrada do sapl_finder.
    writer : JsonlWriter
        Escritor JSONL de saida.
    page_size : int
        Tamanho de pagina usado na API do SAPL.
    with_tramitacao : bool
        Se True, busca ultima tramitacao para cada materia.

    Returns
    -------
    None
        Esta coroutine escreve resultados no escritor fornecido.
    """
    sapl_url = (item.get("sapl_url") or "").strip()
    if not sapl_url:
        return

    base = base_from_sapl_url(sapl_url)
    municipio = item.get("municipio", "") or ""
    uf = item.get("uf", "") or ""
    logger.info("Alvo carregado: %s (%s/%s)", base, municipio, uf)

    async with sem:
        async for row in collect_pls_for_base(
            client,
            base,
            municipio=municipio,
            uf=uf,
            page_size=page_size,
            with_tramitacao=with_tramitacao,
        ):
            writer.write(row)


async def run_scraper(
    in_jsonl: str,
    out_jsonl: str,
    concurrency: int,
    timeout: int,
    page_size: int,
    with_tramitacao: bool,
) -> None:
    """Executa o fluxo completo de raspagem.

    Parameters
    ----------
    in_jsonl : str
        Caminho do arquivo JSONL com as instancias SAPL.
    out_jsonl : str
        Caminho do JSONL de saida.
    concurrency : int
        Numero de bases processadas em paralelo.
    timeout : int
        Timeout das requisicoes em segundos.
    page_size : int
        Tamanho de pagina usado na API do SAPL.
    with_tramitacao : bool
        Se True, busca ultima tramitacao para cada materia.

    Returns
    -------
    None
        Executa o fluxo completo e nao retorna valor.
    """
    writer = JsonlWriter(out_jsonl)
    limits = httpx.Limits(max_keepalive_connections=0, max_connections=concurrency)
    timeout_cfg = httpx.Timeout(timeout)

    try:
        async with httpx.AsyncClient(
            limits=limits,
            timeout=timeout_cfg,
            headers={"User-Agent": "SAPL-PL-Scrapper/1.0"},
        ) as client:
            sem = asyncio.Semaphore(concurrency)
            tasks = [
                asyncio.create_task(
                    scrape_base(
                        client,
                        sem,
                        item,
                        writer,
                        page_size=page_size,
                        with_tramitacao=with_tramitacao,
                    )
                )
                for item in load_inputs(in_jsonl)
            ]
            if tasks:
                await asyncio.gather(*tasks)

        logger.info("Extracao concluida. Registros: %s | JSONL: %s", writer.count, out_jsonl)
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

    if args.concurrency < 1:
        raise ValueError("--concurrency precisa ser >= 1")
    if args.page_size < 1:
        raise ValueError("--page-size precisa ser >= 1")
    if args.timeout < 1:
        raise ValueError("--timeout precisa ser >= 1")

    setup_logging(args.log_level)

    try:
        asyncio.run(
            run_scraper(
                in_jsonl=args.in_jsonl,
                out_jsonl=args.out_jsonl,
                concurrency=args.concurrency,
                timeout=args.timeout,
                page_size=args.page_size,
                with_tramitacao=(not args.no_tramitacao),
            )
        )
    except KeyboardInterrupt:
        logger.warning("Interrompido pelo usuario.")


if __name__ == "__main__":
    main()
