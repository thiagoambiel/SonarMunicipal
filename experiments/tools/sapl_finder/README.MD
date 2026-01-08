# SAPL Finder (IBGE)

Script em Python para descobrir instancias SAPL publicas no Brasil usando apenas dados do IBGE.
O fluxo busca todos os municipios, gera possiveis hosts e valida endpoints tipicos do SAPL.

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
python sapl_finder.py --help
```

Exemplos:

```bash
# Execucao padrao
python sapl_finder.py

# Ajustar concorrencia e timeout
python sapl_finder.py --concurrency 60 --timeout 30

# Definir arquivos de saida
python sapl_finder.py --out-csv saida/sapl_hosts.csv --out-json saida/sapl_hosts.json

# Gerar JSONL adicional
python sapl_finder.py --out-jsonl saida/sapl_hosts.jsonl
```

## Saidas

Os arquivos gerados compartilham os mesmos campos:

- `ibge_id`: identificador do municipio no IBGE
- `municipio`: nome do municipio
- `uf`: sigla da UF
- `source`: origem do resultado (`ibge-heuristic` ou `base-host-endpoint`)
- `sapl_url`: URL do endpoint validado
- `http_status`: status HTTP retornado no teste
- `marker`: marcador que confirmou o SAPL
- `title`: titulo da pagina HTML

Arquivos:

- `sapl_hosts.csv`: tabela resumida
- `sapl_hosts.json`: JSON agregado
- `sapl_hosts.jsonl`: JSON por linha (opcional)

## Como o algoritmo funciona

1. **Carrega municipios do IBGE**
   - O script consulta `https://servicodados.ibge.gov.br/api/v1/localidades/municipios`.
   - Para cada municipio, extrai nome e UF.

2. **Gera hosts candidatos**
   - Para cada municipio, monta dois hosts:
     - `sapl.{slug}.{uf}.leg.br`
     - `{slug}.{uf}.leg.br`
   - O `slug` e obtido do nome do municipio sem acentos, espacos ou simbolos.

3. **Valida endpoints do SAPL**
   - Para cada host, testa caminhos tipicos:
     - `/materia/pesquisar-materia`
     - `/sapl/materia/pesquisar-materia`
   - A resposta deve conter marcadores conhecidos do SAPL ou um `<title>` com a palavra `SAPL`.

4. **Deduplica e grava resultados**
   - Resultados sao deduplicados por `sapl_url`.
   - O script grava CSV e JSON agregados. O JSONL e opcional.

## Observacoes de desempenho

- `--concurrency` controla o numero de requisicoes simultaneas.
- `--timeout` controla o tempo maximo de espera por resposta.
- Em redes mais lentas, prefira `--concurrency 30` a `60` e `--timeout 30`.

## Estrutura do projeto

- `sapl_finder.py`: script principal
- `output.py`: rotinas de escrita de saidas
- `sapls/`: exemplos de dados (nao usados pelo script)
