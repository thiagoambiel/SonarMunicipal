from typing import Dict, List

from fastapi import Depends, FastAPI, HTTPException, Request

from .config import Settings
from .resources import CoreResources
from .schemas import (
    IndicatorDescriptor,
    IndicatorFilterRequest,
    IndicatorFilterResponse,
    PolicyGenerationRequest,
    PolicyGenerationResponse,
    SearchRequest,
    SearchResponse,
)
from .services import compute_effects_for_indexes, generate_policies_from_indexes, run_semantic_search

app = FastAPI(
    title="CityManager API",
    version="0.1.0",
    description="API para busca semântica de PLs e geração de políticas públicas.",
)


@app.on_event("startup")
def load_resources() -> None:
    settings = Settings()
    app.state.settings = settings
    app.state.resources = CoreResources.build(settings)


def get_resources(request: Request) -> CoreResources:
    resources = getattr(request.app.state, "resources", None)
    if resources is None:
        raise HTTPException(status_code=500, detail="Recursos principais ainda não carregados.")
    return resources


def get_settings(request: Request) -> Settings:
    settings = getattr(request.app.state, "settings", None)
    if settings is None:
        raise HTTPException(status_code=500, detail="Configuração da API não carregada.")
    return settings


@app.get("/health")
def health(resources: CoreResources = Depends(get_resources)) -> Dict[str, object]:
    return {
        "status": "ok",
        "dataset_size": len(resources.dataset),
        "indicators": list(resources.settings.indicators.keys()),
    }


@app.get("/indicators", response_model=List[IndicatorDescriptor])
def list_indicators(resources: CoreResources = Depends(get_resources)) -> List[IndicatorDescriptor]:
    descriptors: List[IndicatorDescriptor] = []
    for key, spec in resources.settings.indicators.items():
        descriptors.append(
            IndicatorDescriptor(
                id=key,
                path=spec.path,
                city_col=spec.city_col,
                value_col=spec.value_col,
            )
        )
    return descriptors


@app.post("/search", response_model=SearchResponse)
def semantic_search_endpoint(
    payload: SearchRequest,
    resources: CoreResources = Depends(get_resources),
    settings: Settings = Depends(get_settings),
) -> SearchResponse:
    top_k = payload.top_k or settings.default_top_k
    results = run_semantic_search(SearchRequest(query=payload.query, top_k=top_k), resources)
    return SearchResponse(query=payload.query, top_k=top_k, returned=len(results), results=results)


@app.post("/indicator-effects", response_model=IndicatorFilterResponse)
def indicator_effects(
    payload: IndicatorFilterRequest,
    resources: CoreResources = Depends(get_resources),
) -> IndicatorFilterResponse:
    try:
        resources.settings.get_indicator(payload.indicator)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    effects = compute_effects_for_indexes(payload.bill_indexes, resources, payload.indicator)
    return IndicatorFilterResponse(indicator=payload.indicator, returned=len(effects), effects=effects)


@app.post("/policies", response_model=PolicyGenerationResponse)
def generate_policies(
    payload: PolicyGenerationRequest,
    resources: CoreResources = Depends(get_resources),
) -> PolicyGenerationResponse:
    try:
        resources.settings.get_indicator(payload.indicator)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    policies = generate_policies_from_indexes(payload, resources)
    return PolicyGenerationResponse(indicator=payload.indicator, total_candidates=len(policies), policies=policies)

