A seção de **avaliação anotada da recuperação** já tem um esqueleto bom e, dentro do artigo, é uma das partes mais convincentes. Ela explicita o desenho do benchmark, informa que o pool veio da união dos top-10, usa métricas adequadas para ranking com relevância graduada, traz comparação agregada e ainda reconhece que a avaliação é relativa, local ao top-10 e automatizada por GPT-5.4. Isso dá honestidade metodológica, o que é valioso em artigo científico. 

Semânticamente, a narrativa também está bem costurada: vocês mostram primeiro por que a textualização existe, depois definem como a recuperação foi comparada, e por fim interpretam os ganhos de ações sobre ementas em nDCG@10, MAP@10, P@3, P@10, High-P@10 e High-Recall@10, além de discutir vitórias por problema e os casos em que a reescrita piora o resultado. Esse arco argumentativo funciona porque não vende a técnica como mágica: ele mostra ganhos e também nuance, como nas perdas em iluminação pública, saneamento e dengue/arboviroses. 

Onde a seção ainda fica frágil é no coração da validade externa. O próprio texto admite quatro pontos sensíveis: apenas 15 problemas, 272 pares anotados, pool derivado da união dos top-10 e julgamentos feitos por agente GPT-5.4, não por especialistas. Isso faz a avaliação ficar parecida com uma vitrine bem iluminada, mas ainda pequena. Ela responde bem à pergunta “ações ordenam melhor do que ementas nesse pool?”, mas responde menos à pergunta mais forte: “ações recuperam melhor, de forma robusta e generalizável, no corpus real?”. 

Visualmente, a **Figura 4** comunica a mensagem principal, mas ainda deixa ciência na sombra. À esquerda, as barras agregadas são limpas e mostram o ganho de ações de forma rápida; à direita, a curva de relevância média por posição tenta mostrar dominância ao longo do ranking. O problema é que ambos os painéis resumem demais. A figura mostra médias, mas não mostra **dispersão**, **incerteza**, **variabilidade por consulta** nem a quantidade de empates. Em artigo científico, isso enfraquece porque o leitor vê o placar, mas não enxerga o campeonato. A legenda também poderia informar melhor o tamanho efetivo do benchmark e a natureza incompleta do pool já no caption, não só no texto. A própria curva por posição parece mais “suave” do que os dados provavelmente são, dado que são só 15 problemas e um pool pequeno. 

Minha leitura crítica, então, é esta:

**Pontos fortes**

* Boa coerência entre objetivo da textualização e hipótese de avaliação. 
* Métricas escolhidas fazem sentido para ranking com relevância graduada. 
* Há análise agregada e por problema, o que evita uma conclusão puramente média. 
* O texto reconhece explicitamente que mede ordenação relativa e cobertura local do top-10, não recall absoluto. 
* As limitações estão formuladas com honestidade e já abrem a porta para melhorias reais. 

**Pontos fracos**

* O benchmark é pequeno para sustentar uma conclusão forte de superioridade geral. 
* O pool é enviesado pelas próprias abordagens comparadas, o que favorece uma avaliação “fechada no duelo” e não no universo do corpus. 
* Falta uma validação humana, nem que seja parcial, para calibrar o juiz automático. 
* Faltam intervalos de confiança, testes de hipótese mais alinhados com IR e medidas de tamanho de efeito.
* A visualização enfatiza médias agregadas e oculta heterogeneidade.
* A comparação está restrita a “ementa vs ação” dentro do mesmo framework, mas não testa baselines mais fortes, como BM25, híbrido, concatenação e fusão.

Para aumentar a robustez e a qualidade científica, eu faria as seguintes melhorias, em ordem de impacto:

### 1. Fortalecer o benchmark

Ampliem de 15 para algo como **40 a 60 problemas**, distribuídos por categorias substantivas: saúde, educação, mobilidade, saneamento, segurança, assistência social, urbanismo, meio ambiente, agricultura, tributação etc. O benchmark atual parece plausível, mas ainda estreito demais para capturar a variedade semântica do acervo. Também vale garantir mistura entre consultas específicas, amplas e ambíguas. Isso reduz o risco de a conclusão refletir apenas um punhado de temas “amigos” da textualização. 

### 2. Tornar o pool menos endógeno

Hoje o pool nasce da união dos top-10 de ementas e ações. Isso é útil para comparação rápida, mas cria um universo em que os candidatos já são, por construção, “bons suspeitos”. O ideal é ampliar para **top-20 ou top-50**, incluir candidatos vindos de **BM25** e de um baseline híbrido, e até adicionar alguns **hard negatives** lexicalmente parecidos, mas semanticamente errados. Com isso, a avaliação deixa de ser só um duelo entre dois rankings e vira um teste mais realista de discriminação. O próprio artigo já admite que não estima recall absoluto; esse ajuste melhora bastante isso, mesmo sem resolver tudo. 

### 3. Incluir validação humana parcial

Não precisa virar uma operação jurássica. Uma solução elegante é anotar manualmente um subconjunto estratificado, por exemplo:

* 20% a 30% dos pares do pool,
* amostrados por tema,
* incluindo casos de concordância alta, discordância alta e fronteiras ambíguas.

Aí vocês reportam **weighted kappa** ou **Krippendorff’s alpha** entre humanos, e também entre humanos e GPT-5.4. Isso transforma o LLM judge de “oráculo prático” em “instrumento calibrado”. A seção de limitações já pede isso nas entrelinhas. 

### 4. Descrever melhor o protocolo de anotação

Sugiro criar um pequeno subtópico ou apêndice com:

* as 15 consultas usadas,
* a rubrica exata da escala 0–3,
* o prompt do julgador,
* exemplos de pares 0, 1, 2 e 3,
* temperatura, versão do modelo, data da execução e regra de desempate.

Hoje o texto diz que o julgamento foi feito em escala de 0 a 3 por GPT-5.4, mas o leitor ainda não enxerga bem o “tribunal”. Para reprodutibilidade científica, isso é ouro. 

### 5. Adicionar baselines mais fortes

A conclusão atual sustenta bem “ações > ementas”, mas ainda não sustenta tão bem “ações são a melhor representação prática”. Para isso, faltam adversários mais duros:

* **BM25** nas ementas,
* **BM25** nas ações,
* **concatenação ementa + ação**,
* **fusão por RRF** entre ranking lexical e semântico,
* eventualmente um encoder alternativo ou um embedding adaptado ao domínio jurídico.

Sem isso, a comparação fica correta, mas estreita. É um ringue de dois lutadores quando o leitor quer ver um mini-torneio.

### 6. Reportar incerteza estatística

O sign test ajuda, mas ele sozinho ainda é uma lanterna pequena. Eu incluiria:

* **bootstrap por consulta** para IC 95% de nDCG@10, MAP@10 e High-Recall@10,
* **randomization test** ou **paired permutation test** para métricas de ranking,
* tamanho de efeito, além do p-valor,
* tabela de **wins / ties / losses** por métrica.

Isso deixaria a seção mais musculosa sem inflar demais o texto.

### 7. Explorar melhor a heterogeneidade por problema

A parte mais interessante semanticamente está justamente nas diferenças: enchentes, emprego jovem, resíduos e agricultura melhoraram muito; iluminação, saneamento e dengue pioraram. 
Isso merece uma microanálise mais explícita. Por exemplo:

* consultas orientadas a “objetivo de política” parecem ganhar com textualização;
* consultas muito específicas e terminológicas podem perder quando a reescrita apaga nuance;
* certos domínios dependem mais de vocabulário técnico literal do que de abstração semântica.

Esse trecho pode virar uma contribuição teórica do artigo, não só uma nota de rodapé dos resultados.

### 8. Conectar a avaliação da recuperação com a fidelidade da textualização

Hoje há uma ponte implícita entre “o tradutor teve BERTScore 84%” e “a recuperação melhorou”, mas falta medir a relação entre uma coisa e outra. 
Seria muito forte incluir uma análise do tipo:

* amostra de casos em que a textualização melhora a recuperação,
* amostra de casos em que piora,
* classificação dos erros de reescrita: perda de entidade, generalização excessiva, troca de papel semântico, apagamento temporal, apagamento de público-alvo etc.

Isso une a semântica do tradutor com o comportamento do retriever.

---

## Melhorias visuais recomendadas para a Figura 4

Aqui eu mudaria a figura sem piedade, mas com elegância:

**1. Substituir ou complementar as barras agregadas com um gráfico pareado por consulta**
Um **dumbbell plot** de nDCG@10 por problema, comparando ementa vs ação, mostraria imediatamente onde a textualização ganha e onde perde. Isso é muito mais científico do que apenas médias.

**2. Colocar intervalos de confiança nas métricas agregadas**
As barras atuais contam a história, mas sem margem de erro parecem sentença de mármore. Com IC 95%, o leitor passa a ver estabilidade.

**3. Trocar a linha de relevância média por posição por boxplots ou violin plots por rank**
A curva média por posição, com N pequeno, pode dar uma sensação artificial de continuidade. Distribuições por posição seriam mais honestas.

**4. Adicionar um heatmap consulta × métrica**
Linhas = problemas; colunas = nDCG@10, MAP@10, P@10, High-Recall@10; cor = delta ação − ementa. Isso expõe a heterogeneidade de uma vez só.

**5. Melhorar a legenda/caption**
O caption deveria dizer explicitamente:

* N de problemas,
* N de pares anotados,
* que o pool é incompleto e derivado da união dos top-k,
* que o juiz foi GPT-5.4,
* que as métricas medem qualidade relativa no pool.

Assim, a figura vira quase autossuficiente.

---

## Sugestão de reescrita do argumento científico

Hoje a seção praticamente diz: “ações ganhou”. Eu sugeriria uma formulação mais forte e mais segura:

> “Os resultados indicam que a textualização tende a melhorar a ordenação de PLs relevantes quando a consulta é formulada como objetivo de política pública, sobretudo em temas nos quais a ementa original carrega maior ruído legislativo-formal. Em contrapartida, a reescrita pode reduzir desempenho em domínios nos quais a ementa já contém terminologia suficientemente específica. Assim, a principal evidência não é de superioridade universal, mas de que a textualização altera materialmente o espaço recuperado e, em média, melhora a qualidade do ranking no benchmark exploratório avaliado.”

Essa formulação faz duas coisas bonitas: fica mais científica e menos vulnerável.

---

## Pacote mínimo de melhorias para a versão do artigo

Se o tempo estiver curto, eu priorizaria este combo:

1. Expandir a figura com um **dumbbell plot por problema**.
2. Incluir **IC 95% por bootstrap** para nDCG@10 e MAP@10.
3. Acrescentar um apêndice com **consultas, prompt e rubric de anotação**.
4. Fazer **validação humana parcial** em uma amostra estratificada.
5. Adicionar pelo menos um baseline **BM25** e um **híbrido/fusão**.

Esse quinteto já faria a seção sair de “boa avaliação exploratória” para algo muito mais próximo de “avaliação sólida de artigo”.

Se quiser, eu posso transformar isso em uma **proposta de texto pronta para substituir a subseção 4.2 e a legenda da Figura 4**.
