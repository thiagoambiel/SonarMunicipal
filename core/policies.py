from statistics import mean, stdev
from typing import Any, Dict, List, Optional, Tuple

from .text import jaccard_similarity, normalize_and_tokenize


def group_bills_by_structure(
    bills: List[Tuple[str, str, float]],
    threshold: float = 0.75,
) -> List[Dict[str, Any]]:
    """
    Agrupa projetos de lei por similaridade de estrutura (Jaccard).
    """
    if not bills:
        return []

    groups: List[Dict[str, Any]] = []

    for municipio, frase, score in bills:
        tokens = normalize_and_tokenize(frase)

        if not groups:
            groups.append({
                "rep_tokens": tokens,
                "rep_phrase": frase,
                "members": [(municipio, frase, score, 1.0)],
            })
            continue

        best_idx: Optional[int] = None
        best_sim = 0.0

        for i, g in enumerate(groups):
            sim = jaccard_similarity(tokens, g["rep_tokens"])
            if sim > best_sim:
                best_sim = sim
                best_idx = i

        if best_idx is not None and best_sim >= threshold:
            groups[best_idx]["members"].append((municipio, frase, score, best_sim))
        else:
            groups.append({
                "rep_tokens": tokens,
                "rep_phrase": frase,
                "members": [(municipio, frase, score, 1.0)],
            })

    return groups


def compute_mean_and_std(values: List[float]) -> Tuple[float, float]:
    if not values:
        return 0.0, 0.0
    if len(values) == 1:
        return values[0], 0.0
    return mean(values), stdev(values)


def compute_policy_quality(scores: List[float]) -> float:
    """
    Combina fração de municípios com efeito negativo e magnitude média do efeito.
    """
    if not scores:
        return 0.0

    n = len(scores)
    neg_count = sum(1 for s in scores if s < 0)
    fraction_neg = neg_count / n if n else 0.0
    effect_mean = mean(scores)
    quality = fraction_neg * (-effect_mean)
    return max(0.0, quality)


def generate_policies_from_bills(
    bills: List[Tuple[str, str, float]],
    min_group_members: int = 2,
    similarity_threshold: float = 0.75,
) -> List[Dict[str, Any]]:
    """
    Recebe (municipio, descricao_PL, efeito) e devolve candidatos a políticas.
    """
    groups = group_bills_by_structure(bills, threshold=similarity_threshold)
    policies: List[Dict[str, Any]] = []

    for g in groups:
        members = g["members"]

        if len(members) < min_group_members:
            continue

        scores = [s for (_, _, s, _) in members]

        effect_mean, effect_std = compute_mean_and_std(scores)
        quality_score = compute_policy_quality(scores)
        actions = [(mun, frase, score) for (mun, frase, score, _) in members]

        policies.append({
            "policy": g["rep_phrase"],
            "actions": actions,
            "effect_mean": effect_mean,
            "effect_std": effect_std,
            "quality_score": quality_score,
        })

    policies.sort(key=lambda p: p["quality_score"], reverse=True)
    return policies
