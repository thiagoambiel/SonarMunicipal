from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap, TwoSlopeNorm
from matplotlib.lines import Line2D
from matplotlib.ticker import FormatStrFormatter, MultipleLocator

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from experiments.eval.analyze_annotation_pool import (  # noqa: E402
    ensure_pool_rows_have_metadata,
    evaluate_run,
    iter_jsonl,
    load_qrels,
    load_runs,
)

OUTPUT_DIR = Path(__file__).resolve().parent
POOL_PATH = REPO_ROOT / "experiments/eval/outputs/annotation_pool_categorized.jsonl"
BM25_PATH = REPO_ROOT / "experiments/eval/outputs/recommendations_bm25_ementas.jsonl"
EMENTAS_PATH = REPO_ROOT / "experiments/eval/outputs/recommendations_ementas.jsonl"
ACOES_PATH = REPO_ROOT / "experiments/eval/outputs/recommendations_acoes.jsonl"


@dataclass(frozen=True)
class ProblemMetrics:
    problem_id: str
    precision_at_10: float
    high_recall_at_10: float
    map_at_10: float
    ndcg_at_10: float


PALETTE = {
    "bm25": "#B56649",
    "ementas": "#9FB6CD",
    "acoes": "#173A63",
    "positive": "#2B8C74",
    "negative": "#B56649",
    "text_dark": "#132A45",
    "text_muted": "#506278",
    "grid": "#E5EAF1",
    "spine": "#BFC8D5",
    "bg_box": "#F7F9FC",
    "connector": "#D7DEE8",
    "band": "#FAFBFD",
    "group_bg": "#F3F6FA",
}


def style_matplotlib() -> None:
    plt.rcParams.update(
        {
            "figure.dpi": 180,
            "savefig.dpi": 600,
            "savefig.facecolor": "white",
            "savefig.transparent": False,
            "font.family": "DejaVu Sans",
            "font.size": 10.5,
            "axes.titlesize": 15,
            "axes.titleweight": "bold",
            "axes.labelsize": 11.5,
            "xtick.labelsize": 10.5,
            "ytick.labelsize": 10.5,
            "axes.edgecolor": PALETTE["spine"],
            "axes.labelcolor": PALETTE["text_dark"],
            "xtick.color": PALETTE["text_dark"],
            "ytick.color": PALETTE["text_dark"],
            "pdf.fonttype": 42,
            "ps.fonttype": 42,
            "svg.fonttype": "none",
        }
    )


def save_figure(fig: plt.Figure, stem: str) -> None:
    fig.savefig(
        OUTPUT_DIR / f"{stem}.pdf",
        facecolor="white",
        bbox_inches="tight",
        pad_inches=0.04,
    )
    fig.savefig(
        OUTPUT_DIR / f"{stem}.png",
        facecolor="white",
        bbox_inches="tight",
        pad_inches=0.04,
    )
    plt.close(fig)


def bootstrap_ci(
    values: Sequence[float],
    *,
    samples: int = 20_000,
    seed: int = 42,
) -> tuple[float, float, float]:
    arr = np.asarray(values, dtype=float)
    if arr.size == 0:
        return 0.0, 0.0, 0.0

    rng = np.random.default_rng(seed)
    boot = rng.choice(arr, size=(samples, arr.size), replace=True).mean(axis=1)
    center = float(arr.mean())
    low, high = np.quantile(boot, [0.025, 0.975])
    return center, float(low), float(high)


def short_problem_label(problem_id: str) -> str:
    alias = {
        "agricultura_familiar": "agricultura\nfamiliar",
        "arrecadacao_sem_imposto": "arrecadação\nsem imposto",
        "dengue_arboviroses": "dengue /\narboviroses",
        "digitalizacao_servicos": "digitalização\nde serviços",
        "emprego_jovem": "emprego\njovem",
        "enchentes_urbanas": "enchentes\nurbanas",
        "evasao_ensino_medio": "evasão do\nensino médio",
        "habitacao_interesse_social": "habitação de\ninteresse social",
        "iluminacao_publica": "iluminação\npública",
        "inclusao_pcd": "inclusão\nPcD",
        "mobilidade_pico": "mobilidade\nno pico",
        "residuos_reciclagem": "resíduos /\nreciclagem",
        "saneamento_basico": "saneamento\nbásico",
        "saude_mental_escolas": "saúde mental\nnas escolas",
        "violencia_bairros_centrais": "violência em\nbairros centrais",
    }
    return alias.get(problem_id, problem_id.replace("_", " "))


def sign_counts(values: Iterable[float], tolerance: float = 1e-12) -> tuple[int, int, int]:
    values = list(values)
    wins = sum(value > tolerance for value in values)
    losses = sum(value < -tolerance for value in values)
    ties = len(values) - wins - losses
    return int(wins), int(ties), int(losses)


def add_title_block(
    fig: plt.Figure,
    title: str,
    subtitle: str,
    *,
    x: float,
    title_y: float = 0.972,
    subtitle_y: float = 0.936,
) -> None:
    fig.suptitle(
        title,
        x=x,
        y=title_y,
        ha="left",
        va="top",
        fontsize=15.5,
        fontweight="bold",
        color=PALETTE["text_dark"],
    )
    fig.text(
        x,
        subtitle_y,
        subtitle,
        ha="left",
        va="top",
        fontsize=10.3,
        color=PALETTE["text_muted"],
        linespacing=1.18,
    )


def make_delta_cmap() -> LinearSegmentedColormap:
    return LinearSegmentedColormap.from_list(
        "paper_delta",
        ["#A75A3D", "#F7F9FC", "#2F6EA3"],
        N=256,
    )


def add_alternating_row_bands(ax: plt.Axes, row_count: int, *, color: str = PALETTE["band"]) -> None:
    for idx in range(row_count):
        if idx % 2 == 0:
            ax.axhspan(idx - 0.5, idx + 0.5, facecolor=color, edgecolor="none", zorder=0)


def delta_text_color(value: float) -> str:
    if value > 1e-12:
        return PALETTE["positive"]
    if value < -1e-12:
        return PALETTE["negative"]
    return PALETTE["text_muted"]


def add_metric_group_headers(ax: plt.Axes, *, y: float = 1.055) -> None:
    ax.text(
        0.25,
        y,
        "Ordenação",
        transform=ax.transAxes,
        ha="center",
        va="bottom",
        fontsize=9.1,
        fontweight="bold",
        color=PALETTE["text_dark"],
        bbox=dict(
            boxstyle="round,pad=0.18",
            facecolor=PALETTE["group_bg"],
            edgecolor="none",
        ),
    )
    ax.text(
        0.75,
        y,
        "Topo e cobertura",
        transform=ax.transAxes,
        ha="center",
        va="bottom",
        fontsize=9.1,
        fontweight="bold",
        color=PALETTE["text_dark"],
        bbox=dict(
            boxstyle="round,pad=0.18",
            facecolor=PALETTE["group_bg"],
            edgecolor="none",
        ),
    )


def load_metrics() -> tuple[dict[str, ProblemMetrics], dict[str, ProblemMetrics], dict[str, ProblemMetrics], int]:
    pool_rows = ensure_pool_rows_have_metadata(list(iter_jsonl(POOL_PATH)), POOL_PATH, None)
    qrels = load_qrels(pool_rows)
    benchmark_size = len(pool_rows)

    bm25_eval = evaluate_run(load_runs(BM25_PATH), qrels)
    ementas_eval = evaluate_run(load_runs(EMENTAS_PATH), qrels)
    acoes_eval = evaluate_run(load_runs(ACOES_PATH), qrels)

    def to_problem_metrics(rows: Sequence[object]) -> dict[str, ProblemMetrics]:
        output: dict[str, ProblemMetrics] = {}
        for row in rows:
            output[row.problem_id] = ProblemMetrics(
                problem_id=row.problem_id,
                precision_at_10=row.precision_at_10,
                high_recall_at_10=row.high_recall_at_10,
                map_at_10=row.map_at_10,
                ndcg_at_10=row.ndcg_at_10,
            )
        return output

    return (
        to_problem_metrics(bm25_eval),
        to_problem_metrics(ementas_eval),
        to_problem_metrics(acoes_eval),
        benchmark_size,
    )


def generate_problem_figure(
    problem_ids: Sequence[str],
    labels: Sequence[str],
    bm25: dict[str, ProblemMetrics],
    ementas: dict[str, ProblemMetrics],
    acoes: dict[str, ProblemMetrics],
    benchmark_size: int,
) -> None:
    fig = plt.figure(figsize=(13.2, 9.4), facecolor="white")
    grid = fig.add_gridspec(1, 2, width_ratios=[5.6, 1.2], wspace=0.04)
    ax = fig.add_subplot(grid[0, 0])
    ax_delta = fig.add_subplot(grid[0, 1], sharey=ax)
    fig.subplots_adjust(left=0.25, right=0.975, top=0.845, bottom=0.12)

    y = np.arange(len(problem_ids))
    bm25_ndcg = np.array([bm25[problem_id].ndcg_at_10 for problem_id in problem_ids], dtype=float)
    ementa_ndcg = np.array([ementas[problem_id].ndcg_at_10 for problem_id in problem_ids], dtype=float)
    acao_ndcg = np.array([acoes[problem_id].ndcg_at_10 for problem_id in problem_ids], dtype=float)
    deltas = acao_ndcg - bm25_ndcg

    add_alternating_row_bands(ax, len(problem_ids))
    add_alternating_row_bands(ax_delta, len(problem_ids))

    for idx, (bm25_value, ementa_value, acao_value) in enumerate(zip(bm25_ndcg, ementa_ndcg, acao_ndcg)):
        ax.plot(
            [bm25_value, ementa_value, acao_value],
            [idx, idx, idx],
            color=PALETTE["connector"],
            linewidth=2.0,
            zorder=1,
            solid_capstyle="round",
        )

    ax.scatter(
        bm25_ndcg,
        y,
        s=68,
        facecolor="white",
        edgecolor=PALETTE["bm25"],
        linewidth=1.9,
        label="BM25",
        zorder=3,
    )
    ax.scatter(
        ementa_ndcg,
        y,
        s=50,
        facecolor="white",
        edgecolor=PALETTE["ementas"],
        linewidth=1.2,
        label="Ementas",
        zorder=4,
    )
    ax.scatter(
        acao_ndcg,
        y,
        s=76,
        facecolor=PALETTE["acoes"],
        edgecolor="white",
        linewidth=0.8,
        label="Ações",
        zorder=5,
    )

    ax.set_yticks(y)
    ax.set_yticklabels(labels)
    ax.invert_yaxis()

    xmin = min(bm25_ndcg.min(), ementa_ndcg.min(), acao_ndcg.min()) - 0.05
    xmax = max(bm25_ndcg.max(), ementa_ndcg.max(), acao_ndcg.max()) + 0.05
    ax.set_xlim(max(0.0, xmin), min(1.0, xmax))
    ax.set_xlabel("nDCG@10")
    ax.xaxis.set_major_locator(MultipleLocator(0.10))
    ax.xaxis.set_major_formatter(FormatStrFormatter("%.1f"))
    ax.tick_params(axis="y", pad=8)
    ax.grid(axis="x", color=PALETTE["grid"], linewidth=0.9)
    ax.set_axisbelow(True)

    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color(PALETTE["spine"])
    ax.spines["bottom"].set_color(PALETTE["spine"])

    ax.legend(
        loc="upper left",
        bbox_to_anchor=(0.0, 1.035),
        frameon=False,
        ncol=3,
        handletextpad=0.6,
        columnspacing=1.2,
        borderaxespad=0.0,
        labelspacing=0.8,
    )

    ax_delta.set_facecolor(PALETTE["bg_box"])
    ax_delta.set_xlim(0.0, 1.0)
    ax_delta.set_xticks([])
    ax_delta.tick_params(left=False, labelleft=False)
    for spine in ax_delta.spines.values():
        spine.set_visible(False)
    for idx in range(len(problem_ids) + 1):
        ax_delta.axhline(idx - 0.5, color="#E1E8F0", linewidth=0.8, zorder=0)

    ax_delta.text(
        0.50,
        1.035,
        "Δ Ações - BM25",
        transform=ax_delta.transAxes,
        ha="center",
        va="bottom",
        fontsize=9.2,
        color=PALETTE["text_muted"],
        fontweight="bold",
    )

    for idx, delta in enumerate(deltas):
        ax_delta.text(
            0.50,
            idx,
            f"{delta:+.3f}",
            ha="center",
            va="center",
            fontsize=8.7,
            color=delta_text_color(float(delta)),
        )

    wins, ties, losses = sign_counts(deltas)
    ax.text(
        0.015,
        0.02,
        f"Ganhos: {wins}  •  Empates: {ties}  •  Perdas: {losses}",
        transform=ax.transAxes,
        ha="left",
        va="bottom",
        fontsize=9.2,
        color=PALETTE["text_dark"],
        bbox=dict(
            boxstyle="round,pad=0.30",
            facecolor=PALETTE["bg_box"],
            edgecolor="#D9E1EB",
        ),
    )

    add_title_block(
        fig,
        "Comparação por problema em nDCG@10",
        "Cada linha liga o baseline lexical BM25, a busca por ementas e a busca por ações textualizadas;\n"
        "os problemas estão ordenados pela distância entre ações e BM25, do maior para o menor.",
        x=0.25,
        title_y=0.972,
        subtitle_y=0.936,
    )

    fig.text(
        0.25,
        0.055,
        f"Benchmark exploratório com {len(problem_ids)} problemas, {benchmark_size} pares julgados e pool derivado da união dos top-30.",
        fontsize=9.3,
        color=PALETTE["text_muted"],
    )
    save_figure(fig, "retrieval-eval-problem")


def render_heatmap(
    ax: plt.Axes,
    matrix: np.ndarray,
    *,
    labels: Sequence[str],
    metric_names: Sequence[str],
    title: str,
    cmap: LinearSegmentedColormap,
    norm: TwoSlopeNorm,
):
    im = ax.imshow(matrix, cmap=cmap, norm=norm, aspect="auto", interpolation="nearest")

    ax.set_xticks(np.arange(len(metric_names)))
    ax.set_xticklabels(metric_names)
    ax.set_yticks(np.arange(len(labels)))
    ax.set_yticklabels(labels)

    ax.tick_params(length=0, axis="x", pad=9)
    ax.tick_params(axis="y", pad=6)

    ax.set_xticks(np.arange(-0.5, len(metric_names), 1), minor=True)
    ax.set_yticks(np.arange(-0.5, len(labels), 1), minor=True)
    ax.grid(which="minor", color="white", linewidth=1.3)
    ax.tick_params(which="minor", bottom=False, left=False)

    for spine in ax.spines.values():
        spine.set_visible(False)

    ax.axvline(1.5, color="#D7DEE8", linewidth=2.1)

    ax.text(
        0.0,
        1.125,
        title,
        transform=ax.transAxes,
        ha="left",
        va="bottom",
        fontsize=12.0,
        fontweight="bold",
        color=PALETTE["text_dark"],
    )
    add_metric_group_headers(ax, y=1.045)

    return im


def generate_heatmap_figure(
    problem_ids: Sequence[str],
    labels: Sequence[str],
    bm25: dict[str, ProblemMetrics],
    ementas: dict[str, ProblemMetrics],
    acoes: dict[str, ProblemMetrics],
) -> None:
    fig = plt.figure(figsize=(13.2, 9.2), facecolor="white")
    grid = fig.add_gridspec(
        2,
        2,
        height_ratios=[22, 1.2],
        width_ratios=[1, 1],
        hspace=0.34,
        wspace=0.12,
    )
    axes = [fig.add_subplot(grid[0, 0]), fig.add_subplot(grid[0, 1])]
    cax = fig.add_subplot(grid[1, :])
    fig.subplots_adjust(left=0.24, right=0.97, top=0.79, bottom=0.12)

    metric_specs = [
        ("nDCG", "ndcg_at_10"),
        ("MAP", "map_at_10"),
        ("P@10", "precision_at_10"),
        ("H-Recall", "high_recall_at_10"),
    ]
    metric_names = [label for label, _ in metric_specs]

    delta_ementas = np.array(
        [
            [
                getattr(ementas[problem_id], field) - getattr(bm25[problem_id], field)
                for _, field in metric_specs
            ]
            for problem_id in problem_ids
        ],
        dtype=float,
    )
    delta_acoes = np.array(
        [
            [
                getattr(acoes[problem_id], field) - getattr(bm25[problem_id], field)
                for _, field in metric_specs
            ]
            for problem_id in problem_ids
        ],
        dtype=float,
    )

    vmax = float(max(np.max(np.abs(delta_ementas)), np.max(np.abs(delta_acoes))))
    vmax = max(vmax, 0.05)
    norm = TwoSlopeNorm(vmin=-vmax, vcenter=0.0, vmax=vmax)
    cmap = make_delta_cmap()

    im = render_heatmap(
        axes[0],
        delta_ementas,
        labels=labels,
        metric_names=metric_names,
        title="Ementas - BM25",
        cmap=cmap,
        norm=norm,
    )
    render_heatmap(
        axes[1],
        delta_acoes,
        labels=labels,
        metric_names=metric_names,
        title="Ações - BM25",
        cmap=cmap,
        norm=norm,
    )
    axes[1].tick_params(labelleft=False)

    add_title_block(
        fig,
        "Delta por problema e por métrica",
        "Ganho relativo ao baseline lexical BM25, separando métricas de ordenação (nDCG, MAP)\n"
        "e de desempenho no topo e na cobertura local (P@10, H-Recall).",
        x=0.24,
        title_y=0.972,
        subtitle_y=0.936,
    )

    cbar = fig.colorbar(im, cax=cax, orientation="horizontal")
    cbar.set_label("Delta relativo ao BM25", color=PALETTE["text_dark"])
    cbar.outline.set_edgecolor(PALETTE["spine"])
    cbar.ax.tick_params(colors=PALETTE["text_dark"], labelsize=9.2)
    cbar.set_ticks(np.linspace(-vmax, vmax, 5))
    cbar.ax.xaxis.set_major_formatter(FormatStrFormatter("%.2f"))

    cbar.ax.text(
        0.00,
        1.45,
        "perda",
        transform=cbar.ax.transAxes,
        ha="left",
        va="bottom",
        fontsize=8.6,
        color=PALETTE["text_muted"],
    )
    cbar.ax.text(
        0.50,
        1.45,
        "neutro",
        transform=cbar.ax.transAxes,
        ha="center",
        va="bottom",
        fontsize=8.6,
        color=PALETTE["text_muted"],
    )
    cbar.ax.text(
        1.00,
        1.45,
        "ganho",
        transform=cbar.ax.transAxes,
        ha="right",
        va="bottom",
        fontsize=8.6,
        color=PALETTE["text_muted"],
    )

    fig.text(
        0.24,
        0.055,
        "As duas matrizes usam a mesma escala cromática. A opção por não escrever números nas células favorece a leitura de padrão global na página impressa.",
        fontsize=9.3,
        color=PALETTE["text_muted"],
    )
    save_figure(fig, "retrieval-eval-heatmap")


def generate_summary_figure(
    bm25: dict[str, ProblemMetrics],
    ementas: dict[str, ProblemMetrics],
    acoes: dict[str, ProblemMetrics],
) -> None:
    metric_specs = [
        ("nDCG@10", "ndcg_at_10"),
        ("High-Recall@10", "high_recall_at_10"),
        ("MAP@10", "map_at_10"),
        ("P@10", "precision_at_10"),
    ]
    problem_ids = sorted(bm25.keys())

    fig = plt.figure(figsize=(12.9, 6.2), facecolor="white")
    grid = fig.add_gridspec(1, 2, width_ratios=[4.9, 2.1], wspace=0.05)
    ax = fig.add_subplot(grid[0, 0])
    ax_wtl = fig.add_subplot(grid[0, 1], sharey=ax)
    fig.subplots_adjust(left=0.18, right=0.97, top=0.80, bottom=0.15)

    y = np.arange(len(metric_specs), dtype=float)
    offset = 0.15
    ax.axvline(0.0, color="#98A8BC", linewidth=1.1, linestyle="--", zorder=1)

    legend_handles = [
        Line2D(
            [0],
            [0],
            marker="o",
            color=PALETTE["ementas"],
            markerfacecolor="white",
            markeredgewidth=1.8,
            lw=0,
            label="Ementas - BM25",
            markersize=8,
        ),
        Line2D(
            [0],
            [0],
            marker="o",
            color=PALETTE["acoes"],
            markerfacecolor=PALETTE["acoes"],
            markeredgecolor="white",
            lw=0,
            label="Ações - BM25",
            markersize=9,
        ),
    ]

    rows: list[
        tuple[
            int,
            float,
            float,
            float,
            float,
            float,
            float,
            tuple[int, int, int],
            tuple[int, int, int],
        ]
    ] = []
    x_min = 0.0
    x_max = 0.0

    for idx, (_, field) in enumerate(metric_specs):
        delta_ementas = np.array(
            [getattr(ementas[problem_id], field) - getattr(bm25[problem_id], field) for problem_id in problem_ids],
            dtype=float,
        )
        delta_acoes = np.array(
            [getattr(acoes[problem_id], field) - getattr(bm25[problem_id], field) for problem_id in problem_ids],
            dtype=float,
        )

        center_e, low_e, high_e = bootstrap_ci(delta_ementas)
        center_a, low_a, high_a = bootstrap_ci(delta_acoes)
        wins_e, ties_e, losses_e = sign_counts(delta_ementas)
        wins_a, ties_a, losses_a = sign_counts(delta_acoes)

        rows.append(
            (
                idx,
                center_e,
                low_e,
                high_e,
                center_a,
                low_a,
                high_a,
                (wins_e, ties_e, losses_e),
                (wins_a, ties_a, losses_a),
            )
        )
        x_min = min(x_min, low_e, low_a)
        x_max = max(x_max, high_e, high_a)

    span = max(x_max - x_min, 0.10)
    x_pad = max(0.04, 0.28 * span)
    ax.set_xlim(x_min - 0.025, x_max + x_pad)

    for idx, center_e, low_e, high_e, center_a, low_a, high_a, wtl_e, wtl_a in rows:
        wins_e, ties_e, losses_e = wtl_e
        wins_a, ties_a, losses_a = wtl_a

        ax.errorbar(
            center_e,
            idx + offset,
            xerr=[[center_e - low_e], [high_e - center_e]],
            fmt="o",
            color=PALETTE["ementas"],
            markerfacecolor="white",
            markeredgewidth=1.8,
            ecolor=PALETTE["ementas"],
            elinewidth=2.0,
            capsize=4,
            markersize=8.2,
            zorder=3,
        )
        ax.errorbar(
            center_a,
            idx - offset,
            xerr=[[center_a - low_a], [high_a - center_a]],
            fmt="o",
            color=PALETTE["acoes"],
            markerfacecolor=PALETTE["acoes"],
            markeredgecolor="white",
            ecolor=PALETTE["acoes"],
            elinewidth=2.0,
            capsize=4,
            markersize=8.8,
            zorder=4,
        )

        ax.annotate(
            f"{center_e:+.3f}",
            (high_e, idx + offset),
            xytext=(8, 0),
            textcoords="offset points",
            ha="left",
            va="center",
            fontsize=8.6,
            color=PALETTE["ementas"],
        )
        ax.annotate(
            f"{center_a:+.3f}",
            (high_a, idx - offset),
            xytext=(8, 0),
            textcoords="offset points",
            ha="left",
            va="center",
            fontsize=8.6,
            color=PALETTE["acoes"],
        )

        ax_wtl.text(
            0.30,
            idx,
            f"{wins_e}/{ties_e}/{losses_e}",
            va="center",
            ha="center",
            fontsize=9.0,
            color=PALETTE["text_dark"],
        )
        ax_wtl.text(
            0.78,
            idx,
            f"{wins_a}/{ties_a}/{losses_a}",
            va="center",
            ha="center",
            fontsize=9.0,
            color=PALETTE["text_dark"],
        )

    ax.set_yticks(y)
    ax.set_yticklabels([name for name, _ in metric_specs])
    ax.invert_yaxis()
    ax.set_xlabel("Delta médio por consulta com IC bootstrap de 95%")
    ax.xaxis.set_major_locator(MultipleLocator(0.05))
    ax.xaxis.set_major_formatter(FormatStrFormatter("%.2f"))
    ax.grid(axis="x", color=PALETTE["grid"], linewidth=0.9)
    ax.grid(axis="y", color=PALETTE["grid"], linewidth=0.9)
    ax.set_axisbelow(True)

    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color(PALETTE["spine"])
    ax.spines["bottom"].set_color(PALETTE["spine"])

    ax.legend(
        handles=legend_handles,
        loc="upper left",
        bbox_to_anchor=(0.0, 1.04),
        frameon=False,
        ncol=2,
        columnspacing=1.2,
        handletextpad=0.6,
    )

    ax_wtl.set_facecolor(PALETTE["bg_box"])
    ax_wtl.set_xlim(0.0, 1.0)
    ax_wtl.set_xticks([])
    ax_wtl.tick_params(left=False, labelleft=False)
    for spine in ax_wtl.spines.values():
        spine.set_visible(False)
    for idx in range(len(metric_specs) + 1):
        ax_wtl.axhline(idx - 0.5, color="#E1E8F0", linewidth=0.9, zorder=0)
    ax_wtl.axvline(0.54, color="#D6DEE7", linewidth=0.9, zorder=0)

    ax_wtl.text(
        0.54,
        1.075,
        "W / T / L",
        transform=ax_wtl.transAxes,
        ha="center",
        va="bottom",
        fontsize=9.2,
        color=PALETTE["text_muted"],
        fontweight="bold",
    )
    ax_wtl.text(
        0.30,
        1.01,
        "Ementas",
        transform=ax_wtl.transAxes,
        ha="center",
        va="bottom",
        fontsize=8.9,
        color=PALETTE["text_dark"],
        fontweight="bold",
    )
    ax_wtl.text(
        0.78,
        1.01,
        "Ações",
        transform=ax_wtl.transAxes,
        ha="center",
        va="bottom",
        fontsize=8.9,
        color=PALETTE["text_dark"],
        fontweight="bold",
    )

    add_title_block(
        fig,
        "Resumo agregado com incerteza",
        "Os pontos mostram o ganho médio sobre o BM25; as barras representam IC bootstrap de 95% entre consultas.",
        x=0.18,
        title_y=0.968,
        subtitle_y=0.932,
    )

    fig.text(
        0.18,
        0.06,
        "W/T/L resume vitórias, empates e derrotas por problema. E = Ementas - BM25; A = Ações - BM25.",
        fontsize=9.3,
        color=PALETTE["text_muted"],
    )
    save_figure(fig, "retrieval-eval-summary")


def main() -> None:
    style_matplotlib()

    bm25, ementas, acoes, benchmark_size = load_metrics()
    problem_ids = sorted(
        bm25.keys(),
        key=lambda key: acoes[key].ndcg_at_10 - bm25[key].ndcg_at_10,
        reverse=True,
    )
    labels = [short_problem_label(problem_id) for problem_id in problem_ids]

    generate_problem_figure(problem_ids, labels, bm25, ementas, acoes, benchmark_size)
    generate_heatmap_figure(problem_ids, labels, bm25, ementas, acoes)
    generate_summary_figure(bm25, ementas, acoes)


if __name__ == "__main__":
    main()