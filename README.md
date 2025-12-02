# CityManager — Next.js + Qdrant + HuggingFace

Aplicação Next.js (App Router) com backend em rotas `/api` que gera embeddings via HuggingFace Inference API e busca semântica no Qdrant. O backend FastAPI antigo foi movido para `experiments/backend` (junto dos notebooks de referência).

## Estrutura
- `src/app`: páginas e rotas de API do Next.js.
- `experiments/backend`: backend FastAPI original e notebooks (`notebooks/Upload Data to Qdrant.ipynb` mostra o pipeline de embeddings + Qdrant).

## Pré-requisitos
- Node.js 18+ e npm.
- Credenciais:
  - `HF_API_TOKEN` — token da HuggingFace Inference API.
  - `QDRANT_URL` — URL do cluster Qdrant (ex.: `https://...qdrant.io` ou `http://localhost:6333`).
  - `QDRANT_API_KEY` — API key do Qdrant (deixe vazio para Qdrant local).

Crie um arquivo `.env.local` na raiz com, no mínimo:
```bash
HF_API_TOKEN=...
QDRANT_URL=https://seu-cluster.qdrant.io
QDRANT_API_KEY=...
QDRANT_COLLECTION=projetos-de-lei        # opcional; default igual ao notebook
HF_MODEL_ID=embaas/sentence-transformers-multilingual-e5-base  # opcional; default igual ao notebook
# Indicador (dados reais)
CRIMINAL_INDICATOR_PATH=experiments/backend/data/criminal_indicator.csv
CRIMINAL_INDICATOR_CITY_COL=municipio_norm
CRIMINAL_INDICATOR_VALUE_COL=taxa_homicidios_100k
CRIMINAL_INDICATOR_MIN_VALUE=5
# NEXT_PUBLIC_API_BASE_URL=http://localhost:3000  # opcional para apontar o frontend para outro host
```

## Desenvolvimento
```bash
npm install
npm run dev           # Next.js + rotas /api no mesmo servidor
```
- App: http://localhost:3000  
- API: http://localhost:3000/api/...

Build de produção:
```bash
npm run build
npm start
```

## Backend (rotas Next.js /api)
As rotas seguem a lógica do notebook `notebooks/Upload Data to Qdrant.ipynb`: a query é codificada com o modelo E5 na Inference API e enviada ao Qdrant como vetor para `search`.

- `GET /api/health`  
  Retorna `status: "ok"` e flags indicando se as envs obrigatórias estão definidas.

- `POST /api/search`  
  Corpo: `{ "query": "texto livre", "top_k": 50 }` (`top_k` opcional, máx. 500).  
  Resposta: `{ query, top_k, returned, results: [{ index, score, municipio, uf, acao, data_apresentacao, ementa, link_publico, sapl_url, tipo_label }] }`.
  Exemplo:
  ```bash
  curl -X POST http://localhost:3000/api/search \\
    -H "Content-Type: application/json" \\
    -d '{ "query": "Como diminuir homicídios no município?", "top_k": 25 }'
  ```

- `POST /api/policies`  
  Agrupa projetos retornados pela busca por similaridade de tema (campo `acao`), calcula efeitos usando o indicador configurado e prioriza políticas com maior “win rate” (efeitos com direção desejada).  
  Corpo (campos opcionais):  
  ```json
  {
    "bill_indexes": [0,1,2],
    "use_indicator": true,
    "indicator": "criminal_indicator",
    "effect_window_months": 6,
    "similarity_threshold": 0.75,
    "min_group_members": 2
  }
  ```  
  - `effect_window_months` é múltiplo de 6 (1 semestre = 6 meses).  
  - Se `use_indicator` for `true`, PLs sem dados do indicador são ignorados.  
  Resposta:  
  `{ indicator, used_indicator, total_candidates, policies: [{ policy, effect_mean, effect_std, quality_score, actions: [{ municipio, acao, effect, url, data_apresentacao, ementa }] }] }`.

- `GET /api/indicators`  
  Lista os indicadores reais disponíveis (alias, direção “positive_is_good”, min_value e colunas usadas no CSV).

## Frontend
- `src/app/page.tsx`: busca principal e sugestões de políticas (agrupamento simples a partir dos resultados).
- `src/app/projects/page.tsx`: lista completa de projetos retornados pela busca.

## Experimentos e backend antigo
- Todo o código do backend Python original e notebooks foram movidos para `experiments/backend`. Nenhum arquivo foi removido.
