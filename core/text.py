import re
import unicodedata
from typing import Iterable, List

STOPWORDS = {
    "a", "as", "o", "os", "um", "uma", "uns", "umas",
    "de", "do", "da", "dos", "das",
    "em", "no", "na", "nos", "nas",
    "para", "pra", "pro", "por",
    "ao", "aos", "à", "às",
    "e",
}


def normalize_and_tokenize(text: str) -> List[str]:
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(ch for ch in text if not _is_accent(ch)).replace("\n", " ")
    text = _strip_punctuation(text)
    tokens = text.split()
    return [t for t in tokens if t not in STOPWORDS]


def _is_accent(ch: str) -> bool:
    return unicodedata.category(ch) == "Mn"


def _strip_punctuation(text: str) -> str:
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def jaccard_similarity(tokens_a: Iterable[str], tokens_b: Iterable[str]) -> float:
    set_a = set(tokens_a)
    set_b = set(tokens_b)
    if not set_a and not set_b:
        return 1.0
    inter = len(set_a & set_b)
    uni = len(set_a | set_b)
    return inter / uni

