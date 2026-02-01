# Módulo core (Sonar Municipal)

Este módulo concentra as funções reutilizáveis para carregar dados, gerar
embeddings, realizar busca semântica e agrupar Projetos de Lei em políticas
públicas com base em indicadores.

## Para que serve
- Carregar o dataset de PLs com embeddings.
- Fazer busca semântica por consultas textuais.
- Calcular efeitos de indicadores ao longo do tempo.
- Agrupar PLs semelhantes em políticas com critérios de qualidade.

## Pré-requisitos
- Python 3.9+
- Dependências principais: `numpy`, `sentence-transformers`
- Para efeitos com indicadores: `pandas`

Instalação mínima:
```bash
pip install numpy sentence-transformers pandas
```

## Formato esperado do dataset
O arquivo `dataset.npy` deve conter uma lista de dicionários com, no mínimo:
- `municipio` (str)
- `uf` (str)
- `data_apresentacao` (YYYY-MM-DD)
- `ementa` (str)
- `acao` (str)
- `embedding` (lista ou array de floats)

## Funções principais
Disponíveis via `from core import ...`:

| Função | Descrição |
| --- | --- |
| `load_actions_dataset(path)` | Carrega a lista de dicionários do `.npy`. |
| `extract_embeddings(dataset)` | Empilha embeddings em matriz `N x D`. |
| `load_sentence_model(model_name, device)` | Carrega o modelo E5. |
| `semantic_search(query, dataset, model, embeddings=None, top_k=5)` | Retorna PLs mais próximos com `score` e `index`. |
| `compute_effects_from_indicator(bills, indicator_df, city_col, value_col, effect_window_months, min_value)` | Calcula variação percentual entre semestres. |
| `group_bills_by_structure(bills, threshold)` | Agrupa por similaridade textual (Jaccard). |
| `generate_policies_from_bills(bills, min_group_members, similarity_threshold, criterion)` | Gera políticas agregadas e ordena por qualidade. |
| `by_win_rate(scores)` | Critério de qualidade por taxa de vitória. |
| `by_magnitude(scores)` | Critério de qualidade por magnitude. |
| `normalize_and_tokenize(text)` | Normalização e tokenização de texto. |
| `jaccard_similarity(a, b)` | Similaridade Jaccard entre tokens. |

## Exemplo: busca semântica
```python
from core import load_actions_dataset, extract_embeddings, load_sentence_model, semantic_search

dataset = load_actions_dataset("data/dataset.npy")
embeddings = extract_embeddings(dataset)
model = load_sentence_model()

results = semantic_search(
    "Como reduzir a criminalidade no município?",
    dataset,
    model,
    embeddings,
    top_k=5,
)

for row in results:
    print(row["municipio"], row.get("uf", "-"), row["acao"], row["score"])
```

## Exemplo: efeitos e políticas
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

## Observações importantes
- `semantic_search` usa prefixo `"query: "` para compatibilidade com E5.
- `effect_window_months` deve ser múltiplo de 6 (semestres).
- Indicadores com efeito negativo são tratados como melhoria (critérios em `criterion.py`).
