from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Texto para busca semântica")
    top_k: Optional[int] = Field(None, ge=1, le=1000, description="Número máximo de resultados")


class SearchResult(BaseModel):
    index: int
    score: float
    municipio: Optional[str] = None
    uf: Optional[str] = None
    acao: Optional[str] = None
    data_apresentacao: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    query: str
    top_k: int
    returned: int
    results: List[SearchResult]


class IndicatorFilterRequest(BaseModel):
    indicator: str = Field(..., description="Identificador do indicador (ex.: criminal_indicator)")
    bill_indexes: List[int] = Field(..., min_items=1, description="Índices dos PLs retornados na busca")


class IndicatorEffect(BaseModel):
    index: int
    municipio: str
    uf: Optional[str] = None
    acao: Optional[str] = None
    data_apresentacao: Optional[str] = None
    effect: float


class IndicatorFilterResponse(BaseModel):
    indicator: str
    returned: int
    effects: List[IndicatorEffect]


class PolicyGenerationRequest(BaseModel):
    indicator: str = Field(..., description="Identificador do indicador a ser usado")
    bill_indexes: List[int] = Field(..., min_items=1, description="Índices dos PLs retornados na busca")
    min_group_members: int = Field(2, ge=1, description="Tamanho mínimo para formar um grupo de ações")
    similarity_threshold: float = Field(
        0.75, ge=0.0, le=1.0, description="Similaridade mínima (Jaccard) para agrupar ações"
    )


class PolicyAction(BaseModel):
    municipio: str
    acao: str
    effect: float


class PolicySuggestion(BaseModel):
    policy: str
    effect_mean: float
    effect_std: float
    quality_score: float
    actions: List[PolicyAction]


class PolicyGenerationResponse(BaseModel):
    indicator: str
    total_candidates: int
    policies: List[PolicySuggestion]


class IndicatorDescriptor(BaseModel):
    id: str
    path: str
    city_col: str
    value_col: str
