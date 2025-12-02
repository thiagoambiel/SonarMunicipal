import { NextRequest, NextResponse } from "next/server";

import {
  BillRecord,
  computeIndicatorEffects,
  getIndicatorSpec,
  IndicatorEffect,
  listIndicatorSpecs,
} from "@/lib/indicators";
import { generatePoliciesFromBills, GroupedPolicyAction } from "@/lib/policies";
import { fetchProjectsByIds, SearchHit } from "@/lib/semantic-search";

type PolicyAction = {
  municipio: string;
  acao: string;
  effect?: number | null;
  url?: string | null;
  data_apresentacao?: string | null;
  ementa?: string | null;
};

type PolicySuggestion = {
  policy: string;
  effect_mean?: number | null;
  effect_std?: number | null;
  quality_score?: number | null;
  actions: PolicyAction[];
};

type ActionMeta = {
  effect?: number | null;
  score?: number;
  url?: string;
  data_apresentacao?: string;
  ementa?: string;
};

const DEFAULT_SIMILARITY_THRESHOLD = 0.75;
const DEFAULT_MIN_GROUP_MEMBERS = 2;
const DEFAULT_EFFECT_WINDOW_MONTHS = 6;
const ACOMPANHAR_SUFFIX = "/acompanhar-materia";

const sanitizeBillUrl = (raw?: string | null): string | undefined => {
  if (!raw || typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  let cleaned = trimmed.replace(/\/+$/, "");
  if (cleaned.endsWith(ACOMPANHAR_SUFFIX)) {
    cleaned = cleaned.slice(0, -ACOMPANHAR_SUFFIX.length);
  }

  return cleaned || undefined;
};

const normalizeString = (value: unknown, fallback: string | null = null): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  return fallback;
};

const buildBillRecords = (items: SearchHit[]): BillRecord[] =>
  items.map((hit) => ({
    index: hit.index,
    municipio: hit.municipio ?? undefined,
    uf: hit.uf ?? undefined,
    acao: hit.acao ?? undefined,
    ementa: hit.ementa ?? undefined,
    data_apresentacao: hit.data_apresentacao ?? undefined,
    url: sanitizeBillUrl(hit.link_publico) ?? sanitizeBillUrl(hit.sapl_url) ?? undefined,
  }));

const pickBestEffect = (
  current: ActionMeta,
  score: number,
  rawEffect: number | null,
) => {
  if (rawEffect == null) return current;
  if (current.score == null || score < current.score) {
    return { ...current, score, effect: rawEffect };
  }
  return current;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let billIndexes: Array<number | string> = [];
  let indicator: string | null = null;
  let useIndicator = false;
  let effectWindowMonths = DEFAULT_EFFECT_WINDOW_MONTHS;
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

    let effectsLookup: Map<number, IndicatorEffect> | null = null;

    if (indicatorSpec) {
      const effects = computeIndicatorEffects(bills, indicatorSpec, effectWindowMonths);
      effectsLookup = new Map<number, IndicatorEffect>();
      effects.forEach((item) => effectsLookup?.set(item.index, item));
    }

    const groupingTuples: GroupedPolicyAction[] = [];
    const actionMeta = new Map<string, ActionMeta>();

    for (const bill of bills) {
      const description =
        normalizeString(bill.acao) ??
        normalizeString(bill.ementa) ??
        "Ação não informada";

      const effectEntry = effectsLookup?.get(bill.index);
      if (useIndicator && indicatorSpec && !effectEntry) {
        // Indicador solicitado, mas sem dados para este PL -> ignorar
        continue;
      }

      const rawEffect = effectEntry?.effect ?? null;
      const normalizedScore =
        useIndicator && rawEffect != null
          ? indicatorSpec?.positive_is_good
            ? -rawEffect
            : rawEffect
          : 0;

      const municipioName = bill.municipio ?? "Município não informado";

      groupingTuples.push({
        municipio: municipioName,
        acao: description,
        score: normalizedScore,
        rawEffect,
      });

      const key = `${municipioName}|||${description}`;
      const current: ActionMeta = actionMeta.get(key) ?? {};
      const updated = pickBestEffect(current, normalizedScore, rawEffect);
      if (bill.url) updated.url = bill.url;
      if (bill.data_apresentacao) updated.data_apresentacao = bill.data_apresentacao;
      if (bill.ementa) updated.ementa = bill.ementa;
      actionMeta.set(key, updated);
    }

    const policiesRaw = generatePoliciesFromBills(groupingTuples, minGroupMembers, similarityThreshold);

    const policies: PolicySuggestion[] = policiesRaw.map((policy) => ({
      policy: policy.policy,
      effect_mean: useIndicator ? policy.effectMean : null,
      effect_std: useIndicator ? policy.effectStd : null,
      quality_score: useIndicator ? policy.qualityScore : null,
      actions: policy.actions.map((action) => {
        const meta = actionMeta.get(`${action.municipio}|||${action.acao}`);
        const effect = useIndicator
          ? meta?.effect ?? action.rawEffect ?? null
          : null;
        return {
          municipio: action.municipio,
          acao: action.acao,
          effect: effect == null ? null : effect,
          url: meta?.url ?? null,
          data_apresentacao: meta?.data_apresentacao ?? null,
          ementa: meta?.ementa ?? null,
        };
      }),
    }));

    return NextResponse.json({
      indicator,
      used_indicator: Boolean(indicatorSpec) && useIndicator,
      total_candidates: groupingTuples.length,
      policies,
    });
  } catch (error) {
    console.error("Erro ao gerar políticas:", error);
    return NextResponse.json(
      { detail: "Falha ao gerar agrupamentos de políticas. Verifique o Qdrant e os dados de indicador." },
      { status: 500 },
    );
  }
}
