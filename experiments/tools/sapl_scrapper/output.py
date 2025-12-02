import asyncio
import csv
import json
import logging
import os
from typing import Dict, List, Optional


class PLWriter:
    """
    Escrita incremental dos PLs em CSV e JSONL, com flush imediato e
    deduplicação por (sapl_base, materia_id).
    """

    CSV_FIELDS = [
        "sapl_base",
        "sapl_url",
        "municipio",
        "uf",
        "tipo_id",
        "tipo_label",
        "materia_id",
        "numero",
        "ano",
        "ementa",
        "data_apresentacao",
        "em_tramitacao",
        "situacao",
        "link_publico",
        "ultima_tramitacao_data",
        "ultima_tramitacao_status",
    ]

    def __init__(self, out_csv: str, out_jsonl: Optional[str] = None) -> None:
        self._lock = asyncio.Lock()
        self._seen: set[str] = set()
        self._rows: List[Dict] = []
        self._count: int = 0
        self._logger = logging.getLogger("sapl_scrapper.progress")

        # prepara CSV
        csv_dir = os.path.dirname(out_csv)
        if csv_dir:
            os.makedirs(csv_dir, exist_ok=True)
        self._csv_fp = open(out_csv, "w", newline="", encoding="utf-8")
        self._csv_writer = csv.DictWriter(self._csv_fp, fieldnames=self.CSV_FIELDS)
        self._csv_writer.writeheader()
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

    def _key(self, row: Dict) -> Optional[str]:
        base = row.get("sapl_base") or ""
        mid = row.get("materia_id")
        if not base or mid is None:
            return None
        return f"{base}|{mid}"

    async def emit(self, row: Dict) -> None:
        key = self._key(row)
        if not key:
            return
        async with self._lock:
            if key in self._seen:
                return
            self._seen.add(key)
            self._rows.append(row)
            self._count += 1

            # escreve CSV (somente campos conhecidos)
            csv_row = {k: row.get(k, "") for k in self.CSV_FIELDS}
            self._csv_writer.writerow(csv_row)
            self._csv_fp.flush()

            # escreve JSONL completo
            if self._jsonl_fp is not None:
                try:
                    self._jsonl_fp.write(json.dumps(row, ensure_ascii=False) + "\n")
                    self._jsonl_fp.flush()
                except Exception:
                    pass

            # log progressivo
            try:
                self._logger.info(
                    "PL salvo (%s): %s/%s %s-%s",
                    self._count,
                    (row.get("municipio") or "").strip(),
                    row.get("uf", ""),
                    row.get("numero", ""),
                    row.get("ano", ""),
                    extra={
                        "count": self._count,
                        "sapl_url": row.get("sapl_url", ""),
                        "sapl_base": row.get("sapl_base", ""),
                        "municipio": row.get("municipio", ""),
                        "uf": row.get("uf", ""),
                    },
                )
            except Exception:
                pass

    def finalize_json(self, out_json: str) -> None:
        out_dir = os.path.dirname(out_json)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with open(out_json, "w", encoding="utf-8") as f:
            json.dump(self._rows, f, ensure_ascii=False, indent=2)

    def close(self) -> None:
        try:
            if self._csv_fp:
                self._csv_fp.close()
        finally:
            if self._jsonl_fp:
                self._jsonl_fp.close()

