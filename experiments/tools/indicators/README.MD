# Procedência dos indicadores oficiais

Ferramentas que coletam e processam os indicadores oficiais usados pela plataforma e pelas
análises de políticas. As taxas são normalizadas por 100 mil habitantes com a população do
SIDRA/IBGE (`SIDRA_Habitantes.csv`).

Os CSVs finais consumidos em produção ficam na raiz do repositório, em `indicators/`, e são
apontados por variáveis de ambiente (ver `README.md` da raiz).

## Segurança (`security/`)
- `MJSP/download.sh` — baixa as bases de segurança pública do Ministério da Justiça e Segurança
  Pública (MJSP).
- `process_data.ipynb` — consolida os dados do MJSP, cruza com a população (`SIDRA_Habitantes.csv`)
  e gera a taxa de homicídios por 100 mil habitantes.
- **Saída em produção:** `indicators/homicidios.csv`
  (colunas `municipio_norm`, `uf`, `ano`, `semestre`, `taxa_homicidios_100k`).

## Educação (`education/`)
- `Censo Escolar Scrapper.ipynb` — coleta matrículas do Censo Escolar (INEP) e cruza com a
  população (`SIDRA_Habitantes.csv`).
- **Saída em produção:** `indicators/matriculas.csv`
  (colunas `municipio`, `uf`, `ano`, `semestre`, `taxa_matriculas_100k`).

> **Atenção a acentos.** O caminho Python (`core/indicators.py`) casa o município do PL com o
> indicador via `.upper()`, **sem remover acentos**. Logo, a coluna-chave precisa estar na mesma
> forma acentuada/maiúscula do campo `municipio` do dataset — `indicators/homicidios.csv` usa
> `municipio_norm` (acentuada). A plataforma (TypeScript) normaliza removendo acentos nos dois
> lados e tolera ambas as formas.
