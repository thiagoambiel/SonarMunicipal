from typing import Any, Dict, Iterable, List

from core.indicators import _encode_semester
from core.search import semantic_search
from core.policies import generate_policies_from_bills

from .resources import CoreResources
from .schemas import (
    IndicatorEffect,
    PolicyAction,
    PolicyGenerationRequest,
    PolicySuggestion,
    SearchRequest,
    SearchResult,
)


def sanitize_search_result(row: Dict[str, Any]) -> SearchResult:
    """
    Remove campos pesados (embedding) e separa o payload em dados conhecidos + metadata.
    """
    payload = {k: v for k, v in row.items() if k != "embedding"}
    metadata = {
        k: v
        for k, v in payload.items()
        if k not in {"index", "score", "municipio", "uf", "acao", "data_apresentacao"}
    }

    return SearchResult(
        index=int(payload.get("index", -1)),
        score=float(payload.get("score", 0.0)),
        municipio=payload.get("municipio"),
        uf=payload.get("uf"),
        acao=payload.get("acao"),
        data_apresentacao=payload.get("data_apresentacao"),
        metadata=metadata,
    )


def run_semantic_search(request: SearchRequest, resources: CoreResources) -> List[SearchResult]:
    top_k = request.top_k or 5
    matches = semantic_search(
        query=request.query,
        dataset=resources.dataset,
        model=resources.model,
        embeddings=resources.embeddings,
        top_k=top_k,
    )
    return [sanitize_search_result(row) for row in matches]


def _build_indicator_lookup(indicator_df: Any, city_col: str, value_col: str) -> Dict[Any, float]:
    lookup: Dict[Any, float] = {}
    for _, row in indicator_df.iterrows():
        key = (str(row[city_col]).upper(), str(row["uf"]).upper(), int(row["ano"]), int(row["semestre"]))
        lookup[key] = float(row[value_col])
    return lookup


def compute_effects_for_indexes(
    indexes: Iterable[int],
    resources: CoreResources,
    indicator_key: str,
) -> List[IndicatorEffect]:
    spec, indicator_df = resources.get_indicator(indicator_key)
    lookup = _build_indicator_lookup(indicator_df, city_col=spec.city_col, value_col=spec.value_col)

    effects: List[IndicatorEffect] = []

    for idx in indexes:
        if idx < 0 or idx >= len(resources.dataset):
            continue

        bill = resources.dataset[int(idx)]
        if "data_apresentacao" not in bill or "municipio" not in bill:
            continue

        year, semester = _encode_semester(str(bill["data_apresentacao"]))
        city = str(bill["municipio"]).upper()
        uf = str(bill.get("uf", "")).upper()

        current = lookup.get((city, uf, year, semester))
        next_key = (city, uf, year, 2) if semester == 1 else (city, uf, year + 1, 1)
        future = lookup.get(next_key)

        if current is None or future is None:
            continue

        delta = float(future - current)
        effects.append(
            IndicatorEffect(
                index=int(idx),
                municipio=str(bill.get("municipio") or ""),
                uf=bill.get("uf"),
                acao=str(bill.get("acao") or ""),
                data_apresentacao=bill.get("data_apresentacao"),
                effect=delta,
            )
        )

    return effects


def generate_policies_from_indexes(
    payload: PolicyGenerationRequest,
    resources: CoreResources,
) -> List[PolicySuggestion]:
    effects = compute_effects_for_indexes(payload.bill_indexes, resources, payload.indicator)

    tuples = [(e.municipio, e.acao, e.effect) for e in effects]
    raw = generate_policies_from_bills(
        tuples,
        min_group_members=payload.min_group_members,
        similarity_threshold=payload.similarity_threshold,
    )

    policies: List[PolicySuggestion] = []
    for p in raw:
        policies.append(
            PolicySuggestion(
                policy=p["policy"],
                effect_mean=float(p["effect_mean"]),
                effect_std=float(p["effect_std"]),
                quality_score=float(p["quality_score"]),
                actions=[
                    PolicyAction(municipio=mun, acao=desc, effect=float(score))
                    for (mun, desc, score) in p["actions"]
                ],
            )
        )
    return policies
