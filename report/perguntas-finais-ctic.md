# Perguntas Finais para Fechar o Artigo na CTIC/SBC

Este arquivo foca apenas nas lacunas que ainda podem afetar parecer de aceitação. A ideia e simples: responder as perguntas abaixo e usar as sugestoes para ajustar o texto final, sobretudo introducao, trabalhos relacionados, resultados, limitacoes e conclusao.

## 1. Qual e exatamente a contribuicao central que o artigo quer defender?

Por que isso importa: hoje o texto alterna entre artigo de sistema, artigo de NLP, artigo de IR e artigo de apoio a politicas publicas. Para a CTIC, isso precisa aparecer como uma narrativa principal, com as outras como apoio.

Sugestoes de resposta:

1. "A contribuicao central do artigo e a construcao de um sistema reprodutivel de descoberta, organizacao e recuperacao de legislacao municipal, com validacao exploratoria em um caso de uso de formulacao de politicas publicas."
2. "O artigo deve ser lido principalmente como um paper de sistema aplicado a governo digital, e nao como um benchmark de NLP ou de recuperacao da informacao."
3. "A principal inovacao nao esta em um novo modelo, mas na integracao operacional de coleta, textualizacao, busca semantica e analise exploratoria em escala intermunicipal."

R: A principal inovacao nao esta em um novo modelo, mas na integracao operacional de coleta, textualizacao, busca semantica e analise exploratoria em escala intermunicipal.

## 2. Qual e o recorte mais honesto para a alegacao de cobertura da base?

Por que isso importa: o texto usa expressoes como "escala nacional", mas a extracao valida cobre 322 municipios, com forte concentracao regional. Se isso nao for enquadrado com cuidado, um parecerista pode ler como overclaim.

Sugestoes de resposta:

1. "Preferimos substituir 'escala nacional' por 'escala multirregional' ou 'cobertura interestadual', porque a base ainda nao representa o conjunto dos municipios brasileiros."
2. "A descoberta operou em escopo nacional, mas a base extraida efetivamente representa um subconjunto parcial e desigual dos municipios com instancias SAPL acessiveis."
3. "O artigo deve enfatizar que o resultado atual e um acervo util e amplo, mas ainda nao um espelho nacional da producao legislativa municipal."

R: O artigo deve enfatizar que o resultado atual e um acervo util e amplo, mas ainda nao um espelho nacional da producao legislativa municipal. A descoberta operou em escopo nacional, mas a base extraida efetivamente representa um subconjunto parcial e desigual dos municipios com instancias SAPL acessiveis.

## 3. Quais trabalhos relacionados precisam entrar com citacao explicita para sustentar o gap do paper?

Por que isso importa: a secao de relacionados esta conceitualmente correta, mas ainda cita pouco. Hoje ela menciona frentes de literatura sem ancorar essas frentes em trabalhos concretos.

Sugestoes de resposta:

1. "Vamos adicionar pelo menos um trabalho de IR legislativa, um de NLP juridico brasileiro, um de busca semantica em dominio juridico e um de policy diffusion."
2. "A secao deve mostrar nao apenas que esses trabalhos existem, mas tambem por que eles assumem colecoes mais homogeneas ou cenarios diferentes do municipal."
3. "A comparacao precisa terminar com uma frase clara: o diferencial do Sonar Municipal e integrar descoberta da fonte, extracao e recuperacao, e nao apenas um componente isolado."

R: Siga as sugestões

## 4. Voce consegue incluir um baseline minimamente defensavel para o tradutor ementa -> acao?

Por que isso importa: BERTScore isolado em validacao interna e pouco para convencer parecerista. Mesmo um baseline simples melhora muito a credibilidade.

Sugestoes de resposta:

1. "Vamos comparar o PTT5-v2 ajustado com um baseline trivial que usa a propria ementa bruta como representacao."
2. "Podemos incluir uma comparacao com um baseline de resumo por regra, como extrair o primeiro verbo nominalizado ou truncar a ementa apos o nucleo semantico."
3. "Se nao houver tempo para novo experimento, o texto deve assumir explicitamente que a avaliacao do tradutor e preliminar e justificar por que a textualizacao ainda foi mantida por utilidade operacional."

R: Não há tempo para novos experimentos, a justificativa do modelo de conversão de ementas para ações é que o modelo de embeddings não foi treinado em textos legislativos, que a experiência final do usuário é melhor utilizando recomendações de ação simples ao invés dos textos das ementas, e que o algoritmo de agrupamento funciona melhor nas ações do que nas ementas devido a menos ruidos por tokens legislativos

## 5. E possivel montar uma avaliacao pequena, mas formal, da busca semantica?

Por que isso importa: hoje a recuperacao tem exemplos plausiveis, mas nao tem benchmark. Esse e provavelmente o principal ponto tecnico faltante do artigo.

Sugestoes de resposta:

1. "Podemos anotar 15 a 30 consultas reais, com relevancia binaria ou em tres niveis, e reportar Precision@5 e nDCG@10."
2. "Se o tempo for curto, uma avaliacao com 10 consultas e julgamento manual dos top-10 ja e melhor do que depender apenas de um exemplo ilustrativo."
3. "Tambem podemos comparar dois cenarios simples: busca sobre ementa bruta versus busca sobre acao textualizada."

R: Você consegue realizar essa análise sozinho utilizando o código do projeto como base?

## 6. Como voce quer enquadrar a analise com indicadores para evitar leitura causal?

Por que isso importa: o texto ja diz que a analise nao e causal, mas alguns trechos dos resultados ainda podem soar como evidencia de efetividade da politica.

Sugestoes de resposta:

1. "Vamos reposicionar essa etapa como mecanismo de priorizacao exploratoria de politicas recorrentes, e nao como avaliacao de impacto."
2. "Os resultados devem ser descritos como associacoes observadas apos a proposicao legislativa, sem inferencia de efeito da politica."
3. "Podemos trocar verbos como 'funcionou' ou 'gerou efeito' por formulacoes mais seguras, como 'coincidiu com variacao favoravel do indicador'."

R: Utilize as sugestões de resposta

## 7. Qual e a justificativa metodologica para usar homicidios como proxy no estudo de caso sobre violencia contra a mulher?

Por que isso importa: esse e um ponto vulneravel. Um revisor pode questionar a aderencia entre o problema tematico e o indicador observado.

Sugestoes de resposta:

1. "A justificativa e pragmatica: o indicador esta disponivel de forma padronizada e com cobertura suficiente, servindo apenas como proxy inicial para demonstracao do pipeline."
2. "O texto deve admitir explicitamente que homicidios nao medem violencia contra a mulher de forma especifica e que esse recorte foi escolhido por disponibilidade de dados."
3. "Se possivel, vamos acrescentar uma frase dizendo que futuros ciclos devem substituir ou complementar esse proxy com feminicidio, violencia domestica notificada ou medidas setoriais mais aderentes."

R: Aceite as sugestões

## 8. O que fazer com a contribuicao da plataforma web (C5)?

Por que isso importa: a contribuicao C5 aparece na introducao, mas o artigo hoje quase nao mostra evidencia dessa plataforma alem de uma frase de implementacao.

Sugestoes de resposta:

1. "Se a interface nao sera avaliada, e melhor rebaixar C5 de contribuicao central para artefato de demonstracao do pipeline."
2. "Se houver uma captura de tela boa e um fluxo de uso claro, podemos manter C5 e mostrar a plataforma como prova de operacionalizacao."
3. "Outra opcao e reformular C5 como 'disponibilizacao de uma implementacao web funcional', sem alegar avaliacao de usabilidade."

R: A plataforma web está disponível em "https://sonar-municipal.vercel.app/"

## 9. Qual nivel de reproducibilidade voce consegue prometer e entregar no artigo final?

Por que isso importa: reprodutibilidade e um ponto forte natural do paper, mas o texto ainda nao explicita exatamente o que esta disponivel para terceiros reproduzirem.

Sugestoes de resposta:

1. "Vamos dizer explicitamente que o repositorio inclui scripts de coleta, treinamento, indexacao, interface, prompt do tradutor e lista congelada de instancias SAPL."
2. "Se houver restricoes de redistribuicao da base completa, o artigo deve explicar o que pode ser reproduzido via script e o que depende de disponibilidade externa das APIs."
3. "Tambem vale informar seeds, data do snapshot, versoes de modelo e configuracoes minimas para rerun."

R: Vamos dizer explicitamente que o repositorio inclui scripts de coleta, treinamento, indexacao, interface, prompt do tradutor e lista congelada de instancias SAPL.

## 10. Qual decisao voce quer tomar sobre a contaminacao residual por itens que nao sao PLs estritos?

Por que isso importa: o artigo ja admite 3,54% de contaminacao. O problema nao e fatal, mas precisa de uma decisao clara para nao parecer um detalhe solto.

Sugestoes de resposta:

1. "Vamos manter esses itens nesta versao e enquadra-los como ruido residual de coleta, sem impacto estrutural nas conclusoes exploratorias."
2. "Vamos filtrar pelo menos os tipos mais obviamente fora do escopo, como veto e substitutivo, e atualizar os numeros finais."
3. "Se nao houver novo processamento, o texto deve dizer claramente que os resultados valem para 'proposicoes legislativas proximas de PL' e nao apenas para PLs estritos."

R: Vamos manter esses itens nesta versao e enquadra-los como ruido residual de coleta, sem impacto estrutural nas conclusoes exploratorias.

## 11. Que tipo de evidencia adicional voce ainda consegue inserir sem aumentar demais o artigo?

Por que isso importa: a versao esta em 8 paginas, entao ainda ha espaco para um pequeno ganho de robustez sem estourar o limite.

Sugestoes de resposta:

1. "Inserir uma tabela curta com 10 a 20 consultas anotadas e metricas de recuperacao."
2. "Inserir uma tabela curta comparando ementa bruta versus acao textualizada em um conjunto pequeno de exemplos."
3. "Inserir uma figura unica da interface com legenda objetiva, se a plataforma continuar como contribuicao."

R: Inserir uma tabela curta comparando ementa bruta versus acao textualizada em um conjunto pequeno de exemplos. Inserir uma figura unica da interface com legenda objetiva, se a plataforma continuar como contribuicao.

## 12. Qual e o posicionamento final para a CTIC: artefato de governo digital, IR aplicada ou NLP aplicada?

Por que isso importa: pareceres costumam ficar mais favoraveis quando o texto conversa com uma comunidade de forma nitida. Hoje o paper flerta com varias.

Sugestoes de resposta:

1. "O enquadramento principal sera governo digital e sistemas de informacao aplicados ao setor publico, usando NLP e IR como meios tecnicos."
2. "O paper sera apresentado como sistema aplicado de apoio a formulacao de politicas, e nao como competidor de estado da arte em NLP."
3. "A mensagem central para a CTIC e que o artigo transforma dados legislativos municipais dispersos em infraestrutura informacional utilizavel por gestores e analistas."

R: A mensagem central para a CTIC e que o artigo transforma dados legislativos municipais dispersos em infraestrutura informacional utilizavel por gestores e analistas.

## 13. Que ajustes de linguagem podem reduzir risco de parecer por overclaim?

Por que isso importa: varios trechos estao bons tecnicamente, mas algumas formulacoes ainda soam mais fortes do que a evidencia sustenta.

Sugestoes de resposta:

1. "Trocar 'recomendacao de politicas' por 'apoio exploratorio a identificacao de politicas similares' nos trechos mais sensiveis."
2. "Trocar 'validar o metodo' por 'apresentar evidencia preliminar de utilidade do metodo'."
3. "Trocar 'efeitos favoraveis' por 'variacoes favoraveis do indicador dentro da janela observada'."

R: Aceite as sugestões

## 14. O que voce quer que o parecerista retenha ao terminar a leitura?

Por que isso importa: a conclusao precisa fechar com uma mensagem simples e forte. Sem isso, o artigo pode parecer apenas um prototipo promissor ainda incompleto.

Sugestoes de resposta:

1. "Mesmo com validacao ainda parcial, o artigo entrega uma infraestrutura concreta e reprodutivel para explorar legislacao municipal em escala antes inacessivel."
2. "O valor principal do trabalho e abrir um caminho pratico para comparar iniciativas legislativas municipais e apoiar aprendizado entre cidades."
3. "A mensagem final deve ser: o sistema ja e util como ferramenta exploratoria, e a proxima etapa natural e fortalecer a validacao quantitativa."

R: Mesmo com validacao ainda parcial, o artigo entrega uma infraestrutura concreta e reprodutivel para explorar legislacao municipal em escala antes inacessivel.

## Prioridade recomendada

Se voce tiver pouco tempo, responda nesta ordem:

1. Perguntas 1, 3, 5 e 6.
2. Perguntas 2, 7, 8 e 13.
3. Perguntas 9, 10, 11, 12 e 14.
