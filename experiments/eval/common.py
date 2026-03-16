from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional, Sequence

import numpy as np
import torch
from sentence_transformers import SentenceTransformer


DEFAULT_MODEL_NAME = "embaas/sentence-transformers-multilingual-e5-base"


@dataclass(frozen=True)
class Problem:
    problem_id: str
    name: str
    query: str
    category: Optional[str] = None
    description: Optional[str] = None

    @classmethod
    def from_dict(cls, row: Dict[str, Any]) -> "Problem":
        return cls(
            problem_id=str(row["problem_id"]).strip(),
            name=str(row["name"]).strip(),
            query=str(row["query"]).strip(),
            category=(str(row["category"]).strip() if row.get("category") else None),
            description=(str(row["description"]).strip() if row.get("description") else None),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "problem_id": self.problem_id,
            "name": self.name,
            "query": self.query,
            "category": self.category,
            "description": self.description,
        }


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_dataset(path: Path) -> List[Dict[str, Any]]:
    data = np.load(path, allow_pickle=True)
    rows: List[Dict[str, Any]] = []
    for item in data:
        rows.append(item.item() if hasattr(item, "item") and not isinstance(item, dict) else dict(item))
    return rows


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def normalize_for_dedupe(text: Optional[str]) -> str:
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKD", text)
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = normalized.lower()
    normalized = normalize_whitespace(normalized)
    return normalized


def build_doc_id(row: Dict[str, Any]) -> str:
    sapl_base = str(row.get("sapl_base") or row.get("sapl_url") or "sem-sapl").strip()
    materia_id = row.get("materia_id")
    if materia_id is not None:
        return f"{sapl_base}::materia::{materia_id}"
    numero = row.get("numero")
    ano = row.get("ano")
    ementa_key = normalize_for_dedupe(str(row.get("ementa") or row.get("acao") or "sem-texto"))[:80]
    return f"{sapl_base}::numero::{numero}::ano::{ano}::text::{ementa_key}"


def make_dedupe_key(row: Dict[str, Any], mode: str) -> str:
    if mode == "source":
        return build_doc_id(row)
    if mode == "ementa":
        return normalize_for_dedupe(row.get("ementa"))
    if mode == "acao":
        return normalize_for_dedupe(row.get("acao"))
    if mode == "text_pair":
        return "||".join(
            [
                normalize_for_dedupe(row.get("ementa")),
                normalize_for_dedupe(row.get("acao")),
            ]
        )
    raise ValueError(f"Modo de deduplicacao desconhecido: {mode}")


def deduplicate_rows(rows: Sequence[Dict[str, Any]], mode: str) -> List[Dict[str, Any]]:
    seen: set[str] = set()
    deduped: List[Dict[str, Any]] = []
    for row in rows:
        ementa = normalize_whitespace(str(row.get("ementa") or ""))
        acao = normalize_whitespace(str(row.get("acao") or ""))
        if not ementa or not acao:
            continue
        key = make_dedupe_key(row, mode)
        if not key or key in seen:
            continue
        seen.add(key)
        normalized_row = dict(row)
        normalized_row["doc_id"] = build_doc_id(normalized_row)
        normalized_row["ementa"] = ementa
        normalized_row["acao"] = acao
        deduped.append(normalized_row)
    return deduped


def write_jsonl(path: Path, rows: Iterable[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as fp:
        for row in rows:
            fp.write(json.dumps(row, ensure_ascii=False) + "\n")


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as fp:
        for line in fp:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def iter_jsonl(path: Path) -> Iterator[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as fp:
        for line in fp:
            line = line.strip()
            if line:
                yield json.loads(line)


def save_json(path: Path, payload: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2)


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as fp:
        return json.load(fp)


def choose_device(requested_device: Optional[str]) -> str:
    if requested_device:
        return requested_device
    return "cuda" if torch.cuda.is_available() else "cpu"


def load_model(model_name: str, device: Optional[str] = None) -> SentenceTransformer:
    resolved_device = choose_device(device)
    return SentenceTransformer(model_name, device=resolved_device)


def encode_texts(
    model: SentenceTransformer,
    texts: Sequence[str],
    *,
    batch_size: int,
    normalize_embeddings: bool,
    prefix: str = "",
    dtype: str = "float16",
) -> np.ndarray:
    encoded = [f"{prefix}{text}" if prefix else text for text in texts]
    matrix = model.encode(
        encoded,
        batch_size=batch_size,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=normalize_embeddings,
    )
    return np.asarray(matrix, dtype=np.dtype(dtype))


def l2_normalize_rows(matrix: np.ndarray) -> np.ndarray:
    matrix = np.asarray(matrix, dtype=np.float32)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1e-12
    return matrix / norms


def load_problems(path: Path) -> List[Problem]:
    return [Problem.from_dict(row) for row in read_jsonl(path)]


def write_problems(path: Path, problems: Sequence[Problem]) -> None:
    write_jsonl(path, (problem.to_dict() for problem in problems))
