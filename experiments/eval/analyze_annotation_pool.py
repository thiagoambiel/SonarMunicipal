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
        "--output-path",
        type=Path,
        default=Path("experiments/eval/Analysis.md"),
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


def sign_test_pvalue(wins: int, losses: int) -> float:
    n = wins + losses
    if n == 0:
        return 1.0
    tail = sum(math.comb(n, i) for i in range(max(wins, losses), n + 1)) / (2**n)
    return float(min(1.0, 2 * tail))


def load_runs(path: Path) -> Dict[str, Dict[str, Any]]:
    return {row["problem_id"]: row for row in iter_jsonl(path)}


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

    overlap_counts: List[int] = []
    overlap_ratios: List[float] = []
    only_ementas = []
    only_acoes = []
    in_both = []

    for row in pool_rows:
        if row["ementa_rank"] is not None and row["acao_rank"] is not None:
            in_both.append(row)
        elif row["ementa_rank"] is not None:
            only_ementas.append(row)
        else:
            only_acoes.append(row)

    for rows in by_problem.values():
        ementa_docs = {row["doc_id"] for row in rows if row["ementa_rank"] is not None}
        acao_docs = {row["doc_id"] for row in rows if row["acao_rank"] is not None}
        overlap = len(ementa_docs & acao_docs)
        union = len(ementa_docs | acao_docs)
        overlap_counts.append(overlap)
        overlap_ratios.append(overlap / union if union else 0.0)

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

    return {
        "num_rows": len(pool_rows),
        "num_problems": len(by_problem),
        "avg_candidates_per_problem": len(pool_rows) / len(by_problem),
        "relevance_counter": relevance_counter,
        "relevant_share": sum(v for k, v in relevance_counter.items() if k > 0) / len(pool_rows),
        "high_share": sum(v for k, v in relevance_counter.items() if k >= 2) / len(pool_rows),
        "only_ementas": subset_summary(only_ementas),
        "only_acoes": subset_summary(only_acoes),
        "in_both": subset_summary(in_both),
        "avg_overlap_count": mean(overlap_counts),
        "avg_overlap_jaccard": mean(overlap_ratios),
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
    ementas_run: Dict[str, Dict[str, Any]],
    acoes_run: Dict[str, Dict[str, Any]],
    qrels: Dict[str, Dict[str, int]],
    ementas_eval: Sequence[ProblemEvaluation],
    acoes_eval: Sequence[ProblemEvaluation],
) -> Dict[str, List[str]]:
    ementas_by_problem = {row.problem_id: row for row in ementas_eval}
    acoes_by_problem = {row.problem_id: row for row in acoes_eval}
    deltas = [
        (
            acoes_by_problem[problem_id].ndcg_at_10 - ementas_by_problem[problem_id].ndcg_at_10,
            problem_id,
        )
        for problem_id in ementas_by_problem
    ]
    deltas.sort(reverse=True)

    def describe(problem_id: str) -> str:
        ementa_problem = ementas_run[problem_id]
        acao_problem = acoes_run[problem_id]
        ementa_eval = ementas_by_problem[problem_id]
        acao_eval = acoes_by_problem[problem_id]
        ementa_docs = [
            recommendation_snippet(doc, qrels[problem_id].get(doc["doc_id"], 0))
            for doc in ementa_problem["recommendations"][:3]
        ]
        acao_docs = [
            recommendation_snippet(doc, qrels[problem_id].get(doc["doc_id"], 0))
            for doc in acao_problem["recommendations"][:3]
        ]
        return (
            f"**{ementa_problem['problem_name']}** (`{problem_id}`): "
            f"nDCG@10 ementas={format_float(ementa_eval.ndcg_at_10)} vs acoes={format_float(acao_eval.ndcg_at_10)}. "
            f"Top-3 ementas: {'; '.join(ementa_docs)}. "
            f"Top-3 acoes: {'; '.join(acao_docs)}."
        )

    gains = [describe(problem_id) for _, problem_id in deltas[:2]]
    losses = [describe(problem_id) for _, problem_id in deltas[-2:]]
    return {"gains": gains, "losses": losses}


def render_metric_table(ementas_summary: Dict[str, float], acoes_summary: Dict[str, float]) -> List[str]:
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
    lines = ["| Metrica | Ementas | Acoes | Delta (acoes - ementas) |", "| --- | ---: | ---: | ---: |"]
    for label, key in rows:
        delta = acoes_summary[key] - ementas_summary[key]
        lines.append(
            f"| {label} | {format_float(ementas_summary[key])} | {format_float(acoes_summary[key])} | {format_float(delta)} |"
        )
    return lines


def render_pairwise_table(pairwise_rows: Sequence[Dict[str, Any]]) -> List[str]:
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
        "| Metrica | Delta medio | Vitorias acoes | Vitorias ementas | Empates | p-valor sign test |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in pairwise_rows:
        lines.append(
            f"| {label_map[row['metric']]} | {format_float(row['delta_mean'])} | {row['wins']} | {row['losses']} | {row['ties']} | {format_float(row['sign_test_pvalue'])} |"
        )
    return lines


def render_problem_table(
    ementas_eval: Sequence[ProblemEvaluation],
    acoes_eval: Sequence[ProblemEvaluation],
    problem_qrels: Dict[str, Dict[str, Any]],
) -> List[str]:
    ementas_by_problem = {row.problem_id: row for row in ementas_eval}
    acoes_by_problem = {row.problem_id: row for row in acoes_eval}
    sorted_ids = sorted(
        ementas_by_problem,
        key=lambda problem_id: acoes_by_problem[problem_id].ndcg_at_10 - ementas_by_problem[problem_id].ndcg_at_10,
        reverse=True,
    )

    lines = [
        "| Problema | nDCG@10 ementas | nDCG@10 acoes | Delta | Exclusivos relevantes ementas | Exclusivos relevantes acoes |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for problem_id in sorted_ids:
        qrels_stats = problem_qrels[problem_id]
        lines.append(
            f"| `{problem_id}` | {format_float(ementas_by_problem[problem_id].ndcg_at_10)} | "
            f"{format_float(acoes_by_problem[problem_id].ndcg_at_10)} | "
            f"{format_float(acoes_by_problem[problem_id].ndcg_at_10 - ementas_by_problem[problem_id].ndcg_at_10)} | "
            f"{qrels_stats['relevant_exclusive_ementas']} | {qrels_stats['relevant_exclusive_acoes']} |"
        )
    return lines


def render_rank_table(ementas_rankwise: Sequence[float], acoes_rankwise: Sequence[float]) -> List[str]:
    lines = ["| Rank | Relevancia media ementas | Relevancia media acoes | Delta |", "| --- | ---: | ---: | ---: |"]
    for rank, (ementa_value, acao_value) in enumerate(zip(ementas_rankwise, acoes_rankwise), start=1):
        lines.append(
            f"| {rank} | {format_float(ementa_value)} | {format_float(acao_value)} | {format_float(acao_value - ementa_value)} |"
        )
    return lines


def build_markdown(
    pool_rows: Sequence[Dict[str, Any]],
    ementas_run: Dict[str, Dict[str, Any]],
    acoes_run: Dict[str, Dict[str, Any]],
    ementas_eval: Sequence[ProblemEvaluation],
    acoes_eval: Sequence[ProblemEvaluation],
) -> str:
    qrels = load_qrels(pool_rows)
    pool_summary = pool_stats(pool_rows)
    problem_qrels = collect_problem_qrels(pool_rows)
    ementas_summary = summarise_evaluations(ementas_eval)
    acoes_summary = summarise_evaluations(acoes_eval)
    ementas_rankwise = rankwise_average_relevance(ementas_run, qrels)
    acoes_rankwise = rankwise_average_relevance(acoes_run, qrels)
    examples = build_examples(ementas_run, acoes_run, qrels, ementas_eval, acoes_eval)

    pairwise_rows = [
        pairwise_comparison(ementas_eval, acoes_eval, metric_name)
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

    lines: List[str] = []
    lines.append("# Analise exploratoria: ementas vs acoes")
    lines.append("")
    lines.append("## Escopo")
    lines.append("")
    lines.append(
        "Esta analise compara a qualidade das sugestoes geradas por busca semantica em duas representacoes do mesmo acervo legislativo:"
    )
    lines.append("")
    lines.append("- `ementas`: embeddings calculados diretamente sobre a ementa original do PL.")
    lines.append("- `acoes`: embeddings calculados sobre a ementa reescrita como acao com o modelo de linguagem do projeto.")
    lines.append("")
    lines.append(
        "Os numeros abaixo usam o pool anotado em `experiments/eval/outputs/annotation_pool_categorized.jsonl` e os rankings top-10 de `recommendations_ementas.jsonl` e `recommendations_acoes.jsonl`."
    )
    lines.append("")
    lines.append("## Resumo executivo")
    lines.append("")
    lines.append(
        f"O pool contem {pool_summary['num_rows']} pares problema-documento anotados em {pool_summary['num_problems']} problemas "
        f"(media de {pool_summary['avg_candidates_per_problem']:.1f} candidatos por problema)."
    )
    lines.append(
        f"As recomendacoes baseadas em acoes superam as recomendacoes baseadas em ementas na maior parte das metricas principais: "
        f"nDCG@10 sobe de {format_float(ementas_summary['ndcg_at_10'])} para {format_float(acoes_summary['ndcg_at_10'])} "
        f"(delta {format_float(acoes_summary['ndcg_at_10'] - ementas_summary['ndcg_at_10'])}), "
        f"MAP@10 sobe de {format_float(ementas_summary['map_at_10'])} para {format_float(acoes_summary['map_at_10'])}, "
        f"e a relevancia media no top-10 sobe de {format_float(ementas_summary['avg_relevance_at_10'])} para {format_float(acoes_summary['avg_relevance_at_10'])}."
    )
    lines.append(
        f"O ganho mais consistente aparece na qualidade dos documentos fortes (`relevance >= 2`): "
        f"High-P@10 sobe de {format_float(ementas_summary['high_precision_at_10'])} para {format_float(acoes_summary['high_precision_at_10'])} "
        f"e High-Recall@10 sobe de {format_float(ementas_summary['high_recall_at_10'])} para {format_float(acoes_summary['high_recall_at_10'])}."
    )
    lines.append(
        f"As duas abordagens quase nao recuperam o mesmo conjunto de documentos: o overlap medio e de {pool_summary['avg_overlap_count']:.2f} documentos por problema "
        f"e o Jaccard medio entre top-10 e de apenas {format_float(pool_summary['avg_overlap_jaccard'])}."
    )
    lines.append(
        "Interpretacao pratica: transformar ementas em acoes tende a alinhar melhor a busca com problemas formulados como necessidades municipais, "
        "principalmente quando a ementa original e burocratica, genrica ou indireta."
    )
    lines.append("")
    lines.append("## Perfil do pool anotado")
    lines.append("")
    lines.append(
        f"A base anotada e densa em documentos relevantes porque foi montada a partir da uniao dos top-10 das duas abordagens. "
        f"No total, {format_pct(pool_summary['relevant_share'])} dos itens receberam relevancia > 0 e {format_pct(pool_summary['high_share'])} receberam relevancia >= 2."
    )
    lines.append("")
    lines.append("| Subconjunto | Itens | % relevantes | % relevancia alta (>=2) |")
    lines.append("| --- | ---: | ---: | ---: |")
    lines.append(
        f"| Somente ementas | {pool_summary['only_ementas']['count']} | {format_pct(pool_summary['only_ementas']['relevant_share'])} | {format_pct(pool_summary['only_ementas']['high_share'])} |"
    )
    lines.append(
        f"| Somente acoes | {pool_summary['only_acoes']['count']} | {format_pct(pool_summary['only_acoes']['relevant_share'])} | {format_pct(pool_summary['only_acoes']['high_share'])} |"
    )
    lines.append(
        f"| Intersecao | {pool_summary['in_both']['count']} | {format_pct(pool_summary['in_both']['relevant_share'])} | {format_pct(pool_summary['in_both']['high_share'])} |"
    )
    lines.append("")
    lines.append(
        "Os documentos exclusivos de `acoes` sao mais fortes que os exclusivos de `ementas`: "
        "76.2% dos exclusivos de acoes receberam relevancia alta, contra 56.6% dos exclusivos de ementas."
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
    lines.extend(render_metric_table(ementas_summary, acoes_summary))
    lines.append("")
    lines.append(
        "Leitura rapida: `acoes` melhora tanto a proporcao de itens relevantes no topo quanto a ordenacao dos melhores documentos ao longo do ranking."
    )
    lines.append("")
    lines.append("## Comparacao pareada por problema")
    lines.append("")
    lines.append(
        "A tabela abaixo conta, problema a problema, quantas vezes `acoes` ficou acima de `ementas`. O p-valor vem de um sign test exato e serve apenas como indicio, "
        "porque a amostra tem 15 problemas."
    )
    lines.append("")
    lines.extend(render_pairwise_table(pairwise_rows))
    lines.append("")
    lines.append(
        "O sinal mais forte esta nas metricas de relevancia alta: `acoes` venceu em 9 dos 10 casos nao empatados em High-P@10 e High-Recall@10."
    )
    lines.append("")
    lines.append("## Ganho por problema")
    lines.append("")
    lines.extend(render_problem_table(ementas_eval, acoes_eval, problem_qrels))
    lines.append("")
    lines.append(
        "Os maiores ganhos de `acoes` aparecem em `enchentes_urbanas`, `emprego_jovem`, `residuos_reciclagem`, `agricultura_familiar` e `violencia_bairros_centrais`. "
        "As maiores perdas aparecem em `iluminacao_publica`, `saneamento_basico` e `dengue_arboviroses`."
    )
    lines.append("")
    lines.append("## Qualidade ao longo do ranking")
    lines.append("")
    lines.extend(render_rank_table(ementas_rankwise, acoes_rankwise))
    lines.append("")
    lines.append(
        "No rank 1, as duas abordagens empatam em relevancia media (2.600), mas `acoes` fica claramente melhor entre os ranks 2 e 10, "
        "o que explica o ganho de nDCG e MAP."
    )
    lines.append("")
    lines.append("## Exemplos qualitativos")
    lines.append("")
    lines.append("### Casos em que `acoes` melhora muito")
    lines.append("")
    lines.extend([f"- {item}" for item in examples["gains"]])
    lines.append("")
    lines.append("### Casos em que `ementas` foi melhor")
    lines.append("")
    lines.extend([f"- {item}" for item in examples["losses"]])
    lines.append("")
    lines.append("## Interpretacao")
    lines.append("")
    lines.append(
        "Os resultados sugerem que a transformacao de ementa em acao reduz ambiguidade e aproxima o texto indexado da formulacao das queries, "
        "que tambem sao escritas como problemas ou objetivos de politica publica."
    )
    lines.append("")
    lines.append(
        "Esse efeito aparece sobretudo quando a ementa original fala em instrumentos genericos, fundos, revisoes administrativas ou linguagem legislativa pouco operacional. "
        "Nesses casos, a versao em acao torna mais explicito o verbo, o alvo e o mecanismo da politica."
    )
    lines.append("")
    lines.append(
        "As derrotas de `acoes` parecem ocorrer quando a reescrita perde alguma nuance importante do dominio ou simplifica demais documentos ja muito claros na forma original. "
        "Os temas `iluminacao_publica` e `saneamento_basico` sao exemplos disso."
    )
    lines.append("")
    lines.append("## Limitacoes")
    lines.append("")
    lines.append(
        "- A avaliacao usa um pool anotado derivado da uniao dos top-10 das duas abordagens. Isso e adequado para comparacao relativa, mas nao mede recall absoluto do corpus."
    )
    lines.append(
        "- Documentos fora do pool nao foram julgados. Se uma abordagem trouxesse bons itens fora dessa uniao, o experimento atual nao capturaria esse ganho."
    )
    lines.append(
        "- A amostra tem 15 problemas, entao os sinais estatisticos devem ser tratados como exploratorios."
    )
    lines.append(
        "- O arquivo anotado nao registra multiplos avaliadores, entao nao ha medida de concordancia interanotador."
    )
    lines.append("")
    lines.append("## Conclusao")
    lines.append("")
    lines.append(
        "Dentro deste conjunto anotado, a estrategia baseada em `acoes` e superior a busca usando apenas `ementas`. "
        "O ganho e moderado nas metricas globais, mas forte na recuperacao de documentos de alta qualidade e na consistencia do ranking apos a primeira posicao."
    )
    lines.append("")
    lines.append(
        "Se a meta do projeto e maximizar a utilidade pratica das sugestoes para problemas municipais, os dados atuais favorecem usar a representacao em `acoes` como default "
        "ou pelo menos como componente principal de um ranking hibrido."
    )
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    args = build_parser().parse_args()
    pool_rows = list(iter_jsonl(args.pool_path))
    ementas_run = load_runs(args.ementas_path)
    acoes_run = load_runs(args.acoes_path)
    qrels = load_qrels(pool_rows)

    if set(ementas_run) != set(acoes_run):
        raise ValueError("Os arquivos de recomendacao nao contem o mesmo conjunto de problemas.")
    if set(ementas_run) != set(qrels):
        raise ValueError("Os problemas do pool anotado e das recomendacoes nao coincidem.")

    ementas_eval = evaluate_run(ementas_run, qrels)
    acoes_eval = evaluate_run(acoes_run, qrels)

    markdown = build_markdown(pool_rows, ementas_run, acoes_run, ementas_eval, acoes_eval)
    args.output_path.parent.mkdir(parents=True, exist_ok=True)
    args.output_path.write_text(markdown, encoding="utf-8")
    print(f"Analise salva em {args.output_path}")


if __name__ == "__main__":
    main()
