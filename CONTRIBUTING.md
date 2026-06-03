# Contributing — Sonar Municipal

This repository is the source-code companion to the ICMC-USP
undergraduate thesis *"Sonar Municipal"* (Thiago Ambiel, 2026). It is
also the upstream for the Zenodo software record
`10.5281/zenodo.20387514`, which is automatically
re-archived on every published GitHub release.

## Release & tagging policy

**Tagged releases are immutable.** Once a tag in the form `v*.*.*` is
pushed to `origin` and a corresponding GitHub release is created, the
Zenodo webhook mints an archival DOI tied to that release tarball. To
keep the published DOI and the GitHub-visible history consistent:

- **No force-push past a published tag.** If you need to undo a tagged
  release, mint a new patch version instead (e.g., `v1.0.1`) — never
  rewrite history at or before `v1.0.0`.
- **No deletion of tagged releases.** GitHub release artifacts may be
  amended (release notes, attached files) but the underlying tag must
  remain pointing at the same commit.
- **Branch protection**: the repository owner enables tag protection
  for the pattern `v*` via *Settings → Tags → Protected tags* to
  enforce the above.

## Versioning

This project follows [Semantic Versioning](https://semver.org):

- `MAJOR` — breaking API changes (e.g., pipeline interface).
- `MINOR` — new functionality, non-breaking (e.g., a new retriever).
- `PATCH` — bug fixes.

The companion dataset, model, and thesis follow the same MAJOR.MINOR
versioning at the record level. The current line of releases is:

- **v1.0.0** — canonical public release.
- **v1.x.x** — incremental improvements, if any.

## Pull requests

External contributions are welcome, especially:

- Bug fixes in the retrieval pipeline or evaluation scripts.
- Documentation improvements and translation.
- New retrieval baselines added under the `control-experiments`
  pattern.

Please open an issue first describing the proposed change. By
submitting a pull request, contributors agree to license their
contributions under the MIT License of this repository.

## License

MIT — see [LICENSE](LICENSE).

## Contact

Thiago Ambiel — <thiago.ambiel@usp.br>
