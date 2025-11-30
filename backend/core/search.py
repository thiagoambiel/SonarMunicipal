from typing import Any, Dict, List, Optional, Sequence

import numpy as np
from sentence_transformers import SentenceTransformer

from .data import extract_embeddings


def _normalize_rows(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1e-12
    return matrix / norms


def semantic_search(
    query: str,
    dataset: Sequence[Dict[str, Any]],
    model: SentenceTransformer,
    embeddings: Optional[np.ndarray] = None,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    Retorna os projetos de lei mais próximos semanticamente ao texto de consulta.

    Cada item inclui campos originais do dataset + score de similaridade.
    """
    if top_k <= 0:
        return []

    if embeddings is None:
        embeddings = extract_embeddings(dataset)

    emb_norm = _normalize_rows(np.asarray(embeddings, dtype=np.float32))
    query_vector = model.encode(f"query: {query}", normalize_embeddings=True)
    scores = emb_norm @ query_vector

    top_k = min(top_k, len(scores))
    top_idx = np.argpartition(-scores, top_k - 1)[:top_k]
    top_idx = top_idx[np.argsort(-scores[top_idx])]

    results: List[Dict[str, Any]] = []
    for idx in top_idx:
        row = dict(dataset[idx]) if not isinstance(dataset[idx], dict) else dataset[idx].copy()
        row["score"] = float(scores[idx])
        row["index"] = int(idx)
        results.append(row)
    return results

