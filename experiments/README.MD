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

## Artefatos publicados (Hugging Face)
O dataset e o modelo do projeto estão publicados no Hugging Face Hub — o caminho rápido parte
deles e não exige scraping:

| Artefato | Hub |
| --- | --- |
| Dataset (corpus + pares de treino) | [`thiagoambiel/sonar-municipal-pl-actions`](https://huggingface.co/datasets/thiagoambiel/sonar-municipal-pl-actions) |
| Modelo (ementa → ação) | [`thiagoambiel/sonar_municipal_ptt5_ementa2action`](https://huggingface.co/thiagoambiel/sonar_municipal_ptt5_ementa2action) |

## Guias e atalhos
| Link | Descrição |
| --- | --- |
| [![DATASET.MD](https://img.shields.io/badge/DATASET.MD-Guia%20de%20Dataset-2D9CDB?style=for-the-badge)](DATASET.MD) | Como obter `dataset.npy` (caminho rápido via Hugging Face) e a collection do Qdrant. |
| [![core](https://img.shields.io/badge/core-Documenta%C3%A7%C3%A3o%20do%20M%C3%B3dulo-1565C0?style=for-the-badge)](core/README.MD) | Documentação do módulo `core` com funções de busca, embeddings e políticas. |
| [![sapl_finder](https://img.shields.io/badge/sapl__finder-Descoberta%20SAPL-2E7D32?style=for-the-badge)](tools/sapl_finder/README.MD) | CLI para descobrir instâncias do sistema SAPL e gerar `sapl_hosts.jsonl` (caminho do zero). |
| [![sapl_scrapper](https://img.shields.io/badge/sapl__scrapper-Raspagem%20de%20PLs-7B1FA2?style=for-the-badge)](tools/sapl_scrapper/README.MD) | CLI para raspar PLs das instâncias encontradas e salvar `pl.jsonl` (caminho do zero). |

## O que já está implementado
- Módulo `core/` para embeddings, busca semântica e agrupamento de políticas.
- Construção do `dataset.npy` a partir do dataset publicado no Hugging Face.
- Indexação vetorial no Qdrant para a plataforma (`notebooks/upload_data_to_qdrant.ipynb`).
- Caminho do zero: descoberta no sistema SAPL (`tools/sapl_finder`), raspagem de PLs
  (`tools/sapl_scrapper`) e transformação de ementas em ações com o modelo PTT5 publicado.
- Notebooks de análises e fine-tuning do modelo.

## Atalhos de execução

**Caminho rápido (recomendado) — a partir do Hugging Face:**
- Montar o `dataset.npy` (baixa o corpus publicado e gera os embeddings): rode
  `notebooks/SonarMunicipal_Build_the_Base_Action_Recommendation_Dataset.ipynb`. Passo a passo em
  `DATASET.MD`.
- Hospedar a plataforma (collection Qdrant `projetos-de-lei`): rode
  `notebooks/upload_data_to_qdrant.ipynb` e configure `QDRANT_*` + `HF_API_TOKEN` no `.env.local`.

**Caminho do zero (opcional) — para atualizar/auditar a coleta:**
```bash
python tools/sapl_finder/sapl_finder.py --concurrency 200 --out-jsonl data/sapl_hosts.jsonl
python tools/sapl_scrapper/sapl_scrapper.py --in-jsonl data/sapl_hosts.jsonl --out-jsonl data/pl.jsonl
```
Depois gere as ações com o modelo e monte o dataset — detalhes em `DATASET.MD`.

## Estrutura do diretório
- `core/`: funções de dados, embeddings, busca e políticas.
- `tools/`: scripts de descoberta e raspagem.
- `notebooks/`: geração de ações, embeddings e análises.
