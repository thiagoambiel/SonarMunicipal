# sapl_scrapper

Extrai Projetos de Lei (PL) de múltiplas instâncias SAPL, a partir da lista produzida pelo `sapl_finder`. Salva resultados incrementalmente em CSV e JSONL, e gera um JSON agregado ao final.

- Entrada: `sapl_hosts.jsonl` (do `sapl_finder`).
- Saída: `pl.csv`, `pl.jsonl` (incremental) e `pl.json` (agregado).

## Como usar

Ajuda:

```bash
python -m sapl_scrapper --help
```

Exemplos:

```bash
# Execução completa e incremental
python -m sapl_scrapper \
  --in-jsonl sapl_hosts.jsonl \
  --out-csv pl.csv \
  --out-json pl.json \
  --concurrency 100 \
  --timeout 30 \
 --page-size 200 \
  --log-level INFO \
  --log-file logs/sapl_scrapper.log \
  --log-json

# Execução mais leve (sem última tramitação)
python -m sapl_scrapper --in-jsonl sapl_hosts.jsonl --no-tramitacao

# Teste com poucos hosts
head -n 5 sapl_hosts.jsonl > sample_hosts.jsonl
python -m sapl_scrapper --in-jsonl sample_hosts.jsonl --out-csv pls_test.csv --out-json pls_test.json --no-tramitacao --concurrency 2
```

## Arquitetura e fluxo

Para cada `sapl_url` do JSONL de entrada:

1) Deriva a base do SAPL (`https://host` ou `https://host/sapl`) a partir do caminho `.../materia/pesquisar-materia`.
2) Descobre o endpoint de matérias com fallback: tenta `BASE/api/materia/` e, se 404, `BASE/api/materia/materialegislativa/`.
3) Lista `BASE/api/materia/tipomaterialegislativa/` e filtra rótulos contendo “projeto de lei” (normalização NFKD + lower, sem acentos), cobrindo Ordinária, Complementar, Executivo/Legislativo e variantes.
4) Para cada tipo de PL, pagina as matérias (`page_size` configurável) seguindo o formato de paginação do SAPL (campo `pagination` com `links.next` e/ou `next_page`) ou DRF clássico (`next`). Evitamos definir ordenação (`o=-ano`) por padrão, pois algumas instâncias retornam resultados duplicados e incompletos ao paginar com esse parâmetro.
5) Opcionalmente, consulta `ultima_tramitacao` em `BASE/api/materia/materialegislativa/{id}/ultima_tramitacao/` e expõe `ultima_tramitacao_data`/`ultima_tramitacao_status` (além do JSON bruto em `ultima_tramitacao`).
6) Salva incrementalmente em CSV e JSONL (flush por registro) e, ao final, `pl.json` agregado.

## Paralelização e rede

- Escopo do paralelismo: por instância (base) SAPL.
  - `runner.py` cria uma tarefa por host de entrada e usa `asyncio.Semaphore(concurrency)` para limitar quantas bases são processadas simultaneamente.
  - Cada base é processada de forma sequencial internamente (listar tipos e paginar matérias), o que evita sobrecarga em instâncias menores.
- Cliente HTTP: `httpx.AsyncClient` com `Limits(max_keepalive_connections=0, max_connections=CONCURRENCY)` e `Timeout(T)`.
  - `max_keepalive_connections=0`: reduz conexões persistentes entre muitas bases distintas.
- Padrões da API do SAPL: paginação no estilo DRF (`results`/`next`) ou no formato nativo do SAPL (`pagination.links.next` e `pagination.next_page`). O scrapper segue ambos e também suporta URLs relativas nestes campos.

## Saída e deduplicação

- Deduplicação por `(sapl_base, materia_id)` em `PLWriter`.
- Escrita incremental com `flush`:
  - CSV com cabeçalho fixo e colunas:
    - `sapl_base`, `sapl_url`, `municipio`, `uf`, `tipo_id`, `tipo_label`, `materia_id`, `numero`, `ano`, `ementa`, `data_apresentacao`, `em_tramitacao`, `situacao`, `link_publico`, `ultima_tramitacao_data`, `ultima_tramitacao_status`.
  - JSONL: uma linha por matéria (JSON completo, incluindo `ultima_tramitacao` quando consultada).
  - JSON agregado (`finalize_json`) ao final da execução.

## Logging

Reutiliza `sapl_finder/logging_config.py` (JSON opcional + arquivo rotativo). Principais eventos:
- `[PL] Alvo carregado` — início do processamento de uma base.
- `[PL] Iniciando extração` — confirmação da base e contexto.
- `Tipos PL identificados` — contagem de tipos com “projeto de lei”.
- `Coletando matérias do tipo` — contexto do tipo atual.
- `PL salvo (N)` — progresso incremental por matéria salva.

Extras incluídos nos logs: `sapl_url`, `municipio`, `uf`, `count`, etc.

## Boas práticas de execução

- Conexões: ajuste `--concurrency` entre 10–50 para iniciar; aumente gradualmente conforme a rede.
- Timeout: em redes mais lentas, use `--timeout 40` ou `60`.
- Page size: aumentar `--page-size 200` reduz requisições por base.
- Tramitação: desative `--no-tramitacao` para alto volume; habilite em execuções de refinamento ou subconjuntos.
- Amostras: use `head`/`rg` para filtrar por UF/município no JSONL de entrada e iterar mais rápido.
- Idempotência: o par `(sapl_base, materia_id)` evita duplicatas ao reexecutar.

## Arquivos relevantes

- `sapl_scrapper/cli.py` — parser de argumentos e inicialização.
- `sapl_scrapper/runner.py` — orquestração por base, semáforo e escrita incremental.
- `sapl_scrapper/scraper.py` — lógica de API do SAPL, filtro de tipos, paginação e última tramitação.
- `sapl_scrapper/output.py` — `PLWriter` (CSV/JSONL incremental, deduplicação).
