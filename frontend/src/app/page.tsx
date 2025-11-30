"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

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

const MAX_RESULTS = 200;

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

  const searchButtonLabel = useMemo(() => (status === "loading" ? "Buscando…" : "Buscar"), [status]);

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

  return (
    <div className="page google-layout">
      <div className="google-box">
        <h1 className="logo">CityManager</h1>
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

        <section className="results" aria-live="polite">
          {errorMessage && (
            <div className={`message ${status === "error" ? "error" : "warning"}`}>{errorMessage}</div>
          )}

          {hasSearched && status === "idle" && results.length === 0 && !errorMessage && (
            <div className="message muted">
              Nenhum resultado encontrado para “{lastQuery}”. Tente reformular a pergunta.
            </div>
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
