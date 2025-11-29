from datetime import datetime
from typing import Any, Dict, List, Sequence, Tuple


def _encode_semester(date_str: str) -> Tuple[int, int]:
    date = datetime.strptime(date_str, "%Y-%m-%d")
    semester = 1 if date.month <= 6 else 2
    return date.year, semester


def compute_effects_from_indicator(
    bills: Sequence[Dict[str, Any]],
    indicator_df: Any,
    city_col: str = "municipio_norm",
    value_col: str = "taxa_homicidios_100k",
) -> List[Tuple[str, str, float]]:
    """
    Calcula delta de indicador entre semestres para cada PL.

    bills: sequência com 'municipio', 'data_apresentacao' (YYYY-MM-DD) e 'acao'.
    indicator_df: DataFrame com colunas cidade, ano, semestre e valor do indicador.
    """
    lookup: Dict[Tuple[str, int, int], float] = {}
    for _, row in indicator_df.iterrows():
        key = (str(row[city_col]).upper(), int(row["ano"]), int(row["semestre"]))
        lookup[key] = float(row[value_col])

    results: List[Tuple[str, str, float]] = []
    for row in bills:
        if "data_apresentacao" not in row or "municipio" not in row:
            continue

        year, semester = _encode_semester(str(row["data_apresentacao"]))
        city = str(row["municipio"]).upper()

        current = lookup.get((city, year, semester))
        next_key = (city, year, 2) if semester == 1 else (city, year + 1, 1)
        future = lookup.get(next_key)

        if current is None or future is None:
            continue

        delta = future - current
        results.append((row["municipio"], row.get("acao", ""), delta))

    return results

