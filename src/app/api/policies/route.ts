import { NextRequest, NextResponse } from "next/server";

import { getIndicatorSpec, listIndicatorSpecs } from "@/lib/indicators";
import { buildBillRecords, buildPolicies, summarizeWindowResults } from "@/lib/policy-engine";
import { fetchProjectsByIds } from "@/lib/semantic-search";

const DEFAULT_SIMILARITY_THRESHOLD = 0.75;
const DEFAULT_MIN_GROUP_MEMBERS = 2;
const DEFAULT_EFFECT_WINDOW_MONTHS = 6;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let billIndexes: Array<number | string> = [];
  let indicator: string | null = null;
  let useIndicator = false;
  let effectWindowMonths = DEFAULT_EFFECT_WINDOW_MONTHS;
  let effectWindowCandidates: number[] = [];
  let similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD;
  let minGroupMembers = DEFAULT_MIN_GROUP_MEMBERS;

  try {
    const body = await request.json();
    if (Array.isArray(body?.bill_indexes)) {
      billIndexes = body.bill_indexes;
    }
    if (typeof body?.indicator === "string") {
      indicator = body.indicator;
    }
    if (typeof body?.use_indicator === "boolean") {
      useIndicator = body.use_indicator;
    }
    if (typeof body?.effect_window_months === "number" && Number.isFinite(body.effect_window_months)) {
      effectWindowMonths = Math.max(1, Math.trunc(body.effect_window_months));
    }
    if (Array.isArray(body?.effect_window_months_candidates)) {
      effectWindowCandidates = body.effect_window_months_candidates
        .map((value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null))
        .filter((value: number | null): value is number => value != null && value > 0);
    }
    if (typeof body?.similarity_threshold === "number" && Number.isFinite(body.similarity_threshold)) {
      similarityThreshold = Math.min(1, Math.max(0, body.similarity_threshold));
    }
    if (typeof body?.min_group_members === "number" && Number.isFinite(body.min_group_members)) {
      minGroupMembers = Math.max(1, Math.trunc(body.min_group_members));
    }
  } catch {
    // corpo inválido -> tratado abaixo
  }

  if (billIndexes.length === 0) {
    return NextResponse.json({
      indicator,
      used_indicator: false,
      total_candidates: 0,
      policies: [],
    });
  }

  try {
    const retrieved = await fetchProjectsByIds(billIndexes);
    const bills = buildBillRecords(retrieved);

    const indicatorSpec = useIndicator && indicator ? getIndicatorSpec(indicator) : undefined;
    const availableIndicators = listIndicatorSpecs().map((item) => item.id);

    if (useIndicator && indicator && !indicatorSpec) {
      return NextResponse.json(
        { detail: `Indicador '${indicator}' não encontrado. Disponíveis: ${availableIndicators.join(", ")}` },
        { status: 400 },
      );
    }

    const windowsToTest = useIndicator
      ? Array.from(new Set([effectWindowMonths, ...effectWindowCandidates]))
      : [effectWindowMonths];

    const windowResults = windowsToTest.map((window) =>
      buildPolicies({
        bills,
        indicatorSpec,
        useIndicator,
        effectWindowMonths: window,
        minGroupMembers,
        similarityThreshold,
      }),
    );

    const baseResult =
      windowResults.find((item) => item.effectWindowMonths === effectWindowMonths) ??
      windowResults[0] ??
      null;
    const { bestQualityWindows, bestEffectMeanWindows } = summarizeWindowResults(windowResults);

    return NextResponse.json({
      indicator,
      used_indicator: baseResult?.usedIndicator ?? false,
      total_candidates: baseResult?.totalCandidates ?? 0,
      policies: baseResult?.policies ?? [],
      selected_effect_window: effectWindowMonths,
      best_quality_effect_window: bestQualityWindows[0] ?? null,
      best_quality_effect_windows: bestQualityWindows,
      best_effect_mean_window: bestEffectMeanWindows[0] ?? null,
      best_effect_mean_windows: bestEffectMeanWindows,
    });
  } catch (error) {
    console.error("Erro ao gerar políticas:", error);
    return NextResponse.json(
      { detail: "Falha ao gerar agrupamentos de políticas. Verifique o Qdrant e os dados de indicador." },
      { status: 500 },
    );
  }
}
