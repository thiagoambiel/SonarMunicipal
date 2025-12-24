# Como construir o dataset

Este guia explica o pipeline completo para produzir o dataset de projetos de lei e ações, a partir da descoberta de instâncias SAPL até o arquivo final usado pelo módulo `core/`.

## Visão geral do pipeline
1. **Descobrir instâncias SAPL** com `sapl_finder`.
2. **Raspar projetos de lei** (PLs) dessas instâncias com `sapl_scrapper`.
3. **Gerar ações operacionais a partir das ementas** usando o modelo `ptt5v2-pl-text2action`.
4. **Construir o dataset final** com embeddings e metadados (`dataset.npy`), reaproveitando os notebooks da pasta `notebooks/`.

Os passos abaixo assumem Python 3.9+ e `pip`.

## 1) Encontrar instâncias SAPL (tools/sapl_finder)
O módulo `sapl_finder` localiza portais SAPL ativos varrendo:
- heurística de domínio por lista de municípios do IBGE;
- certificados do crt.sh.

Comando típico:
```bash
python -m tools.sapl_finder \
  --strategy all \
  --concurrency 200 \
  --out-csv data/sapl_hosts.csv \
  --out-json data/sapl_hosts.json
```

Saídas:
- `data/sapl_hosts.csv`: hosts SAPL confirmados (ibge_id, município, uf, url, etc.).
- `data/sapl_hosts.json`: o mesmo, em JSON agregado.
- `data/sapl_hosts.jsonl`: escrito incrementalmente durante a busca (usado pelo scrapper).
- `data/sapl_hosts_candidates.jsonl`: lista de hosts candidatos vindos do crt.sh (sem validação).

## 2) Baixar projetos de lei (tools/sapl_scrapper)
O módulo `sapl_scrapper` lê o JSONL produzido pelo finder e coleta PLs via API do SAPL.

Exemplo:
```bash
python -m tools.sapl_scrapper \
  --in-jsonl data/sapl_hosts.jsonl \
  --out-csv data/pl.csv \
  --out-json data/pl.json \
  --page-size 100
```

Saídas:
- `data/pl.csv`: PLs com campos básicos (ementa, número, ano, data, tramitação opcional).
- `data/pl.jsonl`: PLs linha a linha (útil para streaming/continuação).
- `data/pl.json`: JSON agregado com todos os registros.

## 3) Gerar ações (ementa -> ação)
Use o modelo `thiagoambiel/ptt5v2-pl-text2action` (Hugging Face) para converter ementas em ações imperativas.

Referência: notebook `notebooks/sonar-municipal-ptt5-v2-text2action-inference-on-pls.py`.

Passos resumidos:
1. Baixe/prepare `pl.jsonl` da etapa anterior.
2. Rode o notebook ou adapte o código para gerar `pl_actions.jsonl`, contendo `{ "ementa": ..., "acao": ... }`.
   - O script suporta checkpoints (`.ckpt.json`) para retomar geração em lotes.

Saída esperada:
- `pl_actions.jsonl`: mapeia cada ementa para uma ação sintetizada.

## 4) Montar o dataset final (embeddings + metadados)
Use o notebook `notebooks/SonarMunicipal_Build_the_Base_Action_Recommendation_Dataset.py` como referência:
- Carrega `pl.jsonl` (metadados) e `pl_actions.jsonl` (ações geradas).
- Normaliza e deduplica ementas.
- Anexa a ação correspondente.
- Gera embeddings das ações com `sentence-transformers` (`embaas/sentence-transformers-multilingual-e5-base`).
- Salva tudo em `dataset.npy` (lista de dicionários com municipio, uf, ementa, acao, embedding, etc.).

Depois disso, você pode consumir `dataset.npy` no módulo `core/`:
```python
from core import load_actions_dataset, extract_embeddings, load_sentence_model, semantic_search

dataset = load_actions_dataset("data/dataset.npy")
emb = extract_embeddings(dataset)
model = load_sentence_model()
print(semantic_search("Como reduzir criminalidade?", dataset, model, emb, top_k=5))
```

## 5) Análises e qualidade das políticas (opcionais)
- `notebooks/SonarMunicipal_Action_Recommendation_Dataset_Analysis.py`: exploração básica e busca semântica.
- `notebooks/SonarMunicipal_Correlation_Between_Policies_and_Indicators.py`: cruza PLs com indicadores (ex.: homicídios) e gera políticas agregadas com testes estatísticos.

## Dependências principais
- `httpx`, `asyncio`, `tqdm`, `pandas`, `numpy`, `sentence-transformers`, `torch`, `transformers`, `scipy` (para testes estatísticos).
- GPUs aceleram a geração das ações, mas não são obrigatórias para o scraping.

Use este guia como checklist para reconstruir o dataset do zero ou atualizar com novos PLs.
