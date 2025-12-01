"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PolicyAction = {
  municipio: string;
  acao: string;
  effect?: number | null;
  url?: string | null;
  data_apresentacao?: string | null;
  ementa?: string | null;
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
};

export default function PolicyDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [data, setData] = useState<StoredPolicy | null>(null);

  useEffect(() => {
    if (!params?.slug) return;
    try {
      const raw = sessionStorage.getItem(`policy-detail-${params.slug}`);
      if (raw) {
        setData(JSON.parse(raw) as StoredPolicy);
      }
    } catch (error) {
        console.error("Erro ao recuperar detalhes da política", error);
    }
  }, [params?.slug]);

  if (!data) {
    return (
      <div className="page google-layout">
        <div className="page-surface">
          <header className="topbar">
            <div className="brand">
              <div className="brand-mark">CM</div>
              <div>
                <p className="brand-title">CityManager</p>
                <p className="brand-subtitle">Detalhamento de política</p>
              </div>
            </div>
            <nav className="nav">
              <div className="nav-links">
                <Link className="nav-link" href="/">
                  Políticas Públicas
                </Link>
                <Link className="nav-link" href="/projects">
                  Projetos de Lei
                </Link>
              </div>
            </nav>
          </header>
          <main className="page-body">
            <div className="message muted">Nenhuma política carregada. Volte e selecione uma política.</div>
            <button className="secondary-btn" onClick={() => router.push("/")}>
              Voltar
            </button>
          </main>
        </div>
      </div>
    );
  }

  const { policy, used_indicator } = data;

  return (
    <div className="page google-layout">
      <div className="page-surface">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">CM</div>
            <div>
              <p className="brand-title">CityManager</p>
              <p className="brand-subtitle">Detalhamento de política</p>
            </div>
          </div>
          <nav className="nav">
            <div className="nav-links">
              <Link className="nav-link active" href="/">
                Políticas Públicas
              </Link>
              <Link className="nav-link" href="/projects">
                Projetos de Lei
              </Link>
            </div>
          </nav>
        </header>

        <main className="page-body">
          <section className="hero">
            <div className="hero-text">
              <p className="eyebrow">Política recomendada</p>
              <h1>{policy.policy}</h1>
              <p className="lede">
                Aplicada em {policy.actions.length} município{policy.actions.length === 1 ? "" : "s"} e selecionada
                para seu contexto. Revise os precedentes e adapte ao seu plano de implementação.
              </p>
              <div className="hero-badges">
                {used_indicator && <span className="pill neutral">Indicador ativado</span>}
                <span className="pill neutral">Fonte: projetos públicos</span>
              </div>
              <div className="hero-actions">
                <button className="secondary-btn" type="button" onClick={() => router.back()}>
                  Voltar à lista
                </button>
                <Link className="ghost-btn" href="/projects">
                  Ver projetos de lei
                </Link>
              </div>
            </div>
            <div className="hero-panel">
              <div className="stat-card">
                <p className="stat-label">Efeito médio</p>
                <p className="stat-value">
                  {used_indicator && policy.effect_mean != null ? policy.effect_mean.toFixed(2) : "Não calculado"}
                </p>
                <p className="stat-detail">Estimativa com base no indicador selecionado.</p>
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

            <div className="table-card">
              <div className="table-head">
                <span>Município</span>
                <span>Ação</span>
                <span>Apresentação</span>
                <span>Efeito</span>
              </div>
              {policy.actions.map((action) => (
                <div key={`${policy.policy}-${action.municipio}-${action.acao}`} className="table-row">
                  <div>
                    {action.url ? (
                      <a href={action.url} target="_blank" rel="noreferrer" className="strong">
                        {action.municipio}
                      </a>
                    ) : (
                      <p className="strong">{action.municipio}</p>
                    )}
                    {action.ementa && <p className="muted small">{action.ementa}</p>}
                  </div>
                  <p>{action.acao}</p>
                  <p>{action.data_apresentacao ?? "—"}</p>
                  <p className="strong">
                    {used_indicator && action.effect != null ? action.effect.toFixed(2) : "—"}
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
    </div>
  );
}
