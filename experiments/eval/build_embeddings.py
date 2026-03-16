from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, List

import numpy as np

from common import (
    DEFAULT_MODEL_NAME,
    choose_device,
    deduplicate_rows,
    encode_texts,
    ensure_dir,
    load_dataset,
    load_model,
    load_problems,
    save_json,
    utc_now_iso,
    write_jsonl,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Gera embeddings para ementas, acoes e problemas pre-definidos."
    )
    parser.add_argument(
        "--dataset-path",
        type=Path,
        default=Path("experiments/data/dataset.npy"),
        help="Caminho para o dataset.npy original.",
    )
    parser.add_argument(
        "--problems-path",
        type=Path,
        default=Path("experiments/eval/problems.jsonl"),
        help="Arquivo JSONL com os problemas pre-definidos.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("experiments/eval/artifacts"),
        help="Diretorio onde os artefatos auxiliares serao salvos.",
    )
    parser.add_argument(
        "--model-name",
        default=DEFAULT_MODEL_NAME,
        help="Modelo de embeddings.",
    )
    parser.add_argument(
        "--device",
        default=None,
        help="Device do SentenceTransformer. Padrao: cuda se disponivel, senao cpu.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=256,
        help="Batch size de codificacao.",
    )
    parser.add_argument(
        "--dtype",
        choices=["float16", "float32"],
        default="float16",
        help="Tipo numerico usado ao salvar as matrizes de embeddings.",
    )
    parser.add_argument(
        "--dedupe-mode",
        choices=["text_pair", "ementa", "acao", "source"],
        default="text_pair",
        help="Estrategia de deduplicacao do corpus.",
    )
    parser.add_argument(
        "--document-prefix",
        default="",
        help="Prefixo dos documentos. Deixe vazio para reproduzir o dataset atual; use 'passage: ' se quiser variante E5 classica.",
    )
    parser.add_argument(
        "--query-prefix",
        default="query: ",
        help="Prefixo das queries de problema.",
    )
    return parser


def build_metadata_rows(rows: List[Dict]) -> List[Dict]:
    metadata: List[Dict] = []
    for row in rows:
        metadata.append(
            {
                "doc_id": row["doc_id"],
                "municipio": row.get("municipio"),
                "uf": row.get("uf"),
                "tipo_id": row.get("tipo_id"),
                "tipo_label": row.get("tipo_label"),
                "materia_id": row.get("materia_id"),
                "numero": row.get("numero"),
                "ano": row.get("ano"),
                "data_apresentacao": row.get("data_apresentacao"),
                "em_tramitacao": row.get("em_tramitacao"),
                "situacao": row.get("situacao"),
                "sapl_base": row.get("sapl_base"),
                "sapl_url": row.get("sapl_url"),
                "link_publico": row.get("link_publico"),
                "ementa": row.get("ementa"),
                "acao": row.get("acao"),
            }
        )
    return metadata


def main() -> None:
    args = build_parser().parse_args()
    output_dir = ensure_dir(args.output_dir)

    dataset = load_dataset(args.dataset_path)
    deduped_rows = deduplicate_rows(dataset, mode=args.dedupe_mode)
    metadata_rows = build_metadata_rows(deduped_rows)
    metadata_path = output_dir / "corpus_dedup.jsonl"
    write_jsonl(metadata_path, metadata_rows)

    problems = load_problems(args.problems_path)
    if not problems:
        raise ValueError(f"Nenhum problema encontrado em {args.problems_path}")

    device = choose_device(args.device)
    model = load_model(args.model_name, device=device)

    ementas = [row["ementa"] for row in deduped_rows]
    acoes = [row["acao"] for row in deduped_rows]
    queries = [problem.query for problem in problems]

    ementa_embeddings = encode_texts(
        model,
        ementas,
        batch_size=args.batch_size,
        normalize_embeddings=True,
        prefix=args.document_prefix,
        dtype=args.dtype,
    )
    acao_embeddings = encode_texts(
        model,
        acoes,
        batch_size=args.batch_size,
        normalize_embeddings=True,
        prefix=args.document_prefix,
        dtype=args.dtype,
    )
    query_embeddings = encode_texts(
        model,
        queries,
        batch_size=args.batch_size,
        normalize_embeddings=True,
        prefix=args.query_prefix,
        dtype="float32",
    )

    ementa_embeddings_path = output_dir / "embeddings_ementas.npy"
    acao_embeddings_path = output_dir / "embeddings_acoes.npy"
    query_embeddings_path = output_dir / "embeddings_queries.npy"
    np.save(ementa_embeddings_path, ementa_embeddings)
    np.save(acao_embeddings_path, acao_embeddings)
    np.save(query_embeddings_path, query_embeddings)

    problems_path = output_dir / "problems_resolved.jsonl"
    write_jsonl(problems_path, (problem.to_dict() for problem in problems))

    manifest = {
        "created_at_utc": utc_now_iso(),
        "dataset_path": str(args.dataset_path),
        "problems_path": str(args.problems_path),
        "corpus_path": str(metadata_path),
        "problem_records_path": str(problems_path),
        "ementa_embeddings_path": str(ementa_embeddings_path),
        "acao_embeddings_path": str(acao_embeddings_path),
        "query_embeddings_path": str(query_embeddings_path),
        "model_name": args.model_name,
        "device": device,
        "batch_size": args.batch_size,
        "dtype": args.dtype,
        "document_prefix": args.document_prefix,
        "query_prefix": args.query_prefix,
        "dedupe_mode": args.dedupe_mode,
        "num_rows_original": len(dataset),
        "num_rows_deduped": len(deduped_rows),
        "num_problems": len(problems),
    }
    save_json(output_dir / "manifest.json", manifest)

    print(
        "Artefatos gerados com sucesso:\n"
        f"- corpus deduplicado: {metadata_path}\n"
        f"- embeddings ementas: {ementa_embeddings_path}\n"
        f"- embeddings acoes: {acao_embeddings_path}\n"
        f"- embeddings queries: {query_embeddings_path}\n"
        f"- manifest: {output_dir / 'manifest.json'}"
    )


if __name__ == "__main__":
    main()
