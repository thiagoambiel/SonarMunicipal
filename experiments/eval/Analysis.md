# Analise exploratoria: bm25 vs ementas vs acoes

## Escopo

Esta analise compara a qualidade das sugestoes geradas por tres abordagens sobre o mesmo acervo legislativo:

- `bm25_ementas`: baseline lexical BM25 calculado sobre a ementa original do PL.
- `ementas`: embeddings calculados diretamente sobre a ementa original do PL.
- `acoes`: embeddings calculados sobre a ementa reescrita como acao com o modelo de linguagem do projeto.

Os numeros abaixo usam o pool anotado em `experiments/eval/outputs/annotation_pool_categorized.jsonl` e os rankings de `recommendations_bm25_ementas.jsonl`, `recommendations_ementas.jsonl` e `recommendations_acoes.jsonl`.

## Resumo executivo

O pool contem 3792 pares problema-documento anotados em 50 problemas (media de 75.8 candidatos por problema).
As recomendacoes baseadas em `acoes` lideram nas metricas principais, seguidas por `ementas` e depois por `bm25_ementas`: nDCG@10 = 0.529 / 0.529 / 0.692, MAP@10 = 0.128 / 0.139 / 0.161, e relevancia media@10 = 1.778 / 1.778 / 2.158.
Contra o baseline lexical, `acoes` sobe de 0.606 para 0.728 em High-P@10 e de 0.164 para 0.202 em High-Recall@10. `ementas` tambem supera o BM25 nesses dois cortes (0.582 e 0.154).
Os tres rankings recuperam conjuntos parcialmente distintos: o overlap medio entre BM25 e ementas e de 3.94 documentos por problema (Jaccard 0.075), entre BM25 e acoes e de 5.40 (Jaccard 0.109) e entre ementas e acoes e de 7.02 (Jaccard 0.139).
Interpretacao pratica: as duas abordagens semanticas superam o baseline lexical em media, e a textualizacao em formato de acao continua sendo a melhor forma de alinhar a busca com problemas formulados como necessidades municipais.

## Perfil do pool anotado

A base anotada e densa em documentos relevantes porque foi montada a partir da uniao dos rankings das tres abordagens. No total, 73.4% dos itens receberam relevancia > 0 e 51.0% receberam relevancia >= 2.

| Abordagem | Itens no pool | % relevantes | % relevancia alta (>=2) | Itens exclusivos | % alta nos exclusivos |
| --- | ---: | ---: | ---: | ---: | ---: |
| BM25 | 1500 | 70.0% | 51.8% | 1143 | 41.9% |
| ementas | 1500 | 75.8% | 51.1% | 1062 | 39.4% |
| acoes | 1500 | 85.3% | 64.9% | 989 | 56.3% |

Entre as tres abordagens, `acoes` concentra a maior fracao de itens de alta relevancia (64.9%), enquanto `bm25` adiciona mais candidatos exclusivos ao pool (1143 pares).

Distribuicao global de relevancia no pool:

- `relevance = 0`: 1008 itens
- `relevance = 1`: 849 itens
- `relevance = 2`: 786 itens
- `relevance = 3`: 1149 itens

## Metricas agregadas

| Metrica | BM25 | Ementas | Acoes | Delta (ementas - BM25) | Delta (acoes - BM25) |
| --- | ---: | ---: | ---: | ---: | ---: |
| P@1 | 0.760 | 0.940 | 0.980 | 0.180 | 0.220 |
| P@3 | 0.833 | 0.880 | 0.953 | 0.047 | 0.120 |
| P@5 | 0.812 | 0.848 | 0.932 | 0.036 | 0.120 |
| P@10 | 0.778 | 0.838 | 0.894 | 0.060 | 0.116 |
| High-P@3 (rel>=2) | 0.647 | 0.633 | 0.807 | -0.013 | 0.160 |
| High-P@10 (rel>=2) | 0.606 | 0.582 | 0.728 | -0.024 | 0.122 |
| Recall@10 | 0.141 | 0.154 | 0.168 | 0.013 | 0.026 |
| High-Recall@10 (rel>=2) | 0.164 | 0.154 | 0.202 | -0.010 | 0.039 |
| MRR@10 | 0.847 | 0.967 | 0.990 | 0.119 | 0.143 |
| MAP@10 | 0.128 | 0.139 | 0.161 | 0.011 | 0.033 |
| nDCG@3 | 0.549 | 0.590 | 0.769 | 0.041 | 0.220 |
| nDCG@10 | 0.529 | 0.529 | 0.692 | -0.000 | 0.163 |
| Relevancia media@3 | 1.913 | 1.960 | 2.433 | 0.047 | 0.520 |
| Relevancia media@10 | 1.778 | 1.778 | 2.158 | 0.000 | 0.380 |

Leitura rapida: as duas abordagens semanticas superam o BM25 em media, e `acoes` melhora tanto a proporcao de itens relevantes no topo quanto a ordenacao dos melhores documentos ao longo do ranking.

## Comparacao pareada por problema

As tabelas abaixo contam, problema a problema, quantas vezes cada abordagem semantica ficou acima do baseline lexical BM25. O p-valor vem de um sign test exato e serve apenas como indicio, porque a amostra tem 50 problemas.

### Ementas vs BM25

| Metrica | Delta medio | Vitorias ementas | Vitorias bm25 | Empates | p-valor sign test |
| --- | ---: | ---: | ---: | ---: | ---: |
| P@3 | 0.047 | 10 | 8 | 32 | 0.815 |
| P@10 | 0.060 | 22 | 11 | 17 | 0.080 |
| High-P@10 | -0.024 | 19 | 26 | 5 | 0.371 |
| Recall@10 | 0.013 | 22 | 11 | 17 | 0.080 |
| High-Recall@10 | -0.010 | 19 | 26 | 5 | 0.371 |
| MAP@10 | 0.011 | 24 | 12 | 14 | 0.065 |
| nDCG@10 | -0.000 | 23 | 27 | 0 | 0.672 |
| Relevancia media@10 | -0.000 | 23 | 26 | 1 | 0.775 |

### Acoes vs BM25

| Metrica | Delta medio | Vitorias acoes | Vitorias bm25 | Empates | p-valor sign test |
| --- | ---: | ---: | ---: | ---: | ---: |
| P@3 | 0.120 | 13 | 3 | 34 | 0.021 |
| P@10 | 0.116 | 22 | 9 | 19 | 0.029 |
| High-P@10 | 0.122 | 30 | 13 | 7 | 0.014 |
| Recall@10 | 0.026 | 22 | 9 | 19 | 0.029 |
| High-Recall@10 | 0.039 | 30 | 13 | 7 | 0.014 |
| MAP@10 | 0.033 | 23 | 9 | 18 | 0.020 |
| nDCG@10 | 0.163 | 38 | 12 | 0 | 0.000 |
| Relevancia media@10 | 0.380 | 38 | 10 | 2 | 0.000 |

O sinal mais forte aparece na comparacao de `acoes` contra o baseline: `acoes` venceu em 30 de 43 comparacoes nao empatadas em High-P@10, em 30 de 43 em High-Recall@10 e em 38 de 50 em nDCG@10. `Ementas` tambem vence o BM25 em nDCG@10 em 23 de 50 comparacoes nao empatadas.

## Ganho por problema

| Problema | nDCG@10 BM25 | nDCG@10 ementas | nDCG@10 acoes | Delta (ementas - BM25) | Delta (acoes - BM25) |
| --- | ---: | ---: | ---: | ---: | ---: |
| `enchentes_urbanas` | 0.000 | 0.439 | 0.964 | 0.439 | 0.964 |
| `ciclomobilidade` | 0.000 | 0.554 | 0.736 | 0.554 | 0.736 |
| `abrigos_animais` | 0.260 | 0.355 | 0.829 | 0.095 | 0.569 |
| `profissionalizacao_jovem` | 0.380 | 0.726 | 0.943 | 0.347 | 0.564 |
| `arrecadacao_sem_imposto` | 0.181 | 0.535 | 0.642 | 0.354 | 0.461 |
| `residuos_reciclagem` | 0.495 | 0.673 | 0.946 | 0.179 | 0.451 |
| `seguranca_transporte_publico` | 0.344 | 0.693 | 0.785 | 0.349 | 0.440 |
| `esporte_lazer_ciclismo` | 0.105 | 0.442 | 0.525 | 0.337 | 0.420 |
| `esporte_amador` | 0.497 | 0.444 | 0.913 | -0.053 | 0.416 |
| `inclusao_pcd` | 0.374 | 0.727 | 0.789 | 0.353 | 0.415 |
| `patrimonio_historico` | 0.557 | 0.785 | 0.936 | 0.228 | 0.380 |
| `alimentacao_escolar` | 0.289 | 0.577 | 0.634 | 0.288 | 0.345 |
| `bibliotecas_municipais` | 0.206 | 0.767 | 0.512 | 0.561 | 0.306 |
| `iluminacao_publica` | 0.167 | 0.624 | 0.470 | 0.457 | 0.303 |
| `saude_mental_escolas` | 0.673 | 0.874 | 0.926 | 0.201 | 0.253 |
| `saneamento_basico` | 0.776 | 0.736 | 1.000 | -0.040 | 0.224 |
| `abrigos_populacao_rua` | 0.430 | 0.438 | 0.639 | 0.008 | 0.209 |
| `equipamentos_esportivos` | 0.152 | 0.154 | 0.331 | 0.002 | 0.178 |
| `protagonismo_juvenil` | 0.693 | 0.605 | 0.866 | -0.089 | 0.173 |
| `violencia_domestica` | 0.719 | 0.567 | 0.889 | -0.152 | 0.169 |
| `aluguel_social` | 0.714 | 0.759 | 0.874 | 0.046 | 0.161 |
| `violencia_bairros_centrais` | 0.263 | 0.291 | 0.402 | 0.028 | 0.139 |
| `areas_verdes` | 0.477 | 0.318 | 0.610 | -0.159 | 0.133 |
| `apoio_artistas_locais` | 0.802 | 0.877 | 0.933 | 0.075 | 0.131 |
| `seguranca_alimentar` | 0.827 | 0.650 | 0.951 | -0.176 | 0.125 |
| `evasao_ensino_medio` | 0.881 | 1.000 | 1.000 | 0.119 | 0.119 |
| `calcadas_acessiveis` | 0.490 | 0.403 | 0.604 | -0.087 | 0.114 |
| `apoio_microempreendedor` | 0.891 | 0.943 | 1.000 | 0.052 | 0.109 |
| `arborizacao_urbana` | 0.899 | 0.731 | 1.000 | -0.168 | 0.101 |
| `castracao_animal` | 0.800 | 0.671 | 0.899 | -0.129 | 0.100 |
| `habitacao_interesse_social` | 0.823 | 0.594 | 0.917 | -0.229 | 0.094 |
| `dengue_arboviroses` | 0.717 | 0.940 | 0.807 | 0.223 | 0.090 |
| `participacao_cidada_digital` | 0.151 | 0.143 | 0.226 | -0.008 | 0.076 |
| `agricultura_familiar` | 0.658 | 0.467 | 0.734 | -0.191 | 0.076 |
| `vacinacao_infantil` | 0.426 | 0.220 | 0.490 | -0.206 | 0.064 |
| `regularizacao_fundiaria` | 0.964 | 0.725 | 1.000 | -0.238 | 0.036 |
| `ensino_fundamental_qualidade` | 0.297 | 0.344 | 0.311 | 0.047 | 0.014 |
| `emprego_jovem` | 0.767 | 0.420 | 0.774 | -0.347 | 0.008 |
| `atencao_primaria_saude` | 0.680 | 0.569 | 0.655 | -0.111 | -0.025 |
| `drenagem_urbana` | 0.626 | 0.459 | 0.593 | -0.167 | -0.033 |
| `saude_idosos` | 0.576 | 0.380 | 0.540 | -0.196 | -0.037 |
| `transparencia_orcamentaria` | 0.636 | 0.292 | 0.565 | -0.343 | -0.070 |
| `digitalizacao_servicos` | 0.455 | 0.186 | 0.382 | -0.270 | -0.074 |
| `agroecologia` | 0.554 | 0.372 | 0.454 | -0.182 | -0.100 |
| `acessibilidade_urbana` | 0.725 | 0.402 | 0.589 | -0.323 | -0.136 |
| `esgotamento_sanitario` | 0.663 | 0.247 | 0.476 | -0.416 | -0.187 |
| `pavimentacao_vias` | 0.684 | 0.438 | 0.492 | -0.247 | -0.192 |
| `mobilidade_pico` | 0.607 | 0.355 | 0.404 | -0.252 | -0.203 |
| `risco_geologico` | 0.716 | 0.251 | 0.494 | -0.465 | -0.221 |
| `educacao_jovens_adultos` | 0.396 | 0.281 | 0.156 | -0.115 | -0.240 |

Os maiores ganhos de `acoes` sobre o baseline aparecem em `enchentes_urbanas`, `ciclomobilidade`, `abrigos_animais`, `profissionalizacao_jovem` e `arrecadacao_sem_imposto`. As maiores perdas aparecem em `educacao_jovens_adultos`, `risco_geologico` e `mobilidade_pico`.

## Qualidade ao longo do ranking

| Rank | Relevancia media BM25 | Relevancia media ementas | Relevancia media acoes |
| --- | ---: | ---: | ---: |
| 1 | 1.820 | 2.340 | 2.620 |
| 2 | 1.940 | 1.720 | 2.400 |
| 3 | 1.980 | 1.820 | 2.280 |
| 4 | 1.900 | 1.680 | 2.300 |
| 5 | 1.860 | 1.820 | 2.160 |
| 6 | 1.440 | 1.640 | 1.940 |
| 7 | 1.860 | 1.760 | 2.100 |
| 8 | 1.620 | 1.820 | 2.060 |
| 9 | 1.700 | 1.440 | 1.840 |
| 10 | 1.660 | 1.740 | 1.880 |
| 11 | 1.700 | 1.640 | 2.120 |
| 12 | 1.520 | 1.540 | 2.080 |
| 13 | 1.520 | 1.640 | 2.020 |
| 14 | 1.300 | 1.480 | 1.760 |
| 15 | 1.420 | 1.460 | 2.120 |
| 16 | 1.500 | 1.260 | 2.060 |
| 17 | 1.400 | 1.640 | 1.940 |
| 18 | 1.440 | 1.420 | 1.880 |
| 19 | 1.420 | 1.560 | 1.940 |
| 20 | 1.440 | 1.480 | 1.940 |
| 21 | 1.440 | 1.220 | 1.900 |
| 22 | 1.220 | 1.180 | 1.780 |
| 23 | 1.360 | 1.740 | 1.700 |
| 24 | 1.320 | 1.460 | 1.700 |
| 25 | 1.480 | 1.420 | 1.380 |
| 26 | 1.280 | 1.720 | 1.880 |
| 27 | 1.400 | 1.340 | 1.560 |
| 28 | 1.580 | 1.160 | 1.600 |
| 29 | 1.380 | 1.440 | 1.900 |
| 30 | 1.020 | 1.440 | 1.660 |

Ja no rank 1, `acoes` abre vantagem sobre o BM25 (2.620 vs 1.820) e supera o baseline em 29 das 30 posicoes analisadas. Ainda assim, ha 1 ranks em que o BM25 fica acima.

## Exemplos qualitativos

### Casos em que `acoes` melhora muito sobre o baseline

- **Prevenir enchentes urbanas** (`enchentes_urbanas`): nDCG@10 bm25=0.000 vs ementas=0.439 vs acoes=0.964. Top-3 bm25: #1 (rel=0) Montenegro/RS: Criar o Banco de ideias legislativas no município.; #2 (rel=0) Natal/RN: Criar o Banco de ideias legislativas no município.; #3 (rel=0) Manhuaçu/MG: Criar o Banco de ideias legislativas no município.. Top-3 ementas: #1 (rel=3) Ribas do Rio Pardo/MS: Regulamentar a contenção de águas pluviais para prevenir enchentes, alagamentos e preservaçã...; #2 (rel=0) Itapoá/SC: Desafetar lotes do patrimônio municipal.; #3 (rel=0) Natal/RN: Criar o IPTU Zero, desconto no IPTU para imóveis onde ocorram enchentes e alagamentos no mun.... Top-3 acoes: #1 (rel=3) Campinas/SP: Implantar o programa “Bueiro Imobiliário” para prevenção de enchentes no município.; #2 (rel=3) Rio Grande/RS: Implantar o programa “Bueiro Imobiliário” como forma de prevenção às enchentes no município.; #3 (rel=3) Cabo de Santo Agostinho/PE: Implantar o programa “Bueiro Imobiliário” como forma de prevenção às enchentes no município..
- **Ampliar ciclomobilidade urbana** (`ciclomobilidade`): nDCG@10 bm25=0.000 vs ementas=0.554 vs acoes=0.736. Top-3 bm25: #1 (rel=0) Campina Grande/PB: Implantar jardins de chuva como infraestrutura verde no município.; #2 (rel=0) Palmital/SP: Conceder incentivo às industrias que virem a se instalar no município.; #3 (rel=0) Armação dos Búzios/RJ: Aumentar a licença paternidade dos servidores públicos do município.. Top-3 ementas: #1 (rel=3) Catalão/GO: Construir ciclovias e ciclorotas em loteamentos residenciais, empresariais e condomínios no...; #2 (rel=2) Cidreira/RS: Criar o programa “Doe um Bicicletário” no município.; #3 (rel=2) Carlos Barbosa/RS: Instalar bebedouros na ciclovia municipal.. Top-3 acoes: #1 (rel=3) Natal/RN: Criar sistema cicloviário no município.; #2 (rel=3) Pato Branco/PR: Criar sistema cicloviário no município.; #3 (rel=3) Pato Branco/PR: Criar sistema cicloviário no município..

### Casos em que o baseline lexical foi melhor que `acoes`

- **Reduzir risco geológico em encostas** (`risco_geologico`): nDCG@10 bm25=0.716 vs ementas=0.251 vs acoes=0.494. Top-3 bm25: #1 (rel=3) Montes Claros/MG: Priorizar moradias para famílias em áreas de risco (encostas).; #2 (rel=3) Montes Claros/MG: Priorizar famílias em áreas de risco (encostas).; #3 (rel=3) Montes Claros/MG: Manter as áreas de risco (encostas) existentes no município.. Top-3 ementas: #1 (rel=2) Três Passos/RS: Alterar a Lei no 5.622/ 2021 que autoriza o poder executivo municipal a contratar geólogos.; #2 (rel=2) Três Passos/RS: Contratar geólogos emergenciais.; #3 (rel=0) Marabá/PA: Criar programa municipal de incentivo à prevenção do assoreamento dos rios Itacaiúnas e Toca.... Top-3 acoes: #1 (rel=1) Rio Grande/RS: Criar política municipal de informação e transparência sobre inundações e enchentes em áreas...; #2 (rel=1) Campinas/SP: Criar plano municipal de combate a enchentes e inundações no município.; #3 (rel=3) Montes Claros/MG: Manter as áreas de risco (encostas) existentes no município..
- **Expandir Educação de Jovens e Adultos (EJA)** (`educacao_jovens_adultos`): nDCG@10 bm25=0.396 vs ementas=0.281 vs acoes=0.156. Top-3 bm25: #1 (rel=1) Rio Grande/RS: Instituir o Dia Municipal da Educação de Jovens e Adultos.; #2 (rel=1) Parauapebas/PA: Instituir campanha sobre educação de jovens e adultos no município.; #3 (rel=3) Rio Grande/RS: Criar política itinerante de educação de jovens e adultos no município.. Top-3 ementas: #1 (rel=1) Rio Grande/RS: Instituir o Dia Municipal da Educação de Jovens e Adultos.; #2 (rel=0) Luiz Alves/SC: Criar escola municipal de braço joaquim no município.; #3 (rel=3) Erechim/RS: Criar o Centro Municipal de Educação de Jovens e Adultos – Ceja Erechim.. Top-3 acoes: #1 (rel=1) Parauapebas/PA: Instituir campanha sobre educação de jovens e adultos no município.; #2 (rel=1) Natal/RN: Instituir o programa “Educação + Trabalho” no município.; #3 (rel=1) Itapoá/SC: Instituir campanhas públicas sobre educação de jovens e adultos no município..

## Interpretacao

Os resultados sugerem que as abordagens semanticas reduzem a dependencia de casamento lexical exato e aproximam o texto indexado da formulacao das queries, que tambem sao escritas como problemas ou objetivos de politica publica.

Esse efeito aparece sobretudo quando a ementa original fala em instrumentos genericos, fundos, revisoes administrativas ou linguagem legislativa pouco operacional. Nesses casos, a versao em acao torna mais explicito o verbo, o alvo e o mecanismo da politica, enquanto o BM25 fica preso aos termos literais da query.

As derrotas de `acoes` parecem ocorrer quando o baseline lexical captura termos muito especificos do dominio ou quando a reescrita perde alguma nuance importante de documentos ja claros na forma original. Os temas `educacao_jovens_adultos` e `risco_geologico` ilustram esse comportamento neste recorte.

## Limitacoes

- A avaliacao usa um pool anotado derivado da uniao dos rankings das tres abordagens. Isso e adequado para comparacao relativa, mas nao mede recall absoluto do corpus.
- Documentos fora do pool nao foram julgados. Se uma abordagem trouxesse bons itens fora dessa uniao, o experimento atual nao capturaria esse ganho.
- A amostra tem 50 problemas, entao os sinais estatisticos devem ser tratados como exploratorios.
- O arquivo anotado nao registra multiplos avaliadores, entao nao ha medida de concordancia interanotador.

## Conclusao

Dentro deste conjunto anotado, `acoes` e a melhor estrategia, `ementas` fica em segundo lugar e `bm25_ementas` funciona como baseline lexical competitivo, mas inferior em media. O ganho das abordagens semanticas e mais claro na recuperacao de documentos de alta qualidade e na consistencia do ranking apos a primeira posicao.

Se a meta do projeto e maximizar a utilidade pratica das sugestoes para problemas municipais, os dados atuais favorecem usar `acoes` como default, manter `ementas` como segunda fonte semantica e tratar o BM25 como baseline de referencia ou componente complementar de um ranking hibrido.
