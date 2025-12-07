"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { buildProjectSlug } from "@/lib/projects";

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

type StoredSearchState = {
  query: string;
  filterUf: string;
  filterYear: string;
  results: SearchResult[];
  hasSearched: boolean;
  page: number;
  timestamp: number;
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

function ProjectsContent() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");
  const initialUf = searchParams.get("uf");
  const initialYear = searchParams.get("year");
  const [filterUf, setFilterUf] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const resultsRef = useRef<HTMLElement | null>(null);
  const initialPageParam = searchParams.get("page");
  const prevFiltersRef = useRef<{ uf: string; year: string }>({ uf: "all", year: "all" });

  const isLoading = status === "loading";

  const persistProjectDetail = (item: SearchResult) => {
    const slug = buildProjectSlug({
      acao: item.acao,
      ementa: item.ementa,
      municipio: item.municipio,
      index: item.index,
    });

    const payload = {
      slug,
      index: item.index,
      score: item.score,
      municipio: item.municipio ?? null,
      uf: item.uf ?? null,
      acao: item.acao ?? null,
      ementa: item.ementa ?? null,
      data_apresentacao: item.data_apresentacao ?? null,
      link_publico: item.link_publico ?? null,
      sapl_url: item.sapl_url ?? null,
      tipo_label: item.tipo_label ?? null,
      source: "search" as const,
    };

    try {
      sessionStorage.setItem(`project-detail-${slug}`, JSON.stringify(payload));
    } catch (storageError) {
      console.error("Erro ao salvar detalhes do projeto", storageError);
    }

    return slug;
  };

  const openProjectDetail = (item: SearchResult) => {
    const slug = persistProjectDetail(item);
    router.push(`/projects/${slug}`);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, item: SearchResult) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProjectDetail(item);
    }
  };

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
    const target = resultsRef.current;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 320);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isLoading || !hasSearched) return;
    const node = resultsRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hasSearched, isLoading]);

  const syncUrlState = useCallback(
    (state: { query?: string; uf?: string; year?: string; page?: number }) => {
      const params = new URLSearchParams();
      const normalizedQuery = state.query?.trim();
      if (normalizedQuery) params.set("q", normalizedQuery);
      if (state.uf && state.uf !== "all") params.set("uf", state.uf);
      if (state.year && state.year !== "all") params.set("year", state.year);
      if (state.page && state.page > 1) params.set("page", String(state.page));
      const search = params.toString();
      router.replace(search ? `/projects?${search}` : "/projects", { scroll: false });
    },
    [router],
  );

  const saveStateToStorage = useCallback(
    (state: Partial<StoredSearchState>) => {
      try {
        const payload: StoredSearchState = {
          query,
          filterUf,
          filterYear,
          results,
          hasSearched,
          page,
          timestamp: Date.now(),
          ...state,
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (storageError) {
        console.error("Erro ao salvar estado da busca", storageError);
      }
    },
    [filterUf, filterYear, hasSearched, page, query, results],
  );

  useEffect(() => {
    if (!hasRestoredState) {
      prevFiltersRef.current = { uf: filterUf, year: filterYear };
      return;
    }
    const prev = prevFiltersRef.current;
    if (prev.uf !== filterUf || prev.year !== filterYear) {
      setPage(1);
    }
    prevFiltersRef.current = { uf: filterUf, year: filterYear };
  }, [filterUf, filterYear, hasRestoredState]);

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
    syncUrlState({ query: normalizedQuery, uf: filterUf, year: filterYear, page: 1 });

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
      saveStateToStorage({ query: normalizedQuery, results: payload.results ?? [], hasSearched: true, page: 1 });
      setStatus("idle");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage("Não foi possível buscar agora. Tente novamente em instantes.");
    }
  }, [filterUf, filterYear, query, saveStateToStorage, syncUrlState]);

  const handleSuggestionClick = (text: string) => {
    setQuery(text);
    void handleSearch(undefined, text);
  };

  useEffect(() => {
    if (hasRestoredState) return;

    let nextUf = initialUf ?? "all";
    let nextYear = initialYear ?? "all";
    let nextResults: SearchResult[] = [];
    let nextHasSearched = false;
    let nextPage = 1;
    const parsedPage = Number.parseInt(initialPageParam ?? "", 10);
    if (Number.isFinite(parsedPage) && parsedPage > 0) {
      nextPage = parsedPage;
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<StoredSearchState>;
        if (nextUf === "all" && saved.filterUf) nextUf = saved.filterUf;
        if (nextYear === "all" && saved.filterYear) nextYear = saved.filterYear;
        if (Array.isArray(saved.results)) nextResults = saved.results;
        if (typeof saved.hasSearched === "boolean") nextHasSearched = saved.hasSearched;
        if (typeof saved.page === "number" && !(initialPageParam && Number.isFinite(parsedPage))) {
          nextPage = Math.max(1, Math.trunc(saved.page));
        }
        if (typeof saved.query === "string") {
          setQuery(saved.query);
        }
      }
    } catch (storageError) {
      console.error("Erro ao restaurar filtros anteriores", storageError);
    }

    setFilterUf(nextUf);
    setFilterYear(nextYear);
    setResults(nextResults);
    setHasSearched(nextHasSearched && nextResults.length > 0);
    setPage(nextPage);

    setHasRestoredState(true);
  }, [handleSearch, hasRestoredState, initialPageParam, initialQuery, initialUf, initialYear]);

  useEffect(() => {
    if (!hasRestoredState) return;
    saveStateToStorage({});
  }, [filterUf, filterYear, hasRestoredState, query, results, hasSearched, page, saveStateToStorage]);

  useEffect(() => {
    if (!hasRestoredState || !hasSearched) return;
    syncUrlState({ query, uf: filterUf, year: filterYear, page });
  }, [filterUf, filterYear, hasRestoredState, hasSearched, page, query, syncUrlState]);

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

        {hasSearched && (
          <section className="results-stage full-bleed" id="resultado" aria-live="polite" ref={resultsRef}>
            <div className="results-header">
              <div>
                <p className="eyebrow">Resultados para</p>
                <h2>{query || initialQuery || "Projetos de Lei"}</h2>
                <p className="muted">
                  {hasResults
                    ? `Mostrando ${pageStart}-${pageEnd} de ${sortedResults.length} projetos`
                    : "Nenhum projeto encontrado. Ajuste os filtros ou refine a busca."}
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
                      <span className="skeleton-line w-40" />
                      <span className="skeleton-line w-30" />
                    </div>
                    {[1, 2, 3, 4].map((row) => (
                      <div key={row} className="table-row">
                        <span className="skeleton-line w-70" />
                        <span className="skeleton-line w-80" />
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
                        <span>Fonte</span>
                      </div>
                      {paginatedResults.map((item) => {
                        const preferredLink = item.link_publico ?? item.sapl_url ?? null;
                        return (
                          <div
                            key={item.index}
                            className="table-row clickable-row"
                            role="button"
                            tabIndex={0}
                            aria-label={`Ver detalhes do projeto ${item.acao ?? `#${item.index}`}`}
                            onClick={() => openProjectDetail(item)}
                            onKeyDown={(event) => handleRowKeyDown(event, item)}
                          >
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
                            <div className="row-actions">
                              {preferredLink ? (
                                <a
                                  className="row-link"
                                  href={preferredLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  Abrir fonte
                                </a>
                              ) : (
                                <span className="muted small">Fonte indisponível</span>
                              )}
                            </div>
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

                {!isLoading && !hasResults && (
                  <div className="message muted">
                    Nenhum projeto encontrado {hasActiveFilters ? "com os filtros aplicados" : "para esta busca"}. Ajuste
                    o texto ou revise os filtros.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

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

      {isLoading && (
        <div className="page-overlay" role="alert" aria-live="assertive">
          <div className="overlay-card">
            <div className="spinner" aria-hidden="true" />
            <p className="overlay-title">Buscando projetos priorizados…</p>
            <p className="muted small">
              Analisando semelhança semântica e carregando resultados. Ajuste filtros enquanto processamos.
            </p>
          </div>
        </div>
      )}
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
