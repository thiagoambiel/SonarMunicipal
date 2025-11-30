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
        <div className="google-box">
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
          <div className="message muted">Nenhuma política carregada. Volte e selecione uma política.</div>
          <button className="policy-details-btn" onClick={() => router.push("/")}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const { policy, used_indicator } = data;

  return (
    <div className="page google-layout">
      <div className="google-box">
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

        <section className="policy-section" style={{ width: "100%" }}>
          <h2>Política detalhada</h2>
          <article className="policy-card">
            <p className="policy-title">{policy.policy}</p>
            <p className="policy-count">
              Aplicada em {policy.actions.length} município{policy.actions.length === 1 ? "" : "s"}
            </p>
            {used_indicator && policy.effect_mean != null && (
              <div className="policy-meta">
                <span>Efeito médio: {policy.effect_mean.toFixed(2)}</span>
                {policy.effect_std != null && <span>Desvio: {policy.effect_std.toFixed(2)}</span>}
                {policy.quality_score != null && (
                  <span>Qualidade: {policy.quality_score.toFixed(2)}</span>
                )}
              </div>
            )}

            <div className="policy-actions">
              <p className="policy-actions-title">Projetos aplicados</p>
              <ul style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {policy.actions.map((action) => (
                  <li key={`${policy.policy}-${action.municipio}-${action.acao}`}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {action.url ? (
                        <a href={action.url} target="_blank" rel="noreferrer">
                          {action.municipio}
                        </a>
                      ) : (
                        <span>{action.municipio}</span>
                      )}
                      <span style={{ color: "#5f6368", fontSize: "13px" }}>{action.acao}</span>
                      {action.data_apresentacao && (
                        <span style={{ color: "#5f6368", fontSize: "12px" }}>
                          Data de apresentação: {action.data_apresentacao}
                        </span>
                      )}
                      {action.ementa && (
                        <span style={{ color: "#3c4043", fontSize: "13px" }}>{action.ementa}</span>
                      )}
                      {used_indicator && action.effect != null && (
                        <span className="pill-effect">Efeito: {action.effect.toFixed(2)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </article>
          <button className="policy-details-btn" onClick={() => router.back()} style={{ marginTop: "12px" }}>
            Voltar
          </button>
        </section>
      </div>
    </div>
  );
}
