import json
import logging
import os
from typing import Any, Dict, Optional


class JsonlWriter:
    """Escreve registros em JSONL com deduplicacao e flush imediato.

    Notes
    -----
    Cada linha e gravada no momento em que e processada, garantindo progresso
    em tempo real mesmo em execucoes longas.
    """

    def __init__(self, out_jsonl: str) -> None:
        """Inicializa o escritor JSONL.

        Parameters
        ----------
        out_jsonl : str
            Caminho do arquivo JSONL de saida.
        """
        self._seen: set[str] = set()
        self._count: int = 0
        self._logger = logging.getLogger("sapl_scrapper.progress")
        self._out_jsonl = out_jsonl

        out_dir = os.path.dirname(out_jsonl)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        self._fp = open(out_jsonl, "w", encoding="utf-8")

    @property
    def count(self) -> int:
        """Retorna o total de registros unicos gravados.

        Returns
        -------
        int
            Numero de linhas gravadas no JSONL.
        """
        return self._count

    def _key(self, row: Dict[str, Any]) -> Optional[str]:
        """Monta a chave de deduplicacao.

        Parameters
        ----------
        row : dict
            Registro da materia.

        Returns
        -------
        str or None
            Chave canonica dos campos de saida.
        """
        try:
            return json.dumps(row, ensure_ascii=False, sort_keys=True)
        except Exception:
            return None

    def write(self, row: Dict[str, Any]) -> bool:
        """Grava um registro no JSONL, se ainda nao existir.

        Parameters
        ----------
        row : dict
            Registro completo da materia.

        Returns
        -------
        bool
            True se o registro foi gravado, False se foi ignorado.
        """
        key = self._key(row)
        if not key or key in self._seen:
            return False

        self._seen.add(key)
        self._fp.write(json.dumps(row, ensure_ascii=False) + "\n")
        self._fp.flush()
        self._count += 1

        try:
            self._logger.info(
                "PL salvo (%s): %s/%s",
                self._count,
                (row.get("municipio") or "").strip(),
                row.get("uf", ""),
            )
        except Exception:
            pass

        return True

    def close(self) -> None:
        """Fecha o arquivo JSONL aberto pelo escritor.

        Returns
        -------
        None
            Este metodo fecha o descritor de arquivo.
        """
        if self._fp:
            self._fp.close()

    def dedupe_file(self) -> int:
        """Remove itens duplicados do JSONL final.

        Returns
        -------
        int
            Total de registros unicos mantidos.
        """
        src_path = self._out_jsonl
        tmp_path = f"{src_path}.dedup"
        seen: set[str] = set()
        kept = 0

        try:
            with open(src_path, "r", encoding="utf-8") as src, open(tmp_path, "w", encoding="utf-8") as dst:
                for line in src:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                        key = json.dumps(obj, ensure_ascii=False, sort_keys=True)
                    except Exception:
                        obj = None
                        key = line
                    if key in seen:
                        continue
                    seen.add(key)
                    if isinstance(obj, dict):
                        dst.write(json.dumps(obj, ensure_ascii=False) + "\n")
                    else:
                        dst.write(line + "\n")
                    kept += 1
            os.replace(tmp_path, src_path)
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
        return kept
