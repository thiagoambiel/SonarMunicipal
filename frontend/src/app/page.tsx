"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type IndicatorDescriptor = {
  id: string;
  path: string;
  city_col: string;
  value_col: string;
  alias: string;
  positive_is_good: boolean;
};

type SearchResult = {
  index: number;
  score: number;
  municipio?: string;
  uf?: string;
  acao?: string;
  data_apresentacao?: string;
};

type SearchResponse = {
  query: string;
  top_k: number;
  returned: number;
  results: SearchResult[];
};

type PolicyAction = {
  municipio: string;
  acao: string;
  effect?: number | null;
  url?: string | null;
};

type PolicySuggestion = {
  policy: string;
  effect_mean?: number | null;
  effect_std?: number | null;
  quality_score?: number | null;
  actions: PolicyAction[];
};

type PolicyResponse = {
  indicator?: string | null;
  used_indicator: boolean;
  total_candidates: number;
  policies: PolicySuggestion[];
};

type HomePageState = {
  query: string;
  results: SearchResult[];
  status: "idle" | "loading" | "error";
  errorMessage: string | null;
  hasSearched: boolean;
  lastQuery: string;
  selectedIndicator: string;
  effectWindowMonths: number;
  policies: PolicySuggestion[];
  policiesStatus: "idle" | "loading" | "error";
  policiesError: string | null;
  policiesUseIndicator: boolean;
  suggestionsVisible: boolean;
  indicatorPositiveIsGood: boolean;
  indicatorAlias: string;
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

const suggestionPrompts = [
  "Como reduzir a violência urbana em bairros centrais?",
  "Políticas para aumentar a arrecadação sem subir impostos",
  "Como diminuir evasão escolar no ensino médio?",
  "Ideias para melhorar mobilidade e trânsito em horário de pico",
  "Como ampliar o acesso a saneamento básico rapidamente?",
];

const MAX_RESULTS = 500;
const DEFAULT_EFFECT_WINDOW = 6;
const EFFECT_WINDOW_OPTIONS = [6, 12, 18, 24, 30, 36];

const formatEffectWindowLabel = (months: number) => {
  const semesters = months / 6;
  const years = months / 12;
  const yearsLabel = Number.isInteger(years)
    ? `${years} ano${years === 1 ? "" : "s"}`
    : `${years.toFixed(1)} ano${years > 1 ? "s" : ""}`;
  return `${months} meses · ${semesters} semestre${semesters === 1 ? "" : "s"} · ${yearsLabel}`;
};

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [indicators, setIndicators] = useState<IndicatorDescriptor[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState("");
  const [effectWindowMonths, setEffectWindowMonths] = useState(DEFAULT_EFFECT_WINDOW);
  const [policies, setPolicies] = useState<PolicySuggestion[]>([]);
  const [policiesStatus, setPoliciesStatus] = useState<"idle" | "loading" | "error">("idle");
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const [policiesUseIndicator, setPoliciesUseIndicator] = useState(false);
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);
  const skipPolicyFetchRef = useRef(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [indicatorPositiveIsGood, setIndicatorPositiveIsGood] = useState(true);
  const [indicatorAlias, setIndicatorAlias] = useState("");

  const searchButtonLabel = useMemo(() => (status === "loading" ? "Buscando…" : "Buscar"), [status]);

  const formatEffectValue = (value?: number | null) => {
    if (value == null) return "—";
    const fixed = value.toFixed(2);
    return value > 0 ? `+${fixed}` : fixed;
  };

  const getEffectTone = (value?: number | null) => {
    if (!policiesUseIndicator || value == null) return "effect-neutral";
    if (value === 0) return "effect-neutral";
    const isPositive = value > 0;
    const isGood = indicatorPositiveIsGood ? isPositive : !isPositive;
    return isGood ? "effect-good" : "effect-bad";
  };

  useEffect(() => {
    const loadIndicators = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/indicators`);
        if (!response.ok) return;
        const payload = (await response.json()) as IndicatorDescriptor[];
        setIndicators(payload);
      } catch (error) {
        console.error("Erro ao carregar indicadores", error);
      }
    };
    loadIndicators();
  }, []);

  useEffect(() => {
    if (!selectedIndicator) return;
    const found = indicators.find((indicator) => indicator.id === selectedIndicator);
    if (found) {
      setIndicatorAlias(found.alias || found.id);
      setIndicatorPositiveIsGood(found.positive_is_good);
    }
  }, [indicators, selectedIndicator]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setErrorMessage("Digite uma pergunta para buscar.");
      setHasSearched(false);
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalizedQuery, top_k: MAX_RESULTS }),
      });

      if (!response.ok) {
        let detail = response.statusText;
        try {
          const body = (await response.json()) as { detail?: string };
          detail = body.detail ?? detail;
        } catch {
          // ignore parse errors and use status text
        }
        throw new Error(detail);
      }

      const payload = (await response.json()) as SearchResponse;
      setResults(payload.results ?? []);
      setLastQuery(normalizedQuery);
      setHasSearched(true);
      setSuggestionsVisible(false);
      setStatus("idle");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage("Não foi possível buscar agora. Tente novamente em instantes.");
    }
  };

  const handleSuggestionClick = (text: string) => {
    setQuery(text);
  };

  useEffect(() => {
    if (!hasHydrated) return;

    const fetchPolicies = async () => {
      if (!hasSearched || results.length === 0) {
        setPolicies([]);
        return;
      }

      setPoliciesStatus("loading");
      setPoliciesError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/policies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bill_indexes: results.map((r) => r.index),
            similarity_threshold: 0.75,
            min_group_members: 2,
            use_indicator: Boolean(selectedIndicator),
            indicator: selectedIndicator || null,
            effect_window_months: effectWindowMonths,
          }),
        });

        if (!response.ok) {
          throw new Error(response.statusText);
        }

        const payload = (await response.json()) as PolicyResponse;
        setPolicies(payload.policies ?? []);
        setPoliciesUseIndicator(Boolean(payload.used_indicator));
        setPoliciesStatus("idle");
      } catch (error) {
        console.error(error);
        setPoliciesStatus("error");
        setPoliciesError("Não foi possível gerar políticas agora.");
      }
    };

    if (skipPolicyFetchRef.current) {
      skipPolicyFetchRef.current = false;
      return;
    }

    void fetchPolicies();
  }, [results, selectedIndicator, effectWindowMonths, hasSearched, hasHydrated]);

  useLayoutEffect(() => {
    const hasQueryInUrl = Boolean(searchParams.get("q"));
    if (!hasQueryInUrl) {
      sessionStorage.removeItem("home-page-state");
    }

    try {
      const raw = sessionStorage.getItem("home-page-state");
      if (!raw) {
        setHasHydrated(true);
        return;
      }
      const stored = JSON.parse(raw) as Partial<HomePageState>;
      if (!stored) {
        setHasHydrated(true);
        return;
      }

      setQuery(stored.query ?? "");
      setResults(stored.results ?? []);
      setStatus(stored.status ?? "idle");
      setErrorMessage(stored.errorMessage ?? null);
      setHasSearched(Boolean(stored.hasSearched));
      setLastQuery(stored.lastQuery ?? "");
      setSelectedIndicator(stored.selectedIndicator ?? "");
      setEffectWindowMonths(
        typeof stored.effectWindowMonths === "number" ? stored.effectWindowMonths : DEFAULT_EFFECT_WINDOW,
      );
      setIndicatorPositiveIsGood(stored.indicatorPositiveIsGood ?? true);
      setIndicatorAlias(stored.indicatorAlias ?? "");
      setPolicies(stored.policies ?? []);
      setPoliciesStatus(stored.policiesStatus ?? "idle");
      setPoliciesError(stored.policiesError ?? null);
      setPoliciesUseIndicator(Boolean(stored.policiesUseIndicator));
      setSuggestionsVisible(stored.suggestionsVisible ?? true);
      if (stored.policies && stored.policies.length > 0) {
        skipPolicyFetchRef.current = true;
      }
    } catch (error) {
      console.error("Erro ao restaurar estado anterior", error);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    const state: HomePageState = {
      query,
      results,
      status,
      errorMessage,
      hasSearched,
      lastQuery,
      selectedIndicator,
      effectWindowMonths,
      indicatorPositiveIsGood,
      indicatorAlias,
      policies,
      policiesStatus,
      policiesError,
      policiesUseIndicator,
      suggestionsVisible,
    };

    try {
      sessionStorage.setItem("home-page-state", JSON.stringify(state));
    } catch (error) {
      console.error("Erro ao salvar estado", error);
    }
  }, [
    query,
    results,
    status,
    errorMessage,
    hasSearched,
    lastQuery,
    selectedIndicator,
    effectWindowMonths,
    indicatorPositiveIsGood,
    indicatorAlias,
    policies,
    policiesStatus,
    policiesError,
    policiesUseIndicator,
    suggestionsVisible,
    hasHydrated,
  ]);

  useEffect(() => {
    if (!hasHydrated || !hasSearched) return;

    const params = new URLSearchParams();
    if (lastQuery) {
      params.set("q", lastQuery);
    }
    if (selectedIndicator) {
      params.set("indicator", selectedIndicator);
    }
    if (policiesUseIndicator && effectWindowMonths) {
      params.set("window", String(effectWindowMonths));
    }

    const queryString = params.toString();
    const target = queryString ? `/?${queryString}` : "/";
    router.replace(target, { scroll: false });
  }, [
    hasHydrated,
    hasSearched,
    lastQuery,
    selectedIndicator,
    effectWindowMonths,
    policiesUseIndicator,
    router,
  ]);

  const makeSlug = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "politica";

  const handleViewDetails = (policy: PolicySuggestion) => {
    const slug = makeSlug(policy.policy);
    const payload = {
      policy,
      used_indicator: policiesUseIndicator,
      indicator_positive_is_good: indicatorPositiveIsGood,
      indicator_alias: indicatorAlias,
      effect_window_months: effectWindowMonths,
    };
    try {
      sessionStorage.setItem(`policy-detail-${slug}`, JSON.stringify(payload));
    } catch (error) {
      console.error("Erro ao salvar política", error);
    }
    router.push(`/policy/${slug}`);
  };

  return (
    <div className="page google-layout">
      <div className="page-surface">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">CM</div>
            <div>
              <p className="brand-title">CityManager</p>
              <p className="brand-subtitle">Inteligência para gestores municipais</p>
            </div>
          </div>
          <nav className="nav">
            <div className="nav-links">
              <span className="nav-link active">Políticas Públicas</span>
              <Link
                className="nav-link"
                href={hasSearched ? `/projects?q=${encodeURIComponent(lastQuery)}` : "/projects"}
              >
                Projetos de Lei
              </Link>
            </div>
            <div className="nav-actions">
              <a className="ghost-btn" href="#metodologia">
                Metodologia
              </a>
              <a className="ghost-btn" href="#transparencia">
                Transparência
              </a>
            </div>
          </nav>
        </header>

        <main className="page-body">
          <section className="hero">
            <div className="hero-text">
              <p className="eyebrow">Implantação segura de leis municipais</p>
              <h1>Transforme evidências em políticas aplicáveis</h1>
              <p className="lede">
                A plataforma cruza projetos de lei, jurisprudência e indicadores municipais para sugerir
                políticas públicas que já funcionaram em cidades com perfis parecidos.
              </p>
              <div className="hero-badges">
                <span className="pill neutral">Dados oficiais</span>
                <span className="pill neutral">Transparência metodológica</span>
                <span className="pill accent">Foco em gestores</span>
              </div>
              <div className="hero-actions">
                <a className="primary-btn" href="#busca">
                  Começar uma busca
                </a>
                <Link className="ghost-btn" href="/projects">
                  Ver projetos de lei
                </Link>
              </div>
            </div>
            <div className="hero-panel">
              <div className="stat-card">
                <p className="stat-label">Confiabilidade</p>
                <p className="stat-value">Análise explicável</p>
                <p className="stat-detail">Similaridade semântica + seleção por indicador.</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Próximo passo</p>
                <p className="stat-value">Escolha o indicador</p>
                <p className="stat-detail">Simule impacto médio antes de replicar políticas.</p>
              </div>
            </div>
          </section>

          <section id="busca" className="search-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">Busca guiada</p>
                <h2>Encontre políticas semelhantes e avalie impacto</h2>
                <p className="muted">Pergunte em linguagem natural e ative um indicador para estimar o efeito esperado.</p>
              </div>
            </div>

            <form className="search-panel" onSubmit={handleSearch}>
              <div className="search-row">
                <div className="search-input">
                  <label htmlFor="query">Pergunte ou descreva uma necessidade</label>
                  <input
                    id="query"
                    type="search"
                    name="query"
                    placeholder="Ex.: Como reduzir filas de atendimento na atenção básica?"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label="Pergunta para busca semântica"
                    autoComplete="off"
                  />
                </div>
                <button type="submit" className="primary-btn" disabled={status === "loading"}>
                  {searchButtonLabel}
                </button>
              </div>

              <div className="filter-grid">
                <div className="filter-field indicator-field">
                  <label>Indicador de impacto</label>
                  <select
                    value={selectedIndicator}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedIndicator(value);
                      const found = indicators.find((indicator) => indicator.id === value);
                      if (found) {
                        setIndicatorPositiveIsGood(found.positive_is_good);
                        setIndicatorAlias(found.alias || found.id);
                      } else {
                        setIndicatorPositiveIsGood(true);
                        setIndicatorAlias("");
                      }
                    }}
                    aria-label="Selecionar indicador"
                  >
                    <option value="">Sem indicador</option>
                    {indicators.map((indicator) => (
                      <option key={indicator.id} value={indicator.id}>
                        {indicator.alias || indicator.id}
                      </option>
                    ))}
                  </select>
                  <p className="hint">
                    Ative para simular impacto esperado usando dados históricos do indicador escolhido.
                  </p>
                  {selectedIndicator && (
                    <div className="indicator-direction">

                      <span className={`direction-flag good`}>
                        {indicatorPositiveIsGood
                          ? "O Objetivo é Aumentar o Valor desse Indicador"
                          : "O Objetivo é Diminuir o Valor desse Indicador"}
                      </span>

                    </div>
                  )}
                </div>
                <div className="filter-field">
                  <label htmlFor="effect-window">Janela do efeito</label>
                  <select
                    id="effect-window"
                    value={effectWindowMonths}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      setEffectWindowMonths(Number.isFinite(parsed) ? parsed : DEFAULT_EFFECT_WINDOW);
                    }}
                    aria-label="Selecionar janela temporal para cálculo do efeito"
                  >
                    {EFFECT_WINDOW_OPTIONS.map((months) => (
                      <option key={months} value={months}>
                        {formatEffectWindowLabel(months)}
                      </option>
                    ))}
                  </select>
                  <p className="hint">
                    Dados semestrais: PLs muito recentes podem não ter efeito se a janela for longa.
                  </p>
                </div>
              </div>
            </form>

            {suggestionsVisible ? (
              <div className="suggestions-panel">
                <p className="muted">Sugestões rápidas</p>
                <div className="suggestions">
                  {suggestionPrompts.map((text) => (
                    <button
                      type="button"
                      key={text}
                      onClick={() => handleSuggestionClick(text)}
                      className="suggestion"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button className="toggle-suggestions" onClick={() => setSuggestionsVisible(true)} type="button">
                Ver sugestões
              </button>
            )}
          </section>

          {policiesError && <div className="message error">{policiesError}</div>}

          {policiesStatus === "loading" && <div className="message muted">Gerando políticas com base na busca...</div>}

          {policiesStatus !== "loading" && policies.length > 0 && (
            <section className="policy-section">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Políticas sugeridas</p>
                  <h2>Opções priorizadas para implementação</h2>
                  <p className="muted">
                    Agrupamos políticas similares aplicadas em cidades próximas ao seu contexto. Abra os
                    detalhes para ver precedentes e replicar com segurança.
                  </p>
                </div>
                <div className="chips-inline">
                  <div className="pill neutral">{results.length} projetos considerados</div>
                  {policiesUseIndicator && (
                    <div className="pill neutral">Efeito em {effectWindowMonths} meses</div>
                  )}
                </div>
              </div>

              <div className="policy-grid">
                {policies.map((policy) => {
                  const effectAvailable = policiesUseIndicator && policy.effect_mean != null;
                  const effectStd = policiesUseIndicator && policy.effect_std != null ? policy.effect_std.toFixed(2) : null;
                  const qualityValue =
                    policy.quality_score != null ? policy.quality_score.toFixed(2) : "Não avaliado";
                  const meanTone = getEffectTone(policy.effect_mean);

                  return (
                    <article
                      key={policy.policy}
                      className="policy-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleViewDetails(policy)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleViewDetails(policy);
                        }
                      }}
                    >
                      <p className="policy-title">{policy.policy}</p>

                      <div className="policy-badges">
                        <div className="metric-badge">
                          <span className="badge-label">Efeito médio em {effectWindowMonths} meses</span>
                          <span className={`badge-value ${meanTone}`}>
                            {effectAvailable ? (
                              <>
                                {formatEffectValue(policy.effect_mean)}
                                {effectStd ? ` ± ${effectStd}` : ""}
                              </>
                            ) : (
                              "Não calculado"
                            )}
                          </span>
                        </div>
                        <div className="metric-badge soft">
                          <span className="badge-label">Qualidade</span>
                          <span className="badge-value">{qualityValue}</span>
                        </div>
                      </div>

                      <p className="policy-count">
                        Política aplicada em {policy.actions.length} município
                        {policy.actions.length === 1 ? "" : "s"}:
                      </p>

                      <ul className="policy-city-list">
                        {policy.actions.map((action) => {
                          const effectLabel =
                            policiesUseIndicator && action.effect != null
                              ? `Efeito: ${formatEffectValue(action.effect)}`
                              : "Sem indicador";
                          const effectTone = getEffectTone(action.effect);

                          return (
                            <li
                              key={`${policy.policy}-${action.municipio}-${action.acao}`}
                              className="policy-city-item"
                            >
                              <div className="city-name">
                                <span>{action.municipio}</span>
                                {action.url && (
                                  <a
                                    href={action.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="city-link"
                                    onClick={(event) => event.stopPropagation()}
                                    aria-label={`Abrir ementa original de ${action.municipio}`}
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
                              <span className={`city-effect ${effectTone}`}>{effectLabel}</span>
                            </li>
                          );
                        })}
                      </ul>

                      <div className="policy-card-footer">
                        <button
                          className="secondary-btn"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleViewDetails(policy);
                          }}
                        >
                          Ver detalhes
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="results" aria-live="polite">
            {errorMessage && (
              <div className={`message ${status === "error" ? "error" : "warning"}`}>{errorMessage}</div>
            )}
            {hasSearched && results.length > 0 && (
              <div className="message muted">
                {results.length} projetos correspondem à sua busca. Veja a lista completa em{" "}
                <Link
                  className="nav-link"
                  href={hasSearched ? `/projects?q=${encodeURIComponent(lastQuery)}` : "/projects"}
                >
                  Projetos de Lei
                </Link>
                .
              </div>
            )}
          </section>

          <section id="metodologia" className="info-grid">
            <div className="info-card">
              <p className="eyebrow">Como geramos as políticas</p>
              <h3>Similaridade semântica e agrupamento</h3>
              <p>
                Buscamos em linguagem natural, agrupamos projetos próximos e priorizamos políticas aplicadas em
                municípios comparáveis. Indicadores podem ser ativados para estimar impacto médio.
              </p>
            </div>
            <div className="info-card">
              <p className="eyebrow">Quando usar</p>
              <h3>Planejamento e replicação</h3>
              <p>
                Útil para mapear soluções similares, preparar dossiês para o legislativo e identificar cidades
                referência. Use os filtros para focar em realidades parecidas.
              </p>
            </div>
            <div id="transparencia" className="info-card">
              <p className="eyebrow">Transparência</p>
              <h3>Fontes públicas e documentação</h3>
              <p>
                Trabalhamos apenas com dados públicos. Acompanhe indicadores utilizados e revisite cada projeto na
                origem antes de propor a adoção local.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
