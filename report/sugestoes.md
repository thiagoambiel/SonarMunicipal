Perfeito. Aqui vai um **checklist objetivo, priorizado e aplicável diretamente** à seção **4.2** e às **Figuras 4, 5 e 6**. Estou baseando as ações no que o artigo já afirma sobre o benchmark, as métricas, a heterogeneidade entre consultas, o uso de GPT-5.4 e as limitações já reconhecidas pelo próprio texto.  

## Checklist de revisão da seção 4.2

### Prioridade 1. Deixar a lógica experimental mais auditável

1. **Explicitar quais métricas são primárias e quais são secundárias.**
   A seção hoje apresenta várias métricas, mas a narrativa de fato gira em torno de **nDCG@10** e **High-Recall@10**, enquanto MAP@10 e P@10 aparecem como apoio. Declare isso no início da subseção de avaliação. Isso reduz a sensação de “caça à métrica favorável”. 

2. **Acrescentar um mini-parágrafo operacional sobre a anotação por GPT-5.4.**
   O texto já diz que houve julgamento automático em escala 0–3 e que o agente teve papel instrumental, não substituindo especialistas. Falta dizer, de forma compacta, como esse julgamento foi guiado. Inclua:

   * escala 0–3 em uma linha;
   * critério de relevância alta;
   * uma frase sobre consistência do julgamento;
   * referência ao prompt em apêndice ou repositório.
     Isso fecha a caixa-preta antes que o revisor a abra com um pé de cabra. 

3. **Separar com mais nitidez “efeito no ranking” de “efeito na cobertura local”.**
   Hoje a seção mistura bem esses conceitos, mas ainda de forma difusa. Reorganize assim:

   * **ordenação**: nDCG@10, MAP@10;
   * **topo do ranking**: P@10, High-P@10;
   * **cobertura local do pool**: Recall@10, High-Recall@10;
   * **diversidade entre rankings**: overlap/Jaccard.
     Essa arquitetura argumentativa já está implícita no texto, só precisa virar espinha dorsal explícita.  

4. **Marcar explicitamente que a explicação causal da melhora é hipótese interpretativa.**
   O trecho que diz que a textualização “reduz ambiguidade” e “aproxima a indexação de consultas formuladas como objetivos” é plausível, mas ainda é interpretação. Troque verbos mais fortes por formulações como “sugere”, “é compatível com”, “hipótese explicativa”. 

### Prioridade 2. Fortalecer a robustez metodológica sem exigir novo experimento gigante

5. **Adicionar uma frase curta listando o que o benchmark mede e o que ele não mede.**
   O texto já afirma que o pool vem da união dos top-30, que a avaliação mede qualidade relativa no pool e não recall absoluto no corpus. Traga isso para uma frase de fechamento da subseção, bem limpa. 

6. **Trazer a limitação do pool endógeno para dentro da própria leitura dos resultados.**
   Hoje essa ressalva aparece bem nas limitações. Vale ecoá-la em uma frase na 4.2, logo após o resumo agregado. Isso deixa a seção metodologicamente mais honesta sem enfraquecer o resultado.  

7. **Incluir uma nota de reprodutibilidade do benchmark.**
   Acrescente um trecho do tipo: “A lista de problemas, os candidatos do pool, os julgamentos e o prompt de anotação serão disponibilizados em material suplementar/repositório.”
   O artigo já menciona disponibilidade de código e artefatos do pipeline; fazer o mesmo para o benchmark melhora muito a auditabilidade. 

8. **Anunciar no texto a agenda de validação futura de forma mais técnica.**
   Em vez de só dizer “faltam avaliadores humanos”, escreva algo como:
   “Como próximo passo, planejamos validação estratificada em subconjuntos de maior discordância entre métodos e em consultas com maior sensibilidade temática.”
   Isso conversa diretamente com as ameaças à validade já listadas. 

## Checklist de revisão das figuras

### Figura 4

9. **Ordenar os problemas pelo delta de ações em relação ao BM25.**
   Hoje a figura já mostra que ações vence em 13 de 15 problemas, mas o padrão aparece espalhado. Ordenar por ganho transforma a figura em argumento, não só em inventário visual. 

10. **Encurtar os rótulos dos problemas.**
    Alguns rótulos quebram linha demais e deixam a figura visualmente apertada. Use nomes curtos na figura e mantenha nomes completos no texto, legenda expandida ou apêndice.

11. **Aumentar o espaçamento vertical entre linhas.**
    A Figura 4 está correta, mas um pouco comprimida. Mais respiro melhora muito a leitura em PDF e impressões.

12. **Destacar visualmente apenas a comparação central.**
    Como a narrativa principal é “ações versus BM25”, dê mais contraste a esses dois pontos e deixe ementas em papel secundário. Hoje os três métodos competem pela atenção.

13. **Ajustar a legenda para explicitar a mensagem principal.**
    Em vez de só descrever a figura, feche com a interpretação:
    “A vantagem média de ações é ampla, mas não uniforme, com perdas concentradas em consultas mais terminológicas.”
    Isso já está no texto e deve ecoar na legenda. 

### Figura 5

14. **Remover ou reduzir a ênfase dos números dentro das células.**
    O heatmap já carrega muita informação. Os valores escritos em todas as células deixam a figura densa demais. Em artigo, padrão visual costuma vencer microleitura.

15. **Aumentar o contraste entre ganho e perda sem exagerar na saturação.**
    O mapa atual já comunica a direção, mas pequenas diferenças ficam visuais demais para quem já conhece o dado e pouco legíveis para quem não conhece. Busque uma escala mais equilibrada.

16. **Agrupar visualmente as métricas por função analítica.**
    Uma solução simples:

* nDCG@10 e MAP@10 juntos;
* P@10 e High-Recall@10 juntos.
  Isso ajuda o leitor a entender que há duas histórias ali: ordenação e cobertura/topo.

17. **Mover a carga explicativa da figura para a legenda.**
    A figura deve mostrar padrão; a legenda deve dizer o que observar. Hoje ela ainda pede muita decodificação direta da matriz.

18. **Avaliar substituir o heatmap por barras divergentes, caso haja tempo.**
    Se houver margem para redesenho maior, barras divergentes por métrica podem ficar mais legíveis que matriz dupla. Se não houver, mantenha o heatmap e simplifique.

### Figura 6

19. **Separar visualmente ganho médio e W/T/L.**
    A figura já é muito boa, mas hoje os dois componentes conversam no mesmo volume visual. Coloque o W/T/L como coluna auxiliar mais discreta. 

20. **Ordenar as métricas por importância argumentativa.**
    Sugestão:

* nDCG@10
* High-Recall@10
* MAP@10
* P@10
  Isso alinha figura e narrativa.

21. **Adicionar o valor do delta médio diretamente ao lado do ponto.**
    Os valores já aparecem, mas podem ficar ainda mais claros com posicionamento mais limpo e tipografia menor.

22. **Explicitar na legenda que o IC bootstrap é entre consultas, não entre documentos.**
    Isso evita ambiguidade estatística. A figura já sugere isso, mas uma frase curta fecha a interpretação. 

## Checklist de revisão de texto, frase por frase

23. **Reescrever o trecho interpretativo central para ficar mais científico.**
    Em vez de sustentar “superioridade” de forma ampla, use:

* “vantagem média no benchmark avaliado”;
* “efeito heterogêneo entre temas”;
* “ganho mais frequente em consultas formuladas como objetivo de política pública”;
* “perdas concentradas em consultas mais terminológicas”.
  Isso já está alinhado com o que o artigo mostra e com a própria conclusão. 

24. **Inserir uma frase final de fechamento da subseção 4.2.**
    Sugestão estrutural:
    “Em síntese, os resultados sustentam vantagem média da recuperação baseada em ações no pool anotado, especialmente em métricas que combinam relevância graduada e cobertura de itens fortemente relevantes, mas essa vantagem não é uniforme entre temas e deve ser interpretada à luz do caráter exploratório do benchmark.”
    Essa frase amarra métodos, figuras e limitações num único nó bem apertado.

25. **Reduzir repetição entre texto e legenda.**
    Algumas interpretações aparecem quase duplicadas entre corpo e legenda. Deixe:

* a legenda focada no que observar;
* o texto focado no que concluir.

## Checklist de robustez adicional, para elevar a seção de “boa” para “muito convincente”

26. **Incluir uma tabela-resumo pequena com métricas agregadas e deltas.**
    Uma tabela com BM25, ementas, ações, delta vs. BM25 e uma coluna de interpretação já daria um chão firme para a seção. Os valores já estão no texto; falta só organizá-los.  

27. **Mencionar explicitamente a ausência de baselines híbridos na leitura dos resultados.**
    As limitações já falam disso. Vale antecipar isso na seção 4.2 com uma frase curta, para mostrar que você sabe onde o benchmark ainda não foi. 

28. **Conectar a seção 4.2 com a seção 5 por uma frase-ponte.**
    Algo como:
    “Apesar de promissores, esses resultados devem ser lidos junto às ameaças à validade discutidas na Seção 5, especialmente no que se refere ao pool endógeno, ao número de problemas e ao uso de anotação automatizada.”
    Isso dá sensação de artigo coeso, não de capítulo isolado.

## Ordem prática de execução

1. Reescrever os dois parágrafos centrais da interpretação da 4.2.
2. Ajustar as legendas das Figuras 4, 5 e 6.
3. Refazer a ordenação e o espaçamento da Figura 4.
4. Simplificar a Figura 5.
5. Refinar a Figura 6.
6. Inserir um mini-parágrafo metodológico sobre o julgamento GPT-5.4.
7. Acrescentar uma tabela-resumo enxuta.
8. Fechar a subseção com uma frase de leitura cautelosa e robusta.

### Resultado esperado após as revisões

A seção passa a comunicar, com mais nitidez, quatro ideias:
**(i)** ações vence em média no benchmark;
**(ii)** o ganho é heterogêneo;
**(iii)** parte do ganho parece vir de melhor ordenação e parte de melhor cobertura local;
**(iv)** a evidência é promissora, mas ainda exploratória. Isso é exatamente o tipo de equilíbrio que revisor de artigo gosta de ver.  

No próximo passo, posso transformar esse checklist em uma **versão reescrita da subseção 4.2**, já pronta para colar no artigo.
