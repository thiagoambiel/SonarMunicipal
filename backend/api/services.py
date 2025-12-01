from typing import Any, Dict, Iterable, List, Optional, Tuple

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


def _advance_semester(year: int, semester: int, semesters_ahead: int) -> Tuple[int, int]:
    target = (semester - 1) + semesters_ahead
    return year + target // 2, (target % 2) + 1


def compute_effects_for_indexes(
    indexes: Iterable[int],
    resources: CoreResources,
    indicator_key: str,
    effect_window_months: int = 6,
) -> List[IndicatorEffect]:
    spec, indicator_df = resources.get_indicator(indicator_key)
    lookup = _build_indicator_lookup(indicator_df, city_col=spec.city_col, value_col=spec.value_col)

    semesters_ahead = max(1, effect_window_months // 6)

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
        future_year, future_semester = _advance_semester(year, semester, semesters_ahead)
        future = lookup.get((city, uf, future_year, future_semester))

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


def _build_bill_tuples(
    indexes: Iterable[int],
    resources: CoreResources,
    effects_lookup: Optional[Dict[int, IndicatorEffect]] = None,
) -> Tuple[List[Tuple[str, str, float]], Dict[Tuple[str, str], Dict[str, object]]]:
    """
    Constrói a lista de tuplas (municipio, acao, score) usada pelo agrupador,
    e um lookup (municipio, acao) -> dados auxiliares para ser devolvido na resposta.
    """
    tuples: List[Tuple[str, str, float]] = []
    action_meta: Dict[Tuple[str, str], Dict[str, object]] = {}

    for idx in indexes:
        if idx < 0 or idx >= len(resources.dataset):
            continue

        bill = resources.dataset[int(idx)]
        municipio = str(bill.get("municipio") or "")
        acao = str(bill.get("acao") or "")
        data_apresentacao = bill.get("data_apresentacao")
        ementa = bill.get("ementa")
        url = str(bill.get("link_publico") or bill.get("sapl_url") or bill.get("url") or "").strip() or None
        if url:
            cleaned = url.rstrip("/")
            if cleaned.endswith("/acompanhar-materia"):
                cleaned = cleaned[: -len("/acompanhar-materia")]
            url = cleaned or None

        effect_value: Optional[float] = None
        if effects_lookup is not None:
            effect_obj = effects_lookup.get(int(idx))
            if effect_obj is None:
                # Se o indicador foi solicitado mas não há efeito calculável, ignoramos este PL.
                continue
            effect_value = float(effect_obj.effect)

        score_for_grouping = effect_value if effect_value is not None else 0.0
        tuples.append((municipio, acao, score_for_grouping))

        key = (municipio, acao)
        current = action_meta.get(key, {})
        # Mantém o melhor efeito (menor) quando houver, e sempre guarda URL se existir.
        if effect_value is not None:
            prev_effect = current.get("effect")
            current["effect"] = effect_value if prev_effect is None else min(float(prev_effect), effect_value)
        if url:
            current["url"] = url
        if data_apresentacao:
            current["data_apresentacao"] = data_apresentacao
        if ementa:
            current["ementa"] = ementa
        if current:
            action_meta[key] = current

    return tuples, action_meta


def generate_policies_from_indexes(
    payload: PolicyGenerationRequest,
    resources: CoreResources,
) -> List[PolicySuggestion]:
    effects_lookup: Optional[Dict[int, IndicatorEffect]] = None

    if payload.use_indicator and payload.indicator:
        effects = compute_effects_for_indexes(
            payload.bill_indexes,
            resources,
            payload.indicator,
            effect_window_months=payload.effect_window_months,
        )
        effects_lookup = {e.index: e for e in effects}

    tuples, action_meta = _build_bill_tuples(payload.bill_indexes, resources, effects_lookup)

    raw = generate_policies_from_bills(
        tuples,
        min_group_members=payload.min_group_members,
        similarity_threshold=payload.similarity_threshold,
    )

    policies: List[PolicySuggestion] = []
    for p in raw:
        actions: List[PolicyAction] = []
        for (mun, desc, _score) in p["actions"]:
            meta = action_meta.get((mun, desc), {})
            action_effect = meta.get("effect") if payload.use_indicator else None
            actions.append(
                PolicyAction(
                    municipio=mun,
                    acao=desc,
                    data_apresentacao=str(meta.get("data_apresentacao")) if meta.get("data_apresentacao") else None,
                    ementa=str(meta.get("ementa")) if meta.get("ementa") else None,
                    effect=action_effect if action_effect is None else float(action_effect),
                    url=meta.get("url") if isinstance(meta.get("url"), str) else None,
                )
            )

        policies.append(
            PolicySuggestion(
                policy=p["policy"],
                effect_mean=float(p["effect_mean"]) if payload.use_indicator else None,
                effect_std=float(p["effect_std"]) if payload.use_indicator else None,
                quality_score=float(p["quality_score"]) if payload.use_indicator else None,
                actions=actions,
            )
        )
    return policies
