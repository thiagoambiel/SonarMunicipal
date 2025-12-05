"use client";

import type { FormEvent } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type SearchResult = {
  index: number;
  score: number;
  municipio?: string;
  uf?: string;
  acao?: string;
  data_apresentacao?: string;
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

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

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      void handleSearch(undefined, initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleSearch = async (event?: FormEvent<HTMLFormElement>, override?: string) => {
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
  };

  return (
    <div className="page google-layout">
      <div className="page-surface">
        <header className="topbar">
          <Link className="brand" href="/">
            <div className="brand-mark">CM</div>
            <div>
              <p className="brand-title">CityManager</p>
              <p className="brand-subtitle">Banco vivo de projetos de lei</p>
            </div>
          </Link>
          <nav className="nav">
            <div className="nav-links">
              <Link className="nav-link" href="/">
                Políticas Públicas
              </Link>
              <span className="nav-link active">Projetos de Lei</span>
              <Link className="nav-link" href="/methodology">
                Metodologia
              </Link>
            </div>
            <div className="nav-actions">
              <a className="ghost-btn" href="#filtros">
                Filtros
              </a>
              <Link className="ghost-btn" href="/methodology">
                Confiabilidade
              </Link>
            </div>
          </nav>
        </header>

        <main className="page-body">
          <section className="search-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">Navegar por projetos</p>
                <h2>Resultados completos para sua consulta</h2>
                <p className="muted">
                  Ordenamos por relevância semântica. Use os filtros para focar em UF e ano de apresentação.
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
              </div>
            </form>
          </section>

          <section className="results" aria-live="polite">
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
                </div>
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="table-row">
                    <span className="skeleton-line w-70" />
                    <span className="skeleton-line w-80" />
                    <span className="skeleton-line w-30" />
                    <span className="skeleton-line w-40" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && sortedResults.length > 0 && (
              <div className="table-card">
                <div className="table-head">
                  <span>Município</span>
                  <span>Tema</span>
                  <span>Ano</span>
                  <span>Relevância</span>
                </div>
                {sortedResults.map((item) => (
                  <div key={item.index} className="table-row">
                    <div>
                      <p className="strong">
                        {item.municipio ? item.municipio : "Município não informado"}
                        {item.uf && <span className="pill-uf"> · {item.uf}</span>}
                      </p>
                      <p className="muted small">Índice #{item.index}</p>
                    </div>
                    <p>{item.acao ?? "Ação não informada"}</p>
                    <p>{item.data_apresentacao ?? "—"}</p>
                    <p className="strong">{item.score.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && sortedResults.length === 0 && (
              <div className="message muted">
                Nenhum projeto encontrado {hasActiveFilters ? "com os filtros aplicados" : "para esta busca"}.
                Ajuste o texto ou revise os filtros.
              </div>
            )}
          </section>

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
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="page google-layout"><div className="google-box">Carregando...</div></div>}>
      <ProjectsContent />
    </Suspense>
  );
}
