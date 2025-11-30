"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type IndicatorDescriptor = {
  id: string;
  path: string;
  city_col: string;
  value_col: string;
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

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [indicators, setIndicators] = useState<IndicatorDescriptor[]>([]);
  const [useIndicator, setUseIndicator] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState("");
  const [policies, setPolicies] = useState<PolicySuggestion[]>([]);
  const [policiesStatus, setPoliciesStatus] = useState<"idle" | "loading" | "error">("idle");
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const [policiesUseIndicator, setPoliciesUseIndicator] = useState(false);
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);

  const searchButtonLabel = useMemo(() => (status === "loading" ? "Buscando…" : "Buscar"), [status]);

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
    const fetchPolicies = async () => {
      if (!hasSearched || results.length === 0) {
        setPolicies([]);
        return;
      }

      if (useIndicator && !selectedIndicator) {
        setPolicies([]);
        setPoliciesError("Selecione um indicador ou desabilite o cálculo de efeito.");
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
            use_indicator: useIndicator,
            indicator: useIndicator ? selectedIndicator : null,
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

    void fetchPolicies();
  }, [results, useIndicator, selectedIndicator, hasSearched]);

  return (
    <div className="page google-layout">
      <div className="google-box">
        <h1 className="logo">CityManager</h1>
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
        </nav>
        <form className="search google-search" onSubmit={handleSearch}>
          <div className="google-input">
            <input
              type="search"
              name="query"
              placeholder="Pesquise políticas públicas"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Pergunta para busca semântica"
              autoComplete="off"
            />
            <button type="submit" disabled={status === "loading"}>
              {searchButtonLabel}
            </button>
          </div>
        </form>

        <div className="indicator-row">
          <label className="indicator-toggle">
            <input
              type="checkbox"
              checked={useIndicator}
              onChange={(event) => setUseIndicator(event.target.checked)}
            />
            <span>Calcular efeito por indicador</span>
          </label>
          <select
            value={selectedIndicator}
            onChange={(event) => setSelectedIndicator(event.target.value)}
            disabled={!useIndicator}
          >
            <option value="">Sem indicador</option>
            {indicators.map((indicator) => (
              <option key={indicator.id} value={indicator.id}>
                {indicator.id}
              </option>
            ))}
          </select>
        </div>

        {suggestionsVisible ? (
          <div className="suggestions google-suggestions">
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
        ) : (
          <button className="toggle-suggestions" onClick={() => setSuggestionsVisible(true)} type="button">
            Ver sugestões
          </button>
        )}

        {policiesError && <div className="message error">{policiesError}</div>}

        {policiesStatus === "loading" && <div className="message muted">Gerando políticas...</div>}

        {policies.length > 0 && (
          <section className="policy-section">
            <h2>Políticas sugeridas</h2>
            <div className="policy-grid">
              {policies.map((policy) => (
                <article key={policy.policy} className="policy-card">
                  <p className="policy-title">{policy.policy}</p>
                  <p className="policy-count">
                    Aplicada em {policy.actions.length} município{policy.actions.length === 1 ? "" : "s"}
                  </p>
                  {policiesUseIndicator && policy.effect_mean != null && (
                    <div className="policy-meta">
                      <span>Efeito médio: {policy.effect_mean.toFixed(2)}</span>
                      {policy.effect_std != null && <span>Desvio: {policy.effect_std.toFixed(2)}</span>}
                      {policy.quality_score != null && (
                        <span>Qualidade: {policy.quality_score.toFixed(2)}</span>
                      )}
                    </div>
                  )}
                  <div className="policy-actions">
                    <p className="policy-actions-title">Aplicada em:</p>
                    <ul>
                      {policy.actions.map((action) => (
                        <li key={`${policy.policy}-${action.municipio}-${action.acao}`}>
                          {action.url ? (
                            <a href={action.url} target="_blank" rel="noreferrer">
                              {action.municipio}
                            </a>
                          ) : (
                            <span>{action.municipio}</span>
                          )}
                          {policiesUseIndicator && action.effect != null && (
                            <span className="pill-effect">Efeito: {action.effect.toFixed(2)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="results" aria-live="polite">
          {errorMessage && (
            <div className={`message ${status === "error" ? "error" : "warning"}`}>{errorMessage}</div>
          )}
          {hasSearched && results.length > 0 && (
            <div className="message muted">
              {results.length} projetos encontrados. Veja a lista completa em{" "}
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
      </div>
    </div>
  );
}
