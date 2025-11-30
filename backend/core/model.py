from typing import Optional

from sentence_transformers import SentenceTransformer


def load_sentence_model(
    model_name: str = "embaas/sentence-transformers-multilingual-e5-base",
    device: Optional[str] = None,
) -> SentenceTransformer:
    """
    Carrega o modelo de embeddings usado nos notebooks.
    """
    return SentenceTransformer(model_name, device=device)

