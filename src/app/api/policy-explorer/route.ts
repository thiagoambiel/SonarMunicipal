import { NextRequest, NextResponse } from "next/server";

import { listIndicatorSpecs } from "@/lib/indicators";
import {
  buildBillRecords,
  buildPolicies,
  DEFAULT_EFFECT_WINDOW_MONTHS,
  resolveEffectWindows,
  summarizeWindowResults,
} from "@/lib/policy-engine";
import { searchProjects } from "@/lib/semantic-search";

const MAX_TOP_K = (() => {
  const raw = Number.parseInt(process.env.SEARCH_MAX_RESULTS ?? "", 10);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 1000;
})();

const DEFAULT_SIMILARITY_THRESHOLD = 0.75;
const DEFAULT_MIN_GROUP_MEMBERS = 2;

export const dynamic = "force-dynamic";

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

  if (!question.trim()) {
    return NextResponse.json({ detail: "Informe a pergunta para gerar políticas." }, { status: 400 });
  }

  const limit = Math.max(1, Math.min(topK ?? 200, MAX_TOP_K));

  try {
    const searchResults = await searchProjects({ query: question, limit });
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
    const indicatorBundles = [];

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

    const responsePayload = {
      question,
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

    return NextResponse.json(responsePayload);
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
