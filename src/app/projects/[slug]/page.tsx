"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { ProjectDetail, getPreferredSourceLink } from "@/lib/projects";

const STORAGE_PREFIX = "project-detail-";

const formatEffectValue = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "Sem estimativa";
  if (value === 0) return "Sem variação estimada";
  const fixed = value.toFixed(2);
  return `${value > 0 ? "+" : ""}${fixed}%`;
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

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);

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
