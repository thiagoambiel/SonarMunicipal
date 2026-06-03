# SAPL Scrapper — raspagem de Projetos de Lei

O **SAPL Scrapper** extrai Projetos de Lei (PLs) de múltiplas instâncias do sistema SAPL a partir
do catálogo gerado pelo [`sapl_finder`](../sapl_finder/README.MD). Ele percorre a API de cada
portal, filtra os tipos de matéria correspondentes a projetos de lei e grava o resultado de forma
incremental.

- **Entrada:** `sapl_hosts.jsonl` (saída do `sapl_finder`).
- **Saída:** `pl.jsonl` (incremental).

## Sumário

- [Requisitos](#requisitos)
- [Como usar](#como-usar)
- [Argumentos principais](#argumentos-principais)
- [Estrutura da entrada](#estrutura-da-entrada)
- [Saída gerada](#saída-gerada)
- [Como o algoritmo funciona](#como-o-algoritmo-funciona)
- [Desempenho](#desempenho)
- [Estrutura do código](#estrutura-do-código)

## Requisitos

- Python 3.10+
- Dependência: `httpx`

```bash
pip install httpx
```

## Como usar

Para ver a ajuda completa:

```bash
python sapl_scrapper.py --help
```

Exemplo de execução completa:

```bash
python sapl_scrapper.py \
  --in-jsonl sapl_hosts.jsonl \
  --out-jsonl pl.jsonl \
  --concurrency 20 \
  --timeout 30 \
  --page-size 100
```

## Argumentos principais

| Argumento | Descrição |
| --- | --- |
| `--in-jsonl` | Arquivo JSONL do `sapl_finder` (uma entrada por linha). |
| `--out-jsonl` | Caminho do JSONL incremental de saída. |
| `--concurrency` | Número de bases do SAPL processadas em paralelo. |
| `--timeout` | Timeout das requisições (segundos). |
| `--page-size` | `page_size` usado na API. |

## Estrutura da entrada

O JSONL do `sapl_finder` contém um objeto por linha. O script usa principalmente `sapl_url`
(obrigatório) e `municipio`/`uf` (como contexto no resultado). Exemplo simplificado:

```json
{
  "municipio": "Fortaleza",
  "uf": "CE",
  "sapl_url": "https://sapl.fortaleza.ce.leg.br/materia/pesquisar-materia"
}
```

## Saída gerada

O arquivo `pl.jsonl` traz uma linha por matéria, com o JSON completo de cada registro. Campos mais
comuns:

- `sapl_base`, `sapl_url`, `municipio`, `uf`
- `tipo_id`, `tipo_label`
- `materia_id`, `numero`, `ano`, `ementa`
- `data_apresentacao`, `em_tramitacao`, `situacao`
- `link_publico`
- `ultima_tramitacao_data`, `ultima_tramitacao_status`, `ultima_tramitacao` (quando habilitado)

## Como o algoritmo funciona

1. **Derivação da base do SAPL.** A partir de `sapl_url`, calcula a base correta
   (`https://host` ou `https://host/sapl`).
2. **Descoberta do endpoint de matérias.** Tenta `/api/materia/` e, se necessário, recorre ao
   fallback `/api/materia/materialegislativa/`.
3. **Filtro de tipos de PL.** Lista `tipomaterialegislativa` e seleciona os tipos cujo rótulo
   normalizado contém "projeto de lei".
4. **Paginação das matérias.** Para cada tipo de PL, pagina respeitando o formato da API: DRF
   clássico (`results`/`next`) ou paginação nativa do SAPL (`pagination.links.next` ou
   `pagination.next_page`).
5. **Última tramitação (opcional).** Quando habilitado, consulta
   `/api/materia/materialegislativa/{id}/ultima_tramitacao/` para enriquecer cada registro.
6. **Deduplicação e escrita.** Deduplica por `(sapl_base, materia_id)` e grava o JSONL
   imediatamente (progresso em tempo real).

## Desempenho

- `--concurrency`: comece com 10–30 e aumente conforme a rede permitir.
- `--timeout`: em redes lentas, aumente para 40 ou 60.
- `--page-size`: valores entre 100 e 200 reduzem o número de requisições.

## Estrutura do código

- `sapl_scrapper.py` — script principal (CLI e orquestração).
- `scraper.py` — lógica de API, filtros e paginação.
- `output.py` — escrita e deduplicação do JSONL.
