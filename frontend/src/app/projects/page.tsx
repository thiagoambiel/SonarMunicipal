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

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

const MAX_RESULTS = 500;

function ProjectsContent() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");

  const searchButtonLabel = useMemo(() => (status === "loading" ? "Buscando…" : "Buscar"), [status]);

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
      <div className="google-box">
        <nav className="nav">
          <h1 className="logo" style={{ margin: 0 }}>
            CityManager
          </h1>
          <div className="nav-links">
            <Link className="nav-link" href="/">
              Políticas Públicas
            </Link>
            <span className="nav-link active">Projetos de Lei</span>
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

        <section className="results" aria-live="polite">
          {errorMessage && (
            <div className={`message ${status === "error" ? "error" : "warning"}`}>{errorMessage}</div>
          )}

          {results.length > 0 && (
            <div className="result-list">
              {results.map((item) => (
                <article key={item.index} className="result-card google-result">
                  <p className="result-link">
                    {item.municipio ? item.municipio : "Município não informado"}
                    {item.uf && <span className="pill-uf"> · {item.uf}</span>}
                  </p>
                  <p className="result-title">{item.acao ?? "Ação não informada"}</p>
                  <div className="meta">
                    {item.data_apresentacao && <span>{item.data_apresentacao}</span>}
                    <span>Índice #{item.index}</span>
                    <span>Relevância {item.score.toFixed(2)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
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
