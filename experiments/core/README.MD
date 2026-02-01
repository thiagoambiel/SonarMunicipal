# Modulo core (Sonar Municipal)

Este modulo concentra as funcoes reutilizaveis para carregar dados, gerar
embeddings, realizar busca semantica e agrupar Projetos de Lei em politicas
publicas com base em indicadores.

## Para que serve
- Carregar o dataset de PLs com embeddings.
- Fazer busca semantica por consultas textuais.
- Calcular efeitos de indicadores ao longo do tempo.
- Agrupar PLs semelhantes em politicas com criterios de qualidade.

## Pre-requisitos
- Python 3.9+
- Dependencias principais: `numpy`, `sentence-transformers`
- Para efeitos com indicadores: `pandas`

Instalacao minima:
```bash
pip install numpy sentence-transformers pandas
```

## Formato esperado do dataset
O arquivo `dataset.npy` deve conter uma lista de dicionarios com, no minimo:
- `municipio` (str)
- `uf` (str)
- `data_apresentacao` (YYYY-MM-DD)
- `ementa` (str)
- `acao` (str)
- `embedding` (lista ou array de floats)

## Funcoes principais
Disponiveis via `from core import ...`:

| Funcao | Descricao |
| --- | --- |
| `load_actions_dataset(path)` | Carrega a lista de dicionarios do `.npy`. |
| `extract_embeddings(dataset)` | Empilha embeddings em matriz `N x D`. |
| `load_sentence_model(model_name, device)` | Carrega o modelo E5. |
| `semantic_search(query, dataset, model, embeddings=None, top_k=5)` | Retorna PLs mais proximos com `score` e `index`. |
| `compute_effects_from_indicator(bills, indicator_df, city_col, value_col, effect_window_months, min_value)` | Calcula variacao percentual entre semestres. |
| `group_bills_by_structure(bills, threshold)` | Agrupa por similaridade textual (Jaccard). |
| `generate_policies_from_bills(bills, min_group_members, similarity_threshold, criterion)` | Gera politicas agregadas e ordena por qualidade. |
| `by_win_rate(scores)` | Criterio de qualidade por taxa de vitoria. |
| `by_magnitude(scores)` | Criterio de qualidade por magnitude. |
| `normalize_and_tokenize(text)` | Normalizacao e tokenizacao de texto. |
| `jaccard_similarity(a, b)` | Similaridade Jaccard entre tokens. |

## Exemplo: busca semantica
```python
from core import load_actions_dataset, extract_embeddings, load_sentence_model, semantic_search

dataset = load_actions_dataset("data/dataset.npy")
embeddings = extract_embeddings(dataset)
model = load_sentence_model()

results = semantic_search(
    "Como reduzir a criminalidade no municipio?",
    dataset,
    model,
    embeddings,
    top_k=5,
)

for row in results:
    print(row["municipio"], row.get("uf", "-"), row["acao"], row["score"])
```

## Exemplo: efeitos e politicas
```python
import pandas as pd
from core import (
    load_actions_dataset,
    compute_effects_from_indicator,
    generate_policies_from_bills,
)

dataset = load_actions_dataset("data/dataset.npy")
indicator = pd.read_csv("data/criminal_indicator.csv")

bills = compute_effects_from_indicator(
    dataset,
    indicator,
    city_col="municipio_norm",
    value_col="taxa_homicidios_100k",
    effect_window_months=6,
    min_value=5,
)

policies = generate_policies_from_bills(
    bills,
    min_group_members=2,
    similarity_threshold=0.75,
)

for p in policies:
    print(p["policy"], p["quality_score"], p["effect_mean"])
```

## Observacoes importantes
- `semantic_search` usa prefixo `"query: "` para compatibilidade com E5.
- `effect_window_months` deve ser multiplo de 6 (semestres).
- Indicadores com efeito negativo sao tratados como melhoria (criterios em `criterion.py`).
