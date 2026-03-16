
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap, TwoSlopeNorm
from matplotlib.ticker import FormatStrFormatter, MultipleLocator

OUTPUT_DIR = Path(__file__).resolve().parent


@dataclass(frozen=True)
class ProblemEvaluation:
    problem_id: str
    precision_at_10: float
    high_recall_at_10: float
    map_at_10: float
    ndcg_at_10: float


PROBLEM_METRICS: dict[str, dict[str, ProblemEvaluation]] = {
    "agricultura_familiar": {
        "ementas": ProblemEvaluation("agricultura_familiar", 1.000, 0.250, 0.526, 0.505),
        "acoes": ProblemEvaluation("agricultura_familiar", 1.000, 0.750, 0.526, 0.793),
    },
    "arrecadacao_sem_imposto": {
        "ementas": ProblemEvaluation("arrecadacao_sem_imposto", 0.500, 0.714, 0.543, 0.705),
        "acoes": ProblemEvaluation("arrecadacao_sem_imposto", 0.500, 0.714, 0.690, 0.846),
    },
    "dengue_arboviroses": {
        "ementas": ProblemEvaluation("dengue_arboviroses", 1.000, 0.500, 0.526, 0.940),
        "acoes": ProblemEvaluation("dengue_arboviroses", 1.000, 0.556, 0.526, 0.807),
    },
    "digitalizacao_servicos": {
        "ementas": ProblemEvaluation("digitalizacao_servicos", 0.600, 0.429, 0.350, 0.403),
        "acoes": ProblemEvaluation("digitalizacao_servicos", 1.000, 0.714, 0.769, 0.662),
    },
    "emprego_jovem": {
        "ementas": ProblemEvaluation("emprego_jovem", 0.800, 0.300, 0.456, 0.433),
        "acoes": ProblemEvaluation("emprego_jovem", 0.700, 0.700, 0.426, 0.802),
    },
    "enchentes_urbanas": {
        "ementas": ProblemEvaluation("enchentes_urbanas", 0.400, 0.333, 0.231, 0.430),
        "acoes": ProblemEvaluation("enchentes_urbanas", 1.000, 0.833, 0.833, 0.964),
    },
    "evasao_ensino_medio": {
        "ementas": ProblemEvaluation("evasao_ensino_medio", 1.000, 0.769, 0.769, 1.000),
        "acoes": ProblemEvaluation("evasao_ensino_medio", 1.000, 0.769, 0.769, 1.000),
    },
    "habitacao_interesse_social": {
        "ementas": ProblemEvaluation("habitacao_interesse_social", 1.000, 0.588, 0.588, 0.827),
        "acoes": ProblemEvaluation("habitacao_interesse_social", 1.000, 0.588, 0.588, 0.955),
    },
    "iluminacao_publica": {
        "ementas": ProblemEvaluation("iluminacao_publica", 0.900, 0.636, 0.398, 0.673),
        "acoes": ProblemEvaluation("iluminacao_publica", 1.000, 0.364, 0.526, 0.483),
    },
    "inclusao_pcd": {
        "ementas": ProblemEvaluation("inclusao_pcd", 1.000, 0.600, 0.588, 0.757),
        "acoes": ProblemEvaluation("inclusao_pcd", 1.000, 0.600, 0.588, 0.802),
    },
    "mobilidade_pico": {
        "ementas": ProblemEvaluation("mobilidade_pico", 0.800, 0.500, 0.478, 0.553),
        "acoes": ProblemEvaluation("mobilidade_pico", 0.700, 0.500, 0.413, 0.566),
    },
    "residuos_reciclagem": {
        "ementas": ProblemEvaluation("residuos_reciclagem", 1.000, 0.471, 0.526, 0.673),
        "acoes": ProblemEvaluation("residuos_reciclagem", 1.000, 0.588, 0.526, 1.000),
    },
    "saneamento_basico": {
        "ementas": ProblemEvaluation("saneamento_basico", 1.000, 0.444, 0.500, 0.928),
        "acoes": ProblemEvaluation("saneamento_basico", 1.000, 0.556, 0.500, 0.773),
    },
    "saude_mental_escolas": {
        "ementas": ProblemEvaluation("saude_mental_escolas", 1.000, 0.571, 0.625, 0.852),
        "acoes": ProblemEvaluation("saude_mental_escolas", 1.000, 0.714, 0.625, 0.926),
    },
    "violencia_bairros_centrais": {
        "ementas": ProblemEvaluation("violencia_bairros_centrais", 0.700, 0.375, 0.265, 0.383),
        "acoes": ProblemEvaluation("violencia_bairros_centrais", 1.000, 0.625, 0.588, 0.651),
    },
}


PALETTE = {
    "ementas": "#A8B6C7",
    "acoes": "#173A63",
    "positive": "#2B8C74",
    "negative": "#B56649",
    "neutral": "#BAC4D0",
    "text_dark": "#132A45",
    "text_muted": "#506278",
    "grid": "#E5EAF1",
    "spine": "#BFC8D5",
    "bg_box": "#F7F9FC",
}


def style_matplotlib() -> None:
    """Aplica um tema consistente e adequado para figuras de artigo."""
    plt.rcParams.update(
        {
            "figure.dpi": 180,
            "savefig.dpi": 320,
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
    """Salva as figuras apenas em PDF vetorial."""
    fig.savefig(
        OUTPUT_DIR / f"{stem}.pdf",
        facecolor="white",
        bbox_inches="tight",
        pad_inches=0.03,
    )
    plt.close(fig)


def bootstrap_ci(
    values: Sequence[float],
    *,
    samples: int = 20_000,
    seed: int = 42,
) -> tuple[float, float, float]:
    """
    Calcula média e IC bootstrap percentílico de 95%.

    A implementação é vetorizada para evitar o gargalo do loop Python.
    """
    arr = np.asarray(values, dtype=float)

    if arr.size == 0:
        return 0.0, 0.0, 0.0

    rng = np.random.default_rng(seed)
    boot = rng.choice(arr, size=(samples, arr.size), replace=True).mean(axis=1)
    center = float(arr.mean())
    low, high = np.quantile(boot, [0.025, 0.975])
    return center, float(low), float(high)


def short_problem_label(problem_id: str) -> str:
    """Gera rótulos curtos com quebras de linha controladas."""
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
    """Conta vitórias, empates e perdas."""
    values = list(values)
    wins = sum(value > tolerance for value in values)
    losses = sum(value < -tolerance for value in values)
    ties = len(values) - wins - losses
    return int(wins), int(ties), int(losses)


def add_title_block(fig: plt.Figure, title: str, subtitle: str, *, x: float = 0.08) -> None:
    """Cria um bloco de título separado do eixo para evitar sobreposição."""
    fig.suptitle(
        title,
        x=x,
        y=0.968,
        ha="left",
        va="top",
        fontsize=15.5,
        fontweight="bold",
        color=PALETTE["text_dark"],
    )
    fig.text(
        x,
        0.924,
        subtitle,
        ha="left",
        va="top",
        fontsize=10.8,
        color=PALETTE["text_muted"],
    )


def luminance(rgba: tuple[float, float, float, float]) -> float:
    """Retorna luminância perceptual aproximada para contraste do texto."""
    r, g, b, _ = rgba
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def make_delta_cmap() -> LinearSegmentedColormap:
    """Mapa divergente sóbrio com centro quase branco."""
    return LinearSegmentedColormap.from_list(
        "paper_delta",
        ["#B56649", "#F8FAFC", "#2F69A1"],
        N=256,
    )


def generate_problem_figure(
    problem_ids: Sequence[str],
    labels: Sequence[str],
    ementas: Mapping[str, ProblemEvaluation],
    acoes: Mapping[str, ProblemEvaluation],
) -> None:
    fig, ax = plt.subplots(figsize=(11.8, 7.0), facecolor="white")
    fig.subplots_adjust(left=0.22, right=0.98, top=0.90, bottom=0.12)

    y = np.arange(len(problem_ids))
    ementa_ndcg = np.array([ementas[problem_id].ndcg_at_10 for problem_id in problem_ids], dtype=float)
    acao_ndcg = np.array([acoes[problem_id].ndcg_at_10 for problem_id in problem_ids], dtype=float)
    deltas = acao_ndcg - ementa_ndcg

    for idx, (ementa_value, acao_value, delta_value) in enumerate(zip(ementa_ndcg, acao_ndcg, deltas)):
        line_color = (
            PALETTE["positive"]
            if delta_value > 1e-12
            else PALETTE["negative"]
            if delta_value < -1e-12
            else PALETTE["neutral"]
        )
        ax.hlines(idx, xmin=ementa_value, xmax=acao_value, color=line_color, linewidth=2.4, zorder=1, alpha=0.95)

    ax.scatter(
        ementa_ndcg,
        y,
        s=74,
        facecolor="white",
        edgecolor=PALETTE["ementas"],
        linewidth=1.9,
        label="Ementas",
        zorder=3,
    )
    ax.scatter(
        acao_ndcg,
        y,
        s=74,
        facecolor=PALETTE["acoes"],
        edgecolor="white",
        linewidth=0.8,
        label="Ações",
        zorder=4,
    )

    ax.set_yticks(y)
    ax.set_yticklabels(labels)
    ax.invert_yaxis()

    xmin = min(ementa_ndcg.min(), acao_ndcg.min()) - 0.07
    xmax = min(1.02, max(ementa_ndcg.max(), acao_ndcg.max()) + 0.03)
    ax.set_xlim(max(0.30, xmin), xmax)
    ax.set_xlabel("nDCG@10")
    ax.xaxis.set_major_locator(MultipleLocator(0.10))
    ax.xaxis.set_major_formatter(FormatStrFormatter("%.1f"))

    ax.grid(axis="x", color=PALETTE["grid"], linewidth=0.9)
    ax.set_axisbelow(True)

    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color(PALETTE["spine"])
    ax.spines["bottom"].set_color(PALETTE["spine"])

    add_title_block(
        fig,
        "Comparação pareada por problema",
        "Cada linha conecta o desempenho das ementas originais e das ações textualizadas em nDCG@10.",
        x=0.22,
    )

    wins, ties, losses = sign_counts(deltas)
    ax.text(
        0.015,
        0.02,
        f"Δ nDCG@10: {wins} ganhos, {ties} empate, {losses} perdas",
        transform=ax.transAxes,
        ha="left",
        va="bottom",
        fontsize=9.4,
        color=PALETTE["text_dark"],
        bbox=dict(
            boxstyle="round,pad=0.30",
            facecolor=PALETTE["bg_box"],
            edgecolor="#D9E1EB",
        ),
    )

    ax.legend(
        loc="upper right",
        frameon=False,
        ncol=2,
        handletextpad=0.6,
        columnspacing=1.5,
        borderaxespad=0.3,
    )

    fig.text(
        0.22,
        0.045,
        "Benchmark exploratório com 15 problemas, pool da união dos top-10 e julgamentos automatizados.",
        fontsize=9.4,
        color=PALETTE["text_muted"],
    )
    save_figure(fig, "retrieval-eval-problem")


def generate_heatmap_figure(
    problem_ids: Sequence[str],
    labels: Sequence[str],
    delta_matrix: np.ndarray,
    metric_names: Sequence[str],
) -> None:
    fig, ax = plt.subplots(figsize=(11.8, 7.4), facecolor="white")
    fig.subplots_adjust(left=0.22, right=0.94, top=0.90, bottom=0.16)

    vmax = float(np.max(np.abs(delta_matrix)))
    norm = TwoSlopeNorm(vmin=-vmax, vcenter=0.0, vmax=vmax)
    cmap = make_delta_cmap()

    im = ax.imshow(delta_matrix, cmap=cmap, norm=norm, aspect="auto", interpolation="nearest")

    ax.set_xticks(np.arange(len(metric_names)))
    ax.set_xticklabels(metric_names)
    ax.set_yticks(np.arange(len(problem_ids)))
    ax.set_yticklabels(labels)
    ax.tick_params(length=0)

    # Grade branca fina para destacar células sem criar ruído visual.
    ax.set_xticks(np.arange(-0.5, len(metric_names), 1), minor=True)
    ax.set_yticks(np.arange(-0.5, len(problem_ids), 1), minor=True)
    ax.grid(which="minor", color="white", linewidth=1.4)
    ax.tick_params(which="minor", bottom=False, left=False)

    for row in range(delta_matrix.shape[0]):
        for col in range(delta_matrix.shape[1]):
            value = float(delta_matrix[row, col])
            rgba = cmap(norm(value))
            text_color = "white" if luminance(rgba) < 0.58 else PALETTE["text_dark"]
            ax.text(
                col,
                row,
                f"{value:+.2f}",
                ha="center",
                va="center",
                fontsize=9.3,
                color=text_color,
                fontweight="bold" if abs(value) >= 0.10 else "normal",
            )

    for spine in ax.spines.values():
        spine.set_visible(False)

    add_title_block(
        fig,
        "Delta por problema e por métrica",
        "Cada célula mostra Δ = ações - ementas. Azul indica ganho relativo; terracota indica perda.",
        x=0.22,
    )

    cbar = fig.colorbar(im, ax=ax, orientation="horizontal", pad=0.08, fraction=0.05, aspect=35)
    cbar.set_label("Delta da métrica (ações - ementas)", color=PALETTE["text_dark"])
    cbar.outline.set_edgecolor(PALETTE["spine"])
    cbar.ax.tick_params(colors=PALETTE["text_dark"], labelsize=9.5)

    fig.text(
        0.22,
        0.045,
        "Escala divergente centrada em zero. A intensidade codifica magnitude do efeito por consulta.",
        fontsize=9.4,
        color=PALETTE["text_muted"],
    )
    save_figure(fig, "retrieval-eval-heatmap")


def generate_summary_figure(
    summary_rows: Sequence[tuple[str, float, float, float, int, int, int]],
) -> None:
    fig, ax = plt.subplots(figsize=(11.8, 4.8), facecolor="white")
    fig.subplots_adjust(left=0.15, right=0.96, top=0.85, bottom=0.19)

    y = np.arange(len(summary_rows))
    centers = np.array([row[1] for row in summary_rows], dtype=float)
    lows = np.array([row[2] for row in summary_rows], dtype=float)
    highs = np.array([row[3] for row in summary_rows], dtype=float)

    left_err = centers - lows
    right_err = highs - centers

    x_left = min(-0.02, float(lows.min()) - 0.02)
    x_right = float(highs.max()) + 0.055

    ax.axvline(0.0, color="#98A8BC", linewidth=1.1, linestyle="--", zorder=1)
    ax.errorbar(
        centers,
        y,
        xerr=[left_err, right_err],
        fmt="o",
        color=PALETTE["acoes"],
        ecolor=PALETTE["acoes"],
        elinewidth=2.0,
        capsize=5,
        markersize=8.5,
        zorder=3,
    )

    ax.set_yticks(y)
    ax.set_yticklabels([row[0] for row in summary_rows])
    ax.invert_yaxis()
    ax.set_xlim(x_left, x_right)
    ax.set_xlabel("Delta médio por consulta com IC bootstrap de 95%")

    ax.xaxis.set_major_locator(MultipleLocator(0.05))
    ax.xaxis.set_major_formatter(FormatStrFormatter("%.2f"))
    ax.grid(axis="x", color=PALETTE["grid"], linewidth=0.9)
    ax.set_axisbelow(True)

    for idx, row in enumerate(summary_rows):
        metric_name, center, _, _, wins, ties, losses = row
        ax.text(
            center,
            idx - 0.23,
            f"{center:+.3f}",
            va="bottom",
            ha="center",
            fontsize=9.0,
            color=PALETTE["text_muted"],
        )
        ax.text(
            x_right - 0.003,
            idx,
            f"W/T/L: {wins}/{ties}/{losses}",
            va="center",
            ha="right",
            fontsize=9.5,
            color=PALETTE["text_dark"],
        )

    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color(PALETTE["spine"])
    ax.spines["bottom"].set_color(PALETTE["spine"])

    add_title_block(
        fig,
        "Resumo agregado com incerteza",
        "Os pontos mostram o ganho médio por métrica; as barras representam IC bootstrap de 95% entre consultas.",
        x=0.15,
    )

    fig.text(
        0.15,
        0.07,
        "W/T/L resume quantos problemas tiveram ganho, empate ou perda em cada métrica.",
        fontsize=9.4,
        color=PALETTE["text_muted"],
    )
    save_figure(fig, "retrieval-eval-summary")


def main() -> None:
    style_matplotlib()

    ementas = {problem_id: values["ementas"] for problem_id, values in PROBLEM_METRICS.items()}
    acoes = {problem_id: values["acoes"] for problem_id, values in PROBLEM_METRICS.items()}

    problem_ids = sorted(
        ementas.keys(),
        key=lambda key: acoes[key].ndcg_at_10 - ementas[key].ndcg_at_10,
    )
    labels = [short_problem_label(problem_id) for problem_id in problem_ids]

    metric_specs = [
        ("nDCG@10", "ndcg_at_10"),
        ("MAP@10", "map_at_10"),
        ("P@10", "precision_at_10"),
        ("High-Recall@10", "high_recall_at_10"),
    ]

    delta_matrix = np.array(
        [
            [
                getattr(acoes[problem_id], field) - getattr(ementas[problem_id], field)
                for _, field in metric_specs
            ]
            for problem_id in problem_ids
        ],
        dtype=float,
    )

    summary_rows: list[tuple[str, float, float, float, int, int, int]] = []
    for metric_name, field in metric_specs:
        deltas = [
            getattr(acoes[problem_id], field) - getattr(ementas[problem_id], field)
            for problem_id in problem_ids
        ]
        center, low, high = bootstrap_ci(deltas)
        wins, ties, losses = sign_counts(deltas)
        summary_rows.append((metric_name, center, low, high, wins, ties, losses))

    generate_problem_figure(problem_ids, labels, ementas, acoes)
    generate_heatmap_figure(problem_ids, labels, delta_matrix, [metric_name for metric_name, _ in metric_specs])
    generate_summary_figure(summary_rows)


if __name__ == "__main__":
    main()
