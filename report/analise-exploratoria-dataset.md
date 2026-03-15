# Análise Exploratória do `experiments/data/dataset.npy`

Este arquivo consolida uma análise exploratória do dataset usado no projeto, com foco em responder perguntas do artigo e gerar evidências que podem ser incorporadas em [`main_v2.tex`](/home/thiago/Projects/IC/AIPolicy/CityManager/report/main_v2.tex).

Fonte analisada: [`experiments/data/dataset.npy`](/home/thiago/Projects/IC/AIPolicy/CityManager/experiments/data/dataset.npy)

---

## 1. Resumo executivo

Os achados mais relevantes para o paper são:

1. o dataset contém exatamente `220.065` registros, cobrindo `322` municípios e `19` UFs;
2. a cobertura territorial é fortemente concentrada no Sul (`45,52%` dos registros) e no Sudeste (`23,03%`);
3. os dados vão de `1947-12-29` a `2099-09-29`, mas há pelo menos `2` anomalias temporais claras e `1` ano inválido (`199`);
4. `43,63%` de todo o dataset está concentrado entre `2021` e `2025`, cobrindo `315` dos `322` municípios;
5. todos os registros têm `ementa`, `ação`, `link_publico` e embedding preenchidos, mas o campo `situacao` está vazio em `100%` dos casos;
6. a tradução `ementa -> ação` reduz o tamanho médio do texto para cerca de `58,9%` dos caracteres e `56,3%` das palavras da ementa;
7. o dataset parece bem deduplicado no nível de identificador legislativo: `0` duplicatas por `link_publico` e `0` duplicatas por `(sapl_base, materia_id)`;
8. apesar de o paper falar em PLs, o dataset contém pelo menos `3,54%` de itens que não começam com código `PL`, incluindo anteprojetos, emendas, substitutivos e vetos.

---

## 2. Estrutura do dataset

O arquivo `dataset.npy` é um `ndarray` de tamanho `220065`, com um dicionário por linha. Campos observados:

- `sapl_base`
- `sapl_url`
- `municipio`
- `uf`
- `tipo_id`
- `tipo_label`
- `materia_id`
- `numero`
- `ano`
- `ementa`
- `data_apresentacao`
- `em_tramitacao`
- `situacao`
- `link_publico`
- `acao`
- `embedding`

Características estruturais:

| Métrica | Valor |
| --- | ---: |
| Registros totais | 220.065 |
| Municípios únicos | 322 |
| Pares únicos município/UF | 322 |
| UFs cobertas | 19 |
| `tipo_label` distintos | 360 |
| Dimensão dos embeddings | 768 |
| Norma média dos embeddings (amostra) | 1,0000 |
| Desvio-padrão da norma dos embeddings (amostra) | 0,0000 |

Interpretação:

- o dataset final está no formato adequado para as etapas de busca, agrupamento e análise com indicadores;
- os embeddings parecem já estar normalizados em norma L2 igual a 1, o que é consistente com uso direto em similaridade cosseno.

---

## 3. Cobertura territorial

### 3.1 Por região

| Região | Registros | % dos registros | Municípios | % dos municípios |
| --- | ---: | ---: | ---: | ---: |
| Sul | 100.175 | 45,52% | 107 | 33,23% |
| Sudeste | 50.673 | 23,03% | 100 | 31,06% |
| Centro-Oeste | 38.788 | 17,63% | 68 | 21,12% |
| Nordeste | 21.588 | 9,81% | 36 | 11,18% |
| Norte | 8.841 | 4,02% | 11 | 3,42% |

Leitura para o artigo:

- a cobertura é claramente assimétrica;
- Sul e Sudeste juntos concentram `68,55%` dos registros e `64,29%` dos municípios do dataset;
- isso sustenta diretamente a discussão de viés regional em ameaças à validade.

### 3.2 Top UFs por volume de registros

| UF | Registros | Municípios |
| --- | ---: | ---: |
| RS | 62.529 | 54 |
| MG | 28.312 | 82 |
| MT | 25.206 | 39 |
| PR | 23.624 | 32 |
| SP | 19.859 | 12 |
| SC | 14.022 | 21 |
| GO | 12.121 | 24 |
| PB | 8.419 | 3 |
| PA | 7.642 | 3 |
| RN | 5.959 | 2 |

Observação importante:

- há UFs com poucos municípios e muito volume, o que indica concentração em câmaras com histórico legislativo muito grande.

### 3.3 Top municípios por volume de registros

| Município/UF | Registros |
| --- | ---: |
| Campina Grande/PB | 8.268 |
| Montes Claros/MG | 6.817 |
| Pato Branco/PR | 6.434 |
| Marabá/PA | 6.091 |
| Rio Grande/RS | 6.019 |
| Natal/RN | 5.839 |
| Barueri/SP | 5.726 |
| Erechim/RS | 5.724 |
| Araxá/MG | 4.291 |
| Campinas/SP | 4.218 |

Distribuição por município:

| Métrica | Valor |
| --- | ---: |
| Média de registros por município | 683,43 |
| Mediana de registros por município | 241 |
| Média de anos distintos por município | 10,34 |
| Mediana de anos distintos por município | 6 |

Leitura:

- o dataset é bastante assimétrico;
- a média é puxada por municípios com acervo legislativo muito grande;
- a mediana descreve melhor o município “típico” da base.

---

## 4. Cobertura temporal

### 4.1 Intervalo observado

| Métrica | Valor |
| --- | --- |
| Data mínima (`data_apresentacao`) | 1947-12-29 |
| Data máxima (`data_apresentacao`) | 2099-09-29 |
| Ano mínimo (`ano`) | 199 |
| Ano máximo (`ano`) | 2026 |

### 4.2 Concentração recente

Entre `2021` e `2025`, o dataset contém:

- `96.018` registros;
- `43,63%` de toda a base;
- `315` municípios.

Distribuição anual recente:

| Ano | Registros | % do total |
| --- | ---: | ---: |
| 2021 | 17.637 | 8,01% |
| 2022 | 17.954 | 8,16% |
| 2023 | 20.213 | 9,19% |
| 2024 | 16.370 | 7,44% |
| 2025 | 23.844 | 10,83% |

Leitura para o paper:

- a base não é apenas histórica: ela contém massa recente relevante;
- isso reforça o valor prático do sistema para consultas contemporâneas;
- também indica que uma análise focada no período recente é viável sem perder muita cobertura.

### 4.3 Anomalias temporais detectadas

Foram detectadas pelo menos `2` anomalias temporais claras:

1. `Juazeiro/BA` com `ano = 2026`;
2. `Diamantino/MT` com `ano = 199`.

Também foram encontradas `2` datas de apresentação em `2099-09-29`, ambas em `Araxá/MG`, com ano legislativo de `2009`.

Exemplos:

- `Juazeiro/BA`, número `3983`, matéria `1168`, ano `2026`;
- `Diamantino/MT`, número `26`, matéria `11612`, ano `199`;
- `Araxá/MG`, matérias `3800` e `3802`, `data_apresentacao = 2099-09-29`.

Leitura:

- o dataset precisa de uma etapa explícita de saneamento temporal antes de qualquer análise sensível à data;
- essa é uma evidência concreta para reforçar a seção de limitações.

---

## 5. Qualidade e completude dos campos

| Campo | Situação |
| --- | --- |
| `acao` | 100% preenchido |
| `ementa` | 100% preenchido |
| `link_publico` | 100% preenchido |
| `data_apresentacao` | 11 valores ausentes |
| `situacao` | 220.065 ausentes |

Outras métricas:

| Métrica | Valor |
| --- | ---: |
| `em_tramitacao = true` | 18,38% |
| `em_tramitacao = false` | 81,62% |

Leitura:

- o dataset final está muito completo para busca e recuperação;
- `situacao` não pode ser usado em análise nesta versão da base;
- `data_apresentacao` está quase completa, mas com poucos casos ausentes e alguns outliers severos.

---

## 6. Efeito da tradução `ementa -> ação`

### 6.1 Estatísticas de tamanho

| Métrica | Ementa | Ação |
| --- | ---: | ---: |
| Média de caracteres | 152,86 | 90,01 |
| Mediana de caracteres | 135 | 83 |
| Média de palavras | 24,18 | 13,61 |
| Mediana de palavras | 21 | 13 |

Redução média:

- razão de caracteres `ação / ementa = 0,589`;
- razão de palavras `ação / ementa = 0,563`.

Interpretação:

- a ação preserva pouco mais da metade do tamanho textual médio da ementa;
- isso é coerente com a narrativa do paper de “remoção de casca jurídica” e condensação semântica.

### 6.2 Quantis de tamanho

#### Ementa

| Quantil | Caracteres |
| --- | ---: |
| 10% | 73 |
| 25% | 97 |
| 50% | 135 |
| 75% | 188 |
| 90% | 251 |
| 99% | 440 |

#### Ação

| Quantil | Caracteres |
| --- | ---: |
| 10% | 49 |
| 25% | 63 |
| 50% | 83 |
| 75% | 109 |
| 90% | 140 |
| 99% | 208 |

Leitura:

- a tradução comprime a distribuição inteira, e não apenas a média;
- a cauda longa de ementas muito extensas continua existindo, mas é bastante reduzida nas ações.

### 6.3 Reuso textual

| Métrica | Valor |
| --- | ---: |
| Ementas únicas | 219.245 |
| Ações únicas | 188.254 |
| Reuso de ementas | 0,37% |
| Reuso de ações | 14,46% |

Leitura:

- a tradução aumenta bastante a convergência textual;
- isso reforça a justificativa de usar ações como espaço intermediário para busca e agrupamento;
- em outras palavras, o tradutor não só encurta texto, mas também reduz variabilidade superficial.

### 6.4 Concentração das ações mais frequentes

| Faixa | Registros | % do total |
| --- | ---: | ---: |
| Top 50 ações mais frequentes | 3.381 | 1,54% |
| Top 100 ações mais frequentes | 4.861 | 2,21% |

Leitura:

- apesar de haver reuso semântico relevante, a base continua bastante diversa;
- o espaço de ações não colapsa em poucas frases genéricas.

---

## 7. Integridade e deduplicação

### 7.1 Verificações fortes

| Regra de deduplicação | Duplicatas |
| --- | ---: |
| `link_publico` | 0 |
| `(sapl_base, materia_id)` | 0 |
| `(municipio, uf, ano, ementa)` | 0 |
| `(municipio, uf, numero, ano, tipo_label, sapl_base)` | 1 |

### 7.2 Verificação fraca

| Regra | Duplicatas |
| --- | ---: |
| `(municipio, uf, numero, ano, sapl_base)` | 24.205 |

Interpretação:

- a regra fraca superestima duplicatas porque o mesmo número/ano pode aparecer em tipos diferentes;
- a regra forte mostra que o dataset parece deduplicado corretamente no nível do item legislativo.

O único caso encontrado na regra forte foi em `Congonhas/MG`, com duas matérias distintas classificadas como emendas ao mesmo PL, ambas numeradas como `1/2025`.

Leitura para o paper:

- você pode sustentar que a deduplicação final foi eficaz no nível de identificador público;
- mas não deve afirmar que `número + ano` é chave única universal.

---

## 8. Tipos legislativos observados

### 8.1 Top `tipo_label`

| Tipo | Registros | % do total |
| --- | ---: | ---: |
| `PLO Projeto de Lei Ordinária` | 82.359 | 37,42% |
| `PL Projeto de Lei` | 37.744 | 17,15% |
| `PL PROJETO DE LEI` | 12.075 | 5,49% |
| `PLC Projeto de Lei Complementar` | 8.581 | 3,90% |
| `PLE Projeto de Lei do Executivo` | 5.245 | 2,38% |
| `PLE Projeto de Lei Executivo` | 4.641 | 2,11% |
| `PLEO Projeto de Lei` | 4.516 | 2,05% |
| `PLE Projeto de Lei Ordinária Executivo` | 4.014 | 1,82% |
| `PL Projeto de Lei Ordinário` | 3.085 | 1,40% |
| `PLV Projeto de Lei de Vereador` | 3.011 | 1,37% |

### 8.2 Itens não exatamente “PL clássico”

Registros cujo `tipo_label` **não** começa com código `PL`: `7.783` (`3,54%`).

Classificação ampla desses casos:

| Categoria | Registros |
| --- | ---: |
| PL clássico | 216.862 |
| Emenda | 1.428 |
| Anteprojeto | 1.087 |
| Substitutivo | 508 |
| Veto | 180 |

Leitura para o paper:

- a base final não é composta exclusivamente por PLs estritos;
- isso provavelmente decorre do critério de seleção por rótulo contendo “projeto de lei”;
- essa é uma ameaça metodológica importante e vale ser explicitada.

---

## 9. Sinais temáticos úteis para estudos de caso

### 9.1 Segurança

Filtro exploratório por palavras-chave em `acao`:

- registros: `2.766`
- municípios: `247`
- UFs: `19`

Top municípios:

| Município/UF | Registros |
| --- | ---: |
| Natal/RN | 176 |
| Campina Grande/PB | 131 |
| Campinas/SP | 112 |
| Rio Grande/RS | 102 |
| Barueri/SP | 99 |

Observação:

- o filtro lexical de segurança captura algum ruído, por exemplo “segurança alimentar”;
- ainda assim, o volume é suficiente para montar um estudo de caso inicial.

### 9.2 Educação

Filtro exploratório por palavras-chave em `acao`:

- registros: `14.917`
- municípios: `300`
- UFs: `19`

Top municípios:

| Município/UF | Registros |
| --- | ---: |
| Natal/RN | 804 |
| Campina Grande/PB | 778 |
| Montes Claros/MG | 600 |
| Barueri/SP | 475 |
| Rio Grande/RS | 392 |

Leitura:

- educação é um tema muito mais abundante na base do que segurança;
- isso sugere que um estudo de caso em educação provavelmente terá amostra mais robusta.

---

## 10. Perguntas do artigo que este dataset já ajuda a responder

### Pergunta 10: cobertura final

O dataset sustenta:

- `322` municípios com pelo menos um item legislativo;
- `19` UFs cobertas;
- concentração regional forte em Sul e Sudeste.

### Pergunta 13: deduplicação

O dataset sustenta:

- `0` duplicatas por `link_publico`;
- `0` duplicatas por `(sapl_base, materia_id)`;
- deduplicação efetiva no nível do item legislativo público.

### Pergunta 14: intervalo temporal

O dataset sustenta:

- acervo principal entre `1947` e `2025`;
- presença de poucos outliers que exigem limpeza;
- massa recente forte entre `2021` e `2025`.

### Pergunta 41: resultados quantitativos adicionais

Você já pode adicionar ao paper:

- `322` municípios e `19` UFs cobertas;
- distribuição por região;
- distribuição por ano recente;
- estatísticas de compressão textual da tradução;
- proporção de registros em tramitação (`18,38%`);
- quantidade de tipos legislativos (`360` rótulos);
- proporção de itens não-PL estritos (`3,54%`).

### Pergunta 44: erros ou falhas típicas

O dataset sustenta pelo menos três falhas concretas:

1. datas inválidas ou futuristas (`2099`);
2. ano inconsistente (`199`);
3. contaminação da base por tipos não estritamente classificados como PL.

### Pergunta 55: viés regional

O dataset sustenta claramente a discussão de viés regional:

- Sul: `45,52%` dos registros;
- Sudeste: `23,03%`;
- Norte: apenas `4,02%`.

---

## 11. Pontos que o dataset não responde sozinho

Mesmo com esta análise, algumas perguntas do artigo continuam sem resposta apenas com `dataset.npy`:

1. benchmark formal da busca semântica;
2. avaliação humana do tradutor;
3. comparação com baselines adicionais;
4. causalidade ou robustez temporal dos indicadores;
5. trabalhos relacionados e posicionamento bibliográfico;
6. detalhes completos do protocolo de treino e hardware.

---

## 12. Recomendações diretas para o paper

### Inserções quantitativas recomendadas

1. adicionar uma tabela de cobertura por região;
2. adicionar uma frase sobre `322` municípios e `19` UFs;
3. incluir a compressão média `ementa -> ação` como evidência do valor do tradutor;
4. explicitar que `43,63%` da base está entre `2021` e `2025`;
5. incluir uma nota metodológica sobre `3,54%` de itens não-PL estritos.

### Inserções metodológicas recomendadas

1. declarar uma etapa de saneamento temporal para remover outliers como `ano = 199` e `data_apresentacao = 2099`;
2. revisar a definição operacional de “PL” usada no filtro de `tipo_label`;
3. usar `link_publico` ou `(sapl_base, materia_id)` como referência de integridade da base, em vez de `numero + ano`.

### Sugestões para estudos de caso

1. educação parece o melhor candidato quantitativo para um estudo de caso robusto;
2. segurança continua viável, mas exige filtro temático mais preciso para evitar ruído lexical.

---

## 13. Próximo passo sugerido

Depois desta análise, a melhor sequência é:

1. atualizar [`main_v2.tex`](/home/thiago/Projects/IC/AIPolicy/CityManager/report/main_v2.tex) com uma tabela regional e um parágrafo de qualidade do dataset;
2. filtrar ou corrigir anomalias temporais antes de análises de indicador;
3. usar os recortes de educação e segurança para construir os estudos de caso da próxima versão do artigo.
