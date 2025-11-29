"""
Interface pública do módulo core, dividida em arquivos menores para facilitar manutenção.
"""

from .data import extract_embeddings, load_actions_dataset
from .indicators import compute_effects_from_indicator
from .model import load_sentence_model
from .policies import (
    compute_mean_and_std,
    compute_policy_quality,
    generate_policies_from_bills,
    group_bills_by_structure,
    wilcoxon_less_than_zero,
)
from .search import semantic_search
from .text import STOPWORDS, jaccard_similarity, normalize_and_tokenize

__all__ = [
    "load_actions_dataset",
    "extract_embeddings",
    "load_sentence_model",
    "semantic_search",
    "normalize_and_tokenize",
    "jaccard_similarity",
    "STOPWORDS",
    "group_bills_by_structure",
    "compute_mean_and_std",
    "wilcoxon_less_than_zero",
    "compute_policy_quality",
    "generate_policies_from_bills",
    "compute_effects_from_indicator",
]

