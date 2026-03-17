# Analise exploratoria: bm25 vs ementas vs acoes

## Escopo

Esta analise compara a qualidade das sugestoes geradas por tres abordagens sobre o mesmo acervo legislativo:

- `bm25_ementas`: baseline lexical BM25 calculado sobre a ementa original do PL.
- `ementas`: embeddings calculados diretamente sobre a ementa original do PL.
- `acoes`: embeddings calculados sobre a ementa reescrita como acao com o modelo de linguagem do projeto.

Os numeros abaixo usam o pool anotado em `experiments/eval/outputs/annotation_pool_categorized.jsonl` e os rankings de `recommendations_bm25_ementas.jsonl`, `recommendations_ementas.jsonl` e `recommendations_acoes.jsonl`.

## Resumo executivo

O pool contem 1158 pares problema-documento anotados em 15 problemas (media de 77.2 candidatos por problema).
As recomendacoes baseadas em `acoes` lideram nas metricas principais, seguidas por `ementas` e depois por `bm25_ementas`: nDCG@10 = 0.522 / 0.591 / 0.743, MAP@10 = 0.125 / 0.142 / 0.173, e relevancia media@10 = 1.773 / 1.940 / 2.327.
Contra o baseline lexical, `acoes` sobe de 0.620 para 0.793 em High-P@10 e de 0.145 para 0.215 em High-Recall@10. `ementas` tambem supera o BM25 nesses dois cortes (0.640 e 0.165).
Os tres rankings recuperam conjuntos parcialmente distintos: o overlap medio entre BM25 e ementas e de 4.27 documentos por problema (Jaccard 0.083), entre BM25 e acoes e de 4.47 (Jaccard 0.088) e entre ementas e acoes e de 6.20 (Jaccard 0.126).
Interpretacao pratica: as duas abordagens semanticas superam o baseline lexical em media, e a textualizacao em formato de acao continua sendo a melhor forma de alinhar a busca com problemas formulados como necessidades municipais.

## Perfil do pool anotado

A base anotada e densa em documentos relevantes porque foi montada a partir da uniao dos rankings das tres abordagens. No total, 75.6% dos itens receberam relevancia > 0 e 54.9% receberam relevancia >= 2.

| Abordagem | Itens no pool | % relevantes | % relevancia alta (>=2) | Itens exclusivos | % alta nos exclusivos |
| --- | ---: | ---: | ---: | ---: | ---: |
| BM25 | 450 | 70.4% | 52.7% | 351 | 44.7% |
| ementas | 450 | 78.9% | 55.6% | 325 | 45.8% |
| acoes | 450 | 87.1% | 68.0% | 322 | 62.1% |

Entre as tres abordagens, `acoes` concentra a maior fracao de itens de alta relevancia (68.0%), enquanto `bm25` adiciona mais candidatos exclusivos ao pool (351 pares).

Distribuicao global de relevancia no pool:

- `relevance = 0`: 282 itens
- `relevance = 1`: 240 itens
- `relevance = 2`: 267 itens
- `relevance = 3`: 369 itens

## Metricas agregadas

| Metrica | BM25 | Ementas | Acoes | Delta (ementas - BM25) | Delta (acoes - BM25) |
| --- | ---: | ---: | ---: | ---: | ---: |
| P@1 | 0.800 | 0.933 | 1.000 | 0.133 | 0.200 |
| P@3 | 0.867 | 0.889 | 1.000 | 0.022 | 0.133 |
| P@5 | 0.813 | 0.880 | 0.973 | 0.067 | 0.160 |
| P@10 | 0.787 | 0.873 | 0.940 | 0.087 | 0.153 |
| High-P@3 (rel>=2) | 0.689 | 0.644 | 0.844 | -0.044 | 0.156 |
| High-P@10 (rel>=2) | 0.620 | 0.640 | 0.793 | 0.020 | 0.173 |
| Recall@10 | 0.133 | 0.156 | 0.174 | 0.023 | 0.041 |
| High-Recall@10 (rel>=2) | 0.145 | 0.165 | 0.215 | 0.021 | 0.070 |
| MRR@10 | 0.856 | 0.967 | 1.000 | 0.111 | 0.144 |
| MAP@10 | 0.125 | 0.142 | 0.173 | 0.017 | 0.048 |
| nDCG@3 | 0.555 | 0.635 | 0.818 | 0.079 | 0.262 |
| nDCG@10 | 0.522 | 0.591 | 0.743 | 0.068 | 0.221 |
| Relevancia media@3 | 1.933 | 2.022 | 2.578 | 0.089 | 0.644 |
| Relevancia media@10 | 1.773 | 1.940 | 2.327 | 0.167 | 0.553 |

Leitura rapida: as duas abordagens semanticas superam o BM25 em media, e `acoes` melhora tanto a proporcao de itens relevantes no topo quanto a ordenacao dos melhores documentos ao longo do ranking.

## Comparacao pareada por problema

As tabelas abaixo contam, problema a problema, quantas vezes cada abordagem semantica ficou acima do baseline lexical BM25. O p-valor vem de um sign test exato e serve apenas como indicio, porque a amostra tem 15 problemas.

### Ementas vs BM25

| Metrica | Delta medio | Vitorias ementas | Vitorias bm25 | Empates | p-valor sign test |
| --- | ---: | ---: | ---: | ---: | ---: |
| P@3 | 0.022 | 2 | 1 | 12 | 1.000 |
| P@10 | 0.087 | 6 | 1 | 8 | 0.125 |
| High-P@10 | 0.020 | 9 | 5 | 1 | 0.424 |
| Recall@10 | 0.023 | 6 | 1 | 8 | 0.125 |
| High-Recall@10 | 0.021 | 9 | 5 | 1 | 0.424 |
| MAP@10 | 0.017 | 6 | 2 | 7 | 0.289 |
| nDCG@10 | 0.068 | 9 | 6 | 0 | 0.607 |
| Relevancia media@10 | 0.167 | 9 | 6 | 0 | 0.607 |

### Acoes vs BM25

| Metrica | Delta medio | Vitorias acoes | Vitorias bm25 | Empates | p-valor sign test |
| --- | ---: | ---: | ---: | ---: | ---: |
| P@3 | 0.133 | 3 | 0 | 12 | 0.250 |
| P@10 | 0.153 | 6 | 1 | 8 | 0.125 |
| High-P@10 | 0.173 | 11 | 2 | 2 | 0.022 |
| Recall@10 | 0.041 | 6 | 1 | 8 | 0.125 |
| High-Recall@10 | 0.070 | 11 | 2 | 2 | 0.022 |
| MAP@10 | 0.048 | 6 | 1 | 8 | 0.125 |
| nDCG@10 | 0.221 | 13 | 2 | 0 | 0.007 |
| Relevancia media@10 | 0.553 | 13 | 2 | 0 | 0.007 |

O sinal mais forte aparece na comparacao de `acoes` contra o baseline: `acoes` venceu em 11 de 13 comparacoes nao empatadas em High-P@10, em 11 de 13 em High-Recall@10 e em 13 de 15 em nDCG@10. `Ementas` tambem vence o BM25 em nDCG@10 em 9 de 15 comparacoes nao empatadas.

## Ganho por problema

| Problema | nDCG@10 BM25 | nDCG@10 ementas | nDCG@10 acoes | Delta (ementas - BM25) | Delta (acoes - BM25) |
| --- | ---: | ---: | ---: | ---: | ---: |
| `enchentes_urbanas` | 0.000 | 0.439 | 0.964 | 0.439 | 0.964 |
| `arrecadacao_sem_imposto` | 0.181 | 0.535 | 0.642 | 0.354 | 0.461 |
| `residuos_reciclagem` | 0.495 | 0.673 | 0.946 | 0.179 | 0.451 |
| `inclusao_pcd` | 0.374 | 0.727 | 0.789 | 0.353 | 0.415 |
| `iluminacao_publica` | 0.167 | 0.624 | 0.460 | 0.457 | 0.294 |
| `saude_mental_escolas` | 0.673 | 0.874 | 0.926 | 0.201 | 0.253 |
| `saneamento_basico` | 0.776 | 0.736 | 1.000 | -0.040 | 0.224 |
| `violencia_bairros_centrais` | 0.263 | 0.291 | 0.402 | 0.028 | 0.139 |
| `evasao_ensino_medio` | 0.881 | 1.000 | 1.000 | 0.119 | 0.119 |
| `habitacao_interesse_social` | 0.823 | 0.594 | 0.917 | -0.229 | 0.094 |
| `dengue_arboviroses` | 0.717 | 0.940 | 0.807 | 0.223 | 0.090 |
| `agricultura_familiar` | 0.658 | 0.467 | 0.734 | -0.191 | 0.076 |
| `emprego_jovem` | 0.767 | 0.420 | 0.774 | -0.347 | 0.008 |
| `digitalizacao_servicos` | 0.455 | 0.186 | 0.382 | -0.270 | -0.074 |
| `mobilidade_pico` | 0.607 | 0.355 | 0.404 | -0.252 | -0.203 |

Os maiores ganhos de `acoes` sobre o baseline aparecem em `enchentes_urbanas`, `arrecadacao_sem_imposto`, `residuos_reciclagem`, `inclusao_pcd` e `iluminacao_publica`. As maiores perdas aparecem em `mobilidade_pico` e `digitalizacao_servicos`.

## Qualidade ao longo do ranking

| Rank | Relevancia media BM25 | Relevancia media ementas | Relevancia media acoes |
| --- | ---: | ---: | ---: |
| 1 | 2.067 | 2.533 | 2.667 |
| 2 | 1.800 | 1.733 | 2.667 |
| 3 | 1.933 | 1.800 | 2.400 |
| 4 | 1.600 | 1.933 | 2.400 |
| 5 | 1.800 | 2.133 | 1.933 |
| 6 | 1.600 | 1.933 | 2.467 |
| 7 | 2.067 | 2.000 | 2.467 |
| 8 | 1.400 | 1.800 | 2.200 |
| 9 | 1.733 | 1.600 | 2.067 |
| 10 | 1.733 | 1.933 | 2.000 |
| 11 | 1.733 | 1.467 | 1.933 |
| 12 | 1.467 | 1.533 | 2.133 |
| 13 | 1.600 | 1.667 | 2.533 |
| 14 | 1.200 | 1.600 | 1.933 |
| 15 | 1.533 | 1.867 | 2.333 |
| 16 | 1.600 | 1.333 | 2.067 |
| 17 | 1.400 | 1.533 | 2.267 |
| 18 | 1.200 | 1.733 | 2.067 |
| 19 | 1.667 | 2.200 | 2.133 |
| 20 | 1.600 | 1.733 | 1.800 |
| 21 | 1.733 | 1.267 | 2.067 |
| 22 | 0.800 | 1.000 | 1.800 |
| 23 | 0.933 | 2.267 | 1.667 |
| 24 | 1.200 | 1.200 | 1.533 |
| 25 | 1.600 | 1.200 | 1.600 |
| 26 | 1.200 | 2.000 | 1.533 |
| 27 | 1.200 | 1.533 | 1.733 |
| 28 | 1.533 | 1.267 | 1.600 |
| 29 | 1.667 | 0.733 | 1.800 |
| 30 | 0.867 | 1.733 | 1.467 |

Ja no rank 1, `acoes` abre vantagem sobre o BM25 (2.667 vs 2.067) e supera o baseline em 29 das 30 posicoes analisadas.

## Exemplos qualitativos

### Casos em que `acoes` melhora muito sobre o baseline

- **Prevenir enchentes urbanas** (`enchentes_urbanas`): nDCG@10 bm25=0.000 vs ementas=0.439 vs acoes=0.964. Top-3 bm25: #1 (rel=0) Montenegro/RS: Criar o Banco de ideias legislativas no município.; #2 (rel=0) Natal/RN: Criar o Banco de ideias legislativas no município.; #3 (rel=0) Manhuaçu/MG: Criar o Banco de ideias legislativas no município.. Top-3 ementas: #1 (rel=3) Ribas do Rio Pardo/MS: Regulamentar a contenção de águas pluviais para prevenir enchentes, alagamentos e preservaçã...; #2 (rel=0) Itapoá/SC: Desafetar lotes do patrimônio municipal.; #3 (rel=0) Natal/RN: Criar o IPTU Zero, desconto no IPTU para imóveis onde ocorram enchentes e alagamentos no mun.... Top-3 acoes: #1 (rel=3) Campinas/SP: Implantar o programa “Bueiro Imobiliário” para prevenção de enchentes no município.; #2 (rel=3) Rio Grande/RS: Implantar o programa “Bueiro Imobiliário” como forma de prevenção às enchentes no município.; #3 (rel=3) Cabo de Santo Agostinho/PE: Implantar o programa “Bueiro Imobiliário” como forma de prevenção às enchentes no município..
- **Aumentar arrecadação sem subir impostos** (`arrecadacao_sem_imposto`): nDCG@10 bm25=0.181 vs ementas=0.535 vs acoes=0.642. Top-3 bm25: #1 (rel=2) Luziânia/GO: Prorrogar o prazo para pagamento de impostos municipais sem multas.; #2 (rel=2) Toledo/PR: Conceder prazos para pagamento sem multa de impostos e taxas municipais.; #3 (rel=1) Campina Grande/PB: Definir local de arrecadação de impostos.. Top-3 ementas: #1 (rel=3) Quirinópolis/GO: Criar a campanha “Nota Premiada” como medida para o aumento da arrecadação municipal.; #2 (rel=0) Paranatinga/MT: Declarar o poder executivo municipal a abrir créditos suplementar por excesso de arrecadação.; #3 (rel=3) Palmital/SP: Realizar campanha municipal de arrecadação de IPTU com prêmios para melhorar a arrecadação d.... Top-3 acoes: #1 (rel=3) Tapurah/MT: Instituir campanha “IPTU Premiado” para incentivar a arrecadação municipal.; #2 (rel=3) Quirinópolis/GO: Criar a campanha “Nota Premiada” como medida para o aumento da arrecadação municipal.; #3 (rel=3) São José do Ouro/RS: Instituir campanha para o aumento da arrecadação do município para o ano de 2012..

### Casos em que o baseline lexical foi melhor que `acoes`

- **Digitalizar serviços públicos municipais** (`digitalizacao_servicos`): nDCG@10 bm25=0.455 vs ementas=0.186 vs acoes=0.382. Top-3 bm25: #1 (rel=3) Erechim/RS: Criar a Central de Atendimento ao Cidadão como instrumento de prestação de serviços ao cidadão.; #2 (rel=3) Itaúna/MG: Criar o conectaritaúna app, plataforma digital de integração de serviços públicos e atendime...; #3 (rel=2) Campinas/SP: Criar o Código Municipal de Defesa do Cidadão e a Política Municipal de Atendimento ao Cidadão.. Top-3 ementas: #1 (rel=1) Araxá/MG: Criar programa de acesso do servidor público ao mundo digital.; #2 (rel=1) Lagoa da Prata/MG: Obrigar a administração municipal a utilizar serviços de telefonia Voip.; #3 (rel=1) Marabá/PA: Obrigar o poder público municipal a prestar informações sobre acesso a informação.. Top-3 acoes: #1 (rel=1) Campina Grande/PB: Criar biblioteca digital municipal no município.; #2 (rel=3) Alta Floresta/MT: Fixar códigos QR em vias e locais públicos para facilitar a prestação digital dos serviços p...; #3 (rel=1) Piedade/SP: Criar biblioteca digital municipal..
- **Melhorar mobilidade em horário de pico** (`mobilidade_pico`): nDCG@10 bm25=0.607 vs ementas=0.355 vs acoes=0.404. Top-3 bm25: #1 (rel=3) Campinas/SP: Limitar o horário para a prestação de serviços públicos em vias arteriais e de trânsito rápi...; #2 (rel=2) Itabirito/MG: Criar o Observatório Municipal de Mobilidade e Trânsito no município.; #3 (rel=2) Anápolis/GO: Garantir que táxis utilizem as vias de ônibus para melhorar a mobilidade urbana e proporcion.... Top-3 ementas: #1 (rel=2) Marabá/PA: Criar transporte alternativo de passageiros em veículos tipo micro ônibus e similares no mun...; #2 (rel=3) Natal/RN: Aumentar 30% a frota dos transportes públicos coletivos nos horários de pico em Natal.; #3 (rel=1) Palmital/SP: Instituir a Semana Municipal de Prevenção de Acidentes no Trânsito.. Top-3 acoes: #1 (rel=3) São Mateus/ES: Criar plano de mobilidade para melhorar a acessibilidade e mobilidade das pessoas e cargas n...; #2 (rel=1) Luziânia/GO: Construir pontos de táxi e mototaxi no município.; #3 (rel=2) Campina Grande/PB: Criar sistema de transporte individual por motocicleta e mototáxi no município..

## Interpretacao

Os resultados sugerem que as abordagens semanticas reduzem a dependencia de casamento lexical exato e aproximam o texto indexado da formulacao das queries, que tambem sao escritas como problemas ou objetivos de politica publica.

Esse efeito aparece sobretudo quando a ementa original fala em instrumentos genericos, fundos, revisoes administrativas ou linguagem legislativa pouco operacional. Nesses casos, a versao em acao torna mais explicito o verbo, o alvo e o mecanismo da politica, enquanto o BM25 fica preso aos termos literais da query.

As derrotas de `acoes` parecem ocorrer quando o baseline lexical captura termos muito especificos do dominio ou quando a reescrita perde alguma nuance importante de documentos ja claros na forma original. Os temas `mobilidade_pico` e `digitalizacao_servicos` ilustram esse comportamento neste recorte.

## Limitacoes

- A avaliacao usa um pool anotado derivado da uniao dos rankings das tres abordagens. Isso e adequado para comparacao relativa, mas nao mede recall absoluto do corpus.
- Documentos fora do pool nao foram julgados. Se uma abordagem trouxesse bons itens fora dessa uniao, o experimento atual nao capturaria esse ganho.
- A amostra tem 15 problemas, entao os sinais estatisticos devem ser tratados como exploratorios.
- O arquivo anotado nao registra multiplos avaliadores, entao nao ha medida de concordancia interanotador.

## Conclusao

Dentro deste conjunto anotado, `acoes` e a melhor estrategia, `ementas` fica em segundo lugar e `bm25_ementas` funciona como baseline lexical competitivo, mas inferior em media. O ganho das abordagens semanticas e mais claro na recuperacao de documentos de alta qualidade e na consistencia do ranking apos a primeira posicao.

Se a meta do projeto e maximizar a utilidade pratica das sugestoes para problemas municipais, os dados atuais favorecem usar `acoes` como default, manter `ementas` como segunda fonte semantica e tratar o BM25 como baseline de referencia ou componente complementar de um ranking hibrido.
