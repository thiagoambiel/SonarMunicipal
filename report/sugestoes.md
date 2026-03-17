Perfeito. Fiz um plano de poda cirúrgica, com tesoura fina em vez de motosserra 🎯

**Premissa que vou usar:** reduzir o artigo para **10 páginas totais**. O paper hoje está em 14 páginas e a espinha dorsal dele é muito clara: problema municipal, pipeline integrado, escala de coleta e evidência de que **ações textualizadas** melhoram a recuperação no benchmark exploratório. Isso aparece já no resumo, nas contribuições e na seção de resultados. 

## Estrutura enxuta recomendada para 10 páginas

Minha sugestão de distribuição:

* **Resumo + Introdução:** 1,0 a 1,2 pág.
* **Trabalhos Relacionados:** 0,4 a 0,5 pág.
* **Materiais e Métodos:** 1,8 a 2,2 págs.
* **Resultados principais:** 2,8 a 3,2 págs.
* **Estudo de caso:** 0,6 a 0,8 pág.
* **Limitações + Conclusão:** 0,8 a 1,0 pág.
* **Referências:** o restante

Para isso funcionar, o paper precisa sair da forma “explicação completa em camadas” e entrar na forma “argumento principal com evidência suficiente”.

---

# Plano de corte seção por seção

## 1. Resumo

**Manter**

* problema dos gestores municipais
* pipeline completo
* escala da base
* principal resultado do benchmark: ações > ementas > BM25 nas métricas-chave 

**Cortar**

* qualquer nuance que já reaparece na introdução
* detalhes de treinamento do tradutor além do essencial
* excesso de números secundários

**Versão enxuta**
Deixe o resumo com 5 blocos curtos:

1. problema,
2. solução,
3. escala,
4. experimento,
5. principal achado + cautela.

O resumo atual já está bom, mas ainda carrega muitos números. Eu manteria só:

* 1.259 instâncias encontradas
* 322 extrações válidas
* 220.065 PLs
* melhor desempenho de ações em nDCG@10 e High-Recall@10, com MAP@10 como apoio 

---

## 2. Introdução

**Manter**

* heterogeneidade institucional/textual/tecnológica
* pergunta central
* contribuições
* framing como system paper aplicado a governo digital 

**Cortar**

* frases de reforço que repetem o resumo
* explicações longas sobre o que o restante do artigo fará
* qualquer frase que já está implicitamente contida na lista de contribuições

**Meta de corte**
Reduzir a introdução para algo como **3 a 4 parágrafos curtos**.

**Estrutura ideal**

1. Problema e lacuna
2. Pergunta de pesquisa
3. Contribuições
4. Uma frase final dizendo como o paper está organizado

---

## 3. Trabalhos Relacionados

Hoje essa seção já é compacta, mas dá para deixá-la ainda mais afiada. Ela articula três frentes: infraestrutura legislativa, IR jurídico brasileiro e difusão de políticas. O ponto central já está lá: no cenário municipal, o desafio começa antes da busca, porque é preciso descobrir fontes, extrair em escala e normalizar textos curtos e ruidosos. 

**Manter**

* as 3 frentes
* a frase de lacuna municipal
* a frase final com a contribuição do Sonar Municipal como pipeline integrado 

**Cortar**

* qualquer explicação individual demais sobre cada linha de trabalho
* menções que não retornam no método ou nos resultados

**Versão enxuta**
Transformar em **um único bloco com 2 parágrafos**:

* um parágrafo para situar a literatura
* um parágrafo para marcar a lacuna e sua contribuição

---

## 4. Materiais e Métodos

Essa é a seção com melhor potencial de emagrecimento sem dano real. O método está bem montado, mas há um pouco de “detalhe de oficina mecânica” que pode morar no repositório e não no corpo do artigo.

### 4.1 Visão geral

**Manter**

* as 5 etapas do pipeline
* referência à Figura 1 

**Cortar**

* explicações redundantes que reaparecem nas subseções

### 4.2 Descoberta e extração

**Manter**

* ideia geral da heurística
* números essenciais da execução congelada
* aviso de que a base é parcial e desigual
* ruído residual de 3,54% como honestidade metodológica 

**Cortar**

* detalhes muito granulares de rotas e validação
* frases explicativas duplicadas sobre heterogeneidade dos portais

**Versão enxuta**
Um parágrafo técnico e um parágrafo quantitativo.

### 4.3 Textualização de ementas

**Manter**

* objetivo da textualização
* formato alvo da ação
* base do modelo
* resultado de BERTScore
* redução de comprimento do texto, porque isso ajuda a justificar a melhora de recuperação 

**Cortar**

* hiperparâmetros completos do fine-tuning: QLoRA 4 bits, 30 épocas, taxa de aprendizado, batch size. Isso é material clássico de apêndice ou repositório, não argumento central do paper. 
* as três razões operacionais podem virar **uma única frase compacta**

### 4.4 Busca, indicadores e agrupamento

**Manter**

* comparação entre BM25, ementas e ações
* benchmark de 15 problemas / 1.158 anotações
* papel instrumental do GPT-5.4
* caráter não causal da análise com indicadores
* fórmula ou intuição do escore Q, mas não precisa gastar muito espaço nela 

**Cortar**

* a explicação didática de cada métrica, uma a uma. Esse trecho ocupa espaço e não acrescenta originalidade. A seção hoje define P@K, Recall@10, MRR@10, MAP@10, nDCG e métricas High; eu reduziria isso para uma frase do tipo: “Adotamos métricas de ordenação, precisão no topo e cobertura local, com ênfase em nDCG@10 e High-Recall@10.” 
* parte da explicação detalhada sobre top-30 anotado, mantendo apenas a cautela principal sobre não medir recall absoluto

### 4.5 Implementação

**Manter**

* uma frase sobre stack
* link do repositório e da demo, se o venue permitir 

**Cortar**

* detalhes operacionais demais
* toda frase que repete “reprodutível” sem adicionar algo novo

---

## 5. Resultados

Aqui mora o maior dragão de páginas. E ele pode ser domado.

## 5.1 Cobertura da base

A mensagem central é simples: a descoberta nacional é viável, mas a extração ainda depende da qualidade local das instâncias SAPL; o acervo é grande, interestadual e não nacionalmente representativo. Isso já está muito bem expresso. 

**Manter**

* Figura 2
* um parágrafo com cobertura e concentração regional
* uma frase sobre viés geográfico e temporal 

**Cortar**

* manter Figura 3 é opcional. Ela é boa, mas secundária para a tese central, que é recuperação semântica. Se faltar espaço, eu cortaria a Figura 3 antes de mexer na Figura 4 ou Tabela 1. 

---

## 5.2 Tradução e busca semântica

Essa é a joia da coroa.

O resultado central está muito claro:

* Tabela 1 mostra vantagem consistente de ações em nDCG@10, High-Recall@10, MAP@10 e P@10 
* Figura 4 mostra heterogeneidade por problema e evita a armadilha da média lisa demais 

**Manter obrigatoriamente**

* Tabela 1
* Figura 4
* um parágrafo curto com a mensagem principal
* um parágrafo curto com a leitura de heterogeneidade e cautela 

**Cortar ou fundir**

* Figura 5
* Figura 6
* o texto interpretativo em três camadas que acompanha essas figuras 

A subseção hoje explica:

1. densidade do pool,
2. métricas agregadas,
3. três efeitos da textualização,
4. perfil pareado por problema,
5. overlap entre rankings,
6. maiores ganhos,
7. maiores perdas,
8. incerteza por bootstrap,
9. leitura de heterogeneidade,
10. próximos passos metodológicos. 

Isso é rico, mas para 10 páginas vira um banquete barroco. O paper não precisa de três vitrines para a mesma joia.

**Minha recomendação**

* **Fique com Tabela 1 + Figura 4**
* Remova **Figura 5 e Figura 6**
* Converta o conteúdo delas em **6 a 8 frases no texto**

### Texto que pode virar uma única síntese

Você pode condensar toda essa parte em algo como:

* ações lideram em média nas métricas primárias e secundárias;
* a vantagem não é uniforme;
* o ganho aparece sobretudo em consultas formuladas como objetivo de política pública;
* consultas mais terminológicas ainda podem favorecer BM25;
* a evidência é de vantagem média no pool anotado, não de superioridade universal. 

Pronto. O mesmo recado, com muito menos peso.

---

## 6. Estudo de caso

O estudo de caso é útil para mostrar o sistema funcionando, mas ele não deve sequestrar o palco do benchmark.

Hoje essa seção mostra:

* universo temático do caso,
* fluxo completo do sistema,
* cluster líder,
* outros clusters recorrentes,
* mosaico de estratégias recorrentes. 

**Manter**

* o recorte do tema
* 1 resultado emblemático
* 1 frase de cautela causal
* só **uma** figura do caso 

**Escolha entre as figuras**

* **Figura 7** se você quiser enfatizar o fluxo do sistema no caso
* **Figura 8** se quiser enfatizar o repertório de políticas encontradas

Eu, sinceramente, **manteria a Figura 8**.
Ela comunica melhor o valor final para o leitor: o sistema encontra um cardápio de respostas públicas recorrentes. A Figura 7 é elegante, mas funciona mais como uma mini-repetição do pipeline geral da Figura 1. 

**Versão enxuta da subseção**

* 1 parágrafo apresentando o recorte
* 1 parágrafo com o cluster líder e 2 ou 3 exemplos
* 1 frase final sobre diversidade de estratégias e ausência de inferência causal

---

## 7. Falhas observadas + Limitações

Aqui existe uma redundância deliciosa para cortar.

A subseção **4.4 Falhas observadas** traz dois exemplos muito bons: a perda semântica na textualização, como “Junho Violeta” → “Junho Violento”, e artefatos muito otimistas em municípios pequenos nas métricas de indicadores. 
A seção 5 já cobre exatamente a mesma família de fragilidades: cobertura enviesada, benchmark exploratório, ausência de baselines híbridos, falta de avaliação humana, caráter observacional dos indicadores. 

**Minha recomendação**

* **elimine a seção 4.4 como seção independente**
* incorpore esses dois exemplos dentro de **Limitações e ameaças à validade**

Isso economiza espaço e melhora a arquitetura do paper. Em vez de parecer “resultado + pós-escrito de problemas”, ele fica com uma seção de limitações mais concreta, viva e intelectualmente honesta.

---

## 8. Conclusão

A conclusão atual recapitula o pipeline, os números da base, os resultados do benchmark e os próximos passos. Está correta, mas repete muita coisa já dita no resumo e na seção 4.2. 

**Manter**

* 1 frase sobre a contribuição do sistema
* 1 frase sobre o principal resultado da recuperação
* 1 frase de cautela
* 1 frase de próximos passos

**Cortar**

* repetição detalhada dos números já apresentados antes
* recapitulação longa das cinco etapas

**Versão ideal**
Um único parágrafo robusto, com cara de fechamento e não de recontagem.

---

# Ordem prática de poda

Se você quiser cortar rápido, siga esta sequência:

**Primeira rodada**

1. Remover **Figura 5**
2. Remover **Figura 6**
3. Fundir **4.4 Falhas observadas** em **Seção 5**
4. Encurtar explicação das métricas no método
5. Encurtar hiperparâmetros do tradutor

**Segunda rodada**
6. Escolher entre **Figura 7 ou Figura 8**
7. Encurtar estudo de caso para meia página
8. Reduzir conclusão para um parágrafo

**Terceira rodada, se ainda faltar espaço**
9. Cortar **Figura 3**
10. Reduzir Trabalhos Relacionados para dois parágrafos

---

# Pacote mínimo de figuras e tabela que eu manteria

## Se o objetivo é caber com folga:

* **Figura 1**: pipeline
* **Figura 2**: escala/cobertura
* **Tabela 1**: métricas agregadas
* **Figura 4**: heterogeneidade por problema
* **Figura 8**: estudo de caso

## Se o objetivo é máxima economia:

* **Figura 1**
* **Figura 2**
* **Tabela 1**
* **Figura 4**

Esse quarteto já conta a história inteira do paper. O resto é enriquecimento, não fundação.

---

# Estrutura final sugerida do paper

## Título e resumo

Sem grandes mudanças.

## 1. Introdução

Problema, lacuna, pergunta e contribuições.

## 2. Trabalhos relacionados

Duas frentes e a lacuna municipal.

## 3. Materiais e métodos

3.1 Pipeline
3.2 Descoberta e extração
3.3 Textualização
3.4 Recuperação, benchmark e análise exploratória
3.5 Implementação breve

## 4. Resultados

4.1 Cobertura da base
4.2 Avaliação anotada da recuperação
4.3 Estudo de caso

## 5. Limitações e ameaças à validade

Com os exemplos de falha incorporados.

## 6. Conclusão

Um parágrafo.

---

# Em uma frase: o que não pode morrer no corte

O paper precisa continuar deixando cristalino que ele entrega **um pipeline reprodutível de descoberta, extração, textualização e busca semântica de PLs municipais em escala**, e que, **no benchmark anotado exploratório, ações textualizadas foram a melhor representação para recuperação**. Isso é o motor do artigo.

No próximo passo, eu posso montar uma **versão reescrita e já enxugada do sumário do paper**, seção por seção, pronta para você usar como roteiro de edição.
