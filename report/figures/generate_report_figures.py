#!/usr/bin/env python3

from __future__ import annotations

import json
import math
import re
import subprocess
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Iterable

from shapely.geometry import shape


ROOT = Path(__file__).resolve().parent
COUNTS_PATH = ROOT.parent.parent / "public" / "sapl_pl_counts.json"
BRAZIL_STATES_GEOJSON = (
    "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson"
)


def write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def maybe_convert(svg_path: Path, png_path: Path) -> None:
    subprocess.run(
        ["convert", "-background", "white", "-density", "220", str(svg_path), str(png_path)],
        check=True,
    )


def parse_uf_counts() -> Counter[str]:
    with COUNTS_PATH.open(encoding="utf-8") as fh:
        data = json.load(fh)

    pattern = re.compile(r"\.([a-z]{2})\.leg\.br")
    counts: Counter[str] = Counter()
    for url in data:
        match = pattern.search(url)
        if match:
            counts[match.group(1).upper()] += 1
    return counts


def generate_pipeline_svg() -> str:
    width = 1400
    height = 860

    background = "#f6f2e8"
    ink = "#1d2a3a"
    muted = "#61738a"
    box_fill = "#fffdf8"
    accent = "#d3622b"
    accent_soft = "#f2d6c8"
    secondary = "#2f7d6a"
    stroke = "#213547"

    steps = [
        (90, 180, 340, 126, "1. Descoberta", "Municípios do IBGE\n+ heurísticas de URL"),
        (530, 180, 340, 126, "2. Extração", "Instâncias SAPL válidas\n+ PLs públicos"),
        (970, 180, 340, 126, "3. Textualização", "Ementas jurídicas\n→ ações textualizadas"),
        (310, 410, 340, 126, "4. Busca semântica", "Embeddings E5\n+ índice no Qdrant"),
        (750, 410, 340, 126, "5. Análise", "Agrupamento textual\n+ indicadores"),
    ]

    footer = (
        300,
        650,
        800,
        126,
        "Interface pública",
        "Consulta por problema, exploração de políticas similares\ne inspeção do pipeline em uma única aplicação web",
    )

    def rect(x: int, y: int, w: int, h: int, fill: str, extra: str = "") -> str:
        return (
            f'<rect x="{x + 6}" y="{y + 10}" width="{w}" height="{h}" rx="24" fill="#d9d1c2" opacity="0.25"/>'
            +
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="24" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="3"{extra}/>'
        )

    def text_block(x: int, y: int, title: str, body: str, title_fill: str = ink) -> str:
        lines = body.split("\n")
        body_svg = []
        for idx, line in enumerate(lines):
            body_svg.append(
                f'<text x="{x}" y="{y + 42 + idx * 24}" text-anchor="middle" '
                f'font-family="Helvetica, Arial, sans-serif" font-size="22" fill="{muted}">{line}</text>'
            )
        return (
            f'<text x="{x}" y="{y}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" '
            f'font-weight="700" font-size="28" fill="{title_fill}">{title}</text>'
            + "".join(body_svg)
        )

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        f'<rect width="{width}" height="{height}" fill="{background}"/>',
        "<defs>",
        f'<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{accent}"/></marker>',
        f'<marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{secondary}"/></marker>',
        "</defs>",
        f'<text x="80" y="82" font-family="Helvetica, Arial, sans-serif" font-size="48" font-weight="700" fill="{ink}">Pipeline do Sonar Municipal</text>',
        f'<text x="80" y="116" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="{muted}">Fluxo da descoberta de fontes à consulta pública de políticas similares</text>',
    ]

    for x, y, w, h, title, body in steps:
        fill = accent_soft if "Textualização" in title else box_fill
        svg.append(rect(x, y, w, h, fill))
        svg.append(text_block(x + w / 2, y + 40, title, body, accent if "Textualização" in title else ink))

    svg.extend(
        [
            f'<line x1="430" y1="243" x2="510" y2="243" stroke="{accent}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrow)"/>',
            f'<line x1="870" y1="243" x2="950" y2="243" stroke="{accent}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrow)"/>',
            f'<path d="M 1140 306 C 1160 360, 1110 400, 1040 430" fill="none" stroke="{secondary}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrow-green)"/>',
            f'<path d="M 260 306 C 240 360, 290 400, 360 430" fill="none" stroke="{secondary}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrow-green)"/>',
            f'<line x1="650" y1="473" x2="730" y2="473" stroke="{accent}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrow)"/>',
            f'<path d="M 530 536 C 530 585, 580 620, 700 650" fill="none" stroke="{secondary}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrow-green)"/>',
            f'<path d="M 870 536 C 870 585, 820 620, 700 650" fill="none" stroke="{secondary}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrow-green)"/>',
        ]
    )

    fx, fy, fw, fh, ftitle, fbody = footer
    svg.append(rect(fx, fy, fw, fh, "#eef6f3"))
    svg.append(text_block(fx + fw / 2, fy + 40, ftitle, fbody, secondary))

    svg.append(
        f'<text x="80" y="816" font-family="Helvetica, Arial, sans-serif" font-size="19" fill="{muted}">Entrada: municípios brasileiros e portais legislativos heterogêneos</text>'
    )
    svg.append(
        f'<text x="80" y="844" font-family="Helvetica, Arial, sans-serif" font-size="19" fill="{muted}">Saída: infraestrutura reprodutível para busca, agrupamento e apoio exploratório à formulação de políticas</text>'
    )
    svg.append("</svg>")
    return "".join(svg)


def polygon_to_path(coords: Iterable[tuple[float, float]]) -> str:
    parts = []
    for idx, (x, y) in enumerate(coords):
        cmd = "M" if idx == 0 else "L"
        parts.append(f"{cmd}{x:.2f},{y:.2f}")
    parts.append("Z")
    return " ".join(parts)


def project_factory(features: list[dict], width: int, height: int, margin: int):
    all_x = []
    all_y = []
    geoms = []
    for feature in features:
        geom = shape(feature["geometry"])
        geoms.append(geom)
        minx, miny, maxx, maxy = geom.bounds
        all_x.extend([minx, maxx])
        all_y.extend([miny, maxy])

    minx, maxx = min(all_x), max(all_x)
    miny, maxy = min(all_y), max(all_y)
    scale = min((width - 2 * margin) / (maxx - minx), (height - 2 * margin) / (maxy - miny))

    def project(x: float, y: float) -> tuple[float, float]:
        px = margin + (x - minx) * scale
        py = height - margin - (y - miny) * scale
        return px, py

    return geoms, project


def generate_brazil_coverage_svg(uf_counts: Counter[str]) -> str:
    with urllib.request.urlopen(BRAZIL_STATES_GEOJSON) as response:
        data = json.load(response)

    features = data["features"]
    width, height = 1400, 980
    bg = "#f7f4ed"
    stroke = "#fbfaf6"
    title = "#182433"
    muted = "#59697f"
    no_data = "#d8ddd5"
    palette = ["#d8e7f5", "#adcbe7", "#78a8d6", "#457db7", "#1f537b"]

    map_x = 60
    map_y = 170
    map_w = 820
    map_h = 700

    geoms, project_raw = project_factory(features, map_w, map_h, 30)

    def project(x: float, y: float) -> tuple[float, float]:
        px, py = project_raw(x, y)
        return map_x + px, map_y + py

    breaks = [1, 5, 15, 30, 60]

    def color_for(value: int) -> str:
        if value <= 0:
            return no_data
        for idx, limit in enumerate(breaks):
            if value <= limit:
                return palette[idx]
        return palette[-1]

    def text_color_for(fill: str) -> str:
        fill = fill.lstrip("#")
        r = int(fill[0:2], 16)
        g = int(fill[2:4], 16)
        b = int(fill[4:6], 16)
        luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        return "#ffffff" if luminance < 145 else "#111111"

    label_offsets = {
        "AL": (12, 2),
        "DF": (10, 10),
        "ES": (12, 4),
        "PB": (13, -2),
        "PE": (11, 3),
        "RJ": (10, 6),
        "RN": (13, -4),
        "SE": (12, 2),
    }

    states_svg = []
    labels_svg = []
    covered = 0
    for feature, geom in zip(features, geoms):
        uf = feature["properties"]["sigla"]
        count = uf_counts.get(uf, 0)
        if count:
            covered += 1
        fill = color_for(count)

        if geom.geom_type == "Polygon":
            polygons = [geom]
        else:
            polygons = list(geom.geoms)

        d_parts = []
        for poly in polygons:
            ext = [project(x, y) for x, y in poly.exterior.coords]
            d_parts.append(polygon_to_path(ext))
            for interior in poly.interiors:
                ints = [project(x, y) for x, y in interior.coords]
                d_parts.append(polygon_to_path(ints))

        states_svg.append(
            f'<path d="{" ".join(d_parts)}" fill="{fill}" stroke="{stroke}" stroke-width="2.3" fill-rule="evenodd"/>'
        )

        label_point = geom.representative_point()
        label_x, label_y = project(label_point.x, label_point.y)
        dx, dy = label_offsets.get(uf, (0, 0))
        minx, miny, maxx, maxy = geom.bounds
        box_x1, box_y1 = project(minx, miny)
        box_x2, box_y2 = project(maxx, maxy)
        min_dim = min(abs(box_x2 - box_x1), abs(box_y2 - box_y1))
        if min_dim < 34:
            font_size = 14
        elif min_dim < 60:
            font_size = 16
        else:
            font_size = 20
        labels_svg.append(
            f'<text x="{label_x + dx:.2f}" y="{label_y + dy:.2f}" text-anchor="middle" dominant-baseline="middle" '
            f'font-family="Helvetica, Arial, sans-serif" font-size="{font_size}" font-weight="700" '
            f'fill="{text_color_for(fill)}">{uf}</text>'
        )

    legend_x = 950
    legend_box_y = map_y - 20
    legend_box_h = map_h + 40
    legend_title_y = legend_box_y + 45
    legend_subtitle_y = legend_box_y + 80
    legend_items_y = legend_box_y + 128
    legend_section_y = legend_box_y + 435
    legend_top_states_y = legend_box_y + 478
    legend_source_y = legend_box_y + 695
    legend_items = [
        ("Sem extração válida", no_data),
        ("1–5 municípios", palette[0]),
        ("6–15 municípios", palette[1]),
        ("16–30 municípios", palette[2]),
        ("31–60 municípios", palette[3]),
        ("61+ municípios", palette[4]),
    ]

    top_states = sorted(uf_counts.items(), key=lambda item: (-item[1], item[0]))[:6]
    top_lines = [f"{uf}: {count} municípios" for uf, count in top_states]

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        f'<rect width="{width}" height="{height}" fill="{bg}"/>',
        f'<text x="70" y="78" font-family="Helvetica, Arial, sans-serif" font-size="46" font-weight="700" fill="{title}">Cobertura da base por UF</text>',
        f'<text x="70" y="112" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="{muted}">Mapa coroplético com municípios de extração válida por unidade da federação</text>',
        f'<rect x="{map_x - 10}" y="{map_y - 20}" width="{map_w + 20}" height="{map_h + 40}" rx="26" fill="#fffdf9" stroke="#d7d2c8" stroke-width="2"/>',
        "".join(states_svg),
        "".join(labels_svg),
        f'<rect x="{legend_x - 30}" y="{legend_box_y}" width="380" height="{legend_box_h}" rx="28" fill="#fffdf9" stroke="#d7d2c8" stroke-width="2"/>',
        f'<text x="{legend_x}" y="{legend_title_y}" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="{title}">Execução congelada</text>',
        f'<text x="{legend_x}" y="{legend_subtitle_y}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="{muted}">322 municípios em 19 UFs</text>',
    ]

    for idx, (label, color) in enumerate(legend_items):
        y = legend_items_y + idx * 44
        svg.append(f'<rect x="{legend_x}" y="{y}" width="34" height="34" rx="7" fill="{color}" stroke="#bcc4cf" stroke-width="1.4"/>')
        svg.append(
            f'<text x="{legend_x + 52}" y="{y + 24}" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="{title}">{label}</text>'
        )

    svg.append(
        f'<text x="{legend_x}" y="{legend_section_y}" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="{title}">UFs com maior cobertura</text>'
    )
    for idx, line in enumerate(top_lines):
        y = legend_top_states_y + idx * 30
        svg.append(
            f'<text x="{legend_x}" y="{y}" font-family="Helvetica, Arial, sans-serif" font-size="19" fill="{muted}">{line}</text>'
        )

    svg.append(
        f'<text x="{legend_x}" y="{legend_source_y}" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="{muted}">Fonte: acervo congelado do Sonar Municipal</text>'
    )
    svg.append("</svg>")
    return "".join(svg)


def main() -> None:
    uf_counts = parse_uf_counts()

    pipeline_svg = ROOT / "pipeline-diagram.svg"
    coverage_svg = ROOT / "brazil-coverage-map.svg"
    write(pipeline_svg, generate_pipeline_svg())
    write(coverage_svg, generate_brazil_coverage_svg(uf_counts))

    maybe_convert(pipeline_svg, ROOT / "pipeline-diagram.png")
    maybe_convert(coverage_svg, ROOT / "brazil-coverage-map.png")


if __name__ == "__main__":
    main()
