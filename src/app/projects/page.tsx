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

const suggestionPrompts = [
  "Projetos de lei sobre segurança urbana em capitais",
  "Iniciativas de educação em tempo integral em grandes cidades",
  "Transporte coletivo e mobilidade ativa para reduzir trânsito",
  "Programas de habitação popular apresentados em 2022",
  "Projetos de saneamento em municípios de médio porte",
];

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;
const STORAGE_KEY = "projects-search-state-v1";
const PAGE_SIZE = 20;

const MAX_RESULTS = Number.isFinite(Number(process.env.NEXT_PUBLIC_MAX_TOP_K))
  ? Number(process.env.NEXT_PUBLIC_MAX_TOP_K)
  : 500;

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
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);

  const isLoading = status === "loading";

  const extractYear = (value?: string | null) => {
    if (!value) return null;
    const match = value.match(/(20\d{2})/);
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

  const totalPages = Math.max(1, Math.ceil(Math.max(sortedResults.length, 1) / PAGE_SIZE));
  const pageStart = sortedResults.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, sortedResults.length);
  const paginatedResults = useMemo(
    () => sortedResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, sortedResults],
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

  useEffect(() => {
    setPage(1);
  }, [filterUf, filterYear, results]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleSearch = useCallback(async (event?: FormEvent<HTMLFormElement>, override?: string) => {
    event?.preventDefault();
    const normalizedQuery = (override ?? query).trim();

    if (!normalizedQuery) {
      setErrorMessage("Digite uma pergunta para buscar.");
      return;
    }

    setStatus("loading");
    setHasSearched(true);
    setPage(1);
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

  const handleSuggestionClick = (text: string) => {
    setQuery(text);
    void handleSearch(undefined, text);
  };

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

      <main className="landing-body">
        <section className="search-stage">
          <div className="logo-stack">
            <div className="logo-ring">CM</div>
            <p className="logo-name">Projetos de Lei</p>
            <p className="logo-tagline">Precedentes reais para inspirar novas políticas públicas.</p>
          </div>

          <form className="search-box" onSubmit={handleSearch}>
            <input
              id="projects-query"
              type="search"
              name="query"
              placeholder="Ex.: Projetos de mobilidade ativa em capitais"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Pergunta para buscar projetos de lei"
              autoComplete="off"
            />
            <button type="submit" className="search-circle" aria-label="Buscar projetos" disabled={isLoading}>
              {isLoading ? <span className="loader-dot" aria-hidden="true" /> : <SearchIcon />}
            </button>
          </form>

          <div className="suggestions-list" aria-live="polite">
            <p className="muted">Sugestões de buscas</p>
            <div className="suggestion-chips">
              {suggestionPrompts.map((text) => (
                <button
                  key={text}
                  className="suggestion-chip"
                  type="button"
                  onClick={() => handleSuggestionClick(text)}
                  disabled={isLoading}
                >
                  {text}
                </button>
              ))}
            </div>
            {errorMessage && (
              <div className={`message ${status === "error" ? "error" : "warning"} compact`}>{errorMessage}</div>
            )}
          </div>
        </section>

        <section className="results-stage full-bleed" id="resultado" aria-live="polite">
          <div className="results-header">
            <div>
              <p className="eyebrow">Resultados para</p>
              <h2>{query || initialQuery || "Projetos de Lei"}</h2>
              <p className="muted">
                {hasResults
                  ? `Mostrando ${pageStart}-${pageEnd} de ${sortedResults.length} projetos`
                  : hasSearched
                    ? "Nenhum projeto encontrado. Ajuste os filtros ou refine a busca."
                    : "Busque para ver os projetos priorizados"}
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

          <div className="results-grid">
            <aside className="filters-panel">
              <div className="filter-card">
                <p className="filter-title">UF</p>
                <p className="muted small">Foque nos projetos do estado desejado.</p>
                <div className="filter-select">
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
              </div>
              <div className="filter-card">
                <p className="filter-title">Ano de apresentação</p>
                <p className="muted small">Mantenha o contexto temporal da política.</p>
                <div className="filter-select">
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
                </div>
                {!hasYearOptions && (
                  <p className="muted small helper-text">
                    Nenhum ano disponível nesta busca ainda. Vamos mostrar opções assim que os resultados carregarem.
                  </p>
                )}
              </div>
              <div className="filter-card light">
                <p className="muted small">
                  Resultados ficam no navegador. Troque filtros e navegue pelas páginas sem refazer a busca.
                </p>
              </div>
            </aside>

            <div className="policies-panel">
              {errorMessage && status !== "loading" && (
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
                <>
                  <div className="table-card">
                    <div className="table-head">
                      <span>Município</span>
                      <span>Tema e ementa</span>
                      <span>Ano</span>
                      <span>Relevância</span>
                      <span>Fonte</span>
                    </div>
                    {paginatedResults.map((item) => {
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
                        <div
                          key={item.index}
                          className="table-row"
                          role="group"
                          aria-label="Projeto sem link disponível"
                        >
                          {content}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pagination">
                    <button
                      type="button"
                      className="page-btn ghost"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                    >
                      Anterior
                    </button>
                    <div className="page-list">
                      {Array.from({ length: totalPages }).map((_, index) => {
                        const pageNumber = index + 1;
                        return (
                          <button
                            key={pageNumber}
                            type="button"
                            className={`page-btn ${pageNumber === page ? "active" : ""}`}
                            onClick={() => setPage(pageNumber)}
                            aria-current={pageNumber === page ? "page" : undefined}
                          >
                            {pageNumber}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="page-btn ghost"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                    >
                      Próxima
                    </button>
                  </div>
                </>
              )}

              {!isLoading && !hasResults && hasSearched && (
                <div className="message muted">
                  Nenhum projeto encontrado {hasActiveFilters ? "com os filtros aplicados" : "para esta busca"}. Ajuste o
                  texto ou revise os filtros.
                </div>
              )}
            </div>
          </div>
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
