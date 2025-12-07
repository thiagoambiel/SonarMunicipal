"use client";

import type { FormEvent } from "react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type SearchResult = {
  index: number;
  score: number;
  municipio?: string;
  uf?: string;
  acao?: string;
  data_apresentacao?: string;
  ementa?: string;
  link_publico?: string | null;
  sapl_url?: string | null;
  tipo_label?: string | null;
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;
const STORAGE_KEY = "projects-search-state-v1";

const MAX_RESULTS = Number.isFinite(Number(process.env.NEXT_PUBLIC_MAX_TOP_K))
  ? Number(process.env.NEXT_PUBLIC_MAX_TOP_K)
  : 500;

function ProjectsContent() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");
  const [filterUf, setFilterUf] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const searchButtonLabel = useMemo(() => (status === "loading" ? "Buscando…" : "Buscar"), [status]);
  const isLoading = status === "loading";

  const extractYear = (value?: string | null) => {
    if (!value) return null;
    const match = value.match(/(20\\d{2})/);
    return match ? match[1] : null;
  };

  const availableUfs = useMemo(() => {
    const ufs = new Set<string>();
    results.forEach((item) => {
      if (item.uf) ufs.add(item.uf);
    });
    return Array.from(ufs).sort();
  }, [results]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    results.forEach((item) => {
      const year = extractYear(item.data_apresentacao);
      if (year) years.add(year);
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [results]);

  const filteredResults = useMemo(
    () =>
      results.filter((item) => {
        const matchesUf = filterUf === "all" || item.uf === filterUf;
        const matchesYear = filterYear === "all" || extractYear(item.data_apresentacao) === filterYear;
        return matchesUf && matchesYear;
      }),
    [results, filterUf, filterYear],
  );

  const sortedResults = useMemo(
    () => [...filteredResults].sort((a, b) => b.score - a.score),
    [filteredResults],
  );

  const hasActiveFilters = filterUf !== "all" || filterYear !== "all";
  const hasYearOptions = availableYears.length > 0;
  const hasResults = sortedResults.length > 0;
  const shouldShowBackToTop = showBackToTop && hasResults;

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 320);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = useCallback(async (event?: FormEvent<HTMLFormElement>, override?: string) => {
    event?.preventDefault();
    const normalizedQuery = (override ?? query).trim();

    if (!normalizedQuery) {
      setErrorMessage("Digite uma pergunta para buscar.");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch(apiUrl("/api/search"), {
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
          // ignore
        }
        throw new Error(detail);
      }

      const payload = (await response.json()) as { results: SearchResult[] };
      setResults(payload.results ?? []);
      setStatus("idle");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage("Não foi possível buscar agora. Tente novamente em instantes.");
    }
  }, [query]);

  useEffect(() => {
    if (initialQuery && !hasRestoredState) {
      setQuery(initialQuery);
      void handleSearch(undefined, initialQuery);
      setHasRestoredState(true);
      return;
    }

    if (hasRestoredState) return;

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { query?: string; filterUf?: string; filterYear?: string };
        if (saved.query) {
          setQuery(saved.query);
          void handleSearch(undefined, saved.query);
        }
        if (saved.filterUf) setFilterUf(saved.filterUf);
        if (saved.filterYear) setFilterYear(saved.filterYear);
      }
    } catch (storageError) {
      console.error("Erro ao restaurar filtros anteriores", storageError);
    } finally {
      setHasRestoredState(true);
    }
  }, [handleSearch, hasRestoredState, initialQuery]);

  useEffect(() => {
    if (!hasRestoredState) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          query,
          filterUf,
          filterYear,
        }),
      );
    } catch (storageError) {
      console.error("Erro ao salvar filtros de projetos", storageError);
    }
  }, [filterUf, filterYear, hasRestoredState, query]);

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
            <p className="eyebrow">Banco vivo</p>
            <h1>Resultados completos para sua consulta</h1>
            <p className="lede">
              Ordenamos por relevância semântica. Aplique filtros de UF e ano para focar na jurisdição certa sem perder
              contexto.
            </p>
            <div className="hero-actions">
              <a className="ghost-btn" href="#filtros">
                Ir para filtros
              </a>
              <Link className="ghost-btn" href="/methodology">
                Ver metodologia
              </Link>
            </div>
          </div>
          <div className="hero-panel">
            <div className="stat-card">
              <p className="stat-label">Busca</p>
              <p className="stat-value">{query ? "Consulta ativa" : "Pronta para pesquisar"}</p>
              <p className="stat-detail">Refine a pergunta em linguagem natural.</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Resultados</p>
              <p className="stat-value">{sortedResults.length > 0 ? `${sortedResults.length} projetos` : "Sem itens"}</p>
              <p className="stat-detail">Ordenados por relevância semântica.</p>
            </div>
          </div>
        </section>

        <section className="search-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Navegar por projetos</p>
              <h2>Busque por tema ou necessidade</h2>
              <p className="muted">
                Encontre precedentes para fundamentar novas políticas. Ajuste os filtros sem refazer a busca.
              </p>
            </div>
            {hasActiveFilters && (
              <div className="chips-inline">
                {filterUf !== "all" && <span className="pill neutral">UF: {filterUf}</span>}
                {filterYear !== "all" && <span className="pill neutral">Ano: {filterYear}</span>}
                <button
                  type="button"
                  className="ghost-link"
                  onClick={() => {
                    setFilterUf("all");
                    setFilterYear("all");
                  }}
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>

          <form className="search-panel" onSubmit={handleSearch}>
            <div className="search-row">
              <div className="search-input">
                <label htmlFor="projects-query">Pergunte ou descreva uma necessidade</label>
                <input
                  id="projects-query"
                  type="search"
                  name="query"
                  placeholder="Ex.: Projetos de mobilidade ativa em capitais"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Pergunta para busca semântica"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="primary-btn search-btn" disabled={status === "loading"}>
                {searchButtonLabel}
              </button>
            </div>

            <div id="filtros" className="filter-grid">
              <div className="filter-field">
                <label htmlFor="projects-uf-select">UF</label>
                <select
                  id="projects-uf-select"
                  value={filterUf}
                  onChange={(event) => setFilterUf(event.target.value)}
                >
                  <option value="all">Todas as UF</option>
                  {availableUfs.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="projects-year-select">Ano de apresentação</label>
                <select
                  id="projects-year-select"
                  value={filterYear}
                  disabled={!hasYearOptions}
                  aria-disabled={!hasYearOptions}
                  onChange={(event) => setFilterYear(event.target.value)}
                >
                  <option value="all">Todos os anos</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                {!hasYearOptions && (
                  <p className="muted small helper-text">
                    Nenhum ano disponível nesta busca ainda. Vamos mostrar opções assim que os resultados carregarem.
                  </p>
                )}
              </div>
            </div>
          </form>
        </section>

        <section className="results-stage" aria-live="polite">
          <div className="results-header">
            <div>
              <p className="eyebrow">Resultados</p>
              <h2>Projetos encontrados</h2>
              <p className="muted">
                {sortedResults.length > 0
                  ? `${sortedResults.length} resultados ordenados por relevância`
                  : "Busque para ver os projetos priorizados"}
              </p>
            </div>
            {hasActiveFilters && (
              <div className="result-badges">
                {filterUf !== "all" && <span className="pill neutral">UF: {filterUf}</span>}
                {filterYear !== "all" && <span className="pill neutral">Ano: {filterYear}</span>}
              </div>
            )}
          </div>

          {errorMessage && (
            <div className={`message ${status === "error" ? "error" : "warning"}`}>{errorMessage}</div>
          )}

          {isLoading && (
            <div className="table-card skeleton-table" aria-hidden="true">
              <div className="table-head">
                <span className="skeleton-line w-60" />
                <span className="skeleton-line w-70" />
                <span className="skeleton-line w-30" />
                <span className="skeleton-line w-40" />
                <span className="skeleton-line w-30" />
              </div>
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="table-row">
                  <span className="skeleton-line w-70" />
                  <span className="skeleton-line w-80" />
                  <span className="skeleton-line w-30" />
                  <span className="skeleton-line w-40" />
                  <span className="skeleton-line w-30" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && hasResults && (
            <div className="table-card">
              <div className="table-head">
                <span>Município</span>
                <span>Tema e ementa</span>
                <span>Ano</span>
                <span>Relevância</span>
                <span>Fonte</span>
              </div>
              {sortedResults.map((item) => {
                const preferredLink = item.link_publico ?? item.sapl_url ?? null;
                const content = (
                  <>
                    <div>
                      <p className="strong">
                        {item.municipio ? item.municipio : "Município não informado"}
                        {item.uf && <span className="pill-uf"> · {item.uf}</span>}
                      </p>
                      <p className="muted small">Índice #{item.index}</p>
                      {item.tipo_label && <p className="muted small">Tipo: {item.tipo_label}</p>}
                    </div>
                    <div>
                      <p>{item.acao ?? "Ação não informada"}</p>
                      <p className="muted small">{item.ementa ?? "Ementa não informada"}</p>
                    </div>
                    <p>{item.data_apresentacao ?? "—"}</p>
                    <p className="strong">{item.score.toFixed(2)}</p>
                    <div className="row-actions">
                      {preferredLink ? (
                        <span className="row-link">Abrir fonte</span>
                      ) : (
                        <span className="muted small">Fonte indisponível</span>
                      )}
                    </div>
                  </>
                );

                return preferredLink ? (
                  <a
                    key={item.index}
                    className="table-row clickable-row"
                    href={preferredLink}
                    target="_blank"
                    rel="noreferrer"
                    title="Abrir fonte oficial em nova aba"
                  >
                    {content}
                  </a>
                ) : (
                  <div key={item.index} className="table-row" role="group" aria-label="Projeto sem link disponível">
                    {content}
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && sortedResults.length === 0 && (
            <div className="message muted">
              Nenhum projeto encontrado {hasActiveFilters ? "com os filtros aplicados" : "para esta busca"}. Ajuste o
              texto ou revise os filtros.
            </div>
          )}
        </section>

        {shouldShowBackToTop && (
          <button
            type="button"
            className="back-to-top"
            onClick={handleBackToTop}
            aria-label="Voltar ao topo da página"
          >
            Voltar ao topo
          </button>
        )}

        <section className="trust-strip">
          <div>
            <p className="eyebrow">Documentação</p>
            <h3>Metodologia e limites</h3>
            <p className="muted">
              Consulte como calculamos similaridade, agrupamentos e impacto dos indicadores antes de replicar.
            </p>
          </div>
          <div className="trust-actions">
            <Link className="secondary-btn" href="/methodology">
              Abrir metodologia
            </Link>
            <Link className="ghost-btn" href="/">
              Voltar para busca
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="landing">
          <main className="landing-body page-body">
            <div className="message muted">Carregando...</div>
          </main>
        </div>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}
