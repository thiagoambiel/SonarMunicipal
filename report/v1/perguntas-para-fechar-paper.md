# Perguntas para Fechar o Paper

Este arquivo foi montado a partir da análise de [`report/main.tex`](/home/thiago/Projects/IC/AIPolicy/CityManager/report/main.tex).

## Diagnóstico rápido

O texto já tem uma base boa de relatório técnico: problema aplicado claro, pipeline coerente, números iniciais de coleta e uma narrativa consistente do sistema.

Hoje, porém, ele ainda parece mais um relatório de projeto do que um artigo científico pronto para publicação. Os principais bloqueios são:

1. faltam perguntas de pesquisa, hipóteses ou objetivos avaliáveis;
2. falta uma seção de trabalhos relacionados ou comparação explícita com literatura próxima;
3. o método está descrito em alto nível, mas vários detalhes de implementação e decisão experimental não aparecem;
4. os resultados ainda são poucos para sustentar as contribuições declaradas;
5. faltam avaliações mais fortes para busca semântica, agrupamento e indicadores;
6. faltam informações operacionais de reprodutibilidade, disponibilidade de dados e recorte temporal.

Se você responder bem os itens marcados como `Crítico`, o paper sobe bastante de nível.

Observação: as sugestões abaixo são modelos de resposta. Você deve escolher, adaptar ou combinar apenas o que for verdadeiro no projeto.

---

## Perguntas críticas

### 1. Enquadramento científico

1. Qual é a pergunta central de pesquisa do artigo em uma frase?
Sugestões:
1. Investigar se é possível recomendar políticas públicas municipais a partir de PLs históricos e indicadores oficiais com utilidade prática para gestores.
2. Avaliar se a combinação entre coleta em larga escala de PLs, tradução semântica e busca vetorial produz recomendações legislativas mais reutilizáveis.
3. Verificar se projetos de lei municipais podem ser transformados em um acervo pesquisável de ações públicas orientadas a problema.
4. Estudar em que medida a integração entre texto legislativo e séries temporais municipais apoia decisão pública baseada em evidências.
5. Propor e avaliar um pipeline reproduzível para descoberta, organização e recomendação de políticas públicas municipais.
Resposta: Propor e avaliar um pipeline reproduzível para descoberta, organização e recomendação de políticas públicas municipais.

2. O objetivo do paper é propor um método, validar um sistema, comparar abordagens, ou apresentar uma plataforma aplicada?
Sugestões:
1. O objetivo principal é propor e validar um método aplicado.
2. O foco é apresentar uma plataforma baseada em um pipeline metodológico reproduzível.
3. O artigo descreve um sistema completo e reporta sua validação inicial.
4. O trabalho tem natureza de aplicação, com ênfase em engenharia de dados e recuperação semântica.
5. O paper apresenta um método operacionalizado em uma plataforma web para uso por gestores.
Resposta: O objetivo principal é propor e validar um método aplicado.

3. Quais das contribuições C1--C5 foram realmente implementadas e avaliadas, e quais ainda estão só descritas?
Sugestões:
1. C1, C2 e C3 foram implementadas e avaliadas; C4 e C5 foram implementadas com avaliação ainda preliminar.
2. Todas as contribuições foram implementadas, mas apenas coleta e tradutor possuem métricas quantitativas consolidadas.
3. C1 a C5 foram implementadas; a avaliação formal está mais madura em C1 e C2.
4. C1, C2 e C5 estão completas; C3 e C4 ainda precisam de avaliação mais sistemática.
5. O artigo apresenta a implementação integral do pipeline, mas com níveis diferentes de validação por etapa.
Resposta: O artigo apresenta a implementação integral do pipeline, mas com níveis diferentes de validação por etapa.


4. Para qual tipo de venue você quer submeter: IA aplicada, governo digital, sistemas de informação, mineração de texto, ou informática pública?
Sugestões:
1. Governo digital com componente de IA aplicada.
2. Sistemas de informação aplicados ao setor público.
3. Mineração de texto e recuperação de informação com estudo de caso governamental.
4. Informática pública e ciência de dados para gestão pública.
5. Demo paper com viés de governo digital.
Resposta: Mineração de texto e recuperação de informação com estudo de caso governamental

5. Você quer posicionar o trabalho como artigo científico, relatório técnico expandido, demo paper, ou artigo de aplicação?
Sugestões:
1. Artigo científico de aplicação.
2. Demo paper com forte componente metodológico.
3. Relatório técnico expandido com resultados experimentais.
4. Artigo de sistema com avaliação inicial.
5. Artigo aplicado focado em reprodutibilidade e utilidade prática.
Resposta: Artigo científico de aplicação.

### 2. Trabalhos relacionados

6. Quais trabalhos existentes você quer citar como mais próximos?
Sugestões:
1. Trabalhos sobre análise automática de textos legislativos e jurídicos.
2. Trabalhos sobre recomendação de políticas públicas baseada em dados governamentais.
3. Pesquisas de recuperação semântica em português com embeddings multilíngues.
4. Estudos sobre uso do SAPL, Interlegis e transparência legislativa digital.
5. Trabalhos sobre avaliação observacional de políticas com indicadores públicos.
Resposta: Trabalhos sobre recomendação de políticas públicas baseada em dados governamentais.

7. Existe algum sistema parecido que recomende políticas públicas, analise PLs municipais, use SAPL em escala, ou combine legislação com indicadores oficiais?
Sugestões:
1. Não encontramos um sistema com exatamente essa combinação de coleta nacional, tradução semântica e indicadores oficiais.
2. Há sistemas de consulta legislativa, mas não de recomendação de políticas com análise semântica e séries temporais.
3. Existem ferramentas de transparência legislativa, porém sem foco em recomendação orientada a problema.
4. Há trabalhos acadêmicos parciais em NLP jurídico, mas não uma plataforma integrada como a proposta.
5. O estado da arte cobre componentes isolados, mas não a integração ponta a ponta apresentada aqui.
Resposta: Há sistemas de consulta legislativa, mas não de recomendação de políticas com análise semântica e séries temporais.

8. Em relação ao estado da arte, qual é o diferencial principal do Sonar Municipal?
Sugestões:
1. Integrar coleta legislativa em escala nacional com recomendação de ações em linguagem operacional.
2. Transformar ementas jurídicas em ações pesquisáveis por gestores não técnicos.
3. Combinar recuperação semântica com indicadores municipais oficiais no mesmo sistema.
4. Fornecer um pipeline auditável e reproduzível, do SAPL até a interface web.
5. Agrupar PLs semanticamente similares para reduzir sparsidade e ampliar utilidade analítica.
Resposta: Integrar coleta legislativa em escala nacional com recomendação de ações em linguagem operacional.

### 3. Coleta e base de dados

9. Em que data ou intervalo de datas foi executada a coleta que gerou as 1.259 instâncias encontradas e os 220.065 PLs?
Sugestões:
1. A coleta principal foi executada entre [mês/ano] e [mês/ano].
2. Os números reportados correspondem a uma execução congelada em [data].
3. A varredura nacional ocorreu em lote único no período de [datas].
4. A coleta foi feita em ciclos, mas os resultados do artigo refletem o snapshot de [data].
5. O recorte experimental considera apenas a execução realizada entre [datas], sem atualizações posteriores.
Resposta: Os números reportados correspondem a uma execução congelada em 12/11/2025

10. Dos 5.570 municípios brasileiros, qual foi a cobertura final em percentual para:
- instâncias SAPL encontradas;
- instâncias com extração bem-sucedida;
- municípios com pelo menos um PL coletado?
Sugestões:
1. A cobertura foi de [x]% na descoberta e [y]% na extração bem-sucedida.
2. Em termos de municípios, o pipeline encontrou SAPL em [x] casos e extraiu PLs em [y].
3. A cobertura efetiva foi limitada por heterogeneidade técnica das instâncias, resultando em [x]% de sucesso final.
4. Embora a busca tenha sido nacional, a extração automatizada alcançou apenas uma fração dos municípios.
5. O artigo reporta separadamente cobertura de descoberta, cobertura de extração e cobertura com PL coletado.
Resposta: 1259 instâncias SAPL foram encontradas, com 322 instâncias com pelo menos 1 PL

11. Como foi definida formalmente uma "instância SAPL validada"?
Sugestões:
1. Uma instância foi considerada validada quando expôs evidência pública consistente de SAPL em rota acessível.
2. Definimos validação como confirmação de interface ou endpoint compatível com o padrão do SAPL.
3. A validação exigiu resposta HTTP válida e conteúdo estruturalmente coerente com o SAPL.
4. Consideramos validada a instância que passou nas heurísticas de descoberta e na checagem de compatibilidade pública.
5. Uma instância só foi aceita após evidência observável de consulta legislativa compatível com SAPL.
Resposta: Consideramos validada a instância que passou nas heurísticas de descoberta e na checagem de compatibilidade pública.

12. Como foi definida formalmente uma "extração bem-sucedida"?
Sugestões:
1. Extração bem-sucedida significa obter ao menos um PL com metadados mínimos válidos.
2. Consideramos sucesso quando o pipeline percorreu a paginação e recuperou registros consistentes de PL.
3. O sucesso foi definido pela coleta automatizada de PLs sem intervenção manual.
4. A extração foi marcada como bem-sucedida quando houve resposta estruturada e persistência correta dos registros.
5. Houve sucesso quando a instância permitiu identificar tipos de matéria e recuperar PLs completos.
Resposta: Extração bem-sucedida significa obter ao menos um PL com metadados mínimos válidos.

13. Houve deduplicação de municípios, instâncias ou PLs? Se sim, como?
Sugestões:
1. Sim, deduplicamos instâncias por município e PLs por identificador e metadados chave.
2. Sim, removemos duplicatas usando URL canônica da instância e chave composta do PL.
3. Sim, aplicamos deduplicação por município, número do PL, ano e origem da instância.
4. Não houve deduplicação formal nesta etapa; essa é uma limitação do estudo.
5. Houve deduplicação parcial, suficiente para evitar múltiplos registros óbvios da mesma proposição.
Resposta: Sim, aplicamos deduplicação por município, número do PL, ano e origem da instância.

14. Qual o intervalo temporal dos PLs coletados: todos os anos disponíveis ou apenas um período específico?
Sugestões:
1. Foram coletados todos os anos disponíveis em cada instância.
2. O recorte incluiu apenas PLs no intervalo de [ano] a [ano].
3. A coleta buscou o histórico completo disponível nas APIs acessíveis.
4. O estudo considera apenas proposições posteriores a [ano], por consistência de dados.
5. O intervalo variou por município, refletindo a disponibilidade histórica de cada SAPL.
Resposta: Foram coletados todos os anos disponíveis em cada instância.

15. Você fez alguma validação manual por amostragem da descoberta e da extração? Se sim, qual foi o tamanho da amostra e o resultado?
Sugestões:
1. Sim, realizamos inspeção manual de uma amostra de [n] instâncias e observamos precisão de [x]%.
2. Sim, validamos manualmente [n] PLs extraídos e confirmamos consistência dos campos em [x]% dos casos.
3. Sim, usamos amostragem estratificada por região e tivemos taxa de acerto satisfatória.
4. Não, a validação foi apenas automática; isso será destacado como limitação.
5. Fizemos validação manual exploratória, sem desenho estatístico formal, apenas para sanity check.
Resposta: Fizemos validação manual exploratória, sem desenho estatístico formal, apenas para sanity check.

### 4. Tradutor ementa -> ação

16. As 1.000 amostras sintéticas foram geradas a partir de 1.000 ementas distintas? Houve filtragem ou curadoria manual?
Sugestões:
1. Sim, o conjunto foi gerado a partir de 1.000 ementas distintas selecionadas aleatoriamente.
2. Sim, houve filtragem manual para remover ementas ambíguas, truncadas ou irrelevantes.
3. As amostras vieram de ementas reais, com curadoria mínima para garantir qualidade do treinamento.
4. O conjunto incluiu ementas variadas por tema e município, sem repetição intencional.
5. Houve geração sintética supervisionada por amostragem inicial e revisão posterior.
Resposta: Sim, o conjunto foi gerado a partir de 1.000 ementas distintas selecionadas aleatoriamente.

17. Qual prompt foi usado para gerar os pares sintéticos? Você pretende publicar o prompt completo?
Sugestões:
1. Usamos um prompt instrucional focado em converter ementas em ações curtas e operacionais, e o prompt será publicado.
2. O prompt explicitava verbo no infinitivo, remoção de juridiquês e preservação do núcleo material da política.
3. Pretendemos incluir o prompt completo em apêndice para reprodutibilidade.
4. O prompt foi iterado empiricamente; no paper podemos apresentar a versão final.
5. O prompt continha regras linguísticas e exemplos positivos/negativos, com publicação parcial ou integral.
Resposta: O prompt está disponível em "experiments/tools/ementa2action/Ementa2ActionGPTPrompt.txt"

18. Houve revisão humana das saídas geradas pelo GPT-5.1-Thinking antes do fine-tuning? Se sim, por quem e com qual critério?
Sugestões:
1. Sim, houve revisão manual pelo autor principal com foco em fidelidade semântica e clareza.
2. Sim, uma amostra foi revisada por especialistas do projeto usando critérios de utilidade prática.
3. Sim, corrigimos casos com perda de sentido, excesso de abstração ou linguagem jurídica residual.
4. Não, o conjunto foi usado como gerado; isso será descrito como limitação metodológica.
5. Houve curadoria leve apenas para remover saídas claramente incorretas.
Resposta: Sim, corrigimos casos com perda de sentido, excesso de abstração ou linguagem jurídica residual.

19. Como o conjunto foi dividido em treino, validação e teste?
Sugestões:
1. Adotamos divisão 80/10/10.
2. O conjunto foi separado em treino, validação e teste sem sobreposição de ementas.
3. Utilizamos divisão aleatória estratificada por tema legislativo.
4. O teste foi mantido congelado para avaliação final após ajuste de hiperparâmetros.
5. A divisão seguiu proporção [x]/[y]/[z], com semente fixa para reprodutibilidade.
Resposta: O conjunto foi divido em 90/10 para treino e validação.

20. Quais hiperparâmetros principais foram usados no fine-tuning do PTT5-v2 com QLoRA?
Sugestões:
1. Reportamos taxa de aprendizado, número de épocas, batch size e tamanho máximo de sequência.
2. O ajuste usou QLoRA em 4 bits com rank LoRA, alpha e dropout definidos empiricamente.
3. Os hiperparâmetros foram escolhidos por restrição computacional e desempenho em validação.
4. O treinamento foi realizado com [n] épocas, LR [x], batch [y] e warmup [z].
5. Vamos incluir tabela com configuração de hardware, quantização e parâmetros de ajuste.
Resposta: O treinamento foi realizado com 30 épocas, LR 3e-4, batch 16. O código original de treinamento com todos os hiperparametros está disponível no repositório oficial do projeto

21. O BERTScore de 84% foi medido em qual split e com qual configuração?
Sugestões:
1. O valor de 84% foi medido no conjunto de teste.
2. A métrica foi calculada no split de validação durante seleção do modelo final.
3. O BERTScore refere-se ao F1 médio usando configuração padrão da biblioteca.
4. O artigo precisa explicitar se o valor é precision, recall ou F1.
5. O resultado foi obtido sobre amostra mantida fora do treinamento, com semente e versão fixadas.
Resposta:O valor de 84% foi medido no conjunto de validação.

22. Existe alguma avaliação humana da qualidade das ações geradas, por exemplo clareza, fidelidade semântica e utilidade prática?
Sugestões:
1. Sim, avaliadores humanos classificaram as saídas nesses três critérios.
2. Sim, fizemos uma análise qualitativa com exemplos corretos, aceitáveis e incorretos.
3. Ainda não, mas é uma avaliação planejada e recomendável antes da submissão.
4. Houve revisão informal por especialistas, sem protocolo quantitativo.
5. Não houve avaliação humana formal, o que será explicitado como limitação.
Resposta: Houve revisão informal por especialistas, sem protocolo quantitativo.

23. Contra quais baselines o tradutor foi comparado?
- usar a ementa original;
- prompt zero-shot sem fine-tuning;
- outro modelo seq2seq;
- regra heurística simples.
Sugestões:
1. Comparamos contra a ementa original e contra geração zero-shot com o mesmo LLM.
2. O baseline principal foi não traduzir a ementa e indexar o texto legislativo bruto.
3. Também avaliamos uma abordagem heurística simples baseada em remoção de expressões jurídicas.
4. Não houve baseline formal; isso precisa ser resolvido antes da submissão.
5. Pretendemos incluir ao menos dois baselines fortes para justificar o fine-tuning.
Resposta: O baseline principal foi não traduzir a ementa e indexar o texto legislativo bruto.

### 5. Busca semântica

24. Como vocês avaliaram se o E5 realmente recupera ações úteis para consultas reais?
Sugestões:
1. Avaliamos com consultas reais e julgamento manual de relevância das top-k ações.
2. Usamos um conjunto de perguntas representativas do uso esperado por gestores.
3. A utilidade foi medida por taxa de relevância percebida por avaliadores humanos.
4. Fizemos análise qualitativa de casos e exemplos de sucesso e fracasso.
5. Ainda não há avaliação formal, apenas validação exploratória da equipe.
Resposta: Avaliamos com consultas reais e julgamento manual de relevância das top-k ações.

25. Existe um conjunto de consultas de teste com relevância anotada?
Sugestões:
1. Sim, construímos um conjunto anotado manualmente com [n] consultas.
2. Sim, as consultas foram criadas a partir de necessidades reais de usuários-alvo.
3. Não formalmente; temos apenas exemplos internos ainda não anotados.
4. O conjunto existe, mas ainda precisa ser consolidado para entrar no paper.
5. Pretendemos criar um benchmark pequeno, porém auditável, para submissão.
Resposta: Não formalmente; temos apenas exemplos internos ainda não anotados.

26. Quais métricas de recuperação você consegue reportar: Precision@K, Recall@K, MRR, nDCG, taxa de clique, avaliação humana?
Sugestões:
1. Podemos reportar Precision@5 e nDCG@10.
2. O artigo deve incluir ao menos uma métrica de ranking e uma avaliação humana.
3. Se houver benchmark anotado, MRR e Recall@K são boas opções.
4. Em cenário sem logs de uso, avaliação humana das top-k recomendações é o mínimo viável.
5. Se já existe interface em produção, taxa de clique e seleção também podem complementar.
Resposta: A qualidade da recuperação foi avaliada empiricamente pelo autor do projeto. Uma limitação do projeto é a falta de análise humana da qualidade da recuperação

27. O texto da consulta do usuário recebe algum prefixo do tipo `query:` e as ações recebem `passage:` ou equivalente na indexação do E5?
Sugestões:
1. Sim, seguimos o padrão recomendado pelo modelo para consulta e documento.
2. Sim, usamos prefixos distintos para alinhar consulta e ação no espaço vetorial.
3. Não, indexamos texto puro; isso deve ser informado por impactar desempenho.
4. Testamos com e sem prefixos e adotamos a configuração com melhor recuperação.
5. Essa escolha metodológica ainda precisa ser documentada claramente no artigo.
Resposta: Sim, seguimos o padrão recomendado pelo modelo para consulta e documento.

28. Qual valor de `K` é usado nas recomendações e como ele foi escolhido?
Sugestões:
1. Usamos `K = 10`, definido por equilíbrio entre diversidade e sobrecarga cognitiva.
2. O valor de `K` foi escolhido empiricamente após testes exploratórios.
3. Adotamos `K = 5` para privilegiar precisão nas primeiras recomendações.
4. O sistema permite variar `K`, mas o artigo reporta resultados em um valor fixo.
5. A escolha foi guiada por interface e avaliação qualitativa com usuários.
Resposta: O valor de `K = 1000` foi escolhido empiricamente após testes exploratórios, visando equilibrio entre diversidade e sobrecarga cognitiva.

### 6. Indicadores e efeito no mundo real

29. Qual é a fórmula exata de cada indicador?
Sugestões:
1. Taxa de homicídios = homicídios / população * 100.000.
2. Taxa de matrículas = matrículas no ensino regular / população * 100.000.
3. O paper deve explicitar numerador, denominador, unidade temporal e fonte oficial.
4. Se houver ajustes por faixa etária, isso precisa aparecer na fórmula.
5. As fórmulas serão apresentadas com definição completa das variáveis.
Resposta: Taxa de homicídios = homicídios / população * 100.000, Taxa de matrículas = matrículas no ensino regular / população * 100.000

30. Como vocês alinham a data do PL com a série temporal do indicador?
- mês da apresentação;
- próximo mês disponível;
- média anual;
- outro critério.
Sugestões:
1. Usamos o mês de apresentação quando a série é mensal.
2. Usamos o próximo ponto temporal disponível após a apresentação do PL.
3. Para dados anuais, alinhamos pelo ano de apresentação.
4. Aplicamos regra única por indicador, respeitando sua granularidade temporal.
5. O alinhamento foi operacional e não causal, com simplificação explícita no texto.
Resposta: Aplicamos regra única por indicador, respeitando sua granularidade temporal, sempre alinhando com os valores mais próximos de data

31. Quais horizontes temporais o sistema oferece e por que esses horizontes foram escolhidos?
Sugestões:
1. Oferecemos horizontes de 6, 12 e 24 meses por serem janelas interpretáveis de curto e médio prazo.
2. Para séries anuais, usamos 1, 2 e 4 anos após a apresentação.
3. Os horizontes foram definidos para acomodar diferentes ritmos de implementação legislativa.
4. A escolha buscou equilibrar responsividade e disponibilidade de dados.
5. Os horizontes são configuráveis, mas o paper fixa alguns para comparabilidade.
Resposta: Oferecemos horizontes de 6, 12, 18, 24, 30, 36 meses por serem janelas interpretáveis de curto, médio prazo e longo prazo, com granularidade de 6 meses. Essa granularidade foi escolhida devido a facilidade de encontrar dados de série temporal com essa granularidade ou menor.

32. Como vocês tratam municípios com dados faltantes, séries curtas ou mudanças administrativas?
Sugestões:
1. Municípios com dados insuficientes foram excluídos da análise daquele indicador.
2. Aplicamos filtros mínimos de completude antes de computar efeito.
3. Não realizamos imputação; preferimos manter apenas observações confiáveis.
4. Casos com ruptura administrativa foram tratados separadamente ou removidos.
5. O artigo deve descrever claramente critérios de exclusão e tamanho final da amostra.
Resposta: Municípios com dados insuficientes foram excluídos da análise daquele indicador.

33. Por que "Taxa de Matrículas em Ensino Regular por 100 mil habitantes" foi escolhida como proxy de evasão escolar? Há alguma limitação importante dessa proxy que precisa ser explicitada?
Sugestões:
1. A proxy foi escolhida por disponibilidade nacional padronizada, embora não meça evasão diretamente.
2. Usamos matrículas como aproximação operacional de permanência escolar.
3. A limitação central é que queda de matrícula pode refletir demografia, migração ou rede privada.
4. O indicador é útil para monitoramento exploratório, não para inferência causal sobre evasão.
5. O paper precisa afirmar explicitamente que essa é uma proxy imperfeita, mas comparável entre municípios.
Resposta: Usamos matrículas como aproximação operacional de permanência escolar. A limitação central é que queda de matrícula pode refletir demografia, migração ou rede privada.

34. Existe algum controle mínimo para tendência prévia, sazonalidade ou choque externo, mesmo que o artigo não faça inferência causal?
Sugestões:
1. Não, a análise é puramente descritiva e associativa.
2. Sim, consideramos a tendência prévia do indicador como referência contextual.
3. Podemos incluir comparação simples antes/depois com janela histórica anterior.
4. Podemos controlar sazonalidade apenas nos indicadores com granularidade mensal.
5. Mesmo sem modelo causal, vale incluir ao menos verificações de robustez básicas.
Resposta: Não, a análise é puramente descritiva e associativa.

### 7. Agrupamento em políticas públicas

35. Qual algoritmo de agrupamento foi usado na prática?
Sugestões:
1. Utilizamos HDBSCAN por lidar bem com densidades variáveis e ruído.
2. Usamos k-means sobre embeddings normalizados.
3. Aplicamos clustering hierárquico com corte por similaridade.
4. O agrupamento foi feito por limiar de similaridade cosseno entre ações.
5. O artigo ainda precisa documentar explicitamente o algoritmo usado.
Resposta: O agrupamento é feito através de similaridade de Jaccard entre os tokens da ementa transformada em ação.

36. Quais atributos entram no agrupamento: embeddings das ações, município, tema, período, indicador, ou apenas texto?
Sugestões:
1. O agrupamento usa apenas embeddings das ações.
2. O texto da ação é o principal atributo, sem metadados contextuais.
3. Usamos embeddings e depois agregamos metadados para interpretação dos clusters.
4. Município e período não entram no cluster, apenas na análise posterior do efeito.
5. Se metadados entrarem no agrupamento, isso precisa ser detalhado e justificado.
Resposta: Apenas o texto da ação

37. Como o número de clusters ou o limiar de agrupamento foi definido?
Sugestões:
1. O limiar foi definido empiricamente por inspeção qualitativa dos grupos.
2. O número de clusters foi ajustado com base em métricas internas e interpretabilidade.
3. Escolhemos a configuração que maximizou coerência semântica e tamanho mínimo útil.
4. O método adotado não exige número fixo de clusters, apenas parâmetros de densidade.
5. Essa definição ainda precisa ser formalizada para a versão final do paper.
Resposta: O limiar foi definido empiricamente por inspeção qualitativa dos grupos.

38. Houve inspeção qualitativa dos clusters para verificar coerência semântica?
Sugestões:
1. Sim, realizamos inspeção manual de amostras de clusters.
2. Sim, avaliamos se os PLs agrupados representavam uma mesma política pública.
3. A análise qualitativa indicou boa coerência nos grupos maiores e mais ruído nos menores.
4. Não formalmente; apenas observação exploratória da equipe.
5. Pretendemos incluir exemplos de clusters corretos e problemáticos.
Resposta: Sim, avaliamos se os PLs agrupados representavam uma mesma política pública.

39. Você consegue mostrar 2 ou 3 exemplos reais de clusters com nome, PLs representativos e efeito agregado?
Sugestões:
1. Sim, podemos incluir clusters como transporte escolar, videomonitoramento e apoio à educação básica.
2. Sim, vamos selecionar exemplos com boa interpretabilidade e dados completos.
3. Esses estudos de caso podem entrar na seção de resultados.
4. Ainda não, porque falta consolidar a análise agregada dos grupos.
5. Essa inclusão é recomendável para tornar o artigo mais convincente.
Resposta: Sim, vamos selecionar exemplos com boa interpretabilidade e dados completos.

40. Qual é a justificativa teórica ou empírica para a métrica
`Q = (n_positivos / n) * (n / (n + 1))`?
Sugestões:
1. A métrica combina taxa de sucesso observada com penalização para amostras pequenas.
2. O termo `n / (n + 1)` funciona como suavização simples para evitar supervalorização de grupos pequenos.
3. A escolha é heurística e foi motivada por robustez prática, não por teoria estatística formal.
4. Podemos descrevê-la como score operacional de ranqueamento, não como estimador inferencial.
5. Se mantida, a métrica precisa ser melhor justificada ou comparada com alternativas simples.
Resposta: A métrica combina taxa de sucesso observada com penalização para amostras pequenas.

### 8. Resultados

41. Além da Tabela 1 e do BERTScore, que outros resultados quantitativos você já tem mas ainda não entrou no texto?
Sugestões:
1. Distribuição por região, ano e tema dos PLs coletados.
2. Tamanho médio dos clusters e proporção de municípios com dados utilizáveis.
3. Métricas de recuperação da busca semântica.
4. Número total de ações geradas após a tradução das ementas.
5. Tempo de processamento, cobertura e taxa de falha por etapa do pipeline.
Resposta: Levou 4h 47min para transformar todos os 220.065 PLs em recomendações de ação

42. Você consegue incluir pelo menos um estudo de caso completo, do tipo:
- pergunta do usuário;
- ações recuperadas;
- cluster correspondente;
- comportamento do indicador;
- interpretação final?
Sugestões:
1. Sim, um estudo de caso completo aumentaria bastante a força do paper.
2. Podemos mostrar um caso em segurança pública e outro em educação.
3. O ideal é escolher um exemplo com recomendação intuitiva e série temporal legível.
4. Se houver poucos casos robustos, um único estudo bem detalhado já ajuda.
5. Sem estudo de caso, o paper fica abstrato demais para publicação aplicada.
Resposta: Podemos mostrar um caso em segurança pública e outro em educação.

43. Você consegue apresentar resultados separados por etapa do pipeline, e não apenas um resumo global?
Sugestões:
1. Sim, podemos dividir resultados em coleta, tradução, busca e análise de indicadores.
2. O artigo ganha clareza se cada contribuição tiver ao menos uma evidência própria.
3. Podemos transformar a seção de resultados em subseções alinhadas ao pipeline.
4. Hoje os resultados estão comprimidos demais; vale expandir.
5. Mesmo com poucas métricas, separar por etapa já melhora a leitura científica.
Resposta: Sim, podemos dividir resultados em coleta, tradução, busca, análise de indicadores e agrupamento.

44. Há como mostrar erro ou falha típica do sistema para dar honestidade metodológica ao paper?
Sugestões:
1. Sim, podemos mostrar exemplos de ementas ambíguas traduzidas de forma inadequada.
2. Também podemos mostrar consultas que retornam ações semanticamente próximas, mas politicamente inadequadas.
3. Clusters excessivamente amplos ou heterogêneos são bons exemplos de falha.
4. Se não houver erro documentado, isso enfraquece a credibilidade do artigo.
5. Uma pequena subseção de erros típicos é recomendável.
Resposta: Sim, podemos mostrar exemplos de ementas traduzidas de forma inadequada e amostras instáveis nos indicadores com -100% na taxa de homicidios.

### 9. Reprodutibilidade e disponibilidade

45. O código citado no GitHub está público, organizado e suficiente para reproduzir:
- descoberta SAPL;
- extração;
- treinamento;
- indexação;
- frontend?
Sugestões:
1. Sim, o repositório já contém todos os módulos essenciais.
2. Parcialmente; o código existe, mas ainda precisa de documentação para reprodução.
3. A coleta e a interface estão públicas, mas treinamento e dados ainda não estão consolidados.
4. O paper deve informar claramente o que está aberto e o que não está.
5. Antes da submissão, convém revisar README, scripts e dependências.
Resposta: Sim, o repositório já contém todos os módulos essenciais.

46. Os dados coletados ou metadados derivados serão disponibilizados? Se não, o que pode ser aberto sem problema legal ou ético?
Sugestões:
1. Podemos abrir os metadados derivados e scripts de coleta, mesmo sem redistribuir todo o conteúdo bruto.
2. Os dados originais são públicos nas fontes, então podemos compartilhar apenas identificadores e links.
3. Se houver restrição operacional, ao menos uma amostra reproduzível deve ser disponibilizada.
4. O artigo deve esclarecer política de disponibilidade dos dados.
5. A abertura de snapshots, prompts e listas de instâncias já ajuda bastante na reprodutibilidade.
Resposta: Sim, todos os dados são publicos e serão disponibilizados no repositório oficial

47. O paper precisa informar versão dos modelos, data da coleta, versão das APIs e ambiente computacional. Você já tem esses dados consolidados?
Sugestões:
1. Sim, esses dados serão incluídos em tabela de reprodutibilidade.
2. Parcialmente; ainda precisamos consolidar versões e datas exatas.
3. O artigo final deve registrar snapshot temporal de coleta e configuração experimental.
4. Se não estiver consolidado, vale levantar isso antes da submissão.
5. Uma tabela compacta com software, modelo, data e hardware resolve essa lacuna.
Resposta: Sim, esses dados serão incluídos em tabela de reprodutibilidade.

48. Há alguma questão jurídica, ética ou de uso responsável que deve ser explicitada, já que o sistema recomenda políticas públicas com base em dados observacionais?
Sugestões:
1. Sim, o sistema não substitui análise jurídica, técnica ou política humana.
2. Sim, as recomendações são observacionais e podem refletir vieses de disponibilidade de dados.
3. O artigo deve alertar que associação empírica não implica causalidade.
4. Convém informar que políticas públicas exigem contexto local e validação institucional.
5. Também é importante discutir riscos de automatização indevida da decisão pública.
Resposta: Sim, as recomendações são observacionais e podem refletir vieses de disponibilidade de dados. o sistema não substitui análise jurídica, técnica ou política humana.  O artigo deve alertar que associação empírica não implica causalidade. Convém informar que políticas públicas exigem contexto local e validação institucional. Também é importante discutir riscos de automatização indevida da decisão pública.

---

## Perguntas importantes, mas não bloqueantes

49. Você quer adicionar uma seção explícita de "Trabalhos Relacionados" ou incorporar isso na fundamentação?
Sugestões:
1. Sim, criar uma seção própria fortalece o enquadramento acadêmico.
2. Sim, especialmente se a submissão for para venue científica tradicional.
3. Podemos incorporar na fundamentação, mas isso tende a diluir a comparação.
4. Se o espaço for curto, uma subseção já resolve.
5. Entre as opções, seção explícita costuma ser a escolha mais segura.
Resposta: Sim, criar uma seção própria fortalece o enquadramento acadêmico.

50. O título atual reflete melhor um sistema, um método, ou um estudo empírico? Você quer um título mais científico e menos institucional?
Sugestões:
1. O título atual comunica bem a aplicação, mas pode ficar mais científico.
2. Podemos enfatizar método e escala nacional no título.
3. Podemos destacar recomendação de políticas públicas e análise de PLs municipais.
4. Um subtítulo ajuda a equilibrar nome do sistema e contribuição científica.
5. Se a submissão for mais técnica, vale reduzir o peso do nome do projeto no título.
Resposta: Podemos destacar recomendação de políticas públicas e análise de PLs municipais.

51. O resumo precisa incluir números principais. Quais métricas você quer destacar em uma única frase?
Sugestões:
1. 1.259 instâncias encontradas, 322 com extração bem-sucedida e 220.065 PLs coletados.
2. BERTScore de 84% no tradutor e cobertura nacional na coleta.
3. Número de ações indexadas e desempenho da recuperação semântica.
4. Quantidade de municípios analisados com indicadores oficiais.
5. Um resumo forte deve trazer pelo menos coleta, tradução e busca.
Resposta: 1.259 instâncias encontradas, 322 com extração bem-sucedida e 220.065 PLs coletados.

52. Há uma figura de arquitetura da plataforma ou uma captura de tela que ajude a publicação?
Sugestões:
1. Sim, uma captura da interface pode ser útil em artigo aplicado ou demo.
2. Uma figura de arquitetura técnica complementa o pipeline conceitual.
3. Se houver espaço, incluir ambas é melhor.
4. Uma imagem com fluxo de consulta do usuário pode aumentar clareza.
5. Se a venue for mais teórica, a captura é opcional, mas a arquitetura ajuda.
Resposta: Uma figura de arquitetura técnica complementa o pipeline conceitual.

53. Você pretende incluir um apêndice com prompt, heurísticas de URL, detalhes de treinamento ou exemplos adicionais?
Sugestões:
1. Sim, apêndice melhora reprodutibilidade sem poluir o corpo do texto.
2. O prompt e as heurísticas de descoberta são bons candidatos a apêndice.
3. Detalhes de treinamento e exemplos de erro também cabem bem no material suplementar.
4. Se a venue permitir suplemento, vale mover para lá o que for mais técnico.
5. Um apêndice curto já resolveria várias lacunas metodológicas.
Resposta: Não

54. Existem siglas ou termos que precisam ser definidos melhor para um público fora de computação aplicada ao setor público?
Sugestões:
1. Sim, termos como SAPL, embeddings, Qdrant, QLoRA e BERTScore merecem definição breve.
2. Para público interdisciplinar, vale simplificar parte do vocabulário técnico.
3. Também convém explicar melhor o papel do Interlegis e do SAPL no contexto brasileiro.
4. O artigo pode manter rigor técnico sem assumir familiaridade prévia com NLP.
5. Uma revisão editorial focada em legibilidade ajudaria bastante.
Resposta: Sim, termos como SAPL, embeddings, Qdrant, QLoRA e BERTScore merecem definição breve.

55. Há interesse em explicitar melhor ameaça de viés regional, já que nem todos os municípios usam SAPL ou expõem dados de forma homogênea?
Sugestões:
1. Sim, isso deve entrar explicitamente nas ameaças à validade.
2. A cobertura desigual pode introduzir viés regional e institucional.
3. Municípios com melhor infraestrutura digital tendem a estar mais representados.
4. Esse viés afeta generalização e precisa ser discutido com honestidade.
5. Se possível, vale incluir uma tabela por região para mostrar essa assimetria.
Resposta: Sim, isso deve entrar explicitamente nas ameaças à validade. A cobertura desigual pode introduzir viés regional e institucional. Municípios com melhor infraestrutura digital tendem a estar mais representados. Esse viés afeta generalização e precisa ser discutido com honestidade. Quero incluir tabela por região

---

## Ordem sugerida de resposta

Se quiser responder de forma eficiente, priorize nesta ordem:

1. perguntas 1, 3, 6, 8;
2. perguntas 9 a 15;
3. perguntas 16 a 23;
4. perguntas 24 a 40;
5. perguntas 41 a 48;
6. perguntas 49 a 55.

## Próximo passo recomendado

Depois que você responder este arquivo, o ideal é fazer uma segunda passada em [`report/main.tex`](/home/thiago/Projects/IC/AIPolicy/CityManager/report/main.tex) para:

1. reestruturar o texto no formato de artigo;
2. adicionar resultados e detalhes metodológicos faltantes;
3. decidir se o enquadramento final será artigo científico, demo paper ou relatório técnico expandido.
