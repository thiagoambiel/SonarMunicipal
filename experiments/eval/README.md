# Avaliação de Recomendações de PLs

Esta pasta compara tres abordagens sobre o mesmo acervo legislativo:

- `ementa`: busca semantica com embeddings calculados diretamente sobre a ementa original do Projeto de Lei.
- `acao`: busca semantica com embeddings calculados sobre a textualizacao da ementa em formato mais operacional.
- `bm25_ementas`: baseline lexical BM25 calculado sobre as ementas originais.

Os scripts usam o mesmo modelo de embeddings do Sonar Municipal:

- `embaas/sentence-transformers-multilingual-e5-base`

## Arquivos principais

- `problems.jsonl`: coleção inicial de problemas plausíveis para a plataforma.
- `build_embeddings.py`: deduplica o corpus e gera embeddings de ementas, ações e queries.
- `generate_recommendations.py`: produz rankings `top-k`, exporta JSONL e calcula métricas quando houver `qrels`, incluindo o baseline BM25.

## Fluxo sugerido

1. Gerar artefatos auxiliares:

```bash
python experiments/eval/build_embeddings.py \
  --dataset-path experiments/data/dataset.npy \
  --problems-path experiments/eval/problems.jsonl \
  --output-dir experiments/eval/artifacts \
  --device cuda \
  --batch-size 256 \
  --dedupe-mode text_pair
```

2. Gerar recomendações e um pool para anotação humana:

```bash
python experiments/eval/generate_recommendations.py \
  --manifest-path experiments/eval/artifacts/manifest.json \
  --output-dir experiments/eval/outputs \
  --top-k 50 \
  --annotation-pool-path experiments/eval/outputs/annotation_pool.jsonl
```

Esse comando passa a gerar dois arquivos:

- `annotation_pool.jsonl`: pool cego para anotacao, contendo apenas `problem_id`, `doc_id`, `query`, `ementa`, `relevance` e `notes`.
- `annotation_pool_metadata.jsonl`: metadados completos do pool, usados depois na analise sem expor sinais de ranking ao avaliador.

3. Anotar relevância humana no `annotation_pool.jsonl`:

- Use `relevance = 0` para irrelevante.
- Use `relevance = 1` para relevante.
- Use `relevance = 2` para bastante relevante.
- Use `relevance = 3` para altamente relevante.

Depois de anotar, salve apenas as colunas necessárias em um arquivo `qrels.jsonl`:

```json
{"problem_id":"violencia_bairros_centrais","doc_id":"...","relevance":3}
{"problem_id":"violencia_bairros_centrais","doc_id":"...","relevance":1}
```

4. Recalcular com métricas:

```bash
python experiments/eval/generate_recommendations.py \
  --manifest-path experiments/eval/artifacts/manifest.json \
  --output-dir experiments/eval/outputs \
  --top-k 50 \
  --qrels-path experiments/eval/outputs/qrels.jsonl
```

## O que e preciso para calcular métricas formais

Voce precisa de um conjunto de relevância anotado por humanos (`qrels`), ligando:

- `problem_id`
- `doc_id`
- `relevance`

Sem isso, o experimento gera rankings comparáveis, mas nao mede qualidade de recuperação.

## Como criar os qrels de forma minimamente defensável

- Gere o `annotation_pool.jsonl` como uniao dos `top-50` de ementas, acoes e `bm25_ementas`.
- Anote cada par `problema x PL` com pelo menos um avaliador humano.
- Se o experimento for importante para artigo ou benchmark, use dois avaliadores e meça concordancia.
- Mantenha um guia curto de anotacao dizendo o que conta como relevante para cada problema.
- Se quiser métricas graduadas, use notas `0..3`; se quiser métrica binária, marque apenas `0/1`.

## Saídas

O script de recomendação produz:

- `recommendations_ementas.jsonl`
- `recommendations_acoes.jsonl`
- `recommendations_bm25_ementas.jsonl`
- `metrics.json` quando `--qrels-path` for informado

Cada linha dos arquivos de recomendação representa um problema e inclui:

- identificador do problema
- query usada
- abordagem (`ementas`, `acoes` ou `bm25_ementas`)
- lista ranqueada de PLs recomendados com `doc_id`, `ementa`, `acao`, `similarity_score` e `rank`

## Observações sobre o BM25

- O baseline lexical usa BM25 simples com tokenizacao normalizada (lowercase, remocao de acentos e separacao alfanumerica).
- O corpus indexado pelo BM25 e a `ementa` original, sem reescrita para `acao`.
- O pool de anotacao passa a ser a uniao dos `top-k` de `ementas`, `acoes` e `bm25_ementas`, o que reduz o vies de comparar apenas dois rankings semanticos.
- A anotacao deve ser feita sobre o pool cego (`query` + `ementa`), sem scores, ranks, municipio ou texto da `acao`, para reduzir vies do avaliador.
- A analise posterior pode usar automaticamente o arquivo companheiro `*_metadata.jsonl`; se necessario, informe esse arquivo com `--pool-metadata-path` em `analyze_annotation_pool.py`.
