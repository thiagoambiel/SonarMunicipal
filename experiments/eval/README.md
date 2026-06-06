# Avaliação de recomendações de PLs

Esta pasta avalia, de forma comparável, a qualidade das recomendações de Projetos de Lei geradas
por três abordagens de recuperação sobre o mesmo acervo legislativo:

- **`ementas`** — busca semântica com embeddings calculados diretamente sobre a ementa original.
- **`acoes`** — busca semântica com embeddings calculados sobre a textualização da ementa em
  formato de ação (mais operacional).
- **`bm25_ementas`** — baseline lexical BM25 sobre as ementas originais.

As abordagens semânticas usam o mesmo modelo de embeddings da plataforma:
`embaas/sentence-transformers-multilingual-e5-base`.

> **Pool de anotação canônico.** Os arquivos `annotation_pool*.jsonl` e `recommendations_*.jsonl`
> referenciados aqui **não acompanham este repositório** — eles vivem no *record* de dataset do
> Zenodo (`10.5281/zenodo.20564283`, diretórios `annotation-pool/` e
> `recommendations/`). Antes de rodar `analyze_annotation_pool.py` sobre dados já anotados, baixe o
> *bundle* do Zenodo e coloque os arquivos em `experiments/eval/outputs/` (esse caminho está no
> `.gitignore` e não será re-commitado). Para regenerar do zero, use os scripts abaixo.

## Sumário

- [Arquivos principais](#arquivos-principais)
- [Fluxo sugerido](#fluxo-sugerido)
- [O que é preciso para calcular métricas formais](#o-que-é-preciso-para-calcular-métricas-formais)
- [Como criar os qrels de forma defensável](#como-criar-os-qrels-de-forma-defensável)
- [Saídas](#saídas)
- [Observações sobre o BM25](#observações-sobre-o-bm25)

## Arquivos principais

- `problems.jsonl` — coleção de problemas plausíveis para a plataforma.
- `build_embeddings.py` — deduplica o corpus e gera os embeddings de ementas, ações e queries.
- `generate_recommendations.py` — produz rankings `top-k`, exporta JSONL e calcula as métricas
  quando há `qrels`, incluindo o baseline BM25.

## Fluxo sugerido

> `experiments/data/dataset.npy` é produzido conforme o [DATASET.MD](../DATASET.MD) (caminho
> rápido: baixar o dataset publicado no Hugging Face e gerar os embeddings).

1. **Gerar os artefatos auxiliares:**

   ```bash
   python experiments/eval/build_embeddings.py \
     --dataset-path experiments/data/dataset.npy \
     --problems-path experiments/eval/problems.jsonl \
     --output-dir experiments/eval/artifacts \
     --device cuda \
     --batch-size 256 \
     --dedupe-mode text_pair
   ```

2. **Gerar as recomendações e um pool para anotação humana:**

   ```bash
   python experiments/eval/generate_recommendations.py \
     --manifest-path experiments/eval/artifacts/manifest.json \
     --output-dir experiments/eval/outputs \
     --top-k 50 \
     --annotation-pool-path experiments/eval/outputs/annotation_pool.jsonl
   ```

   Esse comando gera dois arquivos:

   - `annotation_pool.jsonl` — pool cego para anotação, contendo apenas `problem_id`, `doc_id`,
     `query`, `ementa`, `relevance` e `notes`.
   - `annotation_pool_metadata.jsonl` — metadados completos do pool, usados depois na análise sem
     expor sinais de ranking ao avaliador.

3. **Anotar a relevância** no `annotation_pool.jsonl` (o prompt do juiz LLM usado para a anotação
   graduada está em [`judge_prompt.txt`](judge_prompt.txt)):

   - `relevance = 0` — irrelevante.
   - `relevance = 1` — relevante.
   - `relevance = 2` — bastante relevante.
   - `relevance = 3` — altamente relevante.

   Depois de anotar, salve apenas as colunas necessárias em um arquivo `qrels.jsonl`:

   ```json
   {"problem_id":"violencia_bairros_centrais","doc_id":"...","relevance":3}
   {"problem_id":"violencia_bairros_centrais","doc_id":"...","relevance":1}
   ```

4. **Recalcular com as métricas:**

   ```bash
   python experiments/eval/generate_recommendations.py \
     --manifest-path experiments/eval/artifacts/manifest.json \
     --output-dir experiments/eval/outputs \
     --top-k 50 \
     --qrels-path experiments/eval/outputs/qrels.jsonl
   ```

## O que é preciso para calcular métricas formais

É necessário um conjunto de relevância anotado por humanos (`qrels`), ligando `problem_id`,
`doc_id` e `relevance`. Sem ele, o experimento gera rankings comparáveis, mas não mede a qualidade
de recuperação.

## Como criar os qrels de forma defensável

- Gere o `annotation_pool.jsonl` como a união dos `top-50` de ementas, ações e `bm25_ementas`.
- Anote cada par `problema × PL` com pelo menos um avaliador humano.
- Se o experimento for importante para artigo ou benchmark, use dois avaliadores e meça a
  concordância entre eles.
- Mantenha um guia curto de anotação dizendo o que conta como relevante para cada problema.
- Para métricas graduadas, use notas `0..3`; para métrica binária, marque apenas `0/1`.

## Saídas

O script de recomendação produz:

- `recommendations_ementas.jsonl`
- `recommendations_acoes.jsonl`
- `recommendations_bm25_ementas.jsonl`
- `metrics.json` (quando `--qrels-path` é informado)

Cada linha dos arquivos de recomendação representa um problema e inclui o identificador do
problema, a query usada, a abordagem (`ementas`, `acoes` ou `bm25_ementas`) e a lista ranqueada de
PLs recomendados com `doc_id`, `ementa`, `acao`, `similarity_score` e `rank`.

## Observações sobre o BM25

- O baseline lexical usa BM25 simples com tokenização normalizada (caixa baixa, remoção de acentos
  e separação alfanumérica).
- O corpus indexado pelo BM25 é a `ementa` original, sem reescrita para `acao`.
- O pool de anotação é a união dos `top-k` de `ementas`, `acoes` e `bm25_ementas`, o que reduz o
  viés de comparar apenas dois rankings semânticos.
- A anotação deve ser feita sobre o pool cego (`query` + `ementa`), sem scores, ranks, município
  ou o texto da `acao`, para reduzir o viés do avaliador.
- A análise posterior pode usar automaticamente o arquivo companheiro `*_metadata.jsonl`; se
  necessário, informe-o com `--pool-metadata-path` em `analyze_annotation_pool.py`.
