from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import pandas as pd

from core import extract_embeddings, load_actions_dataset, load_sentence_model

from .config import IndicatorSpec, Settings


@dataclass
class CoreResources:
    settings: Settings
    dataset: List[Dict[str, Any]]
    embeddings: Any
    model: Any
    indicators: Dict[str, pd.DataFrame]

    @classmethod
    def build(cls, settings: Settings) -> "CoreResources":
        dataset = load_actions_dataset(settings.dataset_path)
        embeddings = extract_embeddings(dataset)
        model = load_sentence_model(settings.model_name)

        indicators: Dict[str, pd.DataFrame] = {}
        for key, spec in settings.indicators.items():
            indicators[key] = cls._load_indicator(spec)

        return cls(settings=settings, dataset=dataset, embeddings=embeddings, model=model, indicators=indicators)

    @staticmethod
    def _load_indicator(spec: IndicatorSpec) -> pd.DataFrame:
        if not spec.path:
            raise ValueError(f"Caminho inválido para indicador '{spec.key}'")
        return pd.read_csv(spec.path)

    def get_indicator(self, key: str) -> Tuple[IndicatorSpec, pd.DataFrame]:
        spec = self.settings.get_indicator(key)
        if key not in self.indicators:
            self.indicators[key] = self._load_indicator(spec)
        return spec, self.indicators[key]

