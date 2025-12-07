"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { startTransition, useEffect, useMemo, useState } from "react";

import { ProjectDetail, getPreferredSourceLink } from "@/lib/projects";

const STORAGE_PREFIX = "project-detail-";

type IndicatorSeriesPoint = {
  date: string;
  value: number;
  year?: number;
  period?: number;
};

type IndicatorSeriesResponse = {
  series?: IndicatorSeriesPoint[];
  presentation_point?: { input_date?: string | null; period_date?: string | null; value: number | null } | null;
  reference_point?: { period_date?: string | null; value: number | null; target_year?: number; target_period?: number } | null;
  effect_window_months?: number | null;
};

type ChartMarker = {
  date: string;
  value: number | null;
  label: string;
  kind: "presentation" | "reference";
};

const formatEffectValue = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "Sem estimativa";
  if (value === 0) return "Sem variação estimada";
  const fixed = value.toFixed(2);
  return `${value > 0 ? "+" : ""}${fixed}%`;
};

const formatIndicatorValue = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(2);
};

const formatEffectNarrative = (project: ProjectDetail) => {
  if (project.effect == null || Number.isNaN(project.effect)) return "Sem estimativa calculada";
  const window = project.effect_window_months ?? 6;
  const target = project.indicator_alias || "indicador selecionado";
  const direction = project.effect < 0 ? "Redução" : "Aumento";
  const magnitude = Math.abs(project.effect).toFixed(2);
  return `${direction} estimada de ${magnitude}% no ${target} em ${window} meses`;
};

const getEffectTone = (project: ProjectDetail) => {
  if (project.effect == null || Number.isNaN(project.effect)) return "effect-neutral";
  if (project.effect === 0) return "effect-neutral";
  const isPositive = project.effect > 0;
  const isGood =
    project.indicator_positive_is_good == null ? null : project.indicator_positive_is_good ? isPositive : !isPositive;
  if (isGood == null) return "effect-neutral";
  return isGood ? "effect-good" : "effect-bad";
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return "Data não informada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
};

const parseTimestamp = (value?: string | null): number | null => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
};

const IndicatorChart = ({
  points,
  markers,
  indicatorLabel,
  locationLabel,
}: {
  points: IndicatorSeriesPoint[];
  markers: ChartMarker[];
  indicatorLabel: string;
  locationLabel: string;
}) => {
  const [hover, setHover] = useState<{
    svgX: number;
    svgY: number;
    pxX: number;
    pxY: number;
    value: number;
    date: string;
  } | null>(null);

  const parsedPoints = points
    .map((item) => ({ ...item, ts: parseTimestamp(item.date) }))
    .filter((item) => item.ts != null && Number.isFinite(item.value))
    .sort((a, b) => (a.ts as number) - (b.ts as number));

  const parsedMarkers = markers
    .map((item) => ({ ...item, ts: parseTimestamp(item.date) }))
    .filter((item) => item.ts != null);

  if (!parsedPoints.length) {
    return <div className="chart-empty">Sem histórico do indicador para exibir.</div>;
  }

  const allTimestamps = [...parsedPoints.map((p) => p.ts as number), ...parsedMarkers.map((m) => m.ts as number)];
  const allValues = [
    ...parsedPoints.map((p) => p.value),
    ...parsedMarkers
      .map((m) => (m.value != null && Number.isFinite(m.value) ? m.value : null))
      .filter((value): value is number => value != null),
  ];

  const minTs = Math.min(...allTimestamps);
  const maxTs = Math.max(...allTimestamps);
  const timeRange = Math.max(1, maxTs - minTs);

  const minValueRaw = allValues.length ? Math.min(...allValues) : 0;
  const maxValueRaw = allValues.length ? Math.max(...allValues) : 1;
  const buffer =
    minValueRaw === maxValueRaw ? Math.max(1, Math.abs(minValueRaw) * 0.1) : (maxValueRaw - minValueRaw) * 0.1;
  const minValue = minValueRaw - buffer;
  const maxValue = maxValueRaw + buffer;
  const valueRange = Math.max(1, maxValue - minValue);

  const width = 780;
  const height = 380;
  const paddingLeft = 84;
  const paddingRight = 28;
  const paddingTop = 24;
  const paddingBottom = 64;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const scaleX = (ts: number) => paddingLeft + ((ts - minTs) / timeRange) * innerWidth;
  const scaleY = (value: number) => paddingTop + innerHeight - ((value - minValue) / valueRange) * innerHeight;

  const pathD = parsedPoints
    .map((point, index) => {
      const x = scaleX(point.ts as number);
      const y = scaleY(point.value);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const valueTicks = [minValue, (minValue + maxValue) / 2, maxValue];
  const dateTicks = [parsedPoints[0], parsedPoints[Math.floor(parsedPoints.length / 2)] ?? parsedPoints[0], parsedPoints.at(-1)]
    .filter(Boolean)
    .map((item) => item as (typeof parsedPoints)[number]);

  const findNearestPoint = (targetX: number) => {
    const tsTarget = minTs + ((targetX - paddingLeft) / innerWidth) * timeRange;
    let nearest = parsedPoints[0];
    let bestDiff = Math.abs((nearest.ts as number) - tsTarget);
    for (let i = 1; i < parsedPoints.length; i += 1) {
      const point = parsedPoints[i];
      const diff = Math.abs((point.ts as number) - tsTarget);
      if (diff < bestDiff) {
        bestDiff = diff;
        nearest = point;
      }
    }
    return nearest;
  };

  const handleLeave = () => setHover(null);
  const handleMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const scaleXFactor = rect.width / width;
    const scaleYFactor = rect.height / height;

    const svgX = Math.min(width - paddingRight, Math.max(paddingLeft, localX / scaleXFactor));
    const nearest = findNearestPoint(svgX);
    const svgY = scaleY(nearest.value);

    setHover({
      svgX,
      svgY,
      pxX: svgX * scaleXFactor,
      pxY: svgY * scaleYFactor,
      value: nearest.value,
      date: nearest.date,
    });
  };

  return (
    <div className="indicator-chart-wrapper" onMouseLeave={handleLeave}>
      <div className="chart-heading">
        <h3 className="chart-title">
          {indicatorLabel} em {locationLabel}
        </h3>
      </div>
      <svg
        className="indicator-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Histórico do indicador"
        onMouseMove={handleMove}
      >
        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} className="chart-axis" />
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          className="chart-axis"
        />

        {dateTicks.map((item, idx) => {
          const x = scaleX(item.ts as number);
          return (
            <g key={`dx-${idx}`}>
              <line x1={x} y1={paddingTop} x2={x} y2={height - paddingBottom} className="chart-grid" />
              <text x={x} y={height - paddingBottom + 16} className="chart-tick" textAnchor="middle">
                {formatDateLabel(item.date)}
              </text>
            </g>
          );
        })}

        {valueTicks.map((value, idx) => {
          const y = scaleY(value);
          return (
            <g key={`vy-${idx}`}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} className="chart-grid" />
              <text x={paddingLeft - 12} y={y + 4} className="chart-tick" textAnchor="end">
                {formatIndicatorValue(value)}
              </text>
            </g>
          );
        })}

        <text x={width / 2} y={height - 14} className="chart-axis-label" textAnchor="middle">
          Data
        </text>
        <text
          x={20}
          y={height / 2}
          className="chart-axis-label"
          textAnchor="middle"
          transform={`rotate(-90 20 ${height / 2})`}
        >
          {indicatorLabel}
        </text>

        <path className="chart-line" d={pathD} />

        {parsedPoints.map((point, idx) => {
          const x = scaleX(point.ts as number);
          const y = scaleY(point.value);
          return (
            <circle
              key={`${point.date}-${idx}`}
              className="chart-node"
              cx={x}
              cy={y}
              r={5}
            />
          );
        })}

        {parsedMarkers.map((marker, idx) => {
          const x = scaleX(marker.ts as number);
          const y =
            marker.value != null && Number.isFinite(marker.value)
              ? scaleY(marker.value)
              : paddingTop + innerHeight;
          return (
            <g key={`${marker.date}-${marker.kind}-${idx}`}>
              <line
                className={`chart-marker-line ${marker.kind}`}
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={height - paddingBottom}
              />
              <circle className={`chart-marker ${marker.kind}`} cx={x} cy={y} r={7} />
            </g>
          );
        })}

        {hover && (
          <line className="chart-hover-line" x1={hover.svgX} y1={paddingTop} x2={hover.svgX} y2={height - paddingBottom} />
        )}
      </svg>

      {hover && (
        <div className="chart-tooltip" style={{ left: hover.pxX, top: hover.pxY }}>
          <p className="legend-title">{formatIndicatorValue(hover.value)}</p>
          <p className="legend-subtitle">{formatDateLabel(hover.date)}</p>
        </div>
      )}
    </div>
  );
};

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [indicatorSeries, setIndicatorSeries] = useState<IndicatorSeriesPoint[]>([]);
  const [seriesMarkers, setSeriesMarkers] = useState<ChartMarker[]>([]);
  const [seriesStatus, setSeriesStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [seriesError, setSeriesError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.slug) return;
    try {
      const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${params.slug}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ProjectDetail;
      startTransition(() => setProject(parsed));
    } catch (error) {
      console.error("Erro ao recuperar detalhes do projeto", error);
    }
  }, [params?.slug]);

  const primaryLink = useMemo(() => (project ? getPreferredSourceLink(project) : null), [project]);
  const secondaryLink = useMemo(() => {
    if (!project) return null;
    if (project.sapl_url && project.sapl_url !== primaryLink) return project.sapl_url;
    if (project.link_publico && project.link_publico !== primaryLink) return project.link_publico;
    return null;
  }, [primaryLink, project]);

  useEffect(() => {
    if (!project || !project.indicator_id || !project.municipio || !project.uf) {
      setIndicatorSeries([]);
      setSeriesMarkers([]);
      setSeriesStatus("idle");
      setSeriesError(null);
      return;
    }

    const controller = new AbortController();
    const fetchSeries = async () => {
      setSeriesStatus("loading");
      setSeriesError(null);
      try {
        const params = new URLSearchParams({
          indicator_id: project.indicator_id,
          city: project.municipio,
          uf: project.uf,
        });
        if (project.data_apresentacao) params.set("presentation_date", project.data_apresentacao);
        if (project.effect_window_months != null) params.set("effect_window_months", String(project.effect_window_months));

        const response = await fetch(`/api/indicator-series?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) {
          let detail = response.statusText;
          try {
            const payload = (await response.json()) as { detail?: string };
            detail = payload.detail ?? detail;
          } catch {
            // ignore parse errors
          }
          throw new Error(detail);
        }

        const payload = (await response.json()) as IndicatorSeriesResponse;
        const parsedSeries = (payload.series ?? [])
          .map((item) => ({ ...item, value: Number(item.value) }))
          .filter((item) => item.date && Number.isFinite(item.value))
          .sort((a, b) => {
            const aTs = parseTimestamp(a.date) ?? 0;
            const bTs = parseTimestamp(b.date) ?? 0;
            return aTs - bTs;
          });

        const markers: ChartMarker[] = [];
        const presentationDate =
          payload.presentation_point?.input_date ??
          payload.presentation_point?.period_date ??
          project.data_apresentacao ??
          null;
        if (presentationDate) {
          markers.push({
            date: presentationDate,
            value: payload.presentation_point?.value ?? project.indicator_before ?? null,
            label: "Apresentação do projeto",
            kind: "presentation",
          });
        }

        const windowMonths = payload.effect_window_months ?? project.effect_window_months ?? null;
        const referenceDate = payload.reference_point?.period_date ?? null;
        if (referenceDate) {
          markers.push({
            date: referenceDate,
            value: payload.reference_point?.value ?? project.indicator_after ?? null,
            label: windowMonths ? `Referência (${windowMonths} meses)` : "Referência para cálculo do efeito",
            kind: "reference",
          });
        }

        setIndicatorSeries(parsedSeries);
        setSeriesMarkers(markers);
        setSeriesStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Erro ao carregar série do indicador", error);
        setIndicatorSeries([]);
        setSeriesMarkers([]);
        setSeriesStatus("error");
        setSeriesError((error as Error)?.message ?? "Falha ao carregar série do indicador");
      }
    };

    void fetchSeries();
    return () => controller.abort();
  }, [project]);

  if (!project) {
    return (
      <div className="landing">
        <header className="minimal-nav">
          <div className="nav-brand">
            <div className="nav-logo">CM</div>
            <span className="nav-title">CityManager</span>
          </div>
          <nav className="nav-links-minimal">
            <Link className="nav-link-minimal" href="/">
              Gerador de Políticas Públicas
            </Link>
            <Link className="nav-link-minimal" href="/projects">
              Projetos de Lei
            </Link>
            <Link className="nav-link-minimal" href="/methodology">
              Metodologia
            </Link>
          </nav>
        </header>
        <main className="landing-body page-body">
          <div className="message muted">Nenhum projeto carregado. Volte e selecione um projeto de lei.</div>
          <button className="secondary-btn" onClick={() => router.push("/projects")}>
            Voltar
          </button>
        </main>
      </div>
    );
  }

  const title = project.acao || "Projeto de lei sem título";
  const lede =
    project.ementa ||
    "Sem ementa registrada neste resultado. Abra a fonte oficial para revisar o texto do projeto de lei.";
  const location = project.municipio
    ? `${project.municipio}${project.uf ? ` · ${project.uf}` : ""}`
    : "Município não informado";
  const locationTitle = project.municipio
    ? `${project.municipio}${project.uf ? ` (${project.uf})` : ""}`
    : "Município não informado";
  const score = project.score ?? null;
  const sourceLabel = project.source === "policy" ? "Sugestão de política pública" : "Resultado de busca";
  const effectToneClass = getEffectTone(project);

  return (
    <div className="landing">
      <header className="minimal-nav">
        <div className="nav-brand">
          <div className="nav-logo">CM</div>
          <span className="nav-title">CityManager</span>
        </div>
        <nav className="nav-links-minimal">
          <Link className="nav-link-minimal" href="/">
            Gerador de Políticas Públicas
          </Link>
          <span className="nav-link-minimal active">Projetos de Lei</span>
          <Link className="nav-link-minimal" href="/methodology">
            Metodologia
          </Link>
        </nav>
      </header>

      <main className="landing-body page-body">
        <section className="hero">
          <div className="hero-text">
            <p className="eyebrow">{sourceLabel}</p>
            <h1>{title}</h1>
            <p className="lede">{lede}</p>
            <div className="hero-badges">
              <span className="pill neutral">{location}</span>
              {project.data_apresentacao && <span className="pill neutral">Apresentado em {project.data_apresentacao}</span>}
              {project.tipo_label && <span className="pill neutral">{project.tipo_label}</span>}
              {project.indicator_alias && <span className="pill neutral">Indicador: {project.indicator_alias}</span>}
            </div>
            <div className="hero-actions">
              <button className="secondary-btn" type="button" onClick={() => router.back()}>
                Voltar
              </button>
              {primaryLink && (
                <a className="ghost-btn" href={primaryLink} target="_blank" rel="noreferrer">
                  Abrir fonte
                </a>
              )}
            </div>
          </div>
          <div className="hero-panel">
            <div className="stat-card">
              <p className="stat-label">Relevância</p>
              <p className="stat-value">{score != null ? score.toFixed(2) : "Sem pontuação"}</p>
              <p className="stat-detail">
                Pontuação de similaridade do resultado retornado pela busca semântica.
              </p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Efeito estimado</p>
              <p className={`stat-value ${effectToneClass}`}>
                {formatEffectValue(project.effect)}
              </p>
              <p className="stat-detail">{formatEffectNarrative(project)}</p>
              {(project.indicator_before != null || project.indicator_after != null) && (
                <p className="stat-detail">
                  Antes: {formatIndicatorValue(project.indicator_before)} · Depois:{" "}
                  {formatIndicatorValue(project.indicator_after)}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="policy-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Ficha do projeto</p>
              <h2>Dados principais</h2>
              <p className="muted">Local, data e links oficiais para aprofundar a análise.</p>
            </div>
            {project.index != null && <span className="pill neutral">Índice #{project.index}</span>}
          </div>

          <div className="info-grid">
            <div className="info-card">
              <p className="eyebrow">Local</p>
              <h3>{location}</h3>
              <p className="muted small">
                {project.uf ? `UF ${project.uf}` : "UF não informada"} · {project.tipo_label || "Tipo não informado"}
              </p>
            </div>
            <div className="info-card">
              <p className="eyebrow">Apresentação</p>
              <h3>{project.data_apresentacao || "Data não informada"}</h3>
              <p className="muted small">
                O histórico de tramitação deve ser confirmado na fonte original.
              </p>
            </div>
            <div className="info-card">
              <p className="eyebrow">Fontes</p>
              <h3>{primaryLink ? "Fonte oficial" : "Nenhum link disponível"}</h3>
              <p className="muted small">
                Consulte a fonte antes de usar o texto como referência. Links podem variar por município.
              </p>
              <div className="chips-inline" style={{ marginTop: "8px" }}>
                {primaryLink && (
                  <a className="ghost-btn" href={primaryLink} target="_blank" rel="noreferrer">
                    Abrir fonte
                  </a>
                )}
                {secondaryLink && (
                  <a className="ghost-link" href={secondaryLink} target="_blank" rel="noreferrer">
                    Link alternativo
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="policy-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Histórico do indicador</p>
              <h2>Variação no município</h2>
              <p className="muted">Linha do indicador com marcações de apresentação e janela usada no efeito.</p>
            </div>
            {seriesStatus === "loading" && <span className="pill neutral">Carregando série…</span>}
            {seriesStatus === "error" && <span className="pill danger">Falha ao carregar</span>}
          </div>
          <div className="indicator-chart-card">
            {!project.indicator_id ? (
              <p className="muted small">Nenhum indicador associado para gerar o gráfico neste projeto.</p>
            ) : seriesStatus === "loading" ? (
              <p className="muted small">Carregando série do indicador…</p>
            ) : seriesStatus === "error" ? (
              <p className="muted small">
                Não foi possível carregar a série do indicador para este município.
                {seriesError ? ` ${seriesError}` : ""}
              </p>
            ) : indicatorSeries.length ? (
              <>
                <IndicatorChart
                  points={indicatorSeries}
                  markers={seriesMarkers}
                  indicatorLabel={project.indicator_alias || "Indicador"}
                  locationLabel={locationTitle}
                />
                {seriesMarkers.length > 0 && (
                  <div className="chart-legend">
                    {seriesMarkers.map((marker, idx) => (
                      <div key={`${marker.kind}-${marker.date}-${idx}`} className="legend-item">
                        <span className={`legend-dot ${marker.kind}`} aria-hidden="true" />
                        <div>
                          <p className="legend-title">{marker.label}</p>
                          <p className="legend-subtitle">
                            {formatDateLabel(marker.date)} · Valor: {formatIndicatorValue(marker.value)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="muted small">Sem dados do indicador para este município.</p>
            )}
          </div>
        </section>

        <section className="policy-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Ementa</p>
              <h2>Texto base do projeto</h2>
              <p className="muted">Use como ponto de partida e adapte ao contexto local.</p>
            </div>
          </div>
          <div className="info-card">
            <p className="detail-ementa">{lede}</p>
          </div>
        </section>

        <section className="info-grid">
          <div className="info-card">
            <p className="eyebrow">Contexto do indicador</p>
            <h3>{project.indicator_alias || "Sem indicador associado"}</h3>
            <p className="muted">
              {project.effect != null
                ? `Estimativa calculada considerando ${project.effect_window_months ?? 6} meses de observação.`
                : "Nenhuma estimativa de efeito foi associada a este projeto."}
            </p>
          </div>
          <div className="info-card">
            <p className="eyebrow">Como usar</p>
            <h3>Próximos passos</h3>
            <p className="muted">
              Valide a aderência jurídica local, envolva a procuradoria e confirme o status legislativo. Compare com
              outros municípios antes de replicar.
            </p>
          </div>
          <div className="info-card">
            <p className="eyebrow">Origem</p>
            <h3>{sourceLabel}</h3>
            <p className="muted">
              Resultado gerado a partir dos dados consultados na plataforma. Revise a fonte para assegurar que o texto
              segue atualizado.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
