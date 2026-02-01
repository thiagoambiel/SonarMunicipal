![](public/logo.png)

[![Next.js](https://img.shields.io/badge/Next.js-App%20Router-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![HuggingFace](https://img.shields.io/badge/Hugging%20Face-API%20de%20Inferencia-FFD21E?style=for-the-badge&logo=huggingface&logoColor=000)](https://huggingface.co/)
[![Qdrant](https://img.shields.io/badge/Qdrant-Banco%20Vetorial-FF4F8B?style=for-the-badge)](https://qdrant.tech/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

**Sonar Municipal** e uma plataforma web para apoiar a elaboracao e a analise de Projetos
de Lei (PLs) em municipios, em um contexto de alta diversidade legislativa. O sistema
padroniza e automatiza a descoberta e coleta de PLs em instancias SAPL, transforma
ementas em recomendacoes de ação, permite busca semantica por demandas dos usuarios,
simula efeitos em indicadores oficiais ao longo do tempo e agrupa PLs semelhantes em
**politicas publicas** para analise conjunta. 

# Como funciona?
```mermaid
flowchart LR
  E1[Lista de municipios\n(IBGE)] --> E2[Descoberta de instancias\ndo SAPL]
  E2 --> E3[Extracao\nde PLs]
  E3 --> E4[Transformacao\nde ementa\nem acao]
  E4 --> E5[Indexacao\nvetorial\n(Qdrant)]
  E5 --> E6[Indicadores\noficiais\n+ Agrupamento]
```
<p align="center">
  <b>Figura 1:</b> Fluxo de busca semantica e geracao de politicas.
</p>

## API (rotas Next.js)
As rotas seguem a logica do pipeline em `experiments/notebooks`.

- `GET /api/health` retorna status e valida variaveis obrigatorias.
- `POST /api/search` recebe `{ "query": "...", "top_k": 50 }` e devolve PLs similares.
- `POST /api/policies` agrupa PLs por acao e calcula qualidade via indicador.
- `GET /api/indicators` lista indicadores disponiveis.

Exemplo rapido:
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{ "query": "Como reduzir homicidios no municipio?", "top_k": 25 }'
```

## Variaveis de ambiente
Crie `.env.local` na raiz:
```bash
HF_API_TOKEN=...
QDRANT_URL=https://seu-cluster.qdrant.io
QDRANT_API_KEY=...
QDRANT_COLLECTION=projetos-de-lei
HF_MODEL_ID=embaas/sentence-transformers-multilingual-e5-base
SEARCH_MAX_RESULTS=1000

# Indicadores (dados reais)
CRIMINAL_INDICATOR_PATH=indicators/homicidios.csv
CRIMINAL_INDICATOR_CITY_COL=municipio_norm
CRIMINAL_INDICATOR_VALUE_COL=taxa_homicidios_100k
CRIMINAL_INDICATOR_MIN_VALUE=5
EDUCATION_INDICATOR_PATH=indicators/matriculas.csv
EDUCATION_INDICATOR_CITY_COL=municipio
EDUCATION_INDICATOR_VALUE_COL=taxa_matriculas_100k
```

## Instalacao
Requisitos: Node.js 18+ e npm.

```bash
npm install
```

## Uso basico
```bash
npm run dev
```
- Aplicacao: http://localhost:3000
- API: http://localhost:3000/api/...

Build de producao:
```bash
npm run build
npm start
```

## Experimentos (pipeline completo)
Os notebooks e os scripts de coleta ficaram em `experiments/`. Para reconstruir
o dataset do zero, use o guia:

- `experiments/DATASET.MD`

Resumo do pipeline:
1. Descobrir instancias SAPL (`tools/sapl_finder`).
2. Raspar projetos de lei (`tools/sapl_scrapper`).
3. Gerar acoes a partir das ementas (modelo `ptt5v2-pl-text2action`).
4. Gerar embeddings e montar `dataset.npy`.

## Estrutura do repositorio
- `src/app`: paginas e rotas de API do Next.js.
- `public/`: assets do frontend (inclui o banner).
- `experiments/`: backend antigo, notebooks e ferramentas de dados.
