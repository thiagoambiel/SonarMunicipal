# sapl_finder

Descobre instâncias SAPL públicas no Brasil e produz arquivos incrementais (CSV/JSON/JSONL) com endpoints validados. Serve como etapa 1 do pipeline: a saída alimenta o `sapl_scrapper`.

- Entrada: nenhuma (consulta IBGE e/ou crt.sh).
- Saída:
  - `sapl_hosts.csv` — tabela resumida dos endpoints SAPL validados.
  - `sapl_hosts.json` — JSON agregado final.
  - `sapl_hosts.jsonl` — achados incrementais (um por linha), ideal para streaming/processamento.
  - `sapl_hosts_candidates.jsonl` — candidatos brutos do crt.sh (quando usado).

## Como usar

Ajuda:

```bash
python -m sapl_finder --help
```

Exemplos:

```bash
# Estratégia completa (IBGE + crt.sh), com logs em JSON e arquivo rotativo
python -m sapl_finder \
  --strategy all \
  --concurrency 100 \
  --timeout 20 \
  --out-csv sapl_hosts.csv \
  --out-json sapl_hosts.json \
  --log-level INFO \
  --log-file logs/sapl_finder.log \
  --log-json

# Apenas IBGE
python -m sapl_finder --strategy ibge --out-csv sapl.csv --out-json sapl_hosts.json

# Apenas crt.sh (gera JSONL de candidatos)
python -m sapl_finder --strategy crtsh --out-json sapl_hosts.json
```

## Arquitetura e fluxo

1. Estratégias (configuráveis por `--strategy`):
   - IBGE: baixa municípios do endpoint oficial e deriva hosts por heurística (`sapl.{slug}.{uf}.leg.br` e `{slug}.{uf}.leg.br`). Tenta caminhos padrão do SAPL e varre links do portal.
   - crt.sh: consulta o repositório de certificados (CT logs) por nomes que iniciam com `sapl.`. Resultado é normalizado e validado como endpoint SAPL.
2. Validação de endpoint:
   - Caminhos testados (ver `sapl_finder/config.py:CHECK_PATHS`): `/materia/pesquisar-materia`, `/sapl/materia/pesquisar-materia`.
   - Heurística textual (`sapl_finder/config.py:SAPL_MARKERS`) e `<title>` contendo "SAPL".
   - Caso o host base responda mas não os caminhos, varre links do HTML por pistas (`LINK_HINTS`) e re-testa.
3. Escrita incremental:
   - Cada achado dispara `ProgressWriter.on_found`, que escreve imediatamente no CSV e JSONL (flush), com deduplicação por `sapl_url`.
   - Ao final, gera `sapl_hosts.json` agregado via `finalize_json`.
4. Logging estruturado:
   - `sapl_finder/logging_config.py` define `JsonFormatter`, rotação de arquivo e extras (ex.: `sapl_url`, `municipio`, `uf`, `strategy`, `count`).

## Paralelização e rede

- Cliente HTTP: `httpx.AsyncClient` com `Limits(max_keepalive_connections=0, max_connections=CONCURRENCY)` e `Timeout(T)`.
  - `max_keepalive_connections=0`: evita manter conexões persistentes, útil ao acessar milhares de hosts distintos.
- IBGE:
  - Usa `asyncio.Semaphore(concurrency)` para limitar tarefas simultâneas por município.
  - `asyncio.gather(...)` dispara workers que executam `validate_host` com o semáforo.
- crt.sh:
  - Particiona consultas por primeiro caractere após `sapl.` (a..z), reduzindo 429/503.
  - Cada partição tenta: JSON direto, NDJSON por linha, e fallback com regex no HTML.
  - Implementa retries com backoff exponencial (até 5 tentativas) ao detectar falhas ou 429/503.
  - Validação dos hosts retornados executa em paralelo com semáforo e `gather`.
- Validação de host:
  - `try_get` usa `follow_redirects=True` e `User-Agent` definido em `config.USER_AGENT`.

## Saída (campos)

`CSV/JSON/JSONL` compartilhando as chaves:
- `ibge_id`, `municipio`, `uf`
- `source` (estratégia: `ibge-heuristic`, `base-host-endpoint`, `portal-link-scan`, `crtsh`)
- `sapl_url` (URL do endpoint validado)
- `http_status`, `marker`, `title`

## Boas práticas de execução

- Conexões: 50–150 costumam ser estáveis; em redes conservadoras, use 20–50.
- Timeout: mantenha `--timeout 20` a `40` conforme latência da rede.
- Reprodutibilidade: a escrita é incremental + deduplicação; reexecutar não duplica saídas.
- Iteração rápida: experimente `--strategy ibge` antes de `--strategy all`; `crtsh` pode ser mais pesado.
- Logs: use `--log-json` para facilitar parsing e dashboards; aumente para `DEBUG` ao depurar.

## Arquivos relevantes

- `sapl_finder/cli.py`
- `sapl_finder/scraper.py`
- `sapl_finder/output.py`
- `sapl_finder/logging_config.py`

