# CityManager (frontend + backend)

Monorepo com frontend Next.js (App Router) e backend FastAPI, organizado em duas pastas:
- `backend/`: API FastAPI existente (busca semântica, indicadores, políticas).
- `frontend/`: Next.js + React que consome a API e exibe a UI de busca.

## Pré-requisitos
- Node 18+ e npm.
- Python 3.9+ com dependências instaladas em `backend/`:
  ```bash
  cd backend
  pip install -r requirements.txt
  ```

## Desenvolvimento rápido
1) Suba frontend e backend juntos (backend inicia em segundo plano via uvicorn):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   - API: http://localhost:8000  
   - Next: http://localhost:3000  
   Use `NEXT_PUBLIC_API_BASE_URL` se quiser apontar para outro host.

2) Scripts úteis (em `frontend/`):
   - `npm run dev:backend` — só o FastAPI (porta 8000).
   - `npm run dev:frontend` — só o Next.js.
   - `npm run dev` / `dev:full` — ambos em paralelo.
   - `npm run build` — build de produção do Next.

## Deploy / Vercel
- O front pode ser enviado para a Vercel normalmente (`npm run build`).
- A Vercel não executa o backend Python em produção; hospede o FastAPI em outro serviço (Railway, Render, VM) e defina `NEXT_PUBLIC_API_BASE_URL` apontando para ele.
- Em desenvolvimento local (`npm run dev`), o backend sobe automaticamente para facilitar.

## Estrutura da UI
- Página única em `frontend/src/app/page.tsx` com busca e sugestões.
- Estilos globais em `frontend/src/app/globals.css`.
- Layout e metadados em `frontend/src/app/layout.tsx`.

## Backend (referência rápida)
- Rode localmente: `cd backend && uvicorn api.main:app --reload --port 8000`
- Variáveis úteis: `DATASET_PATH`, `SENTENCE_MODEL_NAME`, `DEFAULT_TOP_K`, `CRIMINAL_INDICATOR_*`.
- Endpoints: `/health`, `/search`, `/indicator-effects`, `/policies`.
