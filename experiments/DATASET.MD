# Como construir o dataset

Este guia explica como obter o arquivo final `dataset.npy` consumido pelo módulo `core/` e a
collection vetorial usada pela plataforma. Há dois caminhos:

- **Caminho rápido (recomendado)** — parte dos artefatos publicados no Hugging Face e só gera,
  localmente, os embeddings. É o suficiente para **rodar o algoritmo** e **hospedar a plataforma**.
- **Caminho completo (opcional)** — reconstrói tudo do zero (descoberta no sistema SAPL,
  raspagem, geração de ações). Útil apenas para atualizar o corpus com novos PLs ou auditar a
  coleta.

Os passos assumem Python 3.9+ e `pip`.

## Artefatos publicados

| Artefato | Hub | Conteúdo |
| --- | --- | --- |
| **Dataset** | [`thiagoambiel/sonar-municipal-pl-actions`](https://huggingface.co/datasets/thiagoambiel/sonar-municipal-pl-actions) | subset `default` (~241k PLs com `ementa` + `acao` + metadados) e subset `supervised` (999 pares de treino) |
| **Modelo** | [`thiagoambiel/sonar_municipal_ptt5_ementa2action`](https://huggingface.co/thiagoambiel/sonar_municipal_ptt5_ementa2action) | PTT5‑v2 que transforma ementa em ação imperativa |

O subset `default` já equivale ao resultado das três primeiras etapas do caminho do zero
(descoberta → raspagem → ação): cada linha traz `ementa`, a `acao` já gerada pelo modelo e os
metadados (`municipio`, `uf`, `materia_id`, `numero`, `ano`, `data_apresentacao`, `tipo_label`,
`tipo_id`, `em_tramitacao`, `link_publico`, `sapl_url`, `doc_id`). **Os embeddings não vêm no
dataset** — são gerados localmente com `embaas/sentence-transformers-multilingual-e5-base`.

---

## Caminho rápido (recomendado)

### 1) Baixar o corpus e montar `dataset.npy`
O notebook `notebooks/SonarMunicipal_Build_the_Base_Action_Recommendation_Dataset.ipynb` faz isso;
o trecho abaixo resume a lógica:

```python
from datasets import load_dataset
from sentence_transformers import SentenceTransformer
import numpy as np

# 1. Corpus publicado (já com ementa + acao + metadados)
ds = load_dataset("thiagoambiel/sonar-municipal-pl-actions", "default", split="train")
metadata = [dict(row) for row in ds]

# 2. Remove ementas vazias e deduplica por (municipio, uf, ementa)
seen, dedup = set(), []
for r in metadata:
    if not r.get("ementa"):
        continue
    key = (r["municipio"], r["uf"], r["ementa"])
    if key in seen:
        continue
    seen.add(key)
    dedup.append(r)
metadata = dedup

# 3. data_apresentacao -> 'YYYY-MM-DD' (o Hub entrega 'YYYY-MM-DD HH:MM:SS';
#    core/indicators.py espera só a data)
for r in metadata:
    r["data_apresentacao"] = str(r["data_apresentacao"])[:10]

# 4. Embeddings da acao com o E5 (normalizados para distância de cosseno)
model = SentenceTransformer("embaas/sentence-transformers-multilingual-e5-base")
acoes = [r["acao"] for r in metadata]
embeddings = model.encode(
    acoes, batch_size=256, show_progress_bar=True, normalize_embeddings=True
)
embeddings = np.asarray(embeddings, dtype=np.float16)
for idx, r in enumerate(metadata):
    r["embedding"] = embeddings[idx]

# 5. Salva no caminho que o core/, o eval/ e o Qdrant esperam
with open("data/dataset.npy", "wb") as f:
    np.save(f, metadata)
```

Saída: `experiments/data/dataset.npy` (lista de dicionários com `municipio`, `uf`, `ementa`,
`acao`, `embedding`, etc.).

### 2) Usar o algoritmo (módulo `core/`)
```python
from core import load_actions_dataset, extract_embeddings, load_sentence_model, semantic_search

dataset = load_actions_dataset("data/dataset.npy")
emb = extract_embeddings(dataset)
model = load_sentence_model()
print(semantic_search("Como reduzir criminalidade?", dataset, model, emb, top_k=5))
```

> **Casamento com indicadores (atenção a acentos).** Em `core/indicators.py` o município do PL é
> casado com o indicador apenas via `.upper()`, **sem remover acentos**. Por isso a coluna-chave
> do CSV de indicador deve ter a mesma forma acentuada do campo `municipio` — é o caso de
> `indicators/homicidios.csv` (coluna `municipio_norm` em caixa alta com acentos). Veja
> `core/README.MD`.

### 3) Hospedar a plataforma (collection Qdrant)
A plataforma Next.js consulta a collection vetorial `projetos-de-lei` no Qdrant.

1. Suba os pontos com `notebooks/upload_data_to_qdrant.ipynb` (consome `data/dataset.npy`,
   cria a collection e faz `upsert` em lotes).
2. Configure o `.env.local` da raiz do projeto:
   - `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION=projetos-de-lei`;
   - **`HF_API_TOKEN`** — obrigatório em runtime: a plataforma embeda a consulta do usuário ao
     vivo pela Inference API do Hugging Face e falha sem o token.

---

## Caminho completo (opcional) — reconstruir do zero

Use este caminho apenas para **atualizar o corpus com novos PLs** ou **auditar a coleta**. Ele
reproduz a cadeia que gerou o subset `default` publicado.

### 1) Encontrar instâncias do sistema SAPL (`tools/sapl_finder`)
O módulo `sapl_finder` localiza portais do SAPL ativos varrendo:
- heurística de domínio por lista de municípios do IBGE;
- certificados do crt.sh.

```bash
python tools/sapl_finder/sapl_finder.py \
  --concurrency 200 \
  --out-jsonl data/sapl_hosts.jsonl
```

Saída: `data/sapl_hosts.jsonl` (hosts do SAPL confirmados: ibge_id, municipio, uf, url, etc.).

### 2) Baixar projetos de lei (`tools/sapl_scrapper`)
O script lê o JSONL do finder e coleta os PLs pela API da plataforma SAPL.

```bash
python tools/sapl_scrapper/sapl_scrapper.py \
  --in-jsonl data/sapl_hosts.jsonl \
  --out-jsonl data/pl.jsonl \
  --page-size 100
```

Saída: `data/pl.jsonl` (um PL por linha).

### 3) Gerar ações (ementa → ação)
Use o modelo publicado `thiagoambiel/sonar_municipal_ptt5_ementa2action` para converter ementas
em ações imperativas. Referência:
`notebooks/sonar-municipal-ptt5-v2-ementa2action-inference-on-pls.ipynb` (ajuste os caminhos
de entrada/saída para arquivos locais ao rodar fora do Kaggle).

Saída: `pl_actions.jsonl`, mapeando cada ementa para a ação sintetizada.

### 4) Montar o `dataset.npy`
Reaproveite a lógica do notebook de build (seção do caminho rápido), trocando a fonte: em vez de
`load_dataset(...)`, carregue `pl.jsonl` + `pl_actions.jsonl`, normalize/deduplique, anexe a ação
e gere os embeddings da mesma forma.

### Análises adicionais (opcionais)
- `notebooks/SonarMunicipal_Action_Recommendation_Dataset_Analysis.ipynb`: exploração e busca.
- `notebooks/SonarMunicipal_Correlation_Between_Policies_and_Indicators.ipynb`: cruza PLs com
  indicadores e gera políticas agregadas com testes estatísticos.

---

## Dependências principais
`datasets`, `sentence-transformers`, `torch`, `transformers`, `numpy`, `pandas`, `httpx`, `tqdm`,
`qdrant-client`, `scipy` (testes estatísticos). GPUs aceleram a geração das ações, mas não são
obrigatórias para o caminho rápido.
