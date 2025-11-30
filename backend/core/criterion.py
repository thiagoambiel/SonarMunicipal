from statistics import mean
from typing import List


def by_magnitude(scores: List[float]) -> float:
    """
    Qualidade combinando fração de efeitos negativos e magnitude média (versão original).
    """
    if not scores:
        return 0.0

    n = len(scores)
    neg_count = sum(1 for s in scores if s < 0)
    fraction_neg = neg_count / n if n else 0.0
    effect_mean = mean(scores)
    quality = fraction_neg * (-effect_mean)
    return max(0.0, quality)


def by_win_rate(scores: List[float]) -> float:
    """
    Qualidade por taxa de vitórias (efeitos negativos) ajustada por tamanho do grupo.

    - win_rate = (# scores < 0) / total
    - fator de confiança = n / (n + 1) favorece mais evidência (3/3 > 2/2)
    """
    if not scores:
        return 0.0

    n = len(scores)
    win_rate = sum(1 for s in scores if s < 0) / n
    evidence = n / (n + 1)  # crescente com n; 3/3 > 2/2
    return win_rate * evidence

