# Analise exploratoria: ementas vs acoes

## Escopo

Esta analise compara a qualidade das sugestoes geradas por busca semantica em duas representacoes do mesmo acervo legislativo:

- `ementas`: embeddings calculados diretamente sobre a ementa original do PL.
- `acoes`: embeddings calculados sobre a ementa reescrita como acao com o modelo de linguagem do projeto.

Os numeros abaixo usam o pool anotado em `experiments/eval/outputs/annotation_pool_categorized.jsonl` e os rankings top-10 de `recommendations_ementas.jsonl` e `recommendations_acoes.jsonl`.

## Resumo executivo

O pool contem 272 pares problema-documento anotados em 15 problemas (media de 18.1 candidatos por problema).
As recomendacoes baseadas em acoes superam as recomendacoes baseadas em ementas na maior parte das metricas principais: nDCG@10 sobe de 0.671 para 0.802 (delta 0.131), MAP@10 sobe de 0.491 para 0.593, e a relevancia media no top-10 sobe de 1.893 para 2.240.
O ganho mais consistente aparece na qualidade dos documentos fortes (`relevance >= 2`): High-P@10 sobe de 0.627 para 0.787 e High-Recall@10 sobe de 0.499 para 0.638.
As duas abordagens quase nao recuperam o mesmo conjunto de documentos: o overlap medio e de 1.87 documentos por problema e o Jaccard medio entre top-10 e de apenas 0.118.
Interpretacao pratica: transformar ementas em acoes tende a alinhar melhor a busca com problemas formulados como necessidades municipais, principalmente quando a ementa original e burocratica, genrica ou indireta.

## Perfil do pool anotado

A base anotada e densa em documentos relevantes porque foi montada a partir da uniao dos top-10 das duas abordagens. No total, 87.5% dos itens receberam relevancia > 0 e 68.8% receberam relevancia >= 2.

| Subconjunto | Itens | % relevantes | % relevancia alta (>=2) |
| --- | ---: | ---: | ---: |
| Somente ementas | 122 | 81.1% | 56.6% |
| Somente acoes | 122 | 91.0% | 76.2% |
| Intersecao | 28 | 100.0% | 89.3% |

Os documentos exclusivos de `acoes` sao mais fortes que os exclusivos de `ementas`: 76.2% dos exclusivos de acoes receberam relevancia alta, contra 56.6% dos exclusivos de ementas.

Distribuicao global de relevancia no pool:

- `relevance = 0`: 34 itens
- `relevance = 1`: 51 itens
- `relevance = 2`: 68 itens
- `relevance = 3`: 119 itens

## Metricas agregadas

| Metrica | Ementas | Acoes | Delta (acoes - ementas) |
| --- | ---: | ---: | ---: |
| P@1 | 0.933 | 1.000 | 0.067 |
| P@3 | 0.844 | 1.000 | 0.156 |
| P@5 | 0.853 | 0.960 | 0.107 |
| P@10 | 0.847 | 0.927 | 0.080 |
| High-P@3 (rel>=2) | 0.667 | 0.844 | 0.178 |
| High-P@10 (rel>=2) | 0.627 | 0.787 | 0.160 |
| Recall@10 | 0.541 | 0.601 | 0.060 |
| High-Recall@10 (rel>=2) | 0.499 | 0.638 | 0.139 |
| MRR@10 | 0.967 | 1.000 | 0.033 |
| MAP@10 | 0.491 | 0.593 | 0.102 |
| nDCG@3 | 0.674 | 0.799 | 0.125 |
| nDCG@10 | 0.671 | 0.802 | 0.131 |
| Relevancia media@3 | 2.022 | 2.489 | 0.467 |
| Relevancia media@10 | 1.893 | 2.240 | 0.347 |

Leitura rapida: `acoes` melhora tanto a proporcao de itens relevantes no topo quanto a ordenacao dos melhores documentos ao longo do ranking.

## Comparacao pareada por problema

A tabela abaixo conta, problema a problema, quantas vezes `acoes` ficou acima de `ementas`. O p-valor vem de um sign test exato e serve apenas como indicio, porque a amostra tem 15 problemas.

| Metrica | Delta medio | Vitorias acoes | Vitorias ementas | Empates | p-valor sign test |
| --- | ---: | ---: | ---: | ---: | ---: |
| P@3 | 0.156 | 5 | 0 | 10 | 0.062 |
| P@10 | 0.080 | 4 | 2 | 9 | 0.688 |
| High-P@10 | 0.160 | 9 | 1 | 5 | 0.021 |
| Recall@10 | 0.060 | 4 | 2 | 9 | 0.688 |
| High-Recall@10 | 0.139 | 9 | 1 | 5 | 0.021 |
| MAP@10 | 0.102 | 5 | 2 | 8 | 0.453 |
| nDCG@10 | 0.131 | 11 | 3 | 1 | 0.057 |
| Relevancia media@10 | 0.347 | 10 | 3 | 2 | 0.092 |

O sinal mais forte esta nas metricas de relevancia alta: `acoes` venceu em 9 dos 10 casos nao empatados em High-P@10 e High-Recall@10.

## Ganho por problema

| Problema | nDCG@10 ementas | nDCG@10 acoes | Delta | Exclusivos relevantes ementas | Exclusivos relevantes acoes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `enchentes_urbanas` | 0.430 | 0.964 | 0.534 | 2 | 8 |
| `emprego_jovem` | 0.433 | 0.802 | 0.370 | 8 | 7 |
| `residuos_reciclagem` | 0.673 | 1.000 | 0.327 | 9 | 9 |
| `agricultura_familiar` | 0.505 | 0.793 | 0.288 | 9 | 9 |
| `violencia_bairros_centrais` | 0.383 | 0.651 | 0.268 | 7 | 10 |
| `digitalizacao_servicos` | 0.403 | 0.662 | 0.258 | 3 | 7 |
| `arrecadacao_sem_imposto` | 0.705 | 0.846 | 0.142 | 2 | 2 |
| `habitacao_interesse_social` | 0.827 | 0.955 | 0.128 | 7 | 7 |
| `saude_mental_escolas` | 0.852 | 0.926 | 0.074 | 6 | 6 |
| `inclusao_pcd` | 0.757 | 0.802 | 0.045 | 7 | 7 |
| `mobilidade_pico` | 0.553 | 0.566 | 0.013 | 8 | 7 |
| `evasao_ensino_medio` | 1.000 | 1.000 | 0.000 | 3 | 3 |
| `dengue_arboviroses` | 0.940 | 0.807 | -0.133 | 9 | 9 |
| `saneamento_basico` | 0.928 | 0.773 | -0.155 | 10 | 10 |
| `iluminacao_publica` | 0.673 | 0.483 | -0.190 | 9 | 10 |

Os maiores ganhos de `acoes` aparecem em `enchentes_urbanas`, `emprego_jovem`, `residuos_reciclagem`, `agricultura_familiar` e `violencia_bairros_centrais`. As maiores perdas aparecem em `iluminacao_publica`, `saneamento_basico` e `dengue_arboviroses`.

## Qualidade ao longo do ranking

| Rank | Relevancia media ementas | Relevancia media acoes | Delta |
| --- | ---: | ---: | ---: |
| 1 | 2.600 | 2.600 | 0.000 |
| 2 | 1.733 | 2.600 | 0.867 |
| 3 | 1.733 | 2.267 | 0.533 |
| 4 | 1.933 | 2.400 | 0.467 |
| 5 | 2.067 | 1.733 | -0.333 |
| 6 | 1.867 | 2.333 | 0.467 |
| 7 | 1.933 | 2.400 | 0.467 |
| 8 | 1.733 | 2.067 | 0.333 |
| 9 | 1.400 | 2.000 | 0.600 |
| 10 | 1.933 | 2.000 | 0.067 |

No rank 1, as duas abordagens empatam em relevancia media (2.600), mas `acoes` fica claramente melhor entre os ranks 2 e 10, o que explica o ganho de nDCG e MAP.

## Exemplos qualitativos

### Casos em que `acoes` melhora muito

- **Prevenir enchentes urbanas** (`enchentes_urbanas`): nDCG@10 ementas=0.430 vs acoes=0.964. Top-3 ementas: #1 (rel=3) Ribas do Rio Pardo/MS: Regulamentar a contenção de águas pluviais para prevenir enchentes, alagamentos e preservaçã...; #2 (rel=0) Itapoá/SC: Desafetar lotes do patrimônio municipal.; #3 (rel=0) Natal/RN: Criar o IPTU Zero, desconto no IPTU para imóveis onde ocorram enchentes e alagamentos no mun.... Top-3 acoes: #1 (rel=3) Campinas/SP: Implantar o programa “Bueiro Imobiliário” para prevenção de enchentes no município.; #2 (rel=3) Rio Grande/RS: Implantar o programa “Bueiro Imobiliário” como forma de prevenção às enchentes no município.; #3 (rel=3) Cabo de Santo Agostinho/PE: Implantar o programa “Bueiro Imobiliário” como forma de prevenção às enchentes no município..
- **Ampliar oportunidades para jovens** (`emprego_jovem`): nDCG@10 ementas=0.433 vs acoes=0.802. Top-3 ementas: #1 (rel=3) Paraguaçu Paulista/SP: Criar e instituído o projeto Jovem Trabalhador no município.; #2 (rel=1) Canoinhas/SC: Conceder incentivos para o desenvolvimento econômico e social do município.; #3 (rel=1) Canoinhas/SC: Conceder incentivos para o desenvolvimento econômico e social do município.. Top-3 acoes: #1 (rel=3) Pedro Afonso/TO: Criar o programa “Mais Jovem” para contratação de jovens para trabalhar em diversos setores...; #2 (rel=3) Natal/RN: Criar programa de incentivo à qualificação e à inserção no mercado de trabalho para jovens n...; #3 (rel=3) Cabo de Santo Agostinho/PE: Criar banco municipal de oportunidades para jovens no município..

### Casos em que `ementas` foi melhor

- **Ampliar acesso a saneamento básico** (`saneamento_basico`): nDCG@10 ementas=0.928 vs acoes=0.773. Top-3 ementas: #1 (rel=3) Pato Branco/PR: Criar o Programa Mais Saneamento no município.; #2 (rel=2) São Bento do Sul/SC: Elaborar o Plano Municipal Integrado de Saneamento Básico e propor revisão e aperfeiçoamento.; #3 (rel=2) Congonhal/MG: Criar Fundo Municipal de Saneamento Básico.. Top-3 acoes: #1 (rel=2) Estância Velha/RS: Elaborar plano municipal de saneamento básico no município.; #2 (rel=2) Xangri-lá/RS: Instituir plano de saneamento básico do município.; #3 (rel=2) Canela/RS: Criar plano municipal de saneamento básico para o município..
- **Expandir e modernizar iluminação pública** (`iluminacao_publica`): nDCG@10 ementas=0.673 vs acoes=0.483. Top-3 ementas: #1 (rel=3) Porto Murtinho/MS: Tornar obrigatória o uso de lâmpadas de LED (diodo emissor de luz) na iluminação dos prédios...; #2 (rel=0) Três Passos/RS: Extingue a taxa de iluminação pública municipal.; #3 (rel=2) Montenegro/RS: Incluir ações nas metas e prioridades do PPA 2018/2021.. Top-3 acoes: #1 (rel=2) Estância Velha/RS: Reestruturar o Fundo Municipal de Luz Pública.; #2 (rel=3) Natal/RN: Elaborar e revisão de planejamento de iluminação pública no município.; #3 (rel=1) Natércia/MG: Instituir taxa de iluminação pública municipal..

## Interpretacao

Os resultados sugerem que a transformacao de ementa em acao reduz ambiguidade e aproxima o texto indexado da formulacao das queries, que tambem sao escritas como problemas ou objetivos de politica publica.

Esse efeito aparece sobretudo quando a ementa original fala em instrumentos genericos, fundos, revisoes administrativas ou linguagem legislativa pouco operacional. Nesses casos, a versao em acao torna mais explicito o verbo, o alvo e o mecanismo da politica.

As derrotas de `acoes` parecem ocorrer quando a reescrita perde alguma nuance importante do dominio ou simplifica demais documentos ja muito claros na forma original. Os temas `iluminacao_publica` e `saneamento_basico` sao exemplos disso.

## Limitacoes

- A avaliacao usa um pool anotado derivado da uniao dos top-10 das duas abordagens. Isso e adequado para comparacao relativa, mas nao mede recall absoluto do corpus.
- Documentos fora do pool nao foram julgados. Se uma abordagem trouxesse bons itens fora dessa uniao, o experimento atual nao capturaria esse ganho.
- A amostra tem 15 problemas, entao os sinais estatisticos devem ser tratados como exploratorios.
- O arquivo anotado nao registra multiplos avaliadores, entao nao ha medida de concordancia interanotador.

## Conclusao

Dentro deste conjunto anotado, a estrategia baseada em `acoes` e superior a busca usando apenas `ementas`. O ganho e moderado nas metricas globais, mas forte na recuperacao de documentos de alta qualidade e na consistencia do ranking apos a primeira posicao.

Se a meta do projeto e maximizar a utilidade pratica das sugestoes para problemas municipais, os dados atuais favorecem usar a representacao em `acoes` como default ou pelo menos como componente principal de um ranking hibrido.
