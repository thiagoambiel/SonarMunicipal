from __future__ import annotations

import argparse
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence, Tuple

import numpy as np

from common import (
    iter_jsonl,
    l2_normalize_rows,
    load_json,
    normalize_for_dedupe,
    read_jsonl,
    save_json,
    write_jsonl,
)

TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Gera recomendacoes top-k para ementas e acoes e calcula metricas quando houver qrels."
    )
    parser.add_argument(
        "--manifest-path",
        type=Path,
        default=Path("experiments/eval/artifacts/manifest.json"),
        help="Manifest gerado pelo build_embeddings.py.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("experiments/eval/outputs"),
        help="Diretorio dos arquivos de saida.",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=50,
        help="Quantidade de recomendacoes por problema.",
    )
    parser.add_argument(
        "--qrels-path",
        type=Path,
        default=None,
        help="Arquivo JSONL anotado com relevancia humana para calcular metricas.",
    )
    parser.add_argument(
        "--annotation-pool-path",
        type=Path,
        default=None,
        help="Se informado, salva um pool de candidatos para anotacao humana.",
    )
    parser.add_argument(
        "--bm25-k1",
        type=float,
        default=1.5,
        help="Parametro k1 do BM25.",
    )
    parser.add_argument(
        "--bm25-b",
        type=float,
        default=0.75,
        help="Parametro b do BM25.",
    )
    return parser


def load_artifacts(manifest_path: Path) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]], np.ndarray, np.ndarray, np.ndarray]:
    manifest = load_json(manifest_path)
    corpus = read_jsonl(Path(manifest["corpus_path"]))
    problems = read_jsonl(Path(manifest["problem_records_path"]))
    ementa_embeddings = np.load(manifest["ementa_embeddings_path"])
    acao_embeddings = np.load(manifest["acao_embeddings_path"])
    query_embeddings = np.load(manifest["query_embeddings_path"])
    return corpus, problems, ementa_embeddings, acao_embeddings, query_embeddings


def top_k_indices(scores: np.ndarray, k: int) -> np.ndarray:
    if k <= 0:
        return np.asarray([], dtype=np.int64)
    safe_k = min(k, scores.shape[0])
    if safe_k == 0:
        return np.asarray([], dtype=np.int64)
    idx = np.argpartition(-scores, safe_k - 1)[:safe_k]
    return idx[np.argsort(-scores[idx])]


def tokenize_for_bm25(text: str) -> List[str]:
    normalized = normalize_for_dedupe(text)
    return TOKEN_PATTERN.findall(normalized)


def approach_field_prefix(approach: str) -> str:
    if approach == "ementas":
        return "ementa"
    if approach == "acoes":
        return "acao"
    return approach


def build_ranked_output(
    problem: Dict[str, Any],
    corpus: Sequence[Dict[str, Any]],
    scores: np.ndarray,
    ranking: np.ndarray,
    approach: str,
    top_k: int,
) -> Dict[str, Any]:
    recommendations: List[Dict[str, Any]] = []
    for rank, idx in enumerate(ranking, start=1):
        row = corpus[int(idx)]
        recommendations.append(
            {
                "rank": rank,
                "doc_id": row["doc_id"],
                "similarity_score": float(scores[idx]),
                "municipio": row.get("municipio"),
                "uf": row.get("uf"),
                "materia_id": row.get("materia_id"),
                "numero": row.get("numero"),
                "ano": row.get("ano"),
                "data_apresentacao": row.get("data_apresentacao"),
                "tipo_label": row.get("tipo_label"),
                "link_publico": row.get("link_publico"),
                "sapl_url": row.get("sapl_url"),
                "ementa": row.get("ementa"),
                "acao": row.get("acao"),
            }
        )

    return {
        "problem_id": problem["problem_id"],
        "problem_name": problem["name"],
        "query": problem["query"],
        "category": problem.get("category"),
        "description": problem.get("description"),
        "approach": approach,
        "top_k": top_k,
        "recommendations": recommendations,
    }


def rank_problem(
    problem: Dict[str, Any],
    query_vector: np.ndarray,
    corpus: Sequence[Dict[str, Any]],
    doc_embeddings: np.ndarray,
    top_k: int,
    approach: str,
) -> Dict[str, Any]:
    scores = doc_embeddings @ query_vector
    ranking = top_k_indices(scores, top_k)
    return build_ranked_output(problem, corpus, scores, ranking, approach, top_k)


def build_bm25_index(
    corpus: Sequence[Dict[str, Any]],
    *,
    text_field: str,
    k1: float,
    b: float,
) -> Dict[str, Any]:
    postings: Dict[str, List[Tuple[int, int]]] = defaultdict(list)
    doc_lengths = np.zeros(len(corpus), dtype=np.int32)

    for idx, row in enumerate(corpus):
        tokens = tokenize_for_bm25(str(row.get(text_field) or ""))
        doc_lengths[idx] = len(tokens)
        term_counts = defaultdict(int)
        for token in tokens:
            term_counts[token] += 1
        for term, tf in term_counts.items():
            postings[term].append((idx, tf))

    num_docs = len(corpus)
    avg_doc_length = float(np.mean(doc_lengths)) if num_docs else 0.0
    return {
        "postings": postings,
        "idf": {
            term: float(np.log1p((num_docs - len(posting) + 0.5) / (len(posting) + 0.5)))
            for term, posting in postings.items()
        },
        "doc_lengths": doc_lengths,
        "avg_doc_length": avg_doc_length,
        "k1": float(k1),
        "b": float(b),
    }


def rank_problem_bm25(
    problem: Dict[str, Any],
    corpus: Sequence[Dict[str, Any]],
    bm25_index: Dict[str, Any],
    top_k: int,
    approach: str,
) -> Dict[str, Any]:
    scores = np.zeros(len(corpus), dtype=np.float32)
    query_terms = tokenize_for_bm25(str(problem["query"]))
    doc_lengths = bm25_index["doc_lengths"]
    avg_doc_length = bm25_index["avg_doc_length"] or 1.0
    k1 = bm25_index["k1"]
    b = bm25_index["b"]

    for term in query_terms:
        posting = bm25_index["postings"].get(term)
        if not posting:
            continue
        idf = bm25_index["idf"][term]
        for idx, tf in posting:
            norm = k1 * (1.0 - b + b * (float(doc_lengths[idx]) / avg_doc_length))
            scores[idx] += idf * ((tf * (k1 + 1.0)) / (tf + norm))

    ranking = top_k_indices(scores, top_k)
    return build_ranked_output(problem, corpus, scores, ranking, approach, top_k)


def load_qrels(path: Path) -> Dict[str, Dict[str, int]]:
    qrels: Dict[str, Dict[str, int]] = defaultdict(dict)
    for row in iter_jsonl(path):
        problem_id = str(row["problem_id"]).strip()
        doc_id = str(row["doc_id"]).strip()
        relevance = int(row["relevance"])
        qrels[problem_id][doc_id] = relevance
    return qrels


def precision_at_k(relevances: Sequence[int], k: int) -> float:
    values = list(relevances[:k])
    if not values:
        return 0.0
    return float(sum(1 for rel in values if rel > 0) / len(values))


def recall_at_k(relevances: Sequence[int], total_relevant: int, k: int) -> float:
    if total_relevant <= 0:
        return 0.0
    return float(sum(1 for rel in relevances[:k] if rel > 0) / total_relevant)


def reciprocal_rank_at_k(relevances: Sequence[int], k: int) -> float:
    for idx, rel in enumerate(relevances[:k], start=1):
        if rel > 0:
            return 1.0 / idx
    return 0.0


def average_precision_at_k(relevances: Sequence[int], total_relevant: int, k: int) -> float:
    if total_relevant <= 0:
        return 0.0
    hits = 0
    score = 0.0
    for idx, rel in enumerate(relevances[:k], start=1):
        if rel > 0:
            hits += 1
            score += hits / idx
    return float(score / total_relevant)


def dcg_at_k(relevances: Sequence[int], k: int) -> float:
    score = 0.0
    for idx, rel in enumerate(relevances[:k], start=1):
        score += (2**rel - 1) / np.log2(idx + 1)
    return float(score)


def ndcg_at_k(relevances: Sequence[int], ideal_relevances: Sequence[int], k: int) -> float:
    ideal = dcg_at_k(ideal_relevances, k)
    if ideal == 0:
        return 0.0
    return float(dcg_at_k(relevances, k) / ideal)


def evaluate_run(run: Sequence[Dict[str, Any]], qrels: Dict[str, Dict[str, int]], k: int) -> Dict[str, Any]:
    per_problem: List[Dict[str, Any]] = []
    aggregate_metrics = defaultdict(list)

    for problem_row in run:
        problem_id = problem_row["problem_id"]
        judgments = qrels.get(problem_id, {})
        ranked_docs = problem_row["recommendations"]
        relevances = [int(judgments.get(doc["doc_id"], 0)) for doc in ranked_docs]
        ideal = sorted(judgments.values(), reverse=True)
        total_relevant = sum(1 for rel in judgments.values() if rel > 0)

        metrics = {
            "problem_id": problem_id,
            "problem_name": problem_row["problem_name"],
            "num_qrels": len(judgments),
            "num_relevant_qrels": total_relevant,
            "precision_at_k": precision_at_k(relevances, k),
            "recall_at_k": recall_at_k(relevances, total_relevant, k),
            "mrr_at_k": reciprocal_rank_at_k(relevances, k),
            "map_at_k": average_precision_at_k(relevances, total_relevant, k),
            "ndcg_at_k": ndcg_at_k(relevances, ideal, k),
        }
        per_problem.append(metrics)
        for key, value in metrics.items():
            if key.startswith(("precision", "recall", "mrr", "map", "ndcg")):
                aggregate_metrics[key].append(value)

    summary = {
        "num_problems_evaluated": len(per_problem),
        "mean_precision_at_k": float(np.mean(aggregate_metrics["precision_at_k"])) if per_problem else 0.0,
        "mean_recall_at_k": float(np.mean(aggregate_metrics["recall_at_k"])) if per_problem else 0.0,
        "mean_mrr_at_k": float(np.mean(aggregate_metrics["mrr_at_k"])) if per_problem else 0.0,
        "mean_map_at_k": float(np.mean(aggregate_metrics["map_at_k"])) if per_problem else 0.0,
        "mean_ndcg_at_k": float(np.mean(aggregate_metrics["ndcg_at_k"])) if per_problem else 0.0,
    }
    return {"summary": summary, "per_problem": per_problem}


def build_annotation_pool(runs_by_approach: Dict[str, Sequence[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    by_problem: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)

    for approach, run in runs_by_approach.items():
        for problem in run:
            problem_id = problem["problem_id"]
            for recommendation in problem["recommendations"]:
                doc_id = recommendation["doc_id"]
                field_prefix = approach_field_prefix(approach)
                bucket = by_problem[problem_id].setdefault(
                    doc_id,
                    {
                        "problem_id": problem_id,
                        "problem_name": problem["problem_name"],
                        "query": problem["query"],
                        "doc_id": doc_id,
                        "ementa_rank": None,
                        "ementa_score": None,
                        "acao_rank": None,
                        "acao_score": None,
                        "bm25_ementas_rank": None,
                        "bm25_ementas_score": None,
                        "municipio": recommendation.get("municipio"),
                        "uf": recommendation.get("uf"),
                        "materia_id": recommendation.get("materia_id"),
                        "numero": recommendation.get("numero"),
                        "ano": recommendation.get("ano"),
                        "ementa": recommendation.get("ementa"),
                        "acao": recommendation.get("acao"),
                        "link_publico": recommendation.get("link_publico"),
                        "sapl_url": recommendation.get("sapl_url"),
                        "relevance": None,
                        "notes": "",
                    },
                )
                bucket[f"{field_prefix}_rank"] = recommendation["rank"]
                bucket[f"{field_prefix}_score"] = recommendation["similarity_score"]

    pooled: List[Dict[str, Any]] = []
    for problem_id in sorted(by_problem):
        items = list(by_problem[problem_id].values())
        items.sort(
            key=lambda row: (
                min(
                    value
                    for key, value in row.items()
                    if key.endswith("_rank") and value is not None
                ),
                row["doc_id"],
            )
        )
        pooled.extend(items)
    return pooled


def build_blind_annotation_pool(pool_rows: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    blind_rows: List[Dict[str, Any]] = []
    for row in pool_rows:
        blind_rows.append(
            {
                "problem_id": row["problem_id"],
                "doc_id": row["doc_id"],
                "query": row["query"],
                "ementa": row["ementa"],
                "relevance": row.get("relevance"),
                "notes": row.get("notes", ""),
            }
        )
    return blind_rows


def main() -> None:
    args = build_parser().parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    corpus, problems, ementa_embeddings, acao_embeddings, query_embeddings = load_artifacts(args.manifest_path)
    if len(problems) != len(query_embeddings):
        raise ValueError("Quantidade de problemas e embeddings de query nao coincide.")

    ementa_embeddings = l2_normalize_rows(ementa_embeddings)
    acao_embeddings = l2_normalize_rows(acao_embeddings)
    query_embeddings = l2_normalize_rows(query_embeddings)
    bm25_index = build_bm25_index(corpus, text_field="ementa", k1=args.bm25_k1, b=args.bm25_b)

    ementa_run: List[Dict[str, Any]] = []
    acao_run: List[Dict[str, Any]] = []
    bm25_run: List[Dict[str, Any]] = []

    for problem, query_vector in zip(problems, query_embeddings):
        ementa_run.append(
            rank_problem(problem, query_vector, corpus, ementa_embeddings, args.top_k, approach="ementas")
        )
        acao_run.append(
            rank_problem(problem, query_vector, corpus, acao_embeddings, args.top_k, approach="acoes")
        )
        bm25_run.append(
            rank_problem_bm25(problem, corpus, bm25_index, args.top_k, approach="bm25_ementas")
        )

    ementa_path = args.output_dir / "recommendations_ementas.jsonl"
    acao_path = args.output_dir / "recommendations_acoes.jsonl"
    bm25_path = args.output_dir / "recommendations_bm25_ementas.jsonl"
    write_jsonl(ementa_path, ementa_run)
    write_jsonl(acao_path, acao_run)
    write_jsonl(bm25_path, bm25_run)

    if args.annotation_pool_path:
        pool_metadata = build_annotation_pool(
            {
                "ementas": ementa_run,
                "acoes": acao_run,
                "bm25_ementas": bm25_run,
            }
        )
        blind_pool = build_blind_annotation_pool(pool_metadata)
        metadata_path = args.annotation_pool_path.with_name(f"{args.annotation_pool_path.stem}_metadata.jsonl")
        write_jsonl(args.annotation_pool_path, blind_pool)
        write_jsonl(metadata_path, pool_metadata)

    if args.qrels_path:
        qrels = load_qrels(args.qrels_path)
        metrics = {
            "top_k": args.top_k,
            "ementas": evaluate_run(ementa_run, qrels, args.top_k),
            "acoes": evaluate_run(acao_run, qrels, args.top_k),
            "bm25_ementas": evaluate_run(bm25_run, qrels, args.top_k),
        }
        save_json(args.output_dir / "metrics.json", metrics)

    print(
        "Saidas geradas com sucesso:\n"
        f"- recomendacoes por ementa: {ementa_path}\n"
        f"- recomendacoes por acao: {acao_path}\n"
        f"- recomendacoes BM25 sobre ementas: {bm25_path}\n"
        f"- metricas: {args.output_dir / 'metrics.json' if args.qrels_path else 'nao calculadas'}\n"
        f"- pool de anotacao cego: {args.annotation_pool_path if args.annotation_pool_path else 'nao solicitado'}\n"
        f"- metadados do pool: {metadata_path if args.annotation_pool_path else 'nao solicitado'}"
    )


if __name__ == "__main__":
    main()
