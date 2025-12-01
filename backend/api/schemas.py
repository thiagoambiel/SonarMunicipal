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
    effect_window_months: int = Field(
        6,
        ge=6,
        multiple_of=6,
        description="Janela temporal em meses para calcular o efeito (múltiplos de 6)",
    )


class IndicatorEffect(BaseModel):
    index: int
    municipio: str
    uf: Optional[str] = None
    acao: Optional[str] = None
    data_apresentacao: Optional[str] = None
    effect: float = Field(..., description="Variação percentual do indicador na janela escolhida")


class IndicatorFilterResponse(BaseModel):
    indicator: str
    returned: int
    effects: List[IndicatorEffect]


class PolicyGenerationRequest(BaseModel):
    indicator: Optional[str] = Field(None, description="Identificador do indicador a ser usado (opcional)")
    use_indicator: bool = Field(False, description="Se true, calcula efeitos usando o indicador escolhido")
    bill_indexes: List[int] = Field(..., min_items=1, description="Índices dos PLs retornados na busca")
    min_group_members: int = Field(2, ge=1, description="Tamanho mínimo para formar um grupo de ações")
    effect_window_months: int = Field(
        6,
        ge=6,
        multiple_of=6,
        description="Janela temporal em meses para calcular o efeito (múltiplos de 6)",
    )
    similarity_threshold: float = Field(
        0.75, ge=0.0, le=1.0, description="Similaridade mínima (Jaccard) para agrupar ações"
    )


class PolicyAction(BaseModel):
    municipio: str
    acao: str
    data_apresentacao: Optional[str] = Field(None, description="Data de apresentação do PL (se disponível)")
    ementa: Optional[str] = Field(None, description="Ementa original do PL (se disponível)")
    effect: Optional[float] = Field(None, description="Variação percentual no indicador (se calculada)")
    url: Optional[str] = Field(None, description="Link oficial do projeto de lei (se disponível)")


class PolicySuggestion(BaseModel):
    policy: str
    effect_mean: Optional[float] = Field(None, description="Média das variações percentuais (se indicador foi usado)")
    effect_std: Optional[float] = Field(None, description="Desvio padrão das variações percentuais (se indicador foi usado)")
    quality_score: Optional[float] = Field(None, description="Score de qualidade (se indicador foi usado)")
    actions: List[PolicyAction]


class PolicyGenerationResponse(BaseModel):
    indicator: Optional[str]
    used_indicator: bool
    total_candidates: int
    policies: List[PolicySuggestion]


class IndicatorDescriptor(BaseModel):
    id: str
    path: str
    city_col: str
    value_col: str
    alias: str
    positive_is_good: bool
    min_value: float
