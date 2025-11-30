# CityManager

Ferramentas para descobrir instâncias SAPL, raspar projetos de lei municipais, gerar ações operacionais a partir das ementas e trabalhar com o dataset resultante (busca semântica e geração de políticas).

## Visão geral
- `sapl_finder`: encontra portais SAPL ativos (IBGE + crt.sh) e salva endpoints confirmados.
- `sapl_scrapper`: coleta Projetos de Lei (PLs) via API do SAPL e salva em CSV/JSON/JSONL.
- `notebooks/citymanager-ptt5-v2-text2action-*`: inferência e fine-tuning do modelo que converte ementa -> ação.
- `core/`: funções reutilizáveis para carregar o dataset (`.npy`), fazer busca semântica e agrupar políticas por efeito.
- `DATASET.MD`: guia passo a passo para reconstruir o dataset do zero.

## Estrutura do repositório
- `core/`: módulo Python organizado em submódulos (`data`, `model`, `search`, `text`, `policies`, `indicators`).
- `sapl_finder/`: CLI assíncrona para descobrir instâncias SAPL.
- `sapl_scrapper/`: CLI assíncrona para coletar PLs dos SAPLs encontrados.
- `notebooks/`: scripts/notebooks de treinamento, inferência e análises.
- `DATASET.MD`: documentação de criação do dataset.

## Requisitos rápidos
- Python 3.9+
- Dependências principais: `httpx`, `tqdm`, `pandas`, `numpy`, `sentence-transformers`, `torch`, `transformers`, `scipy`.
- Instalação típica para uso do módulo `core/` e das CLIs:
  ```bash
  pip install httpx tqdm pandas numpy sentence-transformers torch transformers scipy
  ```
  GPUs aceleram a etapa de geração de ações, mas o scraping funciona só com CPU.

## Usar os dados do autor (dataset pronto)
Se você já possui o arquivo `dataset.npy` (gerado pelos notebooks ou baixado do autor):
```python
from core import load_actions_dataset, extract_embeddings, load_sentence_model, semantic_search

dataset = load_actions_dataset("data/dataset.npy")
emb = extract_embeddings(dataset)
model = load_sentence_model()

matches = semantic_search("Como reduzir a criminalidade no município?", dataset, model, emb, top_k=5)
for m in matches:
    print(m["municipio"], m.get("uf", "-"), m["acao"], f"(score={m['score']:.3f})")
```

## Criar seus próprios dados
Siga o guia detalhado em `DATASET.MD`. Resumo:
1. **Descobrir SAPLs**: `python -m sapl_finder --strategy all --out-csv data/sapl_hosts.csv --out-json data/sapl_hosts.json`
2. **Raspar PLs**: `python -m sapl_scrapper --in-jsonl data/sapl_hosts.jsonl --out-csv data/pl.csv --out-json data/pl.json`
3. **Gerar ações (ementa -> ação)** com o modelo `thiagoambiel/ptt5v2-pl-text2action` usando o notebook `citymanager-ptt5-v2-text2action-inference-on-pls.py`, produzindo `pl_actions.jsonl`.
4. **Montar o dataset final** (`dataset.npy`) combinando `pl.jsonl` + `pl_actions.jsonl` e gerando embeddings (veja `CityManager_Build_the_Base_Action_Recommendation_Dataset.py`).
5. **(Opcional)** Rodar análises e geração de políticas com `CityManager_Correlation_Between_Policies_and_Indicators.py`.

## Modelos e notebooks
- Modelo de inferência: `thiagoambiel/ptt5v2-pl-text2action` (Hugging Face). Notebook `citymanager-ptt5-v2-text2action-inference-on-pls.py` mostra como gerar ações em lote.
- Fine-tuning: `citymanager-ptt5-v2-fine-tuning-ementa2action.py` (treino LoRA/QLoRA sobre PTT5).
- Análises: `CityManager_Action_Recommendation_Dataset_Analysis.py` e `CityManager_Correlation_Between_Policies_and_Indicators.py` exploram similaridade e impacto em indicadores.

## Uso do módulo core
APIs disponíveis via `from core import ...`:
- `load_actions_dataset`, `extract_embeddings`, `load_sentence_model`
- `semantic_search` (busca semântica)
- `generate_policies_from_bills` e utilitários em `policies`/`indicators` para agrupar ações e medir efeito com indicadores externos.

### Exemplo: gerar políticas públicas a partir de efeitos
```python
from core import generate_policies_from_bills

# Lista de (municipio, descricao_do_pl, efeito_no_indicador)
# efeito < 0 indica melhora (ex.: redução de homicídios)
bills = [
    ("Campinas", "Instalação de câmeras de monitoramento em praças", -1.8),
    ("Sorocaba", "Programa de iluminação de vias locais", -0.4),
    ("Campinas", "Expansão de rondas comunitárias", -1.2),
    ("Jundiaí", "Criação de patrulha escolar", 0.3),
]

policies = generate_policies_from_bills(bills, similarity_threshold=0.7)

for p in policies:
    if len(p["actions"]) < 2:
        continue  # pede pelo menos 2 ações similares
    print(f"Política: {p['policy']}")
    print(f"  qualidade: {p['quality_score']:.3f}")
    print(f"  efeito médio: {p['effect_mean']:.3f} (std {p['effect_std']:.3f})")
    print("  ações:")
    for mun, desc, score in p["actions"]:
        print(f"    - {mun}: {score:.3f} | {desc}")
```

### Exemplo: calcular efeitos usando um indicador real
Baseado em `notebooks/CityManager_Correlation_Between_Policies_and_Indicators.py`, o fluxo é:
1. Ter um DataFrame de indicadores semestrais por município (ex.: `taxa_homicidios_100k` com colunas `municipio_norm`, `ano`, `semestre`).
2. Calcular o delta semestre a semestre para cada PL.
3. Gerar políticas com as ações e efeitos calculados.

```python
import pandas as pd
from core import load_actions_dataset, compute_effects_from_indicator, generate_policies_from_bills

# 1) Carregue o dataset de PLs/ações (precisa ter 'municipio', 'data_apresentacao', 'acao')
dataset = load_actions_dataset("data/dataset.npy")

# 2) Carregue o indicador (mesma normalização de nomes de cidade usada no indicador)
indicator = pd.read_csv("data/criminal_indicator.csv")  # deve conter municipio_norm, ano, semestre, taxa_homicidios_100k

# 3) Compute os efeitos (delta entre semestre atual e próximo)
effects = compute_effects_from_indicator(
    bills=dataset,
    indicator_df=indicator,
    city_col="municipio_norm",
    value_col="taxa_homicidios_100k",
)

# effects é uma lista de (municipio, descricao_do_pl, delta_indicador)
policies = generate_policies_from_bills(effects, similarity_threshold=0.75)

# 4) Ordene e inspecione
policies = sorted(policies, key=lambda x: x["quality_score"], reverse=True)
for p in policies[:5]:
    print(f"Política: {p['policy']}")
    print(f"  qualidade: {p['quality_score']:.3f}")
    print(f"  efeito médio: {p['effect_mean']:.3f}")
    print(f"  ações: {len(p['actions'])}")
```

## CLI rápida (finder/scrapper)
- Descobrir SAPLs:
  ```bash
  python -m sapl_finder --strategy all --concurrency 200 --out-csv data/sapl_hosts.csv --out-json data/sapl_hosts.json
  ```
- Raspar PLs:
  ```bash
  python -m sapl_scrapper --in-jsonl data/sapl_hosts.jsonl --out-csv data/pl.csv --out-json data/pl.json
  ```

## Observações
- Os dados brutos (PLs, ações, indicadores) não estão no repositório; siga `DATASET.MD` para reconstruí-los.
- Ajuste caminhos e tamanhos de lote conforme sua infraestrutura (GPU/CPU, memória, rede).
