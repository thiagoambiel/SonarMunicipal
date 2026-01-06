import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";

import { listIndicatorSpecs } from "@/lib/indicators";
import {
  buildBillRecords,
  buildPolicies,
  DEFAULT_EFFECT_WINDOW_MONTHS,
  resolveEffectWindows,
  summarizeWindowResults,
} from "@/lib/policy-engine";
import { searchProjects } from "@/lib/semantic-search";
import type { PolicySuggestion } from "@/lib/policy-engine";
import type { SearchHit } from "@/lib/semantic-search";
import {
  getPolicyExplorerExampleFile,
  normalizePolicyExplorerQuery,
} from "@/lib/policy-explorer-examples";

const MAX_TOP_K = (() => {
  const raw = Number.parseInt(process.env.SEARCH_MAX_RESULTS ?? "", 10);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 1000;
})();

const DEFAULT_SIMILARITY_THRESHOLD = 0.75;
const DEFAULT_MIN_GROUP_MEMBERS = 2;

export const dynamic = "force-dynamic";

type PolicyWindowResult = {
  effect_window_months: number;
  policies: PolicySuggestion[];
  total_candidates: number;
  quality: number;
  effect_mean_score: number | null;
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

type PolicyExplorerPayload = {
  question: string;
  total_projects: number;
  projects: SearchHit[];
  baseline: IndicatorBundle;
  indicators: IndicatorBundle[];
};

type PolicyExplorerResponse = PolicyExplorerPayload & {
  cached_results: boolean;
};

type PolicyExplorerCacheEntry = {
  value?: PolicyExplorerPayload;
  inFlight?: Promise<PolicyExplorerPayload>;
  expiresAt: number;
};

const CACHE_TTL_MS = (() => {
  const raw = Number.parseInt(process.env.POLICY_EXPLORER_CACHE_TTL_SECONDS ?? "", 10);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, raw) * 1000;
})();

const CACHE_MAX_ITEMS = (() => {
  const raw = Number.parseInt(process.env.POLICY_EXPLORER_CACHE_MAX_ITEMS ?? "", 10);
  if (!Number.isFinite(raw)) return 100;
  return Math.max(0, raw);
})();

const CACHE_ENABLED = CACHE_MAX_ITEMS > 0;

const policyExplorerCache = new Map<string, PolicyExplorerCacheEntry>();

const buildCacheKey = (question: string, limit: number) =>
  `${normalizePolicyExplorerQuery(question)}::${limit}`;

const pruneCache = () => {
  if (!CACHE_ENABLED || policyExplorerCache.size <= CACHE_MAX_ITEMS) return;
  const now = Date.now();
  for (const [key, entry] of policyExplorerCache.entries()) {
    if (Number.isFinite(entry.expiresAt) && entry.expiresAt <= now) {
      policyExplorerCache.delete(key);
    }
  }
  while (policyExplorerCache.size > CACHE_MAX_ITEMS) {
    const oldestKey = policyExplorerCache.keys().next().value;
    if (!oldestKey) break;
    policyExplorerCache.delete(oldestKey);
  }
};

const getCachedPayload = (key: string): PolicyExplorerPayload | Promise<PolicyExplorerPayload> | null => {
  const entry = policyExplorerCache.get(key);
  if (!entry) return null;
  if (Number.isFinite(entry.expiresAt) && entry.expiresAt <= Date.now()) {
    policyExplorerCache.delete(key);
    return null;
  }
  if (entry.value) {
    policyExplorerCache.delete(key);
    policyExplorerCache.set(key, entry);
    return entry.value;
  }
  return entry.inFlight ?? null;
};

const setCacheValue = (key: string, value: PolicyExplorerPayload) => {
  if (!CACHE_ENABLED) return;
  policyExplorerCache.set(key, {
    value,
    expiresAt: CACHE_TTL_MS > 0 ? Date.now() + CACHE_TTL_MS : Number.POSITIVE_INFINITY,
  });
  pruneCache();
};

const setCacheInFlight = (key: string, promise: Promise<PolicyExplorerPayload>) => {
  if (!CACHE_ENABLED) return;
  policyExplorerCache.set(key, {
    inFlight: promise,
    expiresAt: CACHE_TTL_MS > 0 ? Date.now() + CACHE_TTL_MS : Number.POSITIVE_INFINITY,
  });
};

const EXAMPLE_CACHE_DIR = path.join(process.cwd(), "public", "policy-explorer-examples");
const exampleReadFailures = new Set<string>();

const readExamplePayload = async (question: string, limit: number): Promise<PolicyExplorerPayload | null> => {
  const fileName = getPolicyExplorerExampleFile(question, limit);
  if (!fileName) return null;
  const filePath = path.join(EXAMPLE_CACHE_DIR, fileName);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as PolicyExplorerPayload;
  } catch (error) {
    if (!exampleReadFailures.has(filePath)) {
      console.warn("Falha ao carregar resposta pré-processada:", filePath, error);
      exampleReadFailures.add(filePath);
    }
    return null;
  }
};

const withCacheFlag = (payload: PolicyExplorerPayload, cached: boolean): PolicyExplorerResponse => ({
  question: payload.question,
  total_projects: payload.total_projects,
  cached_results: cached,
  projects: payload.projects,
  baseline: payload.baseline,
  indicators: payload.indicators,
});

export async function POST(request: NextRequest) {
  let question = "";
  let topK: number | undefined;

  try {
    const body = await request.json();
    if (typeof body?.question === "string") {
      question = body.question;
    }
    if (typeof body?.top_k === "number") {
      topK = body.top_k;
    } else if (typeof body?.topK === "number") {
      topK = body.topK;
    }
  } catch {
    // corpo inválido -> tratado abaixo
  }

  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    return NextResponse.json({ detail: "Informe a pergunta para gerar políticas." }, { status: 400 });
  }

  const limit = Math.max(1, Math.min(topK ?? 200, MAX_TOP_K));
  const cacheKey = buildCacheKey(trimmedQuestion, limit);

  try {
    if (CACHE_ENABLED) {
      const cached = getCachedPayload(cacheKey);
      if (cached) {
        const payload = await cached;
        const responsePayload = withCacheFlag(
          payload.question === trimmedQuestion ? payload : { ...payload, question: trimmedQuestion },
          true,
        );
        const response = NextResponse.json(responsePayload);
        response.headers.set("x-policy-explorer-cache", "hit");
        return response;
      }
    }

    const examplePayload = await readExamplePayload(trimmedQuestion, limit);
    if (examplePayload) {
      const normalizedPayload =
        examplePayload.question === trimmedQuestion
          ? examplePayload
          : { ...examplePayload, question: trimmedQuestion };
      setCacheValue(cacheKey, normalizedPayload);
      const response = NextResponse.json(withCacheFlag(normalizedPayload, true));
      response.headers.set("x-policy-explorer-cache", "static");
      return response;
    }

    const computePayload = async (): Promise<PolicyExplorerPayload> => {
      const searchResults = await searchProjects({ query: trimmedQuestion, limit });
      const bills = buildBillRecords(searchResults);

      const baselineResult = buildPolicies({
        bills,
        indicatorSpec: undefined,
        useIndicator: false,
        effectWindowMonths: DEFAULT_EFFECT_WINDOW_MONTHS,
        minGroupMembers: DEFAULT_MIN_GROUP_MEMBERS,
        similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
      });

      const indicators = listIndicatorSpecs();
      const indicatorBundles: IndicatorBundle[] = [];

      for (const spec of indicators) {
        const windows = resolveEffectWindows(spec);
        const windowResults = windows.map((window) =>
          buildPolicies({
            bills,
            indicatorSpec: spec,
            useIndicator: true,
            effectWindowMonths: window,
            minGroupMembers: DEFAULT_MIN_GROUP_MEMBERS,
            similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
          }),
        );
        const { bestQualityWindows, bestEffectMeanWindows } = summarizeWindowResults(windowResults);

        indicatorBundles.push({
          indicator: spec.id,
          indicator_alias: spec.alias,
          positive_is_good: spec.positive_is_good,
          effect_windows: windows,
          best_quality_effect_windows: bestQualityWindows,
          best_effect_mean_windows: bestEffectMeanWindows,
          windows: windowResults.map((item) => ({
            effect_window_months: item.effectWindowMonths,
            policies: item.policies,
            total_candidates: item.totalCandidates,
            quality: item.quality,
            effect_mean_score: item.effectMeanScore,
          })),
        });
      }

      return {
        question: trimmedQuestion,
        total_projects: searchResults.length,
        projects: searchResults,
        baseline: {
          indicator: null,
          indicator_alias: "Sem indicador",
          positive_is_good: null,
          effect_windows: [baselineResult.effectWindowMonths],
          best_quality_effect_windows: [baselineResult.effectWindowMonths],
          best_effect_mean_windows: [],
          windows: [
            {
              effect_window_months: baselineResult.effectWindowMonths,
              policies: baselineResult.policies,
              total_candidates: baselineResult.totalCandidates,
              quality: baselineResult.quality,
              effect_mean_score: baselineResult.effectMeanScore,
            },
          ],
        },
        indicators: indicatorBundles,
      };
    };

    if (!CACHE_ENABLED) {
      const payload = await computePayload();
      return NextResponse.json(withCacheFlag(payload, false));
    }

    const inFlight = computePayload()
      .then((payload) => {
        setCacheValue(cacheKey, payload);
        return payload;
      })
      .catch((error) => {
        policyExplorerCache.delete(cacheKey);
        throw error;
      });

    setCacheInFlight(cacheKey, inFlight);
    const payload = await inFlight;
    const response = NextResponse.json(withCacheFlag(payload, false));
    response.headers.set("x-policy-explorer-cache", "miss");
    return response;
  } catch (error) {
    console.error("Erro ao gerar pacote de políticas:", error);
    const errorDetail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : `Erro desconhecido: ${JSON.stringify(error)}`;
    return NextResponse.json(
      {
        detail:
          "Falha ao gerar políticas. Verifique o Qdrant, embeddings e dados de indicador. " +
          `Detalhe: ${errorDetail}`,
      },
      { status: 500 },
    );
  }
}
