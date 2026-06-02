from __future__ import annotations

import argparse
import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence


def iter_jsonl(path: Path) -> Iterable[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                yield json.loads(line)


@dataclass
class ProblemEvaluation:
    problem_id: str
    problem_name: str
    query: str
    relevances: List[int]
    precision_at_1: float
    precision_at_3: float
    precision_at_5: float
    precision_at_10: float
    high_precision_at_3: float
    high_precision_at_10: float
    recall_at_10: float
    high_recall_at_10: float
    mrr_at_10: float
    map_at_10: float
    ndcg_at_3: float
    ndcg_at_10: float
    avg_relevance_at_3: float
    avg_relevance_at_10: float


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Analisa o pool anotado e compara recomendacoes baseadas em ementas vs acoes."
    )
    parser.add_argument(
        "--pool-path",
        type=Path,
        default=Path("experiments/eval/outputs/annotation_pool_categorized.jsonl"),
    )
    parser.add_argument(
        "--ementas-path",
        type=Path,
        default=Path("experiments/eval/outputs/recommendations_ementas.jsonl"),
    )
    parser.add_argument(
        "--acoes-path",
        type=Path,
        default=Path("experiments/eval/outputs/recommendations_acoes.jsonl"),
    )
    parser.add_argument(
        "--bm25-path",
        type=Path,
        default=Path("experiments/eval/outputs/recommendations_bm25_ementas.jsonl"),
    )
    parser.add_argument(
        "--output-path",
        type=Path,
        default=Path("experiments/eval/Analysis.md"),
    )
    parser.add_argument(
        "--pool-metadata-path",
        type=Path,
        default=None,
        help="Metadados completos do pool, usados quando o arquivo anotado esta em formato cego.",
    )
    return parser


def precision_at_k(relevances: Sequence[int], k: int, threshold: int = 1) -> float:
    values = list(relevances[:k])
    if not values:
        return 0.0
    return float(sum(1 for rel in values if rel >= threshold) / len(values))


def recall_at_k(relevances: Sequence[int], total_relevant: int, k: int, threshold: int = 1) -> float:
    if total_relevant <= 0:
        return 0.0
    return float(sum(1 for rel in relevances[:k] if rel >= threshold) / total_relevant)


def reciprocal_rank_at_k(relevances: Sequence[int], k: int, threshold: int = 1) -> float:
    for idx, rel in enumerate(relevances[:k], start=1):
        if rel >= threshold:
            return float(1 / idx)
    return 0.0


def average_precision_at_k(relevances: Sequence[int], total_relevant: int, k: int, threshold: int = 1) -> float:
    if total_relevant <= 0:
        return 0.0
    hits = 0
    score = 0.0
    for idx, rel in enumerate(relevances[:k], start=1):
        if rel >= threshold:
            hits += 1
            score += hits / idx
    return float(score / total_relevant)


def dcg_at_k(relevances: Sequence[int], k: int) -> float:
    score = 0.0
    for idx, rel in enumerate(relevances[:k], start=1):
        score += (2**rel - 1) / math.log2(idx + 1)
    return float(score)


def ndcg_at_k(relevances: Sequence[int], ideal_relevances: Sequence[int], k: int) -> float:
    ideal = dcg_at_k(ideal_relevances, k)
    if ideal == 0:
        return 0.0
    return float(dcg_at_k(relevances, k) / ideal)


def avg_relevance_at_k(relevances: Sequence[int], k: int) -> float:
    values = list(relevances[:k])
    if not values:
        return 0.0
    return float(sum(values) / len(values))


def mean(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    return float(sum(values) / len(values))


def format_float(value: float) -> str:
    return f"{value:.3f}"


def format_pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def format_problem_list(problem_ids: Sequence[str]) -> str:
    if not problem_ids:
        return ""
    wrapped = [f"`{problem_id}`" for problem_id in problem_ids]
    if len(wrapped) == 1:
        return wrapped[0]
    if len(wrapped) == 2:
        return f"{wrapped[0]} e {wrapped[1]}"
    return f"{', '.join(wrapped[:-1])} e {wrapped[-1]}"


def sign_test_pvalue(wins: int, losses: int) -> float:
    n = wins + losses
    if n == 0:
        return 1.0
    tail = sum(math.comb(n, i) for i in range(max(wins, losses), n + 1)) / (2**n)
    return float(min(1.0, 2 * tail))


def load_runs(path: Path) -> Dict[str, Dict[str, Any]]:
    return {row["problem_id"]: row for row in iter_jsonl(path)}


def resolve_pool_metadata_path(pool_path: Path, explicit_path: Path | None) -> Path | None:
    if explicit_path is not None:
        return explicit_path

    candidates = [pool_path.with_name(f"{pool_path.stem}_metadata.jsonl")]
    if pool_path.stem.endswith("_categorized"):
        base_stem = pool_path.stem[: -len("_categorized")]
        candidates.append(pool_path.with_name(f"{base_stem}_metadata.jsonl"))

    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def merge_pool_rows_with_metadata(
    pool_rows: Sequence[Dict[str, Any]],
    metadata_rows: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    metadata_by_key = {
        (str(row["problem_id"]).strip(), str(row["doc_id"]).strip()): row
        for row in metadata_rows
    }

    merged_rows: List[Dict[str, Any]] = []
    for row in pool_rows:
        key = (str(row["problem_id"]).strip(), str(row["doc_id"]).strip())
        metadata = metadata_by_key.get(key)
        if metadata is None:
            raise ValueError(f"Metadados ausentes para problem_id={key[0]!r}, doc_id={key[1]!r}.")
        merged = dict(metadata)
        merged["relevance"] = row.get("relevance")
        merged["notes"] = row.get("notes", "")
        merged_rows.append(merged)
    return merged_rows


def ensure_pool_rows_have_metadata(
    pool_rows: Sequence[Dict[str, Any]],
    pool_path: Path,
    metadata_path: Path | None,
) -> List[Dict[str, Any]]:
    if not pool_rows:
        return list(pool_rows)

    required_fields = {"ementa_rank", "acao_rank", "bm25_ementas_rank"}
    if required_fields.issubset(pool_rows[0].keys()):
        return list(pool_rows)

    resolved_metadata_path = resolve_pool_metadata_path(pool_path, metadata_path)
    if resolved_metadata_path is None:
        raise ValueError(
            "O pool anotado esta em formato cego e nao inclui metadados de ranking. "
            "Informe --pool-metadata-path ou mantenha o arquivo companheiro *_metadata.jsonl."
        )

    metadata_rows = list(iter_jsonl(resolved_metadata_path))
    return merge_pool_rows_with_metadata(pool_rows, metadata_rows)


def load_qrels(pool_rows: Sequence[Dict[str, Any]]) -> Dict[str, Dict[str, int]]:
    qrels: Dict[str, Dict[str, int]] = defaultdict(dict)
    for row in pool_rows:
        qrels[row["problem_id"]][row["doc_id"]] = int(row["relevance"])
    return qrels


def evaluate_run(
    run: Dict[str, Dict[str, Any]],
    qrels: Dict[str, Dict[str, int]],
) -> List[ProblemEvaluation]:
    evaluations: List[ProblemEvaluation] = []
    for problem_id, problem_row in run.items():
        judgments = qrels[problem_id]
        ranked_docs = problem_row["recommendations"]
        relevances = [int(judgments.get(doc["doc_id"], 0)) for doc in ranked_docs]
        ideal = sorted(judgments.values(), reverse=True)
        total_relevant = sum(1 for rel in judgments.values() if rel > 0)
        total_high = sum(1 for rel in judgments.values() if rel >= 2)

        evaluations.append(
            ProblemEvaluation(
                problem_id=problem_id,
                problem_name=problem_row["problem_name"],
                query=problem_row["query"],
                relevances=relevances,
                precision_at_1=precision_at_k(relevances, 1),
                precision_at_3=precision_at_k(relevances, 3),
                precision_at_5=precision_at_k(relevances, 5),
                precision_at_10=precision_at_k(relevances, 10),
                high_precision_at_3=precision_at_k(relevances, 3, threshold=2),
                high_precision_at_10=precision_at_k(relevances, 10, threshold=2),
                recall_at_10=recall_at_k(relevances, total_relevant, 10),
                high_recall_at_10=recall_at_k(relevances, total_high, 10, threshold=2),
                mrr_at_10=reciprocal_rank_at_k(relevances, 10),
                map_at_10=average_precision_at_k(relevances, total_relevant, 10),
                ndcg_at_3=ndcg_at_k(relevances, ideal, 3),
                ndcg_at_10=ndcg_at_k(relevances, ideal, 10),
                avg_relevance_at_3=avg_relevance_at_k(relevances, 3),
                avg_relevance_at_10=avg_relevance_at_k(relevances, 10),
            )
        )
    return sorted(evaluations, key=lambda row: row.problem_id)


def summarise_evaluations(rows: Sequence[ProblemEvaluation]) -> Dict[str, float]:
    return {
        "precision_at_1": mean([row.precision_at_1 for row in rows]),
        "precision_at_3": mean([row.precision_at_3 for row in rows]),
        "precision_at_5": mean([row.precision_at_5 for row in rows]),
        "precision_at_10": mean([row.precision_at_10 for row in rows]),
        "high_precision_at_3": mean([row.high_precision_at_3 for row in rows]),
        "high_precision_at_10": mean([row.high_precision_at_10 for row in rows]),
        "recall_at_10": mean([row.recall_at_10 for row in rows]),
        "high_recall_at_10": mean([row.high_recall_at_10 for row in rows]),
        "mrr_at_10": mean([row.mrr_at_10 for row in rows]),
        "map_at_10": mean([row.map_at_10 for row in rows]),
        "ndcg_at_3": mean([row.ndcg_at_3 for row in rows]),
        "ndcg_at_10": mean([row.ndcg_at_10 for row in rows]),
        "avg_relevance_at_3": mean([row.avg_relevance_at_3 for row in rows]),
        "avg_relevance_at_10": mean([row.avg_relevance_at_10 for row in rows]),
    }


def pairwise_comparison(
    ementas_eval: Sequence[ProblemEvaluation],
    acoes_eval: Sequence[ProblemEvaluation],
    metric_name: str,
) -> Dict[str, Any]:
    ementas_by_problem = {row.problem_id: row for row in ementas_eval}
    acoes_by_problem = {row.problem_id: row for row in acoes_eval}
    deltas: List[float] = []
    wins = losses = ties = 0

    for problem_id in ementas_by_problem:
        delta = getattr(acoes_by_problem[problem_id], metric_name) - getattr(ementas_by_problem[problem_id], metric_name)
        deltas.append(delta)
        if abs(delta) < 1e-12:
            ties += 1
        elif delta > 0:
            wins += 1
        else:
            losses += 1

    return {
        "metric": metric_name,
        "delta_mean": mean(deltas),
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "sign_test_pvalue": sign_test_pvalue(wins, losses),
    }


def pool_stats(pool_rows: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    relevance_counter = Counter(int(row["relevance"]) for row in pool_rows)
    by_problem: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in pool_rows:
        by_problem[row["problem_id"]].append(row)

    approach_fields = {
        "bm25_ementas": "bm25_ementas_rank",
        "ementas": "ementa_rank",
        "acoes": "acao_rank",
    }
    pairwise_pairs = [
        ("bm25_ementas", "ementas"),
        ("bm25_ementas", "acoes"),
        ("ementas", "acoes"),
    ]

    def subset_summary(rows: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
        total = len(rows)
        relevant = sum(1 for row in rows if int(row["relevance"]) > 0)
        high = sum(1 for row in rows if int(row["relevance"]) >= 2)
        return {
            "count": total,
            "relevant_share": relevant / total if total else 0.0,
            "high_share": high / total if total else 0.0,
            "relevance_counter": Counter(int(row["relevance"]) for row in rows),
        }

    approach_stats: Dict[str, Dict[str, Any]] = {}
    for approach, field in approach_fields.items():
        rows = [row for row in pool_rows if row[field] is not None]
        exclusive_rows = [
            row
            for row in rows
            if all(
                row[other_field] is None
                for other_approach, other_field in approach_fields.items()
                if other_approach != approach
            )
        ]
        approach_stats[approach] = {
            **subset_summary(rows),
            "exclusive": subset_summary(exclusive_rows),
        }

    pairwise_overlap: Dict[str, Dict[str, float]] = {}
    for left, right in pairwise_pairs:
        overlap_counts: List[int] = []
        overlap_ratios: List[float] = []
        left_field = approach_fields[left]
        right_field = approach_fields[right]
        for rows in by_problem.values():
            left_docs = {row["doc_id"] for row in rows if row[left_field] is not None}
            right_docs = {row["doc_id"] for row in rows if row[right_field] is not None}
            overlap = len(left_docs & right_docs)
            union = len(left_docs | right_docs)
            overlap_counts.append(overlap)
            overlap_ratios.append(overlap / union if union else 0.0)
        pairwise_overlap[f"{left}__{right}"] = {
            "avg_overlap_count": mean(overlap_counts),
            "avg_overlap_jaccard": mean(overlap_ratios),
        }

    return {
        "num_rows": len(pool_rows),
        "num_problems": len(by_problem),
        "avg_candidates_per_problem": len(pool_rows) / len(by_problem),
        "relevance_counter": relevance_counter,
        "relevant_share": sum(v for k, v in relevance_counter.items() if k > 0) / len(pool_rows),
        "high_share": sum(v for k, v in relevance_counter.items() if k >= 2) / len(pool_rows),
        "approach_stats": approach_stats,
        "pairwise_overlap": pairwise_overlap,
    }


def collect_problem_qrels(pool_rows: Sequence[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    by_problem: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in pool_rows:
        by_problem[row["problem_id"]].append(row)

    output: Dict[str, Dict[str, Any]] = {}
    for problem_id, rows in by_problem.items():
        relevance_counter = Counter(int(row["relevance"]) for row in rows)
        relevant_exclusive_ementas = sum(
            1
            for row in rows
            if row["ementa_rank"] is not None and row["acao_rank"] is None and int(row["relevance"]) > 0
        )
        relevant_exclusive_acoes = sum(
            1
            for row in rows
            if row["acao_rank"] is not None and row["ementa_rank"] is None and int(row["relevance"]) > 0
        )
        high_exclusive_ementas = sum(
            1
            for row in rows
            if row["ementa_rank"] is not None and row["acao_rank"] is None and int(row["relevance"]) >= 2
        )
        high_exclusive_acoes = sum(
            1
            for row in rows
            if row["acao_rank"] is not None and row["ementa_rank"] is None and int(row["relevance"]) >= 2
        )
        overlap = sum(1 for row in rows if row["ementa_rank"] is not None and row["acao_rank"] is not None)

        output[problem_id] = {
            "num_candidates": len(rows),
            "num_relevant": sum(1 for row in rows if int(row["relevance"]) > 0),
            "num_high_relevance": sum(1 for row in rows if int(row["relevance"]) >= 2),
            "relevance_counter": relevance_counter,
            "relevant_exclusive_ementas": relevant_exclusive_ementas,
            "relevant_exclusive_acoes": relevant_exclusive_acoes,
            "high_exclusive_ementas": high_exclusive_ementas,
            "high_exclusive_acoes": high_exclusive_acoes,
            "overlap_count": overlap,
        }

    return output


def rankwise_average_relevance(
    run: Dict[str, Dict[str, Any]],
    qrels: Dict[str, Dict[str, int]],
) -> List[float]:
    values: List[float] = []
    max_rank = len(next(iter(run.values()))["recommendations"])
    for rank in range(max_rank):
        rank_values = []
        for problem_id, row in run.items():
            doc_id = row["recommendations"][rank]["doc_id"]
            rank_values.append(qrels[problem_id].get(doc_id, 0))
        values.append(mean(rank_values))
    return values


def recommendation_snippet(recommendation: Dict[str, Any], relevance: int) -> str:
    municipio = recommendation.get("municipio") or "-"
    uf = recommendation.get("uf") or "-"
    action = (recommendation.get("acao") or recommendation.get("ementa") or "").strip()
    if len(action) > 95:
        action = action[:92].rstrip() + "..."
    return f"#{recommendation['rank']} (rel={relevance}) {municipio}/{uf}: {action}"


def build_examples(
    bm25_run: Dict[str, Dict[str, Any]],
    ementas_run: Dict[str, Dict[str, Any]],
    acoes_run: Dict[str, Dict[str, Any]],
    qrels: Dict[str, Dict[str, int]],
    bm25_eval: Sequence[ProblemEvaluation],
    ementas_eval: Sequence[ProblemEvaluation],
    acoes_eval: Sequence[ProblemEvaluation],
) -> Dict[str, List[str]]:
    bm25_by_problem = {row.problem_id: row for row in bm25_eval}
    ementas_by_problem = {row.problem_id: row for row in ementas_eval}
    acoes_by_problem = {row.problem_id: row for row in acoes_eval}
    deltas = [
        (
            acoes_by_problem[problem_id].ndcg_at_10 - bm25_by_problem[problem_id].ndcg_at_10,
            problem_id,
        )
        for problem_id in bm25_by_problem
    ]
    deltas.sort(reverse=True)

    def describe(problem_id: str) -> str:
        bm25_problem = bm25_run[problem_id]
        ementa_problem = ementas_run[problem_id]
        acao_problem = acoes_run[problem_id]
        bm25_problem_eval = bm25_by_problem[problem_id]
        ementa_eval = ementas_by_problem[problem_id]
        acao_eval = acoes_by_problem[problem_id]
        bm25_docs = [
            recommendation_snippet(doc, qrels[problem_id].get(doc["doc_id"], 0))
            for doc in bm25_problem["recommendations"][:3]
        ]
        ementa_docs = [
            recommendation_snippet(doc, qrels[problem_id].get(doc["doc_id"], 0))
            for doc in ementa_problem["recommendations"][:3]
        ]
        acao_docs = [
            recommendation_snippet(doc, qrels[problem_id].get(doc["doc_id"], 0))
            for doc in acao_problem["recommendations"][:3]
        ]
        return (
            f"**{acao_problem['problem_name']}** (`{problem_id}`): "
            f"nDCG@10 bm25={format_float(bm25_problem_eval.ndcg_at_10)} "
            f"vs ementas={format_float(ementa_eval.ndcg_at_10)} vs acoes={format_float(acao_eval.ndcg_at_10)}. "
            f"Top-3 bm25: {'; '.join(bm25_docs)}. "
            f"Top-3 ementas: {'; '.join(ementa_docs)}. "
            f"Top-3 acoes: {'; '.join(acao_docs)}."
        )

    gains = [describe(problem_id) for _, problem_id in deltas[:2]]
    losses = [describe(problem_id) for _, problem_id in deltas[-2:]]
    return {"gains": gains, "losses": losses}


def render_metric_table(
    bm25_summary: Dict[str, float],
    ementas_summary: Dict[str, float],
    acoes_summary: Dict[str, float],
) -> List[str]:
    rows = [
        ("P@1", "precision_at_1"),
        ("P@3", "precision_at_3"),
        ("P@5", "precision_at_5"),
        ("P@10", "precision_at_10"),
        ("High-P@3 (rel>=2)", "high_precision_at_3"),
        ("High-P@10 (rel>=2)", "high_precision_at_10"),
        ("Recall@10", "recall_at_10"),
        ("High-Recall@10 (rel>=2)", "high_recall_at_10"),
        ("MRR@10", "mrr_at_10"),
        ("MAP@10", "map_at_10"),
        ("nDCG@3", "ndcg_at_3"),
        ("nDCG@10", "ndcg_at_10"),
        ("Relevancia media@3", "avg_relevance_at_3"),
        ("Relevancia media@10", "avg_relevance_at_10"),
    ]
    lines = [
        "| Metrica | BM25 | Ementas | Acoes | Delta (ementas - BM25) | Delta (acoes - BM25) |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for label, key in rows:
        delta_ementas = ementas_summary[key] - bm25_summary[key]
        delta_acoes = acoes_summary[key] - bm25_summary[key]
        lines.append(
            f"| {label} | {format_float(bm25_summary[key])} | {format_float(ementas_summary[key])} | "
            f"{format_float(acoes_summary[key])} | {format_float(delta_ementas)} | {format_float(delta_acoes)} |"
        )
    return lines


def render_pairwise_table(
    pairwise_rows: Sequence[Dict[str, Any]],
    winner_label: str,
    loser_label: str,
) -> List[str]:
    label_map = {
        "precision_at_3": "P@3",
        "precision_at_10": "P@10",
        "high_precision_at_10": "High-P@10",
        "recall_at_10": "Recall@10",
        "high_recall_at_10": "High-Recall@10",
        "map_at_10": "MAP@10",
        "ndcg_at_10": "nDCG@10",
        "avg_relevance_at_10": "Relevancia media@10",
    }
    lines = [
        f"| Metrica | Delta medio | Vitorias {winner_label} | Vitorias {loser_label} | Empates | p-valor sign test |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in pairwise_rows:
        lines.append(
            f"| {label_map[row['metric']]} | {format_float(row['delta_mean'])} | {row['wins']} | {row['losses']} | {row['ties']} | {format_float(row['sign_test_pvalue'])} |"
        )
    return lines


def render_problem_table(
    bm25_eval: Sequence[ProblemEvaluation],
    ementas_eval: Sequence[ProblemEvaluation],
    acoes_eval: Sequence[ProblemEvaluation],
) -> List[str]:
    bm25_by_problem = {row.problem_id: row for row in bm25_eval}
    ementas_by_problem = {row.problem_id: row for row in ementas_eval}
    acoes_by_problem = {row.problem_id: row for row in acoes_eval}
    sorted_ids = sorted(
        bm25_by_problem,
        key=lambda problem_id: acoes_by_problem[problem_id].ndcg_at_10 - bm25_by_problem[problem_id].ndcg_at_10,
        reverse=True,
    )

    lines = [
        "| Problema | nDCG@10 BM25 | nDCG@10 ementas | nDCG@10 acoes | Delta (ementas - BM25) | Delta (acoes - BM25) |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for problem_id in sorted_ids:
        lines.append(
            f"| `{problem_id}` | {format_float(bm25_by_problem[problem_id].ndcg_at_10)} | "
            f"{format_float(ementas_by_problem[problem_id].ndcg_at_10)} | "
            f"{format_float(acoes_by_problem[problem_id].ndcg_at_10)} | "
            f"{format_float(ementas_by_problem[problem_id].ndcg_at_10 - bm25_by_problem[problem_id].ndcg_at_10)} | "
            f"{format_float(acoes_by_problem[problem_id].ndcg_at_10 - bm25_by_problem[problem_id].ndcg_at_10)} |"
        )
    return lines


def render_rank_table(
    bm25_rankwise: Sequence[float],
    ementas_rankwise: Sequence[float],
    acoes_rankwise: Sequence[float],
) -> List[str]:
    lines = [
        "| Rank | Relevancia media BM25 | Relevancia media ementas | Relevancia media acoes |",
        "| --- | ---: | ---: | ---: |",
    ]
    for rank, (bm25_value, ementa_value, acao_value) in enumerate(
        zip(bm25_rankwise, ementas_rankwise, acoes_rankwise),
        start=1,
    ):
        lines.append(
            f"| {rank} | {format_float(bm25_value)} | {format_float(ementa_value)} | {format_float(acao_value)} |"
        )
    return lines


def build_markdown(
    pool_rows: Sequence[Dict[str, Any]],
    bm25_run: Dict[str, Dict[str, Any]],
    ementas_run: Dict[str, Dict[str, Any]],
    acoes_run: Dict[str, Dict[str, Any]],
    bm25_eval: Sequence[ProblemEvaluation],
    ementas_eval: Sequence[ProblemEvaluation],
    acoes_eval: Sequence[ProblemEvaluation],
) -> str:
    qrels = load_qrels(pool_rows)
    pool_summary = pool_stats(pool_rows)
    bm25_summary = summarise_evaluations(bm25_eval)
    ementas_summary = summarise_evaluations(ementas_eval)
    acoes_summary = summarise_evaluations(acoes_eval)
    bm25_rankwise = rankwise_average_relevance(bm25_run, qrels)
    ementas_rankwise = rankwise_average_relevance(ementas_run, qrels)
    acoes_rankwise = rankwise_average_relevance(acoes_run, qrels)
    bm25_by_problem = {row.problem_id: row for row in bm25_eval}
    ementas_by_problem = {row.problem_id: row for row in ementas_eval}
    acoes_by_problem = {row.problem_id: row for row in acoes_eval}
    problem_deltas = sorted(
        (
            (
                problem_id,
                acoes_by_problem[problem_id].ndcg_at_10 - bm25_by_problem[problem_id].ndcg_at_10,
            )
            for problem_id in bm25_by_problem
        ),
        key=lambda item: item[1],
        reverse=True,
    )
    top_gain_problem_ids = [problem_id for problem_id, delta in problem_deltas if delta > 0][:5]
    top_loss_problem_ids = [problem_id for problem_id, delta in sorted(problem_deltas, key=lambda item: item[1]) if delta < 0][:3]
    rank_deltas = [acao - bm25 for bm25, acao in zip(bm25_rankwise, acoes_rankwise)]
    positive_rank_count = sum(1 for delta in rank_deltas if delta > 1e-12)
    negative_rank_count = sum(1 for delta in rank_deltas if delta < -1e-12)
    rank1_delta = rank_deltas[0] if rank_deltas else 0.0
    examples = build_examples(bm25_run, ementas_run, acoes_run, qrels, bm25_eval, ementas_eval, acoes_eval)

    pairwise_bm25_vs_ementas = [
        pairwise_comparison(bm25_eval, ementas_eval, metric_name)
        for metric_name in [
            "precision_at_3",
            "precision_at_10",
            "high_precision_at_10",
            "recall_at_10",
            "high_recall_at_10",
            "map_at_10",
            "ndcg_at_10",
            "avg_relevance_at_10",
        ]
    ]
    pairwise_bm25_vs_acoes = [
        pairwise_comparison(bm25_eval, acoes_eval, metric_name)
        for metric_name in [
            "precision_at_3",
            "precision_at_10",
            "high_precision_at_10",
            "recall_at_10",
            "high_recall_at_10",
            "map_at_10",
            "ndcg_at_10",
            "avg_relevance_at_10",
        ]
    ]
    pairwise_bm25_vs_ementas_by_metric = {row["metric"]: row for row in pairwise_bm25_vs_ementas}
    pairwise_bm25_vs_acoes_by_metric = {row["metric"]: row for row in pairwise_bm25_vs_acoes}
    high_precision_bm25_vs_acoes = pairwise_bm25_vs_acoes_by_metric["high_precision_at_10"]
    high_recall_bm25_vs_acoes = pairwise_bm25_vs_acoes_by_metric["high_recall_at_10"]
    ndcg_bm25_vs_ementas = pairwise_bm25_vs_ementas_by_metric["ndcg_at_10"]
    ndcg_bm25_vs_acoes = pairwise_bm25_vs_acoes_by_metric["ndcg_at_10"]
    approach_labels = {
        "bm25_ementas": "BM25",
        "ementas": "ementas",
        "acoes": "acoes",
    }
    approach_order = ["bm25_ementas", "ementas", "acoes"]
    best_high_approach = max(
        approach_order,
        key=lambda approach: pool_summary["approach_stats"][approach]["high_share"],
    )
    most_exclusive_approach = max(
        approach_order,
        key=lambda approach: pool_summary["approach_stats"][approach]["exclusive"]["count"],
    )
    overlap_bm25_ementas = pool_summary["pairwise_overlap"]["bm25_ementas__ementas"]
    overlap_bm25_acoes = pool_summary["pairwise_overlap"]["bm25_ementas__acoes"]
    overlap_ementas_acoes = pool_summary["pairwise_overlap"]["ementas__acoes"]

    lines: List[str] = []
    lines.append("# Analise exploratoria: bm25 vs ementas vs acoes")
    lines.append("")
    lines.append("## Escopo")
    lines.append("")
    lines.append(
        "Esta analise compara a qualidade das sugestoes geradas por tres abordagens sobre o mesmo acervo legislativo:"
    )
    lines.append("")
    lines.append("- `bm25_ementas`: baseline lexical BM25 calculado sobre a ementa original do PL.")
    lines.append("- `ementas`: embeddings calculados diretamente sobre a ementa original do PL.")
    lines.append("- `acoes`: embeddings calculados sobre a ementa reescrita como acao com o modelo de linguagem do projeto.")
    lines.append("")
    lines.append(
        "Os numeros abaixo usam o pool anotado em `experiments/eval/outputs/annotation_pool_categorized.jsonl` "
        "e os rankings de `recommendations_bm25_ementas.jsonl`, `recommendations_ementas.jsonl` e `recommendations_acoes.jsonl`."
    )
    lines.append("")
    lines.append("## Resumo executivo")
    lines.append("")
    lines.append(
        f"O pool contem {pool_summary['num_rows']} pares problema-documento anotados em {pool_summary['num_problems']} problemas "
        f"(media de {pool_summary['avg_candidates_per_problem']:.1f} candidatos por problema)."
    )
    lines.append(
        "As recomendacoes baseadas em `acoes` lideram nas metricas principais, seguidas por `ementas` e depois por `bm25_ementas`: "
        f"nDCG@10 = {format_float(bm25_summary['ndcg_at_10'])} / {format_float(ementas_summary['ndcg_at_10'])} / {format_float(acoes_summary['ndcg_at_10'])}, "
        f"MAP@10 = {format_float(bm25_summary['map_at_10'])} / {format_float(ementas_summary['map_at_10'])} / {format_float(acoes_summary['map_at_10'])}, "
        f"e relevancia media@10 = {format_float(bm25_summary['avg_relevance_at_10'])} / {format_float(ementas_summary['avg_relevance_at_10'])} / {format_float(acoes_summary['avg_relevance_at_10'])}."
    )
    lines.append(
        f"Contra o baseline lexical, `acoes` sobe de {format_float(bm25_summary['high_precision_at_10'])} para {format_float(acoes_summary['high_precision_at_10'])} em High-P@10 "
        f"e de {format_float(bm25_summary['high_recall_at_10'])} para {format_float(acoes_summary['high_recall_at_10'])} em High-Recall@10. "
        f"`ementas` tambem supera o BM25 nesses dois cortes ({format_float(ementas_summary['high_precision_at_10'])} e {format_float(ementas_summary['high_recall_at_10'])})."
    )
    lines.append(
        "Os tres rankings recuperam conjuntos parcialmente distintos: "
        f"o overlap medio entre BM25 e ementas e de {overlap_bm25_ementas['avg_overlap_count']:.2f} documentos por problema "
        f"(Jaccard {format_float(overlap_bm25_ementas['avg_overlap_jaccard'])}), "
        f"entre BM25 e acoes e de {overlap_bm25_acoes['avg_overlap_count']:.2f} "
        f"(Jaccard {format_float(overlap_bm25_acoes['avg_overlap_jaccard'])}) "
        f"e entre ementas e acoes e de {overlap_ementas_acoes['avg_overlap_count']:.2f} "
        f"(Jaccard {format_float(overlap_ementas_acoes['avg_overlap_jaccard'])})."
    )
    lines.append(
        "Interpretacao pratica: as duas abordagens semanticas superam o baseline lexical em media, "
        "e a textualizacao em formato de acao continua sendo a melhor forma de alinhar a busca com problemas formulados como necessidades municipais."
    )
    lines.append("")
    lines.append("## Perfil do pool anotado")
    lines.append("")
    lines.append(
        f"A base anotada e densa em documentos relevantes porque foi montada a partir da uniao dos rankings das tres abordagens. "
        f"No total, {format_pct(pool_summary['relevant_share'])} dos itens receberam relevancia > 0 e {format_pct(pool_summary['high_share'])} receberam relevancia >= 2."
    )
    lines.append("")
    lines.append("| Abordagem | Itens no pool | % relevantes | % relevancia alta (>=2) | Itens exclusivos | % alta nos exclusivos |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: |")
    for approach in approach_order:
        stats = pool_summary["approach_stats"][approach]
        lines.append(
            f"| {approach_labels[approach]} | {stats['count']} | {format_pct(stats['relevant_share'])} | "
            f"{format_pct(stats['high_share'])} | {stats['exclusive']['count']} | {format_pct(stats['exclusive']['high_share'])} |"
        )
    lines.append("")
    lines.append(
        f"Entre as tres abordagens, `{approach_labels[best_high_approach].lower()}` concentra a maior fracao de itens de alta relevancia "
        f"({format_pct(pool_summary['approach_stats'][best_high_approach]['high_share'])}), "
        f"enquanto `{approach_labels[most_exclusive_approach].lower()}` adiciona mais candidatos exclusivos ao pool "
        f"({pool_summary['approach_stats'][most_exclusive_approach]['exclusive']['count']} pares)."
    )
    lines.append("")
    lines.append("Distribuicao global de relevancia no pool:")
    lines.append("")
    lines.append(
        f"- `relevance = 0`: {pool_summary['relevance_counter'][0]} itens"
    )
    lines.append(
        f"- `relevance = 1`: {pool_summary['relevance_counter'][1]} itens"
    )
    lines.append(
        f"- `relevance = 2`: {pool_summary['relevance_counter'][2]} itens"
    )
    lines.append(
        f"- `relevance = 3`: {pool_summary['relevance_counter'][3]} itens"
    )
    lines.append("")
    lines.append("## Metricas agregadas")
    lines.append("")
    lines.extend(render_metric_table(bm25_summary, ementas_summary, acoes_summary))
    lines.append("")
    lines.append(
        "Leitura rapida: as duas abordagens semanticas superam o BM25 em media, e `acoes` melhora tanto a proporcao de itens relevantes no topo quanto a ordenacao dos melhores documentos ao longo do ranking."
    )
    lines.append("")
    lines.append("## Comparacao pareada por problema")
    lines.append("")
    lines.append(
        "As tabelas abaixo contam, problema a problema, quantas vezes cada abordagem semantica ficou acima do baseline lexical BM25. O p-valor vem de um sign test exato e serve apenas como indicio, "
        f"porque a amostra tem {len(bm25_eval)} problemas."
    )
    lines.append("")
    lines.append("### Ementas vs BM25")
    lines.append("")
    lines.extend(render_pairwise_table(pairwise_bm25_vs_ementas, "ementas", "bm25"))
    lines.append("")
    lines.append("### Acoes vs BM25")
    lines.append("")
    lines.extend(render_pairwise_table(pairwise_bm25_vs_acoes, "acoes", "bm25"))
    lines.append("")
    lines.append(
        "O sinal mais forte aparece na comparacao de `acoes` contra o baseline: "
        f"`acoes` venceu em {high_precision_bm25_vs_acoes['wins']} de "
        f"{high_precision_bm25_vs_acoes['wins'] + high_precision_bm25_vs_acoes['losses']} comparacoes nao empatadas em High-P@10, "
        f"em {high_recall_bm25_vs_acoes['wins']} de "
        f"{high_recall_bm25_vs_acoes['wins'] + high_recall_bm25_vs_acoes['losses']} em High-Recall@10 "
        f"e em {ndcg_bm25_vs_acoes['wins']} de {ndcg_bm25_vs_acoes['wins'] + ndcg_bm25_vs_acoes['losses']} em nDCG@10. "
        f"`Ementas` tambem vence o BM25 em nDCG@10 em {ndcg_bm25_vs_ementas['wins']} de "
        f"{ndcg_bm25_vs_ementas['wins'] + ndcg_bm25_vs_ementas['losses']} comparacoes nao empatadas."
    )
    lines.append("")
    lines.append("## Ganho por problema")
    lines.append("")
    lines.extend(render_problem_table(bm25_eval, ementas_eval, acoes_eval))
    lines.append("")
    if top_gain_problem_ids and top_loss_problem_ids:
        lines.append(
            f"Os maiores ganhos de `acoes` sobre o baseline aparecem em {format_problem_list(top_gain_problem_ids)}. "
            f"As maiores perdas aparecem em {format_problem_list(top_loss_problem_ids)}."
        )
    elif top_gain_problem_ids:
        lines.append(
            f"Os maiores ganhos de `acoes` sobre o baseline aparecem em {format_problem_list(top_gain_problem_ids)}. "
            "Nao houve perdas de `acoes` em relacao ao BM25 neste conjunto."
        )
    elif top_loss_problem_ids:
        lines.append(
            "Nao houve ganhos de `acoes` em relacao ao BM25 neste conjunto. "
            f"As maiores perdas aparecem em {format_problem_list(top_loss_problem_ids)}."
        )
    lines.append("")
    lines.append("## Qualidade ao longo do ranking")
    lines.append("")
    lines.extend(render_rank_table(bm25_rankwise, ementas_rankwise, acoes_rankwise))
    lines.append("")
    if abs(rank1_delta) < 1e-12:
        lines.append(
            f"No rank 1, `acoes` e BM25 empatam em relevancia media ({format_float(bm25_rankwise[0])}), "
            f"mas `acoes` supera o baseline em {positive_rank_count} das {len(rank_deltas)} posicoes analisadas."
        )
    elif rank1_delta > 0:
        lines.append(
            f"Ja no rank 1, `acoes` abre vantagem sobre o BM25 ({format_float(acoes_rankwise[0])} vs {format_float(bm25_rankwise[0])}) "
            f"e supera o baseline em {positive_rank_count} das {len(rank_deltas)} posicoes analisadas."
        )
    else:
        lines.append(
            f"No rank 1, o BM25 comeca melhor ({format_float(bm25_rankwise[0])} vs {format_float(acoes_rankwise[0])}), "
            f"mas `acoes` recupera terreno e supera o baseline em {positive_rank_count} das {len(rank_deltas)} posicoes analisadas."
        )
    if negative_rank_count:
        lines[-1] += f" Ainda assim, ha {negative_rank_count} ranks em que o BM25 fica acima."
    lines.append("")
    lines.append("## Exemplos qualitativos")
    lines.append("")
    lines.append("### Casos em que `acoes` melhora muito sobre o baseline")
    lines.append("")
    lines.extend([f"- {item}" for item in examples["gains"]])
    lines.append("")
    lines.append("### Casos em que o baseline lexical foi melhor que `acoes`")
    lines.append("")
    lines.extend([f"- {item}" for item in examples["losses"]])
    lines.append("")
    lines.append("## Interpretacao")
    lines.append("")
    lines.append(
        "Os resultados sugerem que as abordagens semanticas reduzem a dependencia de casamento lexical exato e aproximam o texto indexado da formulacao das queries, "
        "que tambem sao escritas como problemas ou objetivos de politica publica."
    )
    lines.append("")
    lines.append(
        "Esse efeito aparece sobretudo quando a ementa original fala em instrumentos genericos, fundos, revisoes administrativas ou linguagem legislativa pouco operacional. "
        "Nesses casos, a versao em acao torna mais explicito o verbo, o alvo e o mecanismo da politica, enquanto o BM25 fica preso aos termos literais da query."
    )
    lines.append("")
    if top_loss_problem_ids:
        lines.append(
            "As derrotas de `acoes` parecem ocorrer quando o baseline lexical captura termos muito especificos do dominio "
            "ou quando a reescrita perde alguma nuance importante de documentos ja claros na forma original. "
            f"Os temas {format_problem_list(top_loss_problem_ids[:2])} ilustram esse comportamento neste recorte."
        )
    else:
        lines.append(
            "As derrotas de `acoes` parecem ocorrer quando o baseline lexical captura termos muito especificos do dominio "
            "ou quando a reescrita perde alguma nuance importante de documentos ja claros na forma original."
        )
    lines.append("")
    lines.append("## Limitacoes")
    lines.append("")
    lines.append(
        "- A avaliacao usa um pool anotado derivado da uniao dos rankings das tres abordagens. Isso e adequado para comparacao relativa, mas nao mede recall absoluto do corpus."
    )
    lines.append(
        "- Documentos fora do pool nao foram julgados. Se uma abordagem trouxesse bons itens fora dessa uniao, o experimento atual nao capturaria esse ganho."
    )
    lines.append(
        f"- A amostra tem {len(bm25_eval)} problemas, entao os sinais estatisticos devem ser tratados como exploratorios."
    )
    lines.append(
        "- O arquivo anotado nao registra multiplos avaliadores, entao nao ha medida de concordancia interanotador."
    )
    lines.append("")
    lines.append("## Conclusao")
    lines.append("")
    lines.append(
        "Dentro deste conjunto anotado, `acoes` e a melhor estrategia, `ementas` fica em segundo lugar e `bm25_ementas` funciona como baseline lexical competitivo, mas inferior em media. "
        "O ganho das abordagens semanticas e mais claro na recuperacao de documentos de alta qualidade e na consistencia do ranking apos a primeira posicao."
    )
    lines.append("")
    lines.append(
        "Se a meta do projeto e maximizar a utilidade pratica das sugestoes para problemas municipais, os dados atuais favorecem usar `acoes` como default, "
        "manter `ementas` como segunda fonte semantica e tratar o BM25 como baseline de referencia ou componente complementar de um ranking hibrido."
    )
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    args = build_parser().parse_args()
    pool_rows = ensure_pool_rows_have_metadata(
        list(iter_jsonl(args.pool_path)),
        args.pool_path,
        args.pool_metadata_path,
    )
    bm25_run = load_runs(args.bm25_path)
    ementas_run = load_runs(args.ementas_path)
    acoes_run = load_runs(args.acoes_path)
    qrels = load_qrels(pool_rows)

    if set(bm25_run) != set(ementas_run) or set(bm25_run) != set(acoes_run):
        raise ValueError("Os arquivos de recomendacao nao contem o mesmo conjunto de problemas.")
    if set(ementas_run) != set(qrels):
        raise ValueError("Os problemas do pool anotado e das recomendacoes nao coincidem.")

    bm25_eval = evaluate_run(bm25_run, qrels)
    ementas_eval = evaluate_run(ementas_run, qrels)
    acoes_eval = evaluate_run(acoes_run, qrels)

    markdown = build_markdown(pool_rows, bm25_run, ementas_run, acoes_run, bm25_eval, ementas_eval, acoes_eval)
    args.output_path.parent.mkdir(parents=True, exist_ok=True)
    args.output_path.write_text(markdown, encoding="utf-8")
    print(f"Analise salva em {args.output_path}")


if __name__ == "__main__":
    main()
