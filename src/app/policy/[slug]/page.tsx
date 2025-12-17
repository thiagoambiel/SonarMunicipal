"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { startTransition, useEffect, useState } from "react";

import MinimalNav from "@/components/MinimalNav";
import { buildProjectSlug } from "@/lib/projects";

type PolicyAction = {
  municipio: string;
  uf?: string | null;
  acao: string;
  effect?: number | null;
  url?: string | null;
  data_apresentacao?: string | null;
  ementa?: string | null;
  indicator_before?: number | null;
  indicator_after?: number | null;
};

type PolicySuggestion = {
  policy: string;
  effect_mean?: number | null;
  effect_std?: number | null;
  quality_score?: number | null;
  actions: PolicyAction[];
};

type StoredPolicy = {
  policy: PolicySuggestion;
  used_indicator: boolean;
  indicator_positive_is_good?: boolean;
  indicator_alias?: string;
  effect_window_months?: number;
  indicator_id?: string | null;
};

const DEFAULT_EFFECT_WINDOW = 6;

export default function PolicyDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [data, setData] = useState<StoredPolicy | null>(null);

  useEffect(() => {
    if (!params?.slug) return;
    try {
      const raw = sessionStorage.getItem(`policy-detail-${params.slug}`);
      if (raw) {
        startTransition(() => {
          setData(JSON.parse(raw) as StoredPolicy);
        });
      }
    } catch (error) {
      console.error("Erro ao recuperar detalhes da política", error);
    }
  }, [params?.slug]);

  if (!data) {
    return (
      <div className="landing">
        <MinimalNav />
        <main className="landing-body page-body">
          <div className="message muted">Nenhuma política carregada. Volte e selecione uma política.</div>
          <button className="secondary-btn" onClick={() => router.push("/")}>
            Voltar
          </button>
        </main>
      </div>
    );
  }

  const { policy, used_indicator } = data;
  const indicatorPositiveIsGood = data.indicator_positive_is_good ?? true;
  const indicatorAlias = data.indicator_alias ?? "";
  const effectWindowMonths = data.effect_window_months ?? DEFAULT_EFFECT_WINDOW;
  const projectsLink = `/projects?q=${encodeURIComponent(policy.policy)}`;

  const formatEffectValue = (value?: number | null) => {
    if (value == null) return "—";
    const fixed = value.toFixed(2);
    const signed = value > 0 ? `+${fixed}` : fixed;
    return `${signed}%`;
  };

  const formatIndicatorValue = (value?: number | null) => {
    if (value == null || Number.isNaN(value)) return "—";
    return value.toFixed(2);
  };

  const formatMunicipalityLabel = (municipio: string, uf?: string | null) =>
    uf ? `${municipio} · ${uf}` : municipio;

  const effectNarrative = (value?: number | null) => {
    if (value == null) return "Sem dados suficientes";
    if (value === 0) return "Sem variação estimada";
    const magnitude = Math.abs(value).toFixed(2);
    const target = indicatorAlias || "indicador selecionado";
    const direction = value < 0 ? "Redução" : "Aumento";
    return `${direction} de ${magnitude}% na ${target} em ${effectWindowMonths} meses`;
  };

  const getEffectTone = (value?: number | null) => {
    if (!used_indicator || value == null) return "effect-neutral";
    if (value === 0) return "effect-neutral";
    const isPositive = value > 0;
    const isGood = indicatorPositiveIsGood ? isPositive : !isPositive;
    return isGood ? "effect-good" : "effect-bad";
  };

  const handleProjectClick = (action: PolicyAction) => {
    const slug = buildProjectSlug({
      acao: action.acao,
      ementa: action.ementa,
      municipio: action.municipio,
    });

    const payload = {
      slug,
      municipio: action.municipio,
      uf: action.uf ?? null,
      acao: action.acao,
      ementa: action.ementa ?? null,
      data_apresentacao: action.data_apresentacao ?? null,
      link_publico: action.url ?? null,
      effect: action.effect ?? null,
      effect_window_months: effectWindowMonths,
      indicator_alias: indicatorAlias,
      indicator_id: data.indicator_id ?? null,
      indicator_positive_is_good: indicatorPositiveIsGood,
      indicator_before: action.indicator_before ?? null,
      indicator_after: action.indicator_after ?? null,
      source: "policy" as const,
    };

    try {
      sessionStorage.setItem(`project-detail-${slug}`, JSON.stringify(payload));
    } catch (storageError) {
      console.error("Erro ao salvar detalhes do projeto", storageError);
    }

    router.push(`/projects/${slug}`);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, action: PolicyAction) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleProjectClick(action);
    }
  };

  return (
    <div className="landing">
      <MinimalNav />

      <main className="landing-body page-body">
        <section className="hero">
          <div className="hero-text">
            <p className="eyebrow">Política recomendada</p>
            <h1>{policy.policy}</h1>
            <p className="lede">
              Aplicada em {policy.actions.length} município{policy.actions.length === 1 ? "" : "s"} e selecionada para
              seu contexto. Revise os precedentes e adapte ao seu plano de implementação.
            </p>
            <div className="hero-badges">
              {used_indicator && <span className="pill neutral">{indicatorAlias || "Indicador ativado"}</span>}
              {used_indicator && <span className="pill neutral">Efeito em {effectWindowMonths} meses</span>}
              {used_indicator && (
                <span className={`pill ${indicatorPositiveIsGood ? "success" : "info"}`}>
                  {indicatorPositiveIsGood ? "Objetivo é aumentar o indicador" : "Objetivo é reduzir o indicador"}
                </span>
              )}
              <span className="pill neutral">Fonte: projetos públicos</span>
            </div>
            <div className="hero-actions">
              <button className="secondary-btn" type="button" onClick={() => router.back()}>
                Voltar à lista
              </button>
              <Link className="ghost-btn" href={projectsLink}>
                Ver projetos de lei
              </Link>
            </div>
          </div>
          <div className="hero-panel">
            <div className="stat-card">
              <p className="stat-label">Efeito médio</p>
              <p className={`stat-value`}>
                {used_indicator ? effectNarrative(policy.effect_mean) : "Não calculado"}
              </p>
              <p className="stat-detail">
                Estimativa com base no indicador selecionado e janela de {effectWindowMonths} meses.
              </p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Qualidade</p>
              <p className="stat-value">
                {used_indicator && policy.quality_score != null ? policy.quality_score.toFixed(2) : "—"}
              </p>
              <p className="stat-detail">Consistência das aplicações existentes.</p>
            </div>
          </div>
        </section>

        <section className="policy-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Projetos aplicados</p>
              <h2>Onde a política já funcionou</h2>
              <p className="muted">Analise os precedentes antes de propor a replicação local.</p>
            </div>
          </div>

          <div className="table-card policy-actions-table">
            <div className="table-head">
              <span>Município</span>
              <span>Ação</span>
              <span>Data</span>
              <span>Indicador antes</span>
              <span>Indicador depois</span>
              <span>Variação (% em {effectWindowMonths}m)</span>
            </div>
            {policy.actions.map((action, index) => (
              <div
                key={`${policy.policy}-${action.municipio}-${action.acao}-${index}`}
                className="table-row clickable-row"
                role="button"
                tabIndex={0}
                aria-label={`Ver detalhes do projeto de ${action.municipio}`}
                onClick={() => handleProjectClick(action)}
                onKeyDown={(event) => handleRowKeyDown(event, action)}
              >
                <div>
                  <div className="city-block tight">
                    <span className="strong">{formatMunicipalityLabel(action.municipio, action.uf)}</span>
                    {action.url && (
                      <a
                        href={action.url}
                        target="_blank"
                        rel="noreferrer"
                        className="city-link"
                        aria-label={`Abrir ementa de ${action.municipio}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M14 4H20V10"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M10 14L20 4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M20 14V20H4V4H10"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </a>
                    )}
                  </div>
                  {action.ementa && <p className="muted small">{action.ementa}</p>}
                </div>
                <p>{action.acao}</p>
                <p className="strong numeric-cell">{action.data_apresentacao ?? "—"}</p>
                <p className="strong numeric-cell">
                  {used_indicator ? formatIndicatorValue(action.indicator_before) : "—"}
                </p>
                <p className="strong numeric-cell">
                  {used_indicator ? formatIndicatorValue(action.indicator_after) : "—"}
                </p>
                <p className={`strong ${getEffectTone(action.effect)} numeric-cell`}>
                  {used_indicator && action.effect != null ? `${formatEffectValue(action.effect)}` : "—"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="info-grid">
          <div className="info-card">
            <p className="eyebrow">Próximos passos</p>
            <h3>Planeje a implementação</h3>
            <p>
              Confirme fontes, valide aderência jurídica local e alinhe metas do indicador selecionado. Use os
              precedentes para antecipar recursos necessários.
            </p>
          </div>
          <div className="info-card">
            <p className="eyebrow">Recomendações</p>
            <h3>Checklist rápido</h3>
            <p>
              Consulte equipes técnicas, envolva a procuradoria e comunique a população afetada. Compare efeitos entre
              cidades antes de assumir metas ambiciosas.
            </p>
          </div>
          <div className="info-card">
            <p className="eyebrow">Transparência</p>
            <h3>Revise cada fonte</h3>
            <p>
              Abra o link do município de origem, registre hipóteses e mantenha o histórico de decisões na sua equipe.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
