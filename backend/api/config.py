from dataclasses import dataclass, field
import os
from typing import Dict


@dataclass(frozen=True)
class IndicatorSpec:
    """
    Define um indicador disponível via API.
    """
    key: str
    path: str
    city_col: str = "municipio_norm"
    value_col: str = "taxa_homicidios_100k"


def _default_indicator_specs() -> Dict[str, "IndicatorSpec"]:
    """
    Registry inicial. Novos indicadores podem ser adicionados aqui.
    """
    return {
        "criminal_indicator": IndicatorSpec(
            key="criminal_indicator",
            path=os.getenv("CRIMINAL_INDICATOR_PATH", "data/criminal_indicator.csv"),
            city_col=os.getenv("CRIMINAL_INDICATOR_CITY_COL", "municipio_norm"),
            value_col=os.getenv("CRIMINAL_INDICATOR_VALUE_COL", "taxa_homicidios_100k"),
        ),
    }


@dataclass
class Settings:
    dataset_path: str = field(default_factory=lambda: os.getenv("DATASET_PATH", "data/dataset.npy"))
    model_name: str = field(
        default_factory=lambda: os.getenv(
            "SENTENCE_MODEL_NAME",
            "embaas/sentence-transformers-multilingual-e5-base",
        )
    )
    default_top_k: int = field(default_factory=lambda: int(os.getenv("DEFAULT_TOP_K", "5")))
    indicators: Dict[str, IndicatorSpec] = field(default_factory=_default_indicator_specs)

    def get_indicator(self, key: str) -> IndicatorSpec:
        if key not in self.indicators:
            raise KeyError(f"Indicador '{key}' não registrado")
        return self.indicators[key]

