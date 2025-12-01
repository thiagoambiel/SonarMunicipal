# CityManager

Pipeline para descobrir instâncias SAPL, raspar projetos de lei municipais, transformar ementas em ações operacionais e gerar recomendações de políticas públicas com busca semântica e análise de indicadores.

> Estrutura atualizada: todo o backend está agora dentro de `backend/`. Considere os caminhos e comandos abaixo relativos a essa pasta.

## Para que serve
- Montar um dataset estruturado de projetos de lei + ações executáveis geradas por IA.
- Localizar rapidamente PLs semelhantes a uma necessidade (“query → PLs”).
- Agrupar PLs parecidos em “políticas” e estimar qualidade a partir do efeito em indicadores (ex.: homicídios).
- Expor tudo via módulo Python reutilizável ou API FastAPI.

## O que já está implementado
- **Descoberta de SAPL** (`tools/sapl_finder`): busca instâncias ativas combinando IBGE e crt.sh, validando endpoints de forma incremental.
- **Raspagem de PLs** (`tools/sapl_scrapper`): coleta tipos de PL, pagina matérias, opcionalmente puxa última tramitação e salva em CSV/JSON/JSONL com deduplicação.
- **Geração de ações** (`notebooks/citymanager-ptt5-v2-text2action-*`): usa o modelo `thiagoambiel/ptt5v2-pl-text2action` para converter ementa → ação imperativa.
- **Módulo core** (`core/`): funções para carregar o dataset, extrair embeddings, fazer busca semântica, cruzar PLs com indicadores e agrupar políticas.
- **API FastAPI** (`api/`): expõe busca, cálculo de efeitos de indicadores e geração de políticas.
- **Guias** (`DATASET.MD`): passo a passo para reconstruir o dataset.

## Como foi implementado (resumo técnico)
- Rede/IO: CLIs assíncronas com `httpx.AsyncClient`, `asyncio.Semaphore` e escrita incremental (flush a cada registro) para tolerar longas execuções.
- Heurísticas SAPL: detecção de endpoints via caminhos padrão, varredura de links e marcadores de HTML; particionamento de consultas a crt.sh para evitar 429/503.
- Raspagem: identifica tipos “projeto de lei” por normalização (NFKD + lowercase), segue paginação nativa do SAPL e do DRF, e guarda última tramitação quando habilitada.
- IA/NLP: embeddings com `sentence-transformers` (`embaas/sentence-transformers-multilingual-e5-base`); similaridade por produto interno com normalização; agrupamento textual por Jaccard.
- Políticas: agrupa ações parecidas mantendo uma por município (melhor efeito), calcula média/desvio dos efeitos e ranqueia por taxa de “vitória” (efeitos negativos).

## Estrutura do repositório
- `core/`: `data.py`, `model.py`, `search.py`, `text.py`, `policies.py`, `criterion.py`, `indicators.py`.
- `tools/sapl_finder/`: CLI para descobrir SAPLs.
- `tools/sapl_scrapper/`: CLI para raspar PLs de SAPLs confirmados.
- `tools/ementa2action/` e `tools/indicators/`: artefatos auxiliares e exemplos.
- `notebooks/`: inferência, fine-tuning e análises (correlação com indicadores, exploração do dataset).
- `api/`: servidor FastAPI (`api/main.py`).
- `DATASET.MD`: guia detalhado de reconstrução do dataset.

## Pré-requisitos
- Python 3.9+
- Dependências principais: `httpx`, `asyncio`, `tqdm`, `pandas`, `numpy`, `sentence-transformers`, `torch`, `transformers`, `scipy`, `fastapi`, `uvicorn`.
- Instalação mínima para módulo e CLIs:
  ```bash
  pip install httpx tqdm pandas numpy sentence-transformers torch transformers scipy fastapi uvicorn
  ```
  GPUs aceleram a geração de ações; descoberta e raspagem funcionam apenas com CPU.

## Formatos de entrada e saída esperados
- **Descoberta (`sapl_finder`)**
  - Entrada: nenhuma (consulta IBGE + crt.sh).
  - Saídas principais:
    - `sapl_hosts.csv` / `sapl_hosts.json`: endpoints confirmados com `ibge_id`, `municipio`, `uf`, `sapl_url`, `source`, `http_status`, `marker`, `title`.
    - `sapl_hosts.jsonl`: escrita incremental, ideal para alimentar o scrapper.
    - `sapl_hosts_candidates.jsonl`: candidatos brutos do crt.sh (sem validação).
- **Raspagem (`sapl_scrapper`)**
  - Entrada: `sapl_hosts.jsonl` gerado pelo finder.
  - Saídas:
    - `pl.csv`: colunas `sapl_base`, `sapl_url`, `municipio`, `uf`, `tipo_id`, `tipo_label`, `materia_id`, `numero`, `ano`, `ementa`, `data_apresentacao`, `em_tramitacao`, `situacao`, `link_publico`, `ultima_tramitacao_data`, `ultima_tramitacao_status`.
    - `pl.jsonl`: registros completos (incremental).
    - `pl.json`: JSON agregado ao final.
- **Dataset final (`dataset.npy`)**
  - Lista de dicionários contendo ao menos `municipio`, `uf`, `ementa`, `acao` (gerada), `data_apresentacao`, `embedding` (vetor float32), mais metadados herdados do scrapper.
- **Indicadores externos**
  - DataFrame com colunas padrão `municipio_norm`, `uf`, `ano`, `semestre` e o valor do indicador (ex.: `taxa_homicidios_100k`).

## Como usar: atalhos
- **Se já tiver `dataset.npy`** (fornecido ou produzido pelos notebooks):
  ```python
  from core import load_actions_dataset, extract_embeddings, load_sentence_model, semantic_search

  dataset = load_actions_dataset("data/dataset.npy")
  emb = extract_embeddings(dataset)
  model = load_sentence_model()

  for m in semantic_search("Como reduzir a criminalidade no município?", dataset, model, emb, top_k=5):
      print(m["municipio"], m.get("uf", "-"), m["acao"], f"(score={m['score']:.3f})")
  ```
- **Para reconstruir seus dados** (detalhes em `DATASET.MD`):
  1. Descobrir SAPLs  
     `python -m tools.sapl_finder --strategy all --concurrency 200 --out-csv data/sapl_hosts.csv --out-json data/sapl_hosts.json`
  2. Raspar PLs  
     `python -m tools.sapl_scrapper --in-jsonl data/sapl_hosts.jsonl --out-csv data/pl.csv --out-json data/pl.json`
  3. Gerar ações (ementa → ação) com o notebook `notebooks/citymanager-ptt5-v2-text2action-inference-on-pls.py`, produzindo `pl_actions.jsonl`.
  4. Montar `dataset.npy` com o notebook `notebooks/CityManager_Build_the_Base_Action_Recommendation_Dataset.py` (une PL + ação, normaliza e gera embeddings).
  5. (Opcional) Rodar análises/correlação com indicadores (`notebooks/CityManager_Correlation_Between_Policies_and_Indicators.py`).

## Uso do módulo `core`
- Principais funções (`from core import ...`):
  - `load_actions_dataset(path)`: carrega lista de dicionários do `dataset.npy`.
  - `extract_embeddings(dataset)`: empilha `embedding` em matriz `N x D`.
  - `load_sentence_model(model_name, device)`: carrega modelo E5 (ou outro) via `sentence-transformers`.
  - `semantic_search(query, dataset, model, embeddings=None, top_k=5)`: retorna PLs mais semelhantes (com `score` e `index`).
  - `compute_effects_from_indicator(bills, indicator_df, city_col, value_col, effect_window_months=6)`: calcula delta do indicador na janela escolhida (múltiplos de 6 meses) para cada PL.
  - `generate_policies_from_bills(bills, min_group_members, similarity_threshold, criterion)`: agrupa ações parecidas em políticas, removendo duplicatas por município e ranqueando por qualidade.
- Exemplo rápido (gerar políticas a partir de efeitos simulados):
  ```python
  from core import generate_policies_from_bills

  bills = [
      ("Campinas", "Instalação de câmeras de monitoramento em praças", -1.8),
      ("Sorocaba", "Programa de iluminação de vias locais", -0.4),
      ("Campinas", "Expansão de rondas comunitárias", -1.2),
      ("Jundiaí", "Criação de patrulha escolar", 0.3),
  ]

  policies = generate_policies_from_bills(bills, similarity_threshold=0.7)
  for p in policies:
      print(p["policy"], f"qualidade={p['quality_score']:.3f}", f"efeito_médio={p['effect_mean']:.3f}")
  ```
- Exemplo com indicador real (delta semestre):
  ```python
  import pandas as pd
  from core import load_actions_dataset, compute_effects_from_indicator, generate_policies_from_bills

  dataset = load_actions_dataset("data/dataset.npy")
  indicator = pd.read_csv("data/criminal_indicator.csv")  # municipio_norm, uf, ano, semestre, taxa_homicidios_100k

  effects = compute_effects_from_indicator(dataset, indicator, city_col="municipio_norm", value_col="taxa_homicidios_100k")
  policies = generate_policies_from_bills(effects, similarity_threshold=0.75)
  ```

## API FastAPI
- Instalação: `pip install -r requirements.txt`.
- Subir localmente: `uvicorn api.main:app --reload --port 8000`.
- Variáveis de ambiente úteis: `DATASET_PATH`, `SENTENCE_MODEL_NAME`, `CRIMINAL_INDICATOR_PATH`, `CRIMINAL_INDICATOR_CITY_COL`, `CRIMINAL_INDICATOR_VALUE_COL`.
- Endpoints:
  - `GET /health`: status e indicadores carregados.
  - `GET /indicators`: lista indicadores disponíveis.
  - `POST /search`: body `{"query": "...", "top_k": 5}` → PLs similares com `index`.
  - `POST /indicator-effects`: body `{"indicator": "criminal_indicator", "bill_indexes": [1,2,3], "effect_window_months": 6}` → somente PLs com indicador + delta calculado na janela (múltiplos de 6 meses).
  - `POST /policies`: body `{"indicator": "criminal_indicator", "bill_indexes": [...], "min_group_members": 2, "similarity_threshold": 0.75, "effect_window_months": 6}` → políticas agregadas.
- Fluxo sugerido: `/search` → coletar `index` → `/indicator-effects` → `/policies`.

## CLIs principais
- **Descobrir SAPLs**  
  ```bash
  python -m tools.sapl_finder --strategy all --concurrency 100 --timeout 20 --out-csv data/sapl_hosts.csv --out-json data/sapl_hosts.json
  ```
  Entradas: nenhuma. Saídas incrementais em CSV/JSON/JSONL. Ajuste `--strategy` (`ibge`, `crtsh`, `all`), `--concurrency` e `--timeout` conforme rede. Logs estruturados com `--log-json`.
- **Raspar PLs**  
  ```bash
  python -m tools.sapl_scrapper --in-jsonl data/sapl_hosts.jsonl --out-csv data/pl.csv --out-json data/pl.json --concurrency 100 --page-size 200
  ```
  Entrada: `sapl_hosts.jsonl`. Saídas incrementais `pl.csv`/`pl.jsonl` + `pl.json`. Use `--no-tramitacao` para execuções mais leves; amostre hosts com `head` para testes rápidos.

## Dicas de uso
- Prefira execuções incrementais: tanto finder quanto scrapper escrevem linha a linha, permitindo retomar facilmente.
- Conexões: 50–150 no finder e 10–100 no scrapper são estáveis; reduza em redes restritivas.
- Timeout: aumente para 40–60s em redes lentas; diminua para iterar rápido em testes.
- GPU: só necessária para gerar ações; todo o pipeline de coleta funciona em CPU.
- Normalização de cidades: indicadores devem usar o mesmo formato (`municipio_norm`, `uf`) que o dataset; revise o notebook de correlação para exemplos de limpeza.
