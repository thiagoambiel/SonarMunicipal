"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type IndicatorDescriptor = {
  id: string;
  path: string;
  city_col: string;
  value_col: string;
  alias: string;
  positive_is_good: boolean;
  min_value: number;
  periods_per_year?: number;
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
  selected_effect_window?: number | null;
  best_quality_effect_window?: number | null;
  best_quality_effect_windows?: number[];
  best_effect_mean_window?: number | null;
  best_effect_mean_windows?: number[];
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
  bestQualityWindows: number[];
  bestEffectMeanWindows: number[];
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

const MAX_RESULTS = Number.isFinite(Number(process.env.NEXT_PUBLIC_MAX_TOP_K))
  ? Number(process.env.NEXT_PUBLIC_MAX_TOP_K)
  : 500;
const DEFAULT_EFFECT_WINDOW = 6;
const EFFECT_WINDOW_OPTIONS = [6, 12, 18, 24, 30, 36];

const monthsPerIndicator = (indicator: IndicatorDescriptor | null | undefined): number => {
  const periods = indicator?.periods_per_year ?? 2; // padrão semestral
  const months = Math.round(12 / (periods > 0 ? periods : 2));
  return months > 0 ? months : 6;
};

const buildEffectWindowOptions = (indicator: IndicatorDescriptor | null | undefined): number[] => {
  const step = monthsPerIndicator(indicator);
  const filtered = EFFECT_WINDOW_OPTIONS.filter((value) => value % step === 0);
  if (filtered.length > 0) return filtered;
  const fallback = [step, step * 2, step * 3].filter((value, index, arr) => value > 0 && arr.indexOf(value) === index);
  return fallback.length > 0 ? fallback : [DEFAULT_EFFECT_WINDOW];
};

const formatEffectWindowLabel = (months: number) => {
  const semesters = months / 6;
  const years = months / 12;
  const semestersValue = Number.isInteger(semesters) ? semesters : Number(semesters.toFixed(1));
  const yearsLabel = Number.isInteger(years)
    ? `${years} ano${years === 1 ? "" : "s"}`
    : `${years.toFixed(1)} ano${years > 1 ? "s" : ""}`;
  return `${months} meses • ${semestersValue} semestre${semestersValue === 1 ? "" : "s"} • ${yearsLabel}`;
};

type DropdownValue = string | number;

type DropdownBadge = {
  label: string;
  tone: "quality" | "effect";
};

type DropdownOption = {
  value: DropdownValue;
  label: string;
  badges?: DropdownBadge[];
};

type CustomDropdownProps = {
  options: DropdownOption[];
  value: DropdownValue;
  disabled?: boolean;
  onChange: (value: DropdownValue) => void;
  id?: string;
  ariaLabel?: string;
};

function CustomDropdown({ options, value, disabled, onChange, id, ariaLabel }: CustomDropdownProps) {
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
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [disabled, open]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const buildBadges = (current: DropdownValue): DropdownBadge[] =>
    options.find((item) => item.value === current)?.badges ?? [];

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
        className="dropdown-trigger"
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
      </button>
      {isMenuOpen && (
        <div className="dropdown-menu" role="listbox">
          {options.map((option) => {
            const badges = buildBadges(option.value);
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
                  {badges.length > 0 && (
                    <div className="option-badges">
                      {badges.map((badge) => (
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

function HomeContent() {
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
  const latestPoliciesRequestRef = useRef(0);
  const previousIndicatorRef = useRef<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [indicatorPositiveIsGood, setIndicatorPositiveIsGood] = useState(true);
  const [indicatorAlias, setIndicatorAlias] = useState("");
  const [bestQualityWindows, setBestQualityWindows] = useState<number[]>([]);
  const [bestEffectMeanWindows, setBestEffectMeanWindows] = useState<number[]>([]);
  const [windowBadgesCache, setWindowBadgesCache] = useState<Record<string, { quality: number[]; effect: number[] }>>(
    {},
  );
  const searchControllerRef = useRef<AbortController | null>(null);
  const policiesControllerRef = useRef<AbortController | null>(null);
  const selectedIndicatorObj = useMemo(
    () => indicators.find((indicator) => indicator.id === selectedIndicator) ?? null,
    [indicators, selectedIndicator],
  );
  const resetSearchOutputs = () => {
    setErrorMessage(null);
    setResults([]);
    setPolicies([]);
    setPoliciesError(null);
    setPoliciesStatus("idle");
    setPoliciesUseIndicator(false);
    setHasSearched(false);
    setLastQuery("");
    const cached = selectedIndicator ? windowBadgesCache[selectedIndicator] : null;
    setBestQualityWindows(cached?.quality ?? []);
    setBestEffectMeanWindows(cached?.effect ?? []);
    setSuggestionsVisible(true);
  };
  const effectWindowOptions = useMemo(
    () => buildEffectWindowOptions(selectedIndicatorObj),
    [selectedIndicatorObj],
  );
  const effectWindowDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      effectWindowOptions.map((months) => {
        const badges: DropdownBadge[] = [];
        if (bestQualityWindows.includes(months)) {
          badges.push({ label: "Melhor Qualidade", tone: "quality" });
        }
        if (bestEffectMeanWindows.includes(months)) {
          badges.push({ label: "Melhor Efeito Médio", tone: "effect" });
        }
        return { value: months, label: formatEffectWindowLabel(months), badges };
      }),
    [bestEffectMeanWindows, bestQualityWindows, effectWindowOptions],
  );
  const indicatorDropdownOptions = useMemo<DropdownOption[]>(
    () => [
      { value: "", label: "Sem indicador" },
      ...indicators.map((indicator) => ({
        value: indicator.id,
        label: indicator.alias || indicator.id,
      })),
    ],
    [indicators],
  );

  const searchButtonLabel = useMemo(() => (status === "loading" ? "Buscando…" : "Buscar"), [status]);
  const isLoadingPolicies = policiesStatus === "loading";
  const showPolicyArea = hasSearched || isLoadingPolicies || policies.length > 0 || Boolean(policiesError);
  const isProcessing = status === "loading" || isLoadingPolicies;

  const formatEffectValue = (value?: number | null) => {
    if (value == null) return "—";
    const fixed = value.toFixed(2);
    const signed = value > 0 ? `+${fixed}` : fixed;
    return `${signed}%`;
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
        const response = await fetch(apiUrl("/api/indicators"));
        if (!response.ok) return;
        const payload = (await response.json()) as IndicatorDescriptor[];
        setIndicators(payload);
      } catch (error) {
        console.error("Erro ao carregar indicadores", error);
      }
    };
    loadIndicators();
  }, [searchParams]);

  useEffect(() => {
    if (!selectedIndicatorObj) return;
    setIndicatorAlias(selectedIndicatorObj.alias || selectedIndicatorObj.id);
    setIndicatorPositiveIsGood(selectedIndicatorObj.positive_is_good);
  }, [selectedIndicatorObj]);

  useEffect(() => {
    const previous = previousIndicatorRef.current;
    if (previous !== selectedIndicator) {
      const cached = selectedIndicator ? windowBadgesCache[selectedIndicator] : null;
      setBestQualityWindows(cached?.quality ?? []);
      setBestEffectMeanWindows(cached?.effect ?? []);
      previousIndicatorRef.current = selectedIndicator;
      return;
    }
    previousIndicatorRef.current = selectedIndicator;
  }, [selectedIndicator, windowBadgesCache]);

  useEffect(() => {
    if (!effectWindowOptions.length) return;
    if (!effectWindowOptions.includes(effectWindowMonths)) {
      setEffectWindowMonths(effectWindowOptions[0]);
    }
  }, [effectWindowOptions, effectWindowMonths]);

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
    if (searchControllerRef.current) {
      searchControllerRef.current.abort();
    }
    const controller = new AbortController();
    searchControllerRef.current = controller;

    try {
      const response = await fetch(apiUrl("/api/search"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalizedQuery, top_k: MAX_RESULTS }),
        signal: controller.signal,
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
      searchControllerRef.current = null;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
        return;
      }
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
      const requestId = latestPoliciesRequestRef.current + 1;
      latestPoliciesRequestRef.current = requestId;
      if (policiesControllerRef.current) {
        policiesControllerRef.current.abort();
      }
      const controller = new AbortController();
      policiesControllerRef.current = controller;
      try {
        const candidateWindows = selectedIndicator ? effectWindowOptions : [];
        const response = await fetch(apiUrl("/api/policies"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bill_indexes: results.map((r) => r.index),
            similarity_threshold: 0.75,
            min_group_members: 2,
            use_indicator: Boolean(selectedIndicator),
            indicator: selectedIndicator || null,
            effect_window_months: effectWindowMonths,
            effect_window_months_candidates: candidateWindows,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(response.statusText);
        }

        const payload = (await response.json()) as PolicyResponse;
        if (requestId !== latestPoliciesRequestRef.current) return;
        const toNumberArray = (input: unknown): number[] => {
          if (!Array.isArray(input)) return [];
          const values = input
            .map((value) => (typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null))
            .filter((value): value is number => value != null);
          return Array.from(new Set(values));
        };
        const bestQualityList = toNumberArray(payload.best_quality_effect_windows);
        const bestEffectMeanList = toNumberArray(payload.best_effect_mean_windows);
        const bestQualityFromPayload =
          bestQualityList.length > 0
            ? bestQualityList
            : typeof payload.best_quality_effect_window === "number"
              ? [payload.best_quality_effect_window]
              : typeof payload.selected_effect_window === "number"
                ? [payload.selected_effect_window]
                : [];
        const bestEffectMeanFromPayload =
          bestEffectMeanList.length > 0
            ? bestEffectMeanList
            : typeof payload.best_effect_mean_window === "number"
              ? [payload.best_effect_mean_window]
              : [];
        setBestQualityWindows(selectedIndicator ? bestQualityFromPayload : []);
        setBestEffectMeanWindows(selectedIndicator ? bestEffectMeanFromPayload : []);
        if (selectedIndicator) {
          setWindowBadgesCache((prev) => ({
            ...prev,
            [selectedIndicator]: {
              quality: bestQualityFromPayload,
              effect: bestEffectMeanFromPayload,
            },
          }));
        }
        setPolicies(payload.policies ?? []);
        setPoliciesUseIndicator(Boolean(payload.used_indicator));
        setPoliciesStatus("idle");
        policiesControllerRef.current = null;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          if (requestId !== latestPoliciesRequestRef.current) return;
          setPoliciesStatus("idle");
          return;
        }
        console.error(error);
        if (requestId !== latestPoliciesRequestRef.current) return;
        setPoliciesStatus("error");
        setPoliciesError("Não foi possível gerar políticas agora.");
      }
    };

    if (skipPolicyFetchRef.current) {
      skipPolicyFetchRef.current = false;
      return;
    }

    void fetchPolicies();
  }, [results, selectedIndicator, effectWindowMonths, hasSearched, hasHydrated, effectWindowOptions]);

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
      const toNumberArray = (input: unknown): number[] => {
        if (!Array.isArray(input)) return [];
        const values = input
          .map((value) => (typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null))
          .filter((value): value is number => value != null);
        return Array.from(new Set(values));
      };
      const legacyBestEffect = (stored as { bestEffectWindow?: number | null }).bestEffectWindow;
      const legacyBestQuality = (stored as { bestQualityWindow?: number | null }).bestQualityWindow;
      const bestQualityFromStorage = toNumberArray((stored as { bestQualityWindows?: unknown }).bestQualityWindows);
      if (!bestQualityFromStorage.length && typeof legacyBestQuality === "number") {
        bestQualityFromStorage.push(legacyBestQuality);
      } else if (!bestQualityFromStorage.length && typeof legacyBestEffect === "number") {
        bestQualityFromStorage.push(legacyBestEffect);
      }
      const legacyBestEffectMean = (stored as { bestEffectMeanWindow?: number | null }).bestEffectMeanWindow;
      const bestEffectMeanFromStorage = toNumberArray(
        (stored as { bestEffectMeanWindows?: unknown }).bestEffectMeanWindows,
      );
      if (!bestEffectMeanFromStorage.length && typeof legacyBestEffectMean === "number") {
        bestEffectMeanFromStorage.push(legacyBestEffectMean);
      }
      setBestQualityWindows(bestQualityFromStorage);
      setBestEffectMeanWindows(bestEffectMeanFromStorage);
      if (stored.policies && stored.policies.length > 0) {
        skipPolicyFetchRef.current = true;
      }
    } catch (error) {
      console.error("Erro ao restaurar estado anterior", error);
    } finally {
      setHasHydrated(true);
    }
  }, [searchParams]);

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
      bestQualityWindows,
      bestEffectMeanWindows,
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
    bestQualityWindows,
    bestEffectMeanWindows,
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

  const handleCancelProcessing = () => {
    if (status === "loading" && searchControllerRef.current) {
      searchControllerRef.current.abort();
    }
    if (policiesStatus === "loading" && policiesControllerRef.current) {
      policiesControllerRef.current.abort();
    }
    setStatus((prev) => (prev === "loading" ? "idle" : prev));
    setPoliciesStatus((prev) => (prev === "loading" ? "idle" : prev));
    setPoliciesError("Processamento cancelado pelo usuário.");
  };

  return (
    <>
      <div className="page google-layout">
        <div className="page-surface">
          <header className="topbar">
            <Link className="brand" href="/">
              <div className="brand-mark">CM</div>
              <div>
                <p className="brand-title">CityManager</p>
                <p className="brand-subtitle">Inteligência para gestores municipais</p>
              </div>
            </Link>
            <nav className="nav">
              <div className="nav-links">
                <span className="nav-link active">Políticas Públicas</span>
                <Link
                  className="nav-link"
                  href={hasSearched ? `/projects?q=${encodeURIComponent(lastQuery)}` : "/projects"}
                >
                  Projetos de Lei
                </Link>
                <Link className="nav-link" href="/methodology">
                  Metodologia
                </Link>
              </div>
              <div className="nav-actions">
                <a className="ghost-btn" href="#busca">
                  Nova busca
                </a>
                <Link className="ghost-btn" href="/projects">
                  Ver projetos
                </Link>
              </div>
            </nav>
          </header>

          <main className="page-body">
            <section className="hero">
              <div className="hero-text">
                <p className="eyebrow">Implantação segura de leis municipais</p>
                <h1>Transforme evidências em políticas aplicáveis</h1>
                <p className="lede">
                  A plataforma cruza projetos de lei, jurisprudência e indicadores municipais para sugerir políticas
                  públicas que já funcionaram em cidades com perfis parecidos. Tudo explicado com links para a fonte.
                </p>
                <div className="hero-badges">
                  <span className="pill neutral">Dados oficiais</span>
                  <span className="pill neutral">Explicabilidade</span>
                  <span className="pill accent">Foco em gestores</span>
                </div>
                <div className="hero-actions">
                  <a className="primary-btn" href="#busca">
                    Buscar políticas agora
                  </a>
                  <Link className="ghost-btn" href="/methodology">
                    Metodologia e confiança
                  </Link>
                  <Link className="ghost-btn" href="/projects">
                    Projetos de lei
                  </Link>
                </div>
              </div>
              <div className="hero-panel">
                <div className="stat-card highlight">
                  <p className="stat-label">Assistente de confiabilidade</p>
                  <p className="stat-value">Dados públicos + indicadores</p>
                  <p className="stat-detail">
                    Similaridade semântica explicável, agrupamentos transparentes e links para a origem.
                  </p>
                  <Link className="ghost-btn compact" href="/methodology">
                    Ver como calculamos
                  </Link>
                </div>
                <div className="stat-card">
                  <p className="stat-label">Próximo passo</p>
                  <p className="stat-value">Ative um indicador</p>
                  <p className="stat-detail">Selecione indicador e janela para simular impacto médio.</p>
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
                    onChange={(event) => {
                      setQuery(event.target.value);
                      resetSearchOutputs();
                    }}
                    aria-label="Pergunta para busca semântica"
                    autoComplete="off"
                  />
                  </div>
                  <button type="submit" className="primary-btn search-btn" disabled={status === "loading"}>
                    {searchButtonLabel}
                  </button>
                </div>

                <div className="filter-grid">
                  <div className="filter-field indicator-field">
                    <label>Indicador de impacto</label>
                  <CustomDropdown
                    id="indicator-select"
                    ariaLabel="Selecionar indicador"
                    value={selectedIndicator}
                    options={indicatorDropdownOptions}
                    onChange={(newValue) => {
                      const value = String(newValue);
                      setSelectedIndicator(value);
                      const found = indicators.find((indicator) => indicator.id === value);
                      if (found) {
                        setIndicatorPositiveIsGood(found.positive_is_good);
                        setIndicatorAlias(found.alias || found.id);
                      } else {
                        setIndicatorPositiveIsGood(true);
                        setIndicatorAlias("");
                      }
                      resetSearchOutputs();
                    }}
                  />
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
                  <CustomDropdown
                    key={selectedIndicator ? "effect-window-enabled" : "effect-window-disabled"}
                    id="effect-window"
                    ariaLabel="Selecionar janela temporal para cálculo do efeito"
                    disabled={!selectedIndicator}
                    options={effectWindowDropdownOptions}
                    value={effectWindowMonths}
                    onChange={(newValue) => {
                      const parsed = typeof newValue === "number" ? newValue : Number(newValue);
                      setEffectWindowMonths(Number.isFinite(parsed) ? parsed : DEFAULT_EFFECT_WINDOW);
                      resetSearchOutputs();
                    }}
                  />
                    <p className="hint">
                      A janela em meses é arredondada para a granularidade do indicador (semestral, anual); PLs muito
                      recentes podem não ter efeito calculado.
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
                    onClick={() => {
                      handleSuggestionClick(text);
                      resetSearchOutputs();
                    }}
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

            {showPolicyArea && (
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
                  <div className="section-actions">
                    <div className="chips-inline">
                      <div className="pill neutral">{results.length} projetos considerados</div>
                      {policiesUseIndicator && (
                        <div className="pill neutral">Efeito em {effectWindowMonths} meses</div>
                      )}
                      {selectedIndicator && (
                        <div className="pill neutral">Indicador: {indicatorAlias || selectedIndicator}</div>
                      )}
                    </div>
                    <Link
                      className="ghost-btn"
                      href={hasSearched ? `/projects?q=${encodeURIComponent(lastQuery)}` : "/projects"}
                    >
                      Ver projetos analisados
                    </Link>
                  </div>
                </div>

                {policiesError && <div className="message error">{policiesError}</div>}

                {isLoadingPolicies && (
                  <>
                    <div className="message muted">Gerando políticas com base na busca...</div>
                    <div className="policy-grid skeleton-grid" aria-hidden="true">
                      {[1, 2, 3].map((item) => (
                        <div key={item} className="policy-card skeleton-card">
                          <span className="skeleton-line w-70" />
                          <span className="skeleton-line w-50" />
                          <div className="skeleton-pill-row">
                            <span className="skeleton-pill w-40" />
                            <span className="skeleton-pill w-30" />
                          </div>
                          <div className="skeleton-list">
                            <span className="skeleton-line w-80" />
                            <span className="skeleton-line w-60" />
                            <span className="skeleton-line w-50" />
                          </div>
                          <span className="skeleton-line w-45" />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {!isLoadingPolicies && policies.length > 0 && (
                  <div className="policy-grid">
                    {policies.map((policy, policyIndex) => {
                      const effectAvailable = policiesUseIndicator && policy.effect_mean != null;
                      const effectStd =
                        policiesUseIndicator && policy.effect_std != null ? `${policy.effect_std.toFixed(2)}%` : null;
                      const qualityValue =
                        policy.quality_score != null ? policy.quality_score.toFixed(2) : "Não avaliado";
                      const meanTone = getEffectTone(policy.effect_mean);

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
                              <span className="badge-label">Efeito médio (% em {effectWindowMonths} meses)</span>
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
                            {policy.actions.map((action, actionIndex) => {
                              const effectLabel =
                                policiesUseIndicator && action.effect != null
                                  ? `Variação: ${formatEffectValue(action.effect)}`
                                  : "Sem indicador";
                              const effectTone = getEffectTone(action.effect);

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
                )}

                {!isLoadingPolicies && !policiesError && hasSearched && policies.length === 0 && (
                  <div className="message muted">
                    Nenhuma política priorizada para esta busca. Ajuste o texto, refine os filtros ou ative um indicador
                    para estimar impacto.
                  </div>
                )}
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

            <section className="trust-strip">
              <div>
                <p className="eyebrow">Confiabilidade</p>
                <h3>Metodologia e limites claros</h3>
                <p className="muted">
                  Veja fontes, indicadores usados, privacidade e como calculamos efeitos médios antes de replicar.
                </p>
              </div>
              <div className="trust-actions">
                <Link className="secondary-btn" href="/methodology">
                  Abrir metodologia
                </Link>
                <Link className="ghost-btn" href="/projects">
                  Ver projetos
                </Link>
              </div>
            </section>
          </main>
        </div>
      </div>
      {isProcessing && (
        <div className="page-overlay" role="alert" aria-live="assertive">
          <div className="overlay-card">
            <div className="spinner" aria-hidden="true" />
            <p className="overlay-title">Gerando políticas priorizadas…</p>
            <p className="muted small">
              Agrupando projetos similares, aplicando indicador e selecionando as opções com melhor qualidade.
            </p>
            <div className="overlay-actions">
              <button className="secondary-btn" type="button" onClick={handleCancelProcessing}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      <a className="fab fab-btn" href="#busca" aria-label="Nova busca">
        Nova busca
      </a>
    </>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="page google-layout">
          <div className="page-surface">
            <p>Carregando...</p>
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
