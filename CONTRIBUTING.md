# Contribuindo com o Sonar Municipal

Este repositório é o componente de código-fonte que acompanha o Trabalho de Conclusão de Curso
*"Sonar Municipal"* (Thiago Ambiel, ICMC-USP, 2026). Ele também é a origem (*upstream*) do registro
de software no Zenodo `10.5281/zenodo.20387514`, que é re-arquivado automaticamente a cada release
publicado no GitHub.

## Sumário

- [Política de releases e tags](#política-de-releases-e-tags)
- [Versionamento](#versionamento)
- [Pull requests](#pull-requests)
- [Licença](#licença)
- [Contato](#contato)

## Política de releases e tags

**Releases com tag são imutáveis.** Assim que uma tag no formato `v*.*.*` é enviada para a
`origin` e um release correspondente é criado no GitHub, o webhook do Zenodo emite um DOI de
arquivamento atrelado ao tarball daquele release. Para manter o DOI publicado e o histórico
visível no GitHub consistentes:

- **Sem `force-push` sobre uma tag publicada.** Para desfazer um release com tag, publique uma nova
  versão de correção (ex.: `v1.0.1`) — nunca reescreva o histórico em `v1.0.0` ou antes dele.
- **Sem exclusão de releases com tag.** Os artefatos de um release no GitHub podem ser ajustados
  (notas, arquivos anexos), mas a tag subjacente deve continuar apontando para o mesmo commit.
- **Proteção de tags.** O mantenedor habilita a proteção de tags para o padrão `v*` em
  *Settings → Tags → Protected tags* para garantir as regras acima.

## Versionamento

O projeto segue o [Versionamento Semântico](https://semver.org/lang/pt-BR/):

- `MAJOR` — mudanças incompatíveis na API (ex.: na interface do pipeline).
- `MINOR` — novas funcionalidades compatíveis com versões anteriores (ex.: um novo recuperador).
- `PATCH` — correções de bugs.

O dataset, o modelo e a tese que acompanham o projeto seguem o mesmo versionamento `MAJOR.MINOR`
no nível de cada registro. A linha atual de releases é:

- **v1.0.0** — release público canônico.
- **v1.x.x** — melhorias incrementais, se houver.

## Pull requests

Contribuições externas são bem-vindas, especialmente:

- correções de bugs no pipeline de recuperação ou nos scripts de avaliação;
- melhorias e traduções de documentação;
- novos baselines de recuperação, seguindo o padrão `control-experiments`.

Por favor, abra uma *issue* antes descrevendo a mudança proposta. Ao enviar um pull request, a
pessoa contribuidora concorda em licenciar sua contribuição sob a Licença MIT deste repositório.

## Licença

MIT — veja [LICENSE](LICENSE).

## Contato

Thiago Ambiel — <thiago.ambiel@usp.br>
