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
    width = 1600
    height = 900

    background = "#f6f2e8"
    ink = "#1d2a3a"
    muted = "#61738a"
    box_fill = "#fffdf8"
    accent = "#d3622b"
    accent_soft = "#f2d6c8"
    secondary = "#2f7d6a"
    stroke = "#213547"

    steps = [
        (90, 150, 250, 118, "1. Descoberta", "Municípios do IBGE\n+ heurísticas de URL"),
        (390, 150, 250, 118, "2. Extração", "Instâncias SAPL válidas\n+ PLs públicos"),
        (690, 150, 250, 118, "3. Textualização", "Ementas jurídicas\n→ ações textualizadas"),
        (990, 150, 250, 118, "4. Busca semântica", "Embeddings E5\n+ índice no Qdrant"),
        (1290, 150, 220, 118, "5. Análise", "Agrupamento\n+ indicadores"),
    ]

    footer = (460, 570, 680, 150, "Interface pública", "Consulta por problema, exploração de políticas similares\ne inspeção do pipeline em uma única aplicação web")

    def rect(x: int, y: int, w: int, h: int, fill: str, extra: str = "") -> str:
        return (
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="24" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="3"{extra}/>'
        )

    def text_block(x: int, y: int, title: str, body: str, title_fill: str = ink) -> str:
        lines = body.split("\n")
        body_svg = []
        for idx, line in enumerate(lines):
            body_svg.append(
                f'<text x="{x}" y="{y + 42 + idx * 24}" text-anchor="middle" '
                f'font-family="Helvetica, Arial, sans-serif" font-size="24" fill="{muted}">{line}</text>'
            )
        return (
            f'<text x="{x}" y="{y}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" '
            f'font-weight="700" font-size="30" fill="{title_fill}">{title}</text>'
            + "".join(body_svg)
        )

    arrows = []
    for idx in range(len(steps) - 1):
        x1 = steps[idx][0] + steps[idx][2]
        x2 = steps[idx + 1][0]
        y = 209
        arrows.append(
            f'<line x1="{x1 + 14}" y1="{y}" x2="{x2 - 14}" y2="{y}" stroke="{accent}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrow)"/>'
        )

    arrows.append(
        '<path d="M 1400 280 C 1450 360, 1320 470, 1120 570" fill="none" '
        f'stroke="{secondary}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrow-green)"/>'
    )

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        f'<rect width="{width}" height="{height}" fill="{background}"/>',
        "<defs>",
        f'<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{accent}"/></marker>',
        f'<marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{secondary}"/></marker>',
        "</defs>",
        f'<text x="90" y="82" font-family="Helvetica, Arial, sans-serif" font-size="54" font-weight="700" fill="{ink}">Pipeline do Sonar Municipal</text>',
        f'<text x="90" y="120" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="{muted}">Fluxo da descoberta de fontes à consulta pública de políticas similares</text>',
    ]

    for x, y, w, h, title, body in steps:
        fill = accent_soft if "Textualização" in title else box_fill
        svg.append(rect(x, y, w, h, fill))
        svg.append(text_block(x + w / 2, y + 38, title, body, accent if "Textualização" in title else ink))

    svg.extend(arrows)

    fx, fy, fw, fh, ftitle, fbody = footer
    svg.append(rect(fx, fy, fw, fh, "#eef6f3"))
    svg.append(text_block(fx + fw / 2, fy + 42, ftitle, fbody, secondary))

    svg.append(
        f'<text x="110" y="820" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="{muted}">Entrada: municípios brasileiros e portais legislativos heterogêneos</text>'
    )
    svg.append(
        f'<text x="110" y="852" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="{muted}">Saída: infraestrutura reprodutível para busca, agrupamento e apoio exploratório à formulação de políticas</text>'
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
    width, height = 1500, 1180
    bg = "#f7f4ed"
    stroke = "#fbfaf6"
    title = "#182433"
    muted = "#59697f"
    no_data = "#d8ddd5"
    palette = ["#d8e7f5", "#adcbe7", "#78a8d6", "#457db7", "#1f537b"]

    geoms, project = project_factory(features, 920, 980, 60)

    breaks = [1, 5, 15, 30, 60]

    def color_for(value: int) -> str:
        if value <= 0:
            return no_data
        for idx, limit in enumerate(breaks):
            if value <= limit:
                return palette[idx]
        return palette[-1]

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

        if count:
            point = geom.representative_point()
            lx, ly = project(point.x, point.y)
            labels_svg.append(
                f'<text x="{lx:.2f}" y="{ly:.2f}" text-anchor="middle" dominant-baseline="middle" '
                f'font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="700" fill="{title}">{uf}</text>'
            )

    legend_x = 1020
    legend_y = 240
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
        f'<text x="70" y="88" font-family="Helvetica, Arial, sans-serif" font-size="52" font-weight="700" fill="{title}">Cobertura da base por UF</text>',
        f'<text x="70" y="126" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="{muted}">Mapa coroplético com municípios de extração válida por unidade da federação</text>',
        f'<g transform="translate(0,80)">{"".join(states_svg)}{"".join(labels_svg)}</g>',
        f'<rect x="{legend_x - 30}" y="{legend_y - 70}" width="390" height="600" rx="28" fill="#fffdf9" stroke="#d7d2c8" stroke-width="2"/>',
        f'<text x="{legend_x}" y="{legend_y - 25}" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="{title}">Execução congelada</text>',
        f'<text x="{legend_x}" y="{legend_y + 10}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="{muted}">322 municípios em 19 UFs</text>',
    ]

    for idx, (label, color) in enumerate(legend_items):
        y = legend_y + 55 + idx * 52
        svg.append(f'<rect x="{legend_x}" y="{y}" width="34" height="34" rx="7" fill="{color}" stroke="#bcc4cf" stroke-width="1.4"/>')
        svg.append(
            f'<text x="{legend_x + 52}" y="{y + 24}" font-family="Helvetica, Arial, sans-serif" font-size="21" fill="{title}">{label}</text>'
        )

    svg.append(
        f'<text x="{legend_x}" y="{legend_y + 405}" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="{title}">UFs com maior cobertura</text>'
    )
    for idx, line in enumerate(top_lines):
        y = legend_y + 445 + idx * 34
        svg.append(
            f'<text x="{legend_x}" y="{y}" font-family="Helvetica, Arial, sans-serif" font-size="21" fill="{muted}">{line}</text>'
        )

    svg.append(
        f'<text x="{legend_x}" y="{legend_y + 665}" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="{muted}">Fonte: acervo congelado do Sonar Municipal</text>'
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
