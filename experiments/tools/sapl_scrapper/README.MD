# sapl_scrapper

Script em Python para extrair Projetos de Lei (PL) de multiplas instancias SAPL
a partir do arquivo JSONL gerado pelo `sapl_finder`. O resultado e salvo apenas
em JSONL incremental.

- **Entrada:** `sapl_hosts.jsonl` do `sapl_finder`.
- **Saida:** `pl.jsonl` (incremental).

## Requisitos

- Python 3.10+
- Dependencia: `httpx`

Instalacao rapida:

```bash
pip install httpx
```

## Como usar

Ajuda:

```bash
python sapl_scrapper.py --help
```

Exemplos:

```bash
# Execucao completa
python sapl_scrapper.py \
  --in-jsonl sapl_hosts.jsonl \
  --out-jsonl pl.jsonl \
  --concurrency 20 \
  --timeout 30 \
  --page-size 100

```

## Argumentos principais

- `--in-jsonl`: arquivo JSONL do `sapl_finder` (uma entrada por linha).
- `--out-jsonl`: caminho do JSONL incremental de saida.
- `--concurrency`: numero de bases SAPL processadas em paralelo.
- `--timeout`: timeout das requisicoes (segundos).
- `--page-size`: `page_size` usado na API.

## Estrutura da entrada

O JSONL do `sapl_finder` contem um objeto por linha. O script usa principalmente:

- `sapl_url` (obrigatorio)
- `municipio` e `uf` (usados como contexto no output)

Exemplo simplificado:

```json
[
  {
    "municipio": "Fortaleza",
    "uf": "CE",
    "sapl_url": "https://sapl.fortaleza.ce.leg.br/materia/pesquisar-materia"
  }
]
```

## Saidas geradas

### JSONL incremental (`pl.jsonl`)

Uma linha por materia, com o JSON completo de cada registro.
Campos mais comuns:

- `sapl_base`, `sapl_url`, `municipio`, `uf`
- `tipo_id`, `tipo_label`
- `materia_id`, `numero`, `ano`, `ementa`
- `data_apresentacao`, `em_tramitacao`, `situacao`
- `link_publico`
- `ultima_tramitacao_data`, `ultima_tramitacao_status`
- `ultima_tramitacao` (quando habilitado)

## Como o algoritmo funciona

1. **Derivacao da base SAPL**  
   A partir de `sapl_url`, o script calcula a base correta
   (`https://host` ou `https://host/sapl`).

2. **Descoberta do endpoint de materias**  
   Tenta `/api/materia/` e, se necessario, usa o fallback
   `/api/materia/materialegislativa/`.

3. **Filtro de tipos de PL**  
   Lista `tipomaterialegislativa` e filtra todos os tipos cujo rotulo,
   normalizado, contem "projeto de lei".

4. **Paginacao das materias**  
   Para cada tipo de PL, pagina as materias respeitando o formato da API:
   - DRF classico (`results`/`next`)
   - Paginacao nativa do SAPL (`pagination.links.next` ou `pagination.next_page`)

5. **Ultima tramitacao (opcional)**  
   Quando habilitado, consulta
   `/api/materia/materialegislativa/{id}/ultima_tramitacao/` para enriquecer
   cada registro.

6. **Deduplicacao e escrita**  
   Cada item e deduplicado por `(sapl_base, materia_id)` e gravado no JSONL
   imediatamente (progresso em tempo real).

## Desempenho e ajustes

- `--concurrency`: comece com 10-30 e aumente conforme a rede.
- `--timeout`: em redes lentas, aumente para 40 ou 60.
- `--page-size`: valores entre 100 e 200 reduzem o numero de requisicoes.

## Estrutura do codigo

- `sapl_scrapper.py`: script principal (CLI e orquestracao).
- `scraper.py`: logica de API, filtros e paginacao.
- `output.py`: escrita e deduplicacao JSONL.
