# CityManager Core

Funções reutilizáveis para trabalhar com o dataset de ações e projetos de lei do CityManager fora dos notebooks.

Estrutura em módulos pequenos dentro do pacote `core/`:
- `data.py`: carregamento de dataset/embeddings
- `model.py`: carregamento do modelo de texto
- `search.py`: busca semântica
- `text.py`: utilidades de texto/tokenização
- `policies.py`: agrupamento e métricas de políticas
- `indicators.py`: cálculo de efeito a partir de indicadores

## O que está pronto
- Carregar o dataset salvo em `.npy`.
- Carregar o modelo de embeddings `sentence-transformers`.
- Buscar projetos de lei por similaridade semântica.
- Agrupar projetos e gerar candidatas a políticas públicas com métricas simples.
- (Opcional) Calcular efeito de projetos usando uma tabela de indicadores semestrais.

## Instalação rápida
```bash
pip install numpy sentence-transformers scipy pandas
```
`scipy` e `pandas` só são usados nas funções de efeito/indicador; para busca semântica, apenas `numpy` e `sentence-transformers` já funcionam.

## Como usar

### 1) Carregar dados e buscar por semântica
```python
from core import load_actions_dataset, load_sentence_model, extract_embeddings, semantic_search

# dataset.npy deve conter os dicionários com campos como municipio, uf, acao, embedding, data_apresentacao
dataset = load_actions_dataset("data/dataset.npy")
model = load_sentence_model()
embeddings = extract_embeddings(dataset)

matches = semantic_search(
    "Como reduzir a criminalidade no município?",
    dataset,
    model,
    embeddings=embeddings,
    top_k=5,
)

for m in matches:
    print(f"{m['municipio']} ({m.get('uf', '-')}) | score={m['score']:.3f}")
    print("  ", m.get("acao", ""))
```

### 2) Gerar políticas a partir de efeitos medidos
Passe uma lista de `(municipio, descricao_do_pl, efeito)` onde `efeito` é a variação do indicador (negativo = melhora).
```python
from core import generate_policies_from_bills

bills = [
    ("Campinas", "Instalação de câmeras de monitoramento em praças", -1.8),
    ("Sorocaba", "Programa de iluminação de vias locais", -0.4),
    ("Campinas", "Expansão de rondas comunitárias", -1.2),
]

policies = generate_policies_from_bills(bills, similarity_threshold=0.7)

for p in policies:
    if len(p["actions"]) < 2:
        continue
    print(f"Política: {p['policy']}")
    print(f"  qualidade: {p['quality_score']:.3f}")
    print(f"  efeito médio: {p['effect_mean']:.3f} (std {p['effect_std']:.3f})")
    print(f"  efetiva? {p['effective']}")
    print("  ações:")
    for mun, desc, score in p["actions"]:
        print(f"    - {mun}: {score:.3f} | {desc}")
    print()
```

### 3) Medir efeito usando indicadores (opcional)
Se você tiver um CSV com colunas `municipio_norm`, `ano`, `semestre` e um valor de indicador (ex.: `taxa_homicidios_100k`), dá para calcular o delta e alimentar o gerador de políticas.
```python
import pandas as pd
from core import compute_effects_from_indicator, generate_policies_from_bills

indicator = pd.read_csv("data/criminal_indicator.csv")

# Cada item do dataset deve ter 'municipio', 'data_apresentacao' (YYYY-MM-DD) e 'acao'
effects = compute_effects_from_indicator(
    bills=dataset,  # pode ser o mesmo dataset carregado acima
    indicator_df=indicator,
    city_col="municipio_norm",
    value_col="taxa_homicidios_100k",
)

policies = generate_policies_from_bills(effects, similarity_threshold=0.7)
```

## Funções principais (pacote `core`)
- `load_actions_dataset(path)` – lê o `.npy` com as ações/projetos.
- `load_sentence_model(model_name, device)` – carrega o modelo de texto.
- `extract_embeddings(dataset)` – empilha embeddings do dataset.
- `semantic_search(query, dataset, model, embeddings, top_k)` – busca projetos similares.
- `compute_effects_from_indicator(bills, indicator_df, city_col, value_col)` – calcula delta de indicador semestre a semestre.
- `generate_policies_from_bills(bills, similarity_threshold, alpha)` – agrupa projetos parecidos e gera políticas ranqueadas por `quality_score`.

Mantive as ideias dos notebooks, mas com funções diretas e sem dependências do Jupyter. Qualquer ajuste de nomes de colunas/datasets pode ser feito alterando os parâmetros das funções.
