# Avaliação de Recomendações de PLs

Esta pasta compara duas representações textuais do acervo legislativo:

- `ementa`: texto original do Projeto de Lei.
- `acao`: textualização da ementa em formato mais operacional.

Os scripts usam o mesmo modelo de embeddings do Sonar Municipal:

- `embaas/sentence-transformers-multilingual-e5-base`

## Arquivos principais

- `problems.jsonl`: coleção inicial de problemas plausíveis para a plataforma.
- `build_embeddings.py`: deduplica o corpus e gera embeddings de ementas, ações e queries.
- `generate_recommendations.py`: produz rankings `top-k`, exporta JSONL e calcula métricas quando houver `qrels`.

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

- Gere o `annotation_pool.jsonl` como uniao dos `top-50` de ementas e acoes.
- Anote cada par `problema x PL` com pelo menos um avaliador humano.
- Se o experimento for importante para artigo ou benchmark, use dois avaliadores e meça concordancia.
- Mantenha um guia curto de anotacao dizendo o que conta como relevante para cada problema.
- Se quiser métricas graduadas, use notas `0..3`; se quiser métrica binária, marque apenas `0/1`.

## Saídas

O script de recomendação produz:

- `recommendations_ementas.jsonl`
- `recommendations_acoes.jsonl`
- `metrics.json` quando `--qrels-path` for informado

Cada linha dos arquivos de recomendação representa um problema e inclui:

- identificador do problema
- query usada
- abordagem (`ementas` ou `acoes`)
- lista ranqueada de PLs recomendados com `doc_id`, `ementa`, `acao`, `similarity_score` e `rank`
