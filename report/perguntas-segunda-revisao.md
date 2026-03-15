# Perguntas para a Próxima Revisão do Artigo

Este arquivo substitui a versão anterior de revisão. As respostas já incorporadas no paper atual incluem:

1. título sem ``Sonar Municipal'';
2. seção de trabalhos relacionados estruturada;
3. organização dos resultados em cinco subseções;
4. gráfico regional;
5. estudo de caso único sobre violência contra a mulher;
6. três clusters ilustrativos;
7. tabela com falhas observadas;
8. explicitação do limiar de Jaccard em 0,75;
9. manutenção do escore heurístico $Q$;
10. manutenção dos outliers temporais e dos não-PLs como limitação.

O foco agora é apenas no que ainda falta para uma versão mais madura de submissão.

Observação: os exemplos abaixo são modelos curtos de resposta. Use, adapte ou descarte conforme o que for verdadeiro no projeto.

---

## 1. Bibliografia final

1. Quais referências você quer transformar em entradas definitivas no [`sonar-references.bib`](/home/thiago/Projects/IC/AIPolicy/CityManager/report/sonar-references.bib)?
Por que isso importa: a seção de relacionados já está montada, mas ainda falta fechar a bibliografia enxuta e formal.
Exemplos:
- Vou fechar SAPL, LexML, Ulysses, UlyssesNER-Br e dois trabalhos de policy transfer.
- Quero uma bibliografia curta com 8 a 10 referências centrais.
- Vou priorizar só as referências diretamente comparáveis ao pipeline.
Resposta:

2. Você quer citar formalmente também o trabalho de clustering semântico de emendas legislativas mencionado em [`trabalhos_relacionados.md`](/home/thiago/Projects/IC/AIPolicy/CityManager/report/trabalhos_relacionados.md)?
Por que isso importa: ele conversa diretamente com a parte de agrupamento do artigo.
Exemplos:
- Sim. Esse trabalho é importante para posicionar melhor a parte de clustering.
- Talvez. Só vou incluir se conseguir uma entrada bibliográfica completa.
- Não. Vou manter a bibliografia mais enxuta.
Resposta:

---

## 2. Avaliação do tradutor

3. Você quer incluir ao menos um baseline explícito para o tradutor \textit{ementa} $\rightarrow$ \textit{ação}?
Sugestões viáveis nesta rodada:
- usar a ementa bruta como baseline;
- usar um prompt zero-shot;
- usar os dois.
Exemplos:
- Vou comparar contra a ementa bruta.
- Vou usar ementa bruta e prompt zero-shot.
- Não vou incluir baseline nesta rodada e vou manter isso como limitação.
Resposta:

4. Você quer adicionar uma avaliação humana simples do tradutor?
Formato mínimo sugerido: amostra pequena com notas para fidelidade, clareza e utilidade.
Exemplos:
- Sim. Vou avaliar manualmente 20 exemplos.
- Sim, mas só de forma informal e descritiva.
- Não. Vou manter apenas a avaliação automática atual.
Resposta:

---

## 3. Interface e submissão

5. De onde sairá a captura de tela da interface principal?
Por que isso importa: o artigo agora já prevê essa figura, mas o repositório ainda não contém a imagem final.
Exemplos:
- Vou gerar uma captura nova da tela inicial da plataforma.
- Vou usar uma tela de resultados com consulta e recomendações.
- Não vou usar captura de tela nesta submissão.
Resposta:

6. Você quer ajustar explicitamente o paper ao enquadramento do CTIC na próxima rodada?
Possibilidades:
- deixar mais claro o caráter de iniciação científica;
- encurtar alguns blocos metodológicos;
- enfatizar contribuição prática e formação científica.
Exemplos:
- Sim. Quero adaptar o texto ao CTIC na próxima revisão.
- Só depois de fechar bibliografia e figuras.
- Não. Primeiro quero estabilizar o conteúdo científico.
Resposta:

---

## Próximo passo ideal

Depois de responder este arquivo, a sequência mais eficiente é:

1. fechar a bibliografia no `.bib`;
2. decidir a avaliação extra do tradutor;
3. adicionar a figura da interface;
4. fazer a passada final de adequação ao CTIC.
