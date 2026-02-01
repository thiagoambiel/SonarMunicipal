![](../public/logo.png)

[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![SAPL](https://img.shields.io/badge/SAPL-Coleta%20de%20PLs-2E7D32?style=for-the-badge)](https://sapl.senado.leg.br/)
[![HuggingFace](https://img.shields.io/badge/Hugging%20Face-Modelos%20e%20Embeddings-FFD21E?style=for-the-badge&logo=huggingface&logoColor=000)](https://huggingface.co/)
[![Qdrant](https://img.shields.io/badge/Qdrant-Banco%20Vetorial-FF4F8B?style=for-the-badge)](https://qdrant.tech/)

Este diretório reúne o pipeline completo de dados do Sonar Municipal: descoberta de
instâncias do SAPL, coleta de projetos de lei, transformação de ementas em ações,
indexação vetorial e análises com indicadores oficiais.

# Como funciona?
```mermaid
flowchart LR
  E1["Lista de municípios (IBGE)"] --> E2["Descoberta de instâncias do SAPL"]
  E2 --> E3["Extração de PLs"]
  E3 --> E4["Transformação de ementas em ações"]
  E4 --> E5["Indexação vetorial (Qdrant)"]
  E5 --> E6["Indicadores oficiais + Agrupamento"]
```
<p align="center">
  <b>Figura 1:</b> Pipeline conceitual do Sonar Municipal.
</p>

## Guias e atalhos
| Link | Descrição |
| --- | --- |
| [![DATASET.MD](https://img.shields.io/badge/DATASET.MD-Guia%20de%20Dataset-2D9CDB?style=for-the-badge)](DATASET.MD) | Passo a passo para reconstruir o dataset final (`dataset.npy`). |
| [![core](https://img.shields.io/badge/core-Documenta%C3%A7%C3%A3o%20do%20M%C3%B3dulo-1565C0?style=for-the-badge)](core/README.MD) | Documentação do módulo `core` com funções de busca, embeddings e políticas. |
| [![sapl_finder](https://img.shields.io/badge/sapl__finder-Descoberta%20SAPL-2E7D32?style=for-the-badge)](tools/sapl_finder/README.MD) | CLI para descobrir instâncias do SAPL e gerar `sapl_hosts.jsonl`. |
| [![sapl_scrapper](https://img.shields.io/badge/sapl__scrapper-Raspagem%20de%20PLs-7B1FA2?style=for-the-badge)](tools/sapl_scrapper/README.MD) | CLI para raspar PLs das instâncias encontradas e salvar `pl.jsonl`. |

## O que já está implementado
- Descoberta de instâncias do SAPL (`tools/sapl_finder`).
- Raspagem de PLs (`tools/sapl_scrapper`).
- Transformação de ementas em ações (modelos HuggingFace).
  - Referência: `notebooks/sonar-municipal-ptt5-v2-fine-tuning-ementa2action.ipynb`.
- Módulo `core/` para embeddings, busca semântica e agrupamento de políticas.
- Notebooks para construção do dataset e análises com indicadores.

## Atalhos de execução
- Descobrir instâncias do SAPL:
  ```bash
  python tools/sapl_finder/sapl_finder.py --concurrency 200 --out-jsonl data/sapl_hosts.jsonl
  ```
- Raspar PLs:
  ```bash
  python tools/sapl_scrapper/sapl_scrapper.py --in-jsonl data/sapl_hosts.jsonl --out-jsonl data/pl.jsonl
  ```
- Reconstruir o dataset:
  Consulte o guia detalhado em `DATASET.MD`.

## Estrutura do diretório
- `core/`: funções de dados, embeddings, busca e políticas.
- `tools/`: scripts de descoberta e raspagem.
- `notebooks/`: geração de ações, embeddings e análises.
