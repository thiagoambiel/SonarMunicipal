import asyncio
import csv
import json
import os
import logging
from typing import Dict, List, Optional


def write_outputs(found: List[Dict], out_csv: str, out_json: str) -> None:
    found = sorted(found, key=lambda x: (x.get("uf", ""), x.get("municipio", ""), x.get("sapl_url", "")))
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["ibge_id", "municipio", "uf", "source", "sapl_url", "http_status", "marker", "title"])
        for r in found:
            w.writerow([
                r.get("ibge_id", ""),
                r.get("municipio", ""),
                r.get("uf", ""),
                r.get("source", ""),
                r.get("sapl_url", ""),
                r.get("http_status", ""),
                r.get("marker", ""),
                r.get("title", ""),
            ])
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(found, f, ensure_ascii=False, indent=2)


class ProgressWriter:
    """
    Escrita incremental de resultados: CSV e JSONL em tempo real,
    com deduplicação por "sapl_url" e flush a cada inserção.
    """

    def __init__(self, out_csv: str, out_jsonl: Optional[str] = None) -> None:
        self._lock = asyncio.Lock()
        self._seen = set()
        self._rows: List[Dict] = []
        self._count: int = 0
        self._logger = logging.getLogger("sapl_finder.progress")

        # garante diretórios
        csv_dir = os.path.dirname(out_csv)
        if csv_dir:
            os.makedirs(csv_dir, exist_ok=True)
        self._csv_fp = open(out_csv, "w", newline="", encoding="utf-8")
        self._csv_writer = csv.writer(self._csv_fp)
        self._csv_writer.writerow([
            "ibge_id",
            "municipio",
            "uf",
            "source",
            "sapl_url",
            "http_status",
            "marker",
            "title",
        ])
        self._csv_fp.flush()

        self._jsonl_fp = None
        if out_jsonl:
            jsonl_dir = os.path.dirname(out_jsonl)
            if jsonl_dir:
                os.makedirs(jsonl_dir, exist_ok=True)
            self._jsonl_fp = open(out_jsonl, "w", encoding="utf-8")

    @property
    def rows(self) -> List[Dict]:
        return list(self._rows)

    async def on_found(self, row: Dict) -> None:
        """
        Callback assíncrono a ser usado pelos scrapers.
        Escreve a linha no CSV e JSONL, fazendo flush imediato.
        """
        url = row.get("sapl_url")
        if not url:
            return
        async with self._lock:
            if url in self._seen:
                return
            self._seen.add(url)
            self._rows.append(row)
            self._count += 1

            self._csv_writer.writerow([
                row.get("ibge_id", ""),
                row.get("municipio", ""),
                row.get("uf", ""),
                row.get("source", ""),
                row.get("sapl_url", ""),
                row.get("http_status", ""),
                row.get("marker", ""),
                row.get("title", ""),
            ])
            self._csv_fp.flush()

            if self._jsonl_fp is not None:
                self._jsonl_fp.write(json.dumps(row, ensure_ascii=False) + "\n")
                self._jsonl_fp.flush()

            # Loga contagem acumulada e contexto do achado
            try:
                self._logger.info(
                    "Novo SAPL encontrado (%s): %s",
                    self._count,
                    row.get("sapl_url", ""),
                    extra={
                        "count": self._count,
                        "sapl_url": row.get("sapl_url", ""),
                        "municipio": row.get("municipio", ""),
                        "uf": row.get("uf", ""),
                        "source": row.get("source", ""),
                    },
                )
            except Exception:
                # Evita que logging quebre fluxo de escrita
                pass

    def finalize_json(self, out_json: str) -> None:
        """
        Gera o JSON agregado final a partir das linhas coletadas.
        """
        data = sorted(self._rows, key=lambda x: (x.get("uf", ""), x.get("municipio", ""), x.get("sapl_url", "")))
        out_dir = os.path.dirname(out_json)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with open(out_json, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def close(self) -> None:
        try:
            if self._csv_fp:
                self._csv_fp.close()
        finally:
            if self._jsonl_fp:
                self._jsonl_fp.close()


class CandidatesWriter:
    """
    Escrita incremental de candidatos (hosts) vindos do crt.sh, antes de validação.
    Salva apenas em JSONL, com deduplicação por host.
    """

    def __init__(self, out_jsonl: str) -> None:
        self._seen = set()
        self._jsonl_fp = None
        if out_jsonl:
            dirn = os.path.dirname(out_jsonl)
            if dirn:
                os.makedirs(dirn, exist_ok=True)
            self._jsonl_fp = open(out_jsonl, "w", encoding="utf-8")

    async def emit(self, host: str, pattern: str, source: str = "crtsh-candidate") -> None:
        if not host or host in self._seen:
            return
        self._seen.add(host)
        row = {"host": host, "pattern": pattern, "source": source}
        if self._jsonl_fp:
            self._jsonl_fp.write(json.dumps(row, ensure_ascii=False) + "\n")
            self._jsonl_fp.flush()

    def close(self) -> None:
        if self._jsonl_fp:
            self._jsonl_fp.close()
