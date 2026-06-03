# SAPL Finder — descoberta de instâncias do SAPL

O **SAPL Finder** descobre instâncias públicas do sistema SAPL (Sistema de Apoio ao Processo
Legislativo) de municípios brasileiros usando apenas dados oficiais do IBGE. A partir da lista de
municípios, o script gera hosts candidatos e valida os endpoints típicos do SAPL, produzindo um
catálogo de portais ativos — o ponto de partida da etapa de raspagem (`sapl_scrapper`).

## Sumário

- [Requisitos](#requisitos)
- [Como usar](#como-usar)
- [Saída](#saída)
- [Como o algoritmo funciona](#como-o-algoritmo-funciona)
- [Desempenho](#desempenho)
- [Estrutura](#estrutura)

## Requisitos

- Python 3.10+
- Dependência: `httpx`

```bash
pip install httpx
```

## Como usar

Para ver a ajuda completa:

```bash
python sapl_finder.py --help
```

Exemplos:

```bash
# Execução padrão
python sapl_finder.py

# Ajustar concorrência e timeout
python sapl_finder.py --concurrency 60 --timeout 30

# Definir o arquivo de saída
python sapl_finder.py --out-jsonl saida/sapl_hosts.jsonl
```

## Saída

O arquivo `sapl_hosts.jsonl` é escrito incrementalmente (uma instância por linha, com progresso em
tempo real). Cada registro contém:

| Campo | Descrição |
| --- | --- |
| `ibge_id` | Identificador do município no IBGE. |
| `municipio` | Nome do município. |
| `uf` | Sigla da UF. |
| `source` | Origem do resultado (`ibge-heuristic` ou `base-host-endpoint`). |
| `sapl_url` | URL do endpoint do SAPL validado. |
| `http_status` | Status HTTP retornado no teste. |
| `marker` | Marcador que confirmou tratar-se de um SAPL. |
| `title` | Título da página HTML. |

## Como o algoritmo funciona

1. **Carrega os municípios do IBGE.** Consulta
   `https://servicodados.ibge.gov.br/api/v1/localidades/municipios` e extrai nome e UF de cada
   município.
2. **Gera hosts candidatos.** Para cada município, monta dois hosts a partir de um *slug* (nome sem
   acentos, espaços ou símbolos): `sapl.{slug}.{uf}.leg.br` e `{slug}.{uf}.leg.br`.
3. **Valida os endpoints do SAPL.** Testa caminhos típicos (`/materia/pesquisar-materia` e
   `/sapl/materia/pesquisar-materia`); a resposta precisa conter marcadores conhecidos do SAPL ou
   um `<title>` com a palavra "SAPL".
4. **Deduplica e grava.** Remove duplicatas por `sapl_url` e grava o JSONL em tempo real.

## Desempenho

- `--concurrency` controla o número de requisições simultâneas.
- `--timeout` controla o tempo máximo de espera por resposta.
- Em redes mais lentas, prefira `--concurrency 30` (em vez de 60) e `--timeout 30`.

## Estrutura

- `sapl_finder.py` — script principal.
- `sapls/` — exemplos de dados (não usados pelo script).
