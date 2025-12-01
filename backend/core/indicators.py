from datetime import datetime
from typing import Any, Dict, List, Sequence, Tuple


def _encode_semester(date_str: str) -> Tuple[int, int]:
    date = datetime.strptime(date_str, "%Y-%m-%d")
    semester = 1 if date.month <= 6 else 2
    return date.year, semester


def _advance_semester(year: int, semester: int, semesters_ahead: int) -> Tuple[int, int]:
    target = (semester - 1) + semesters_ahead
    return year + target // 2, (target % 2) + 1


def compute_effects_from_indicator(
    bills: Sequence[Dict[str, Any]],
    indicator_df: Any,
    city_col: str = "municipio_norm",
    value_col: str = "taxa_homicidios_100k",
    effect_window_months: int = 6,
) -> List[Tuple[str, str, float]]:
    """
    Calcula delta de indicador entre semestres para cada PL.

    bills: sequência com 'municipio', 'data_apresentacao' (YYYY-MM-DD) e 'acao'.
    indicator_df: DataFrame com colunas cidade, ano, semestre e valor do indicador.
    effect_window_months: janela temporal para comparar o indicador (múltiplos de 6 meses).
    """
    lookup: Dict[Tuple[str, int, int], float] = {}
    for _, row in indicator_df.iterrows():
        key = (str(row[city_col]).upper(), str(row['uf']), int(row["ano"]), int(row["semestre"]))
        lookup[key] = float(row[value_col])

    semesters_ahead = max(1, effect_window_months // 6)
    results: List[Tuple[str, str, float]] = []
    for row in bills:
        if "data_apresentacao" not in row or "municipio" not in row:
            continue

        year, semester = _encode_semester(str(row["data_apresentacao"]))
        city = str(row["municipio"]).upper()
        uf = str(row['uf']).upper()

        current = lookup.get((city, uf, year, semester))
        future_year, future_semester = _advance_semester(year, semester, semesters_ahead)
        future = lookup.get((city, uf, future_year, future_semester))

        if current is None or future is None:
            continue

        delta = future - current
        results.append((row["municipio"], row.get("acao", ""), delta))

    return results
