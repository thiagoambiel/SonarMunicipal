"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  index: number;
  score: number;
  municipio?: string;
  uf?: string;
  acao?: string;
  data_apresentacao?: string;
};

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

type PolicyWindowResult = {
  effect_window_months: number;
  policies: PolicySuggestion[];
  total_candidates: number;
  quality: number;
  effect_mean_score?: number | null;
};

type IndicatorBundle = {
  indicator: string | null;
  indicator_alias: string;
  positive_is_good: boolean | null;
  effect_windows: number[];
  best_quality_effect_windows: number[];
  best_effect_mean_windows: number[];
  windows: PolicyWindowResult[];
};

type PolicyExplorerResponse = {
  question: string;
  total_projects: number;
  projects: SearchResult[];
  baseline: IndicatorBundle;
  indicators: IndicatorBundle[];
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

const suggestionPrompts = [
  "Como reduzir a violência urbana em bairros centrais?",
  "Políticas para aumentar a arrecadação sem subir impostos",
  "Como diminuir evasão escolar no ensino médio?",
  "Ideias para melhorar mobilidade e trânsito em horário de pico",
  "Como ampliar o acesso a saneamento básico rapidamente?",
];

const NO_INDICATOR_KEY = "__none__";
const MAX_RESULTS = Number.isFinite(Number(process.env.NEXT_PUBLIC_MAX_TOP_K))
  ? Number(process.env.NEXT_PUBLIC_MAX_TOP_K)
  : 400;

const toKey = (value: string | null) => (value == null ? NO_INDICATOR_KEY : value);

const formatEffectValue = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "—";
  const fixed = value.toFixed(2);
  const signed = value > 0 ? `+${fixed}` : fixed;
  return `${signed}%`;
};

const makeSlug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "politica";

type DropdownValue = string | number;

type DropdownBadge = {
  label: string;
  tone: "quality" | "effect" | "info";
};

type DropdownOption = {
  value: DropdownValue;
  label: string;
  badges?: DropdownBadge[];
};

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function CustomDropdown({ options, value, disabled, loading, onChange, id, ariaLabel }: {
  options: DropdownOption[];
  value: DropdownValue;
  disabled?: boolean;
  loading?: boolean;
  onChange: (value: DropdownValue) => void;
  id?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = useMemo(() => options.find((item) => item.value === value), [options, value]);
  const selectedBadges = selectedOption?.badges ?? [];

  useEffect(() => {
    if (!open || disabled) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [disabled, open]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleSelection = (selectedValue: DropdownValue) => {
    onChange(selectedValue);
    setOpen(false);
  };

  const selectedLabel = selectedOption?.label ?? "";
  const isDisabled = Boolean(disabled);
  const isMenuOpen = !isDisabled && open;

  return (
    <div className={`custom-dropdown ${isDisabled ? "disabled" : ""}`} ref={containerRef}>
      <button
        type="button"
        className={`dropdown-trigger ${loading ? "loading" : ""}`}
        onClick={() => !isDisabled && setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isMenuOpen}
        disabled={isDisabled}
        id={id}
        aria-label={ariaLabel}
      >
        <div className="dropdown-trigger-content">
          <span className="dropdown-value">{selectedLabel}</span>
          {selectedBadges.length > 0 && (
            <div className="option-badges">
              {selectedBadges.map((badge) => (
                <span key={badge.label} className={`option-badge ${badge.tone}`}>
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="dropdown-icons">
          {loading && <span className="dropdown-spinner" aria-hidden="true" />}
          <svg
            className={`chevron ${isMenuOpen ? "open" : ""}`}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>
      {isMenuOpen && (
        <div className="dropdown-menu" role="listbox">
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={`dropdown-option ${isActive ? "active" : ""}`}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelection(option.value)}
              >
                <div className="option-line">
                  <span className="option-label">{option.label}</span>
                  {option.badges && option.badges.length > 0 && (
                    <div className="option-badges">
                      {option.badges.map((badge) => (
                        <span key={`${option.value}-${badge.label}`} className={`option-badge ${badge.tone}`}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [data, setData] = useState<PolicyExplorerResponse | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<string>(NO_INDICATOR_KEY);
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const bundles = useMemo(() => {
    if (!data) return [];
    return [data.baseline, ...(data.indicators ?? [])];
  }, [data]);

  const activeBundle = useMemo(
    () => bundles.find((bundle) => toKey(bundle.indicator) === selectedIndicator) ?? bundles[0] ?? null,
    [bundles, selectedIndicator],
  );

  const activeWindowResult = useMemo(() => {
    if (!activeBundle) return null;
    const found = activeBundle.windows.find((item) => item.effect_window_months === selectedWindow);
    return found ?? activeBundle.windows[0] ?? null;
  }, [activeBundle, selectedWindow]);

  const activePolicies = activeWindowResult?.policies ?? [];
  const usedIndicator = Boolean(activeBundle?.indicator);
  const indicatorAlias = activeBundle?.indicator_alias ?? "Sem indicador";
  const indicatorPositiveIsGood = activeBundle?.positive_is_good ?? true;
  const bestQualityWindows = activeBundle?.best_quality_effect_windows ?? [];
  const bestEffectWindows = activeBundle?.best_effect_mean_windows ?? [];
  const effectWindowLabel = activeWindowResult?.effect_window_months ?? "—";

  useEffect(() => {
    if (!activeBundle) return;
    const preferred =
      activeBundle.best_quality_effect_windows[0] ??
      activeBundle.best_effect_mean_windows[0] ??
      activeBundle.effect_windows[0] ??
      null;
    if (preferred == null) return;
    if (selectedWindow == null || !activeBundle.effect_windows.includes(selectedWindow)) {
      setSelectedWindow(preferred);
    }
  }, [activeBundle, selectedWindow]);

  const runSearch = async (text: string) => {
    const normalized = text.trim();
    if (!normalized) {
      setError("Digite uma pergunta para buscar.");
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch(apiUrl("/api/policy-explorer"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: normalized, top_k: MAX_RESULTS }),
      });

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

      const payload = (await response.json()) as PolicyExplorerResponse;
      setData(payload);
      setSelectedIndicator(NO_INDICATOR_KEY);
      const defaultWindow =
        payload.baseline?.effect_windows?.[0] ??
        payload.baseline?.windows?.[0]?.effect_window_months ??
        payload.indicators?.[0]?.effect_windows?.[0] ??
        null;
      setSelectedWindow(defaultWindow ?? null);
    } catch (fetchError) {
      console.error(fetchError);
      setError("Não foi possível gerar políticas agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(query);
  };

  const handleSuggestionClick = (text: string) => {
    setQuery(text);
    void runSearch(text);
  };

  const handleIndicatorChange = (key: string) => {
    setSelectedIndicator(key);
    const bundle = bundles.find((item) => toKey(item.indicator) === key);
    const target = bundle?.best_quality_effect_windows?.[0] ?? bundle?.effect_windows?.[0] ?? selectedWindow;
    if (target != null) {
      setSelectedWindow(target);
    }
  };

  const buildWindowLabel = (window: number) => {
    const monthsLabel = `${window} ${window === 1 ? "mês" : "meses"}`;
    const semesters = window / 6;
    const years = window / 12;
    const semestersLabel = `${semesters % 1 === 0 ? semesters : semesters.toFixed(1)} ${semesters === 1 ? "semestre" : "semestres"}`;
    const yearsLabel = `${years % 1 === 0 ? years : years.toFixed(1)} ${years === 1 ? "ano" : "anos"}`;
    return `${monthsLabel} · ${semestersLabel} · ${yearsLabel}`;
  };

  const handleViewDetails = (policy: PolicySuggestion) => {
    const slug = makeSlug(policy.policy);
    try {
      sessionStorage.setItem(
        `policy-detail-${slug}`,
        JSON.stringify({
          policy,
          used_indicator: usedIndicator,
          indicator_positive_is_good: indicatorPositiveIsGood,
          indicator_alias: indicatorAlias,
          effect_window_months: activeWindowResult?.effect_window_months,
        }),
      );
    } catch (storageError) {
      console.error("Erro ao armazenar política para detalhes", storageError);
    }
    router.push(`/policy/${slug}`);
  };

  const getEffectTone = (value?: number | null) => {
    if (!usedIndicator || value == null) return "effect-neutral";
    if (value === 0) return "effect-neutral";
    const isPositive = value > 0;
    const isGood = indicatorPositiveIsGood ? isPositive : !isPositive;
    return isGood ? "effect-good" : "effect-bad";
  };

  useEffect(() => {
    if (!loading && hasSearched && data && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading, hasSearched, data]);

  return (
    <div className="landing">
      <header className="minimal-nav">
        <div className="nav-brand">
          <div className="nav-logo">CM</div>
          <span className="nav-title">CityManager</span>
        </div>
        <nav className="nav-links-minimal">
          <span className="nav-link-minimal active">Gerador de Políticas Públicas</span>
          <Link className="nav-link-minimal" href="/projects">
            Projetos de Lei
          </Link>
          <Link className="nav-link-minimal" href="/methodology">
            Metodologia
          </Link>
        </nav>
      </header>

      <main className="landing-body">
        <section className="search-stage">
          <div className="logo-stack">
            <div className="logo-ring">CM</div>
            <p className="logo-name">CityManager</p>
            <p className="logo-tagline">Políticas públicas com dados em uma única busca.</p>
          </div>

          <form className="search-box" onSubmit={handleSearch}>
            <input
              id="query"
              type="search"
              name="query"
              placeholder="Ex.: Como reduzir a violência urbana em bairros centrais?"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Pergunta para buscar políticas públicas"
              autoComplete="off"
            />
            <button type="submit" className="search-circle" aria-label="Buscar políticas" disabled={loading}>
              {loading ? <span className="loader-dot" aria-hidden="true" /> : <SearchIcon />}
            </button>
          </form>

          <div className="suggestions-list" aria-live="polite">
            <p className="muted">Sugestões de perguntas</p>
            <div className="suggestion-chips">
              {suggestionPrompts.map((text) => (
                <button key={text} className="suggestion-chip" type="button" onClick={() => handleSuggestionClick(text)}>
                  {text}
                </button>
              ))}
            </div>
            {error && <div className="message error compact">{error}</div>}
          </div>
        </section>

        {hasSearched && !loading && data && (
          <section className="results-stage full-bleed" id="resultado" ref={resultsRef}>
            <div className="results-header">
              <div>
                <p className="eyebrow">Resultados para</p>
                <h2>{query || data?.question}</h2>
                <p className="muted">
                  {data?.total_projects ?? 0} projetos analisados • {activePolicies.length} políticas priorizadas
                </p>
              </div>
              <div className="result-badges">
                <span className="pill neutral">CityManager</span>
                {usedIndicator ? <span className="pill neutral">{indicatorAlias}</span> : <span className="pill neutral">Sem indicador</span>}
                {usedIndicator && (
                  <span className="pill neutral">Janela: {effectWindowLabel} meses</span>
                )}
              </div>
            </div>

            <div className="results-grid">
              <aside className="filters-panel">
                <div className="filter-card">
                  <p className="filter-title">Indicador</p>
                  <CustomDropdown
                    id="indicator-select"
                    ariaLabel="Selecionar indicador"
                    value={selectedIndicator}
                    options={bundles.map((bundle) => {
                      const key = toKey(bundle.indicator);
                      const badges: DropdownBadge[] = [];
                      if (bundle.indicator) {
                        badges.push({
                          label: bundle.positive_is_good ? "Objetivo: aumentar" : "Objetivo: reduzir",
                          tone: "info",
                        });
                      }
                      return {
                        value: key,
                        label: bundle.indicator_alias,
                        badges,
                      };
                    })}
                    onChange={(newValue) => handleIndicatorChange(String(newValue))}
                  />
                </div>

                <div className="filter-card">
                  <p className="filter-title">Janela de efeito</p>
                  <CustomDropdown
                    id="window-select"
                    ariaLabel="Selecionar janela de efeito"
                    value={selectedWindow ?? ""}
                    options={(activeBundle?.effect_windows ?? []).map((window) => {
                      const badges: DropdownBadge[] = [];
                      if (bestQualityWindows.includes(window)) badges.push({ label: "Melhor qualidade", tone: "quality" });
                      if (bestEffectWindows.includes(window)) badges.push({ label: "Melhor efeito", tone: "effect" });
                      return {
                        value: window,
                        label: buildWindowLabel(window),
                        badges,
                      };
                    })}
                    onChange={(newValue) => {
                      const parsed = typeof newValue === "number" ? newValue : Number(newValue);
                      setSelectedWindow(Number.isFinite(parsed) ? parsed : null);
                    }}
                  />
                </div>

                <div className="filter-card light">
                  <p className="muted small">
                    Todos os resultados já estão carregados no navegador. Troque os filtros e visualize sem esperar novas requisições.
                  </p>
                </div>
              </aside>

              <div className="policies-panel">
                {loading && <div className="message muted">Gerando políticas com base na sua pergunta…</div>}

                {!loading && activePolicies.length === 0 && (
                  <div className="message muted">
                    Nenhuma política priorizada para essa combinação. Tente outra janela ou selecione um indicador diferente.
                  </div>
                )}

                {!loading && activePolicies.length > 0 && (
                  <div className="policy-grid three-col">
                    {activePolicies.map((policy, policyIndex) => {
                      const effectAvailable = usedIndicator && policy.effect_mean != null;
                      const effectTone = getEffectTone(policy.effect_mean);
                      const effectStd =
                        usedIndicator && policy.effect_std != null ? ` ± ${policy.effect_std.toFixed(2)}%` : null;
                      const qualityValue = policy.quality_score != null ? policy.quality_score.toFixed(2) : "Não avaliado";

                      return (
                        <article
                          key={`${policy.policy}-${policyIndex}`}
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
                              <span className="badge-label">Efeito médio (% em {effectWindowLabel} meses)</span>
                              <span className={`badge-value ${effectTone}`}>
                                {effectAvailable ? (
                                  <>
                                    {formatEffectValue(policy.effect_mean)}
                                    {effectStd ? ` ${effectStd}` : ""}
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
                            {policy.actions.map((action, actionIndex) => {
                              const effectLabel =
                                usedIndicator && action.effect != null
                                  ? `Variação: ${formatEffectValue(action.effect)}`
                                  : "Sem indicador";
                              const effectToneAction = getEffectTone(action.effect);

                              return (
                                <li
                                  key={`${policy.policy}-${action.municipio}-${action.acao}-${actionIndex}`}
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
                                  <span className={`city-effect ${effectToneAction}`}>{effectLabel}</span>
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
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {loading && (
        <div className="page-overlay" role="alert" aria-live="assertive">
          <div className="overlay-card">
            <div className="spinner" aria-hidden="true" />
            <p className="overlay-title">Gerando políticas priorizadas…</p>
            <p className="muted small">
              Agrupando projetos similares, aplicando indicador e selecionando as melhores políticas para sua pergunta.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
