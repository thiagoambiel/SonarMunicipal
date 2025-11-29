from typing import Any, Dict, List, Sequence

import numpy as np


def load_actions_dataset(path: str) -> List[Dict[str, Any]]:
    """
    Lê o dataset salvo em .npy (lista de dicionários).
    """
    data = np.load(path, allow_pickle=True)
    return list(data)


def extract_embeddings(dataset: Sequence[Dict[str, Any]]) -> np.ndarray:
    """
    Empilha as embeddings do dataset em uma matriz (N, D).
    """
    embeddings: List[np.ndarray] = []
    for idx, row in enumerate(dataset):
        if "embedding" not in row:
            raise KeyError(f"Faltou a chave 'embedding' no item {idx}")
        embeddings.append(np.asarray(row["embedding"], dtype=np.float32))
    return np.vstack(embeddings)

