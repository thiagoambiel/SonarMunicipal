"use client";
import Link from "next/link";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import CustomDropdown, { type DropdownBadge } from "@/components/CustomDropdown";
import MinimalNav from "@/components/MinimalNav";
import { clearProjectsSearchState } from "@/lib/projectsSearchStorage";

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
  uf?: string | null;
  acao: string;
  effect?: number | null;
  url?: string | null;
  data_apresentacao?: string | null;
  ementa?: string | null;
  indicator_before?: number | null;
  indicator_after?: number | null;
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
const CACHE_PREFIX = "policy-explorer-cache-";

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
  : 1000;

const toKey = (value: string | null) => (value == null ? NO_INDICATOR_KEY : value);

const normalizeText = (value?: string | null) => (value ?? "").trim().toLocaleLowerCase("pt-BR");

const buildMunicipioKey = (municipio?: string | null, uf?: string | null) => `${(municipio ?? "").trim()}|${uf ?? ""}`;
const buildMunicipioLabel = (municipio: string, uf?: string | null) => (uf ? `${municipio} · ${uf}` : municipio);
const parseMunicipioKey = (key: string) => {
  const [municipio, uf = ""] = key.split("|");
  return { municipio, uf: uf || null };
};

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

type PolicySortOption = "effect-desc" | "effect-asc" | "quality-desc" | "quality-asc";

const policySortOptions: Array<{ value: PolicySortOption; label: string; badges?: DropdownBadge[] }> = [
  { value: "quality-desc", label: "Qualidade", badges: [{ label: "Maior primeiro", tone: "info" }] },
  { value: "quality-asc", label: "Qualidade", badges: [{ label: "Menor primeiro", tone: "info" }] },
  { value: "effect-desc", label: "Efeito médio", badges: [{ label: "Maior primeiro", tone: "info" }] },
  { value: "effect-asc", label: "Efeito médio", badges: [{ label: "Menor primeiro", tone: "info" }] },
];

const isPolicySortOption = (value: string | null | undefined): value is PolicySortOption =>
  policySortOptions.some((option) => option.value === value);

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

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="landing">
          <main className="landing-body">
            <div className="message muted">Carregando...</div>
          </main>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<"idle" | "loading" | "slow" | "very-slow">("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [data, setData] = useState<PolicyExplorerResponse | null>(null);
  const [sortPoliciesBy, setSortPoliciesBy] = useState<PolicySortOption>("quality-desc");
  const [filterUf, setFilterUf] = useState<string>("all");
  const [filterMunicipio, setFilterMunicipio] = useState<string>("all");
  const [isMunicipioOpen, setIsMunicipioOpen] = useState(false);
  const [municipioSearch, setMunicipioSearch] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<string>(NO_INDICATOR_KEY);
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const [filtersFromUrlApplied, setFiltersFromUrlApplied] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verySlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const municipalityDropdownRef = useRef<HTMLDivElement | null>(null);

  const clearLoadingTimers = () => {
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    if (verySlowTimerRef.current) clearTimeout(verySlowTimerRef.current);
    slowTimerRef.current = null;
    verySlowTimerRef.current = null;
  };

  const selectPreferredWindow = useCallback((bundle: IndicatorBundle | null | undefined) => {
    if (!bundle) return null;
    const intersection = (bundle.effect_windows ?? []).filter(
      (window) =>
        bundle.best_quality_effect_windows?.includes(window) && bundle.best_effect_mean_windows?.includes(window),
    );
    if (intersection.length > 0) return intersection[0];
    if (bundle.best_quality_effect_windows?.length) return bundle.best_quality_effect_windows[0] ?? null;
    if (bundle.best_effect_mean_windows?.length) return bundle.best_effect_mean_windows[0] ?? null;
    return bundle.effect_windows?.[0] ?? null;
  }, []);

  const syncUrlState = useCallback(
    (state: {
      query?: string;
      indicator?: string | null;
      window?: number | null;
      sort?: PolicySortOption;
      uf?: string;
      municipio?: string;
    }) => {
      const params = new URLSearchParams();
      const normalizedQuery = state.query?.trim();
      if (normalizedQuery) params.set("q", normalizedQuery);
      const indicatorValue = state.indicator && state.indicator !== NO_INDICATOR_KEY ? state.indicator : null;
      if (indicatorValue) params.set("indicator", indicatorValue);
      if (Number.isFinite(state.window ?? null)) params.set("window", String(state.window));
      if (state.sort && state.sort !== "quality-desc") params.set("sort", state.sort);
      if (state.uf && state.uf !== "all") params.set("uf", state.uf);
      if (state.municipio && state.municipio !== "all") params.set("municipio", state.municipio);
      const search = params.toString();
      router.replace(search ? `/?${search}` : "/", { scroll: false });
    },
    [router],
  );

  const applyPayload = useCallback((payload: PolicyExplorerResponse) => {
    setData(payload);
    setSelectedIndicator(NO_INDICATOR_KEY);
    const defaultWindow = selectPreferredWindow(payload.baseline) ?? payload.baseline?.windows?.[0]?.effect_window_months ?? null;
    setSelectedWindow(defaultWindow ?? null);
    setHasSearched(true);
    setError(null);
  }, [selectPreferredWindow]);

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

  const geoMatch = useCallback(
    (action: PolicyAction) => {
      const matchesUf = filterUf === "all" || action.uf === filterUf;
      if (filterMunicipio === "all") return matchesUf;
      const { municipio: selectedMunicipio, uf: selectedMunicipioUf } = parseMunicipioKey(filterMunicipio);
      const matchesMunicipio = normalizeText(action.municipio) === normalizeText(selectedMunicipio);
      const matchesMunicipioUf = !selectedMunicipioUf || action.uf === selectedMunicipioUf;
      return matchesUf && matchesMunicipio && matchesMunicipioUf;
    },
    [filterMunicipio, filterUf],
  );

  const filteredPolicies = useMemo(() => {
    const policies = activeWindowResult?.policies ?? [];
    if (filterUf === "all" && filterMunicipio === "all") return policies;
    return policies.filter((policy) => policy.actions.some((action) => geoMatch(action)));
  }, [activeWindowResult?.policies, filterMunicipio, filterUf, geoMatch]);

  const activePolicies = useMemo(() => {
    const policies = filteredPolicies;
    const compareNumber = (
      valueA: number | null | undefined,
      valueB: number | null | undefined,
      direction: "asc" | "desc",
    ) => {
      const hasA = valueA != null;
      const hasB = valueB != null;
      if (!hasA && !hasB) return 0;
      if (!hasA) return 1;
      if (!hasB) return -1;
      const diff = valueA - valueB;
      return direction === "asc" ? diff : -diff;
    };

    const sorted = [...policies].sort((a, b) => {
      switch (sortPoliciesBy) {
        case "effect-asc":
          return compareNumber(a.effect_mean, b.effect_mean, "asc");
        case "effect-desc":
          return compareNumber(a.effect_mean, b.effect_mean, "desc");
        case "quality-asc":
          return compareNumber(a.quality_score, b.quality_score, "asc");
        case "quality-desc":
          return compareNumber(a.quality_score, b.quality_score, "desc");
        default:
          return 0;
      }
    });

    return sorted;
  }, [filteredPolicies, sortPoliciesBy]);

  const hasResults = activePolicies.length > 0;
  const usedIndicator = Boolean(activeBundle?.indicator);
  const indicatorAlias = activeBundle?.indicator_alias ?? "Sem indicador";
  const indicatorPositiveIsGood = activeBundle?.positive_is_good ?? true;
  const bestQualityWindows = activeBundle?.best_quality_effect_windows ?? [];
  const bestEffectWindows = activeBundle?.best_effect_mean_windows ?? [];
  const effectWindowLabel = activeWindowResult?.effect_window_months ?? "—";
  const availableUfs = useMemo(() => {
    const ufs = new Set<string>();
    (activeWindowResult?.policies ?? []).forEach((policy) => {
      policy.actions.forEach((action) => {
        if (action.uf) ufs.add(action.uf);
      });
    });
    return Array.from(ufs).sort();
  }, [activeWindowResult?.policies]);

  const availableMunicipios = useMemo(() => {
    const municipios = new Map<string, { key: string; label: string; municipio: string; uf: string | null }>();
    (activeWindowResult?.policies ?? []).forEach((policy) => {
      policy.actions.forEach((action) => {
        if (filterUf !== "all" && action.uf !== filterUf) return;
        const name = (action.municipio ?? "").trim();
        if (!name) return;
        const key = buildMunicipioKey(name, action.uf ?? null);
        if (!municipios.has(key)) {
          municipios.set(key, {
            key,
            label: buildMunicipioLabel(name, action.uf ?? null),
            municipio: name,
            uf: action.uf ?? null,
          });
        }
      });
    });
    return Array.from(municipios.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [activeWindowResult?.policies, filterUf]);

  const filteredMunicipioOptions = useMemo(() => {
    if (!municipioSearch.trim()) return availableMunicipios;
    const queryText = normalizeText(municipioSearch);
    return availableMunicipios.filter((option) => normalizeText(option.label).includes(queryText));
  }, [availableMunicipios, municipioSearch]);

  useEffect(() => {
    if (!activeBundle) return;
    const preferred = selectPreferredWindow(activeBundle);
    if (preferred == null) return;
    if (selectedWindow == null || !activeBundle.effect_windows.includes(selectedWindow)) {
      setSelectedWindow(preferred);
    }
  }, [activeBundle, selectPreferredWindow, selectedWindow]);

  const runSearch = useCallback(async (text: string, options?: { skipUrlUpdate?: boolean }) => {
    const normalized = text.trim();
    if (!normalized) {
      setError("Digite uma pergunta para buscar.");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    clearLoadingTimers();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setLoadingPhase("loading");
    setError(null);
    setHasSearched(true);

    slowTimerRef.current = setTimeout(() => setLoadingPhase("slow"), 8000);
    verySlowTimerRef.current = setTimeout(() => setLoadingPhase("very-slow"), 15000);

    try {
      if (!options?.skipUrlUpdate) {
        syncUrlState({
          query: normalized,
          indicator: selectedIndicator,
          window: selectedWindow,
          sort: sortPoliciesBy,
          uf: filterUf,
          municipio: filterMunicipio,
        });
      }

      const response = await fetch(apiUrl("/api/policy-explorer"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: normalized, top_k: MAX_RESULTS }),
        signal: controller.signal,
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
      applyPayload(payload);
      try {
        sessionStorage.setItem(`${CACHE_PREFIX}${normalized}`, JSON.stringify(payload));
      } catch (storageError) {
        console.error("Erro ao armazenar cache de políticas", storageError);
      }
    } catch (fetchError) {
      console.error(fetchError);
      if ((fetchError as Error)?.name === "AbortError") {
        setError("Busca cancelada. Tente novamente.");
      } else {
        setError("Não foi possível gerar políticas agora. Tente novamente em instantes.");
      }
    } finally {
      clearLoadingTimers();
      setLoadingPhase("idle");
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [applyPayload, filterMunicipio, filterUf, selectedIndicator, selectedWindow, sortPoliciesBy, syncUrlState]);

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
    const target = selectPreferredWindow(bundle) ?? selectedWindow;
    if (target != null) {
      setSelectedWindow(target);
      syncUrlState({ query, indicator: key, window: target, sort: sortPoliciesBy, uf: filterUf, municipio: filterMunicipio });
    } else {
      syncUrlState({ query, indicator: key, window: selectedWindow, sort: sortPoliciesBy, uf: filterUf, municipio: filterMunicipio });
    }
  };

  useEffect(() => {
    const ufParam = searchParams.get("uf");
    const municipioParam = searchParams.get("municipio");
    if (ufParam) setFilterUf(ufParam);
    if (municipioParam) setFilterMunicipio(municipioParam);
  }, [searchParams]);

  useEffect(() => {
    const initialQuery = searchParams.get("q");
    if (!initialQuery || hasSearched || loading) return;
    const normalized = initialQuery.trim();
    if (!normalized) return;

    setQuery(normalized);

    try {
      const cached = sessionStorage.getItem(`${CACHE_PREFIX}${normalized}`);
      if (cached) {
        const payload = JSON.parse(cached) as PolicyExplorerResponse;
        applyPayload(payload);
        return;
      }
    } catch (storageError) {
      console.error("Erro ao recuperar cache de políticas", storageError);
    }

    void runSearch(normalized, { skipUrlUpdate: true });
  }, [applyPayload, hasSearched, loading, runSearch, searchParams]);

  useEffect(() => {
    if (!data || filtersFromUrlApplied) return;
    const indicatorParam = searchParams.get("indicator");
    const windowParam = searchParams.get("window");
    const sortParam = searchParams.get("sort");
    const ufParam = searchParams.get("uf");
    const municipioParam = searchParams.get("municipio");

    if (indicatorParam) {
      const exists = bundles.find((bundle) => toKey(bundle.indicator) === indicatorParam);
      if (exists) {
        setSelectedIndicator(indicatorParam);
      }
    }

    if (windowParam) {
      const parsed = Number(windowParam);
      const targetBundle =
        bundles.find((bundle) => toKey(bundle.indicator) === (indicatorParam ?? selectedIndicator)) ??
        activeBundle ??
        bundles[0];
      if (Number.isFinite(parsed) && targetBundle?.effect_windows?.includes(parsed)) {
        setSelectedWindow(parsed);
      }
    }

    if (sortParam && isPolicySortOption(sortParam)) {
      setSortPoliciesBy(sortParam);
    }

    if (ufParam) setFilterUf(ufParam);
    if (municipioParam) setFilterMunicipio(municipioParam);

    setFiltersFromUrlApplied(true);
  }, [activeBundle, bundles, data, filtersFromUrlApplied, searchParams, selectedIndicator]);

  const buildWindowLabel = (window: number) => {
    const monthsLabel = `${window} ${window === 1 ? "mês" : "meses"}`;
    const semesters = window / 6;
    const years = window / 12;
    const semestersLabel = `${semesters % 1 === 0 ? semesters : semesters.toFixed(1)} ${semesters === 1 ? "semestre" : "semestres"}`;
    const yearsLabel = `${years % 1 === 0 ? years : years.toFixed(1)} ${years === 1 ? "ano" : "anos"}`;
    return `${monthsLabel} · ${semestersLabel} · ${yearsLabel}`;
  };

  const windowOptions = useMemo(() => {
    if (!usedIndicator) {
      return [
        {
          value: "__select_indicator__",
          label: "Escolha um indicador para selecionar a janela",
        },
      ];
    }
    return (activeBundle?.effect_windows ?? []).map((window) => {
      const badges: DropdownBadge[] = [];
      if (bestQualityWindows.includes(window)) badges.push({ label: "Melhor qualidade", tone: "quality" });
      if (bestEffectWindows.includes(window)) badges.push({ label: "Melhor efeito", tone: "effect" });
      return {
        value: window,
        label: buildWindowLabel(window),
        badges,
      };
    });
  }, [activeBundle?.effect_windows, bestEffectWindows, bestQualityWindows, usedIndicator]);

  const windowSelectValue = usedIndicator ? selectedWindow ?? "" : "__select_indicator__";
  const sortSelectValue = usedIndicator ? sortPoliciesBy : "__select_indicator__";
  const sortOptions = useMemo(() => {
    if (!usedIndicator) {
      return [
        {
          value: "__select_indicator__",
          label: "Escolha um indicador para ordenar as políticas",
        },
      ];
    }
    return policySortOptions.map((option) => ({
      value: option.value,
      label: option.label,
      badges: option.badges,
    }));
  }, [usedIndicator]);

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
          indicator_id: activeBundle?.indicator ?? null,
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
    if (filterUf !== "all" && !availableUfs.includes(filterUf)) {
      setFilterUf("all");
    }
  }, [availableUfs, filterUf]);

  useEffect(() => {
    if (filterMunicipio !== "all" && !availableMunicipios.some((option) => option.key === filterMunicipio)) {
      setFilterMunicipio("all");
    }
  }, [availableMunicipios, filterMunicipio]);

  const selectedMunicipioLabel =
    filterMunicipio === "all"
      ? "Todos os municípios"
      : availableMunicipios.find((option) => option.key === filterMunicipio)?.label ?? "Todos os municípios";

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!isMunicipioOpen) return;
      if (municipalityDropdownRef.current && !municipalityDropdownRef.current.contains(event.target as Node)) {
        setIsMunicipioOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMunicipioOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMunicipioOpen]);

  useEffect(() => {
    if (!isMunicipioOpen) {
      setMunicipioSearch("");
    }
  }, [isMunicipioOpen]);

  useEffect(() => {
    if (!loading && hasSearched && data && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading, hasSearched, data]);

  useEffect(() => {
    if (!hasSearched) return;
    syncUrlState({
      query,
      indicator: selectedIndicator,
      window: selectedWindow,
      sort: sortPoliciesBy,
      uf: filterUf,
      municipio: filterMunicipio,
    });
  }, [filterMunicipio, filterUf, hasSearched, query, selectedIndicator, selectedWindow, sortPoliciesBy, syncUrlState]);

  useEffect(() => () => clearLoadingTimers(), []);

  const handleCancelSearch = () => {
    try {
      const controller = abortControllerRef.current;
      if (controller && !controller.signal.aborted) {
        controller.abort("user-cancelled");
      }
    } catch (abortError) {
      console.warn("Erro ao cancelar busca", abortError);
    }
    clearLoadingTimers();
    setLoading(false);
    setLoadingPhase("idle");
  };

  const loadingTitle =
    loadingPhase === "very-slow" ? "Demorando mais que o esperado…" : "Gerando políticas priorizadas…";
  const loadingDescription =
    loadingPhase === "very-slow"
      ? "Ainda estamos calculando. Isso pode levar alguns segundos extras. Você pode cancelar e tentar novamente."
      : loadingPhase === "slow"
        ? "Quase lá! Refinando políticas e aplicando indicador à sua pergunta."
        : "Agrupando projetos similares, aplicando indicador e selecionando as melhores políticas para sua pergunta.";
  const shouldShowBackToTop = showBackToTop && hasResults;

  return (
    <div className="landing">
      <MinimalNav />

      <main className="landing-body">
        <section className="search-stage">

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
              {(filterUf !== "all" || filterMunicipio !== "all") && (
                <div className="chips-inline">
                  {filterUf !== "all" && <span className="pill neutral">UF: {filterUf}</span>}
                  {filterMunicipio !== "all" && <span className="pill neutral">Município: {selectedMunicipioLabel}</span>}
                  <button
                    type="button"
                    className="ghost-link"
                    onClick={() => {
                      setFilterUf("all");
                      setFilterMunicipio("all");
                    }}
                  >
                    Limpar filtros geográficos
                  </button>
                </div>
              )}
            </div>

            <div className="results-grid">
              <aside className="filters-panel">
                <div className="filter-card">
                  <p className="filter-title">UF</p>
                  <p className="muted small">Filtre políticas aplicadas em estados específicos.</p>
                  <CustomDropdown
                    id="policy-uf-select"
                    ariaLabel="Filtrar políticas por UF"
                    value={filterUf}
                    disabled={availableUfs.length === 0}
                    options={[
                      { value: "all", label: "Todas as UF" },
                      ...availableUfs.map((uf) => ({ value: uf, label: uf })),
                    ]}
                    onChange={(newValue) => setFilterUf(String(newValue))}
                  />
                  {availableUfs.length === 0 && (
                    <p className="muted small helper-text">Busque para liberar as UF retornadas nos resultados.</p>
                  )}
                </div>

                <div className="filter-card">
                  <p className="filter-title">Município</p>
                  <p className="muted small">Mesmas opções da busca de projetos, com busca rápida no texto.</p>
                  <div
                    className={`custom-dropdown ${availableMunicipios.length === 0 ? "disabled" : ""}`}
                    ref={municipalityDropdownRef}
                  >
                    <button
                      type="button"
                      className="dropdown-trigger"
                      onClick={() => availableMunicipios.length > 0 && setIsMunicipioOpen((prev) => !prev)}
                      aria-haspopup="listbox"
                      aria-expanded={isMunicipioOpen}
                      disabled={availableMunicipios.length === 0}
                    >
                      <div className="dropdown-trigger-content">
                        <span className="dropdown-value">
                          {selectedMunicipioLabel}
                        </span>
                      </div>
                      <div className="dropdown-icons">
                        <svg
                          className={`chevron ${isMunicipioOpen ? "open" : ""}`}
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
                    {isMunicipioOpen && (
                      <div className="dropdown-menu with-search" role="listbox">
                        <div className="dropdown-search">
                          <input
                            type="search"
                            placeholder="Digite para filtrar"
                            value={municipioSearch}
                            onChange={(event) => setMunicipioSearch(event.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="dropdown-options-list">
                          <button
                            type="button"
                            className={`dropdown-option ${filterMunicipio === "all" ? "active" : ""}`}
                            role="option"
                            aria-selected={filterMunicipio === "all"}
                            onClick={() => {
                              setFilterMunicipio("all");
                              setIsMunicipioOpen(false);
                            }}
                          >
                            <span className="option-line">
                              <span className="option-label">Todos os municípios</span>
                            </span>
                          </button>
                          {filteredMunicipioOptions.map((option) => {
                            const isActive = option.key === filterMunicipio;
                            return (
                              <button
                                key={option.key}
                                type="button"
                                className={`dropdown-option ${isActive ? "active" : ""}`}
                                role="option"
                                aria-selected={isActive}
                                onClick={() => {
                                  setFilterMunicipio(option.key);
                                  setIsMunicipioOpen(false);
                                }}
                              >
                                <span className="option-line">
                                  <span className="option-label">{option.label}</span>
                                </span>
                              </button>
                            );
                          })}
                          {filteredMunicipioOptions.length === 0 && (
                            <div className="dropdown-empty">Nenhum município encontrado com o texto digitado.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {availableMunicipios.length === 0 && (
                    <p className="muted small helper-text">
                      Primeiro execute a busca ou escolha a UF para mostrar os municípios disponíveis.
                    </p>
                  )}
                </div>

                <div className="filter-card">
                  <p className="filter-title">Indicador</p>
                  <p className="muted small">Escolha o indicador que deve subir ou descer para estimar o impacto das políticas no mundo real.</p>
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
                  <p className="muted small">Defina em quanto tempo o impacto é estimado (meses, semestres ou anos).</p>
                  <CustomDropdown
                    id="window-select"
                    ariaLabel="Selecionar janela de efeito"
                    disabled={!usedIndicator}
                    value={windowSelectValue}
                    options={windowOptions}
                    onChange={(newValue) => {
                      const parsed = typeof newValue === "number" ? newValue : Number(newValue);
                      const normalizedWindow = Number.isFinite(parsed) ? parsed : null;
                      setSelectedWindow(normalizedWindow);
                      syncUrlState({
                        query,
                        indicator: selectedIndicator,
                        window: normalizedWindow,
                        sort: sortPoliciesBy,
                      });
                    }}
                  />
                </div>

                <div className="filter-card">
                  <p className="filter-title">Ordenar políticas</p>
                  <p className="muted small">Reorganize por efeito médio ou qualidade.</p>
                  <CustomDropdown
                    id="policy-sort-select"
                    ariaLabel="Selecionar ordenação das políticas"
                    disabled={!usedIndicator}
                    value={sortSelectValue}
                    options={sortOptions}
                    onChange={(newValue) => {
                      if (!usedIndicator) return;
                      const nextValue = typeof newValue === "string" ? newValue : String(newValue);
                      setSortPoliciesBy(isPolicySortOption(nextValue) ? nextValue : "quality-desc");
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
                {loading && (
                  <div className="message muted">
                    {loadingPhase === "very-slow"
                      ? "Processando há mais tempo que o normal. Aguarde alguns segundos ou cancele para tentar de novo."
                      : "Gerando políticas com base na sua pergunta…"}
                  </div>
                )}

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
                      const policyActions =
                        filterUf === "all" && filterMunicipio === "all"
                          ? policy.actions
                          : policy.actions.filter((action) => geoMatch(action));

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
                                  <span title={usedIndicator ? "Sem dados suficientes para estimar o efeito nesse indicador e janela." : "Selecione um indicador para estimar o efeito."}>
                                    {usedIndicator ? "Sem dados suficientes" : "Selecione um indicador"}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="metric-badge soft">
                              <span className="badge-label">Qualidade</span>
                              <span className="badge-value">
                                {policy.quality_score != null ? qualityValue : usedIndicator ? "Sem dados suficientes" : "Selecione um indicador"}
                              </span>
                            </div>
                          </div>

                          <p className="policy-count">
                            Política aplicada em {policyActions.length} município
                            {policyActions.length === 1 ? "" : "s"}:
                          </p>
                          <ul className="policy-city-list">
                            {policyActions.map((action, actionIndex) => {
                              const effectLabel =
                                usedIndicator && action.effect != null
                                  ? `Variação: ${formatEffectValue(action.effect)}`
                                  : "Sem indicador calculado";
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
            <Link className="ghost-btn" href="/projects" onClick={clearProjectsSearchState}>
              Ver projetos de lei
            </Link>
          </div>
        </section>
      </main>

      {loading && (
        <div className="page-overlay" role="alert" aria-live="assertive">
          <div className="overlay-card">
            <div className="spinner" aria-hidden="true" />
            <p className="overlay-title">{loadingTitle}</p>
            <p className="muted small">{loadingDescription}</p>
            <div className="overlay-actions">
              <button className="ghost-btn" type="button" onClick={handleCancelSearch}>
                Cancelar busca
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
