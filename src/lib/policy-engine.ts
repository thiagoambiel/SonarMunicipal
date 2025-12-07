import { BillRecord, computeIndicatorEffects, IndicatorEffect, IndicatorSpec } from "./indicators";
import { generatePoliciesFromBills, GroupedPolicyAction, PolicyCandidate } from "./policies";
import { SearchHit } from "./semantic-search";

export type PolicyAction = {
  municipio: string;
  acao: string;
  effect?: number | null;
  url?: string | null;
  data_apresentacao?: string | null;
  ementa?: string | null;
  indicator_before?: number | null;
  indicator_after?: number | null;
};

export type PolicySuggestion = {
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
  indicator_before?: number | null;
  indicator_after?: number | null;
};

export type PolicyBuildOptions = {
  bills: BillRecord[];
  indicatorSpec?: IndicatorSpec | null;
  useIndicator: boolean;
  effectWindowMonths: number;
  minGroupMembers: number;
  similarityThreshold: number;
};

export type PolicyBuildResult = {
  indicatorId: string | null;
  effectWindowMonths: number;
  policies: PolicySuggestion[];
  usedIndicator: boolean;
  totalCandidates: number;
  quality: number;
  effectMeanScore: number | null;
};

const ACOMPANHAR_SUFFIX = "/acompanhar-materia";

export const DEFAULT_EFFECT_WINDOW_MONTHS = 6;
export const EFFECT_WINDOW_PRESETS = [6, 12, 18, 24, 30, 36];

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

const pickBestEffect = (
  current: ActionMeta,
  score: number,
  rawEffect: number | null,
  indicatorBefore: number | null,
  indicatorAfter: number | null,
) => {
  if (rawEffect == null) return current;
  if (current.score == null || score < current.score) {
    return { ...current, score, effect: rawEffect, indicator_before: indicatorBefore, indicator_after: indicatorAfter };
  }
  return current;
};

const computeQuality = (candidates: PolicyCandidate[]): number => {
  if (!candidates.length) return 0;
  return Math.max(...candidates.map((item) => item.qualityScore ?? 0));
};

const computeMeanEffectScore = (policies: PolicySuggestion[], positiveIsGood: boolean): number | null => {
  const values = policies
    .map((item) => item.effect_mean)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (values.length === 0) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return positiveIsGood ? mean : -mean;
};

const monthsPerIndicatorPeriod = (spec: IndicatorSpec): number => {
  const periodsPerYear = spec.periods_per_year > 0 ? spec.periods_per_year : 1;
  const months = Math.round(12 / periodsPerYear);
  return months > 0 ? months : DEFAULT_EFFECT_WINDOW_MONTHS;
};

export const resolveEffectWindows = (spec: IndicatorSpec): number[] => {
  const step = monthsPerIndicatorPeriod(spec);
  const filtered = EFFECT_WINDOW_PRESETS.filter((value) => value % step === 0);
  if (filtered.length) return filtered;
  const fallback = [step, step * 2, step * 3]
    .map((value) => Math.trunc(value))
    .filter((value, index, arr) => value > 0 && arr.indexOf(value) === index);
  return fallback.length ? fallback : [DEFAULT_EFFECT_WINDOW_MONTHS];
};

export const buildBillRecords = (items: SearchHit[]): BillRecord[] =>
  items.map((hit) => ({
    index: hit.index,
    municipio: hit.municipio ?? undefined,
    uf: hit.uf ?? undefined,
    acao: hit.acao ?? undefined,
    ementa: hit.ementa ?? undefined,
    data_apresentacao: hit.data_apresentacao ?? undefined,
    url: sanitizeBillUrl(hit.link_publico) ?? sanitizeBillUrl(hit.sapl_url) ?? undefined,
  }));

export const buildPolicies = (options: PolicyBuildOptions): PolicyBuildResult => {
  const { bills, indicatorSpec, useIndicator, effectWindowMonths, minGroupMembers, similarityThreshold } = options;

  let effectsLookup: Map<number, IndicatorEffect> | null = null;

  if (useIndicator && indicatorSpec) {
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
    const updated = pickBestEffect(
      current,
      normalizedScore,
      rawEffect,
      effectEntry?.start_value ?? null,
      effectEntry?.end_value ?? null,
    );
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
        indicator_before: meta?.indicator_before ?? null,
        indicator_after: meta?.indicator_after ?? null,
      };
    }),
  }));

  const effectMeanScore =
    indicatorSpec && useIndicator ? computeMeanEffectScore(policies, indicatorSpec.positive_is_good) : null;

  return {
    indicatorId: indicatorSpec?.id ?? null,
    effectWindowMonths,
    policies,
    usedIndicator: Boolean(indicatorSpec) && useIndicator,
    totalCandidates: groupingTuples.length,
    quality: computeQuality(policiesRaw),
    effectMeanScore,
  };
};

export const summarizeWindowResults = (results: PolicyBuildResult[]) => {
  let bestQualityScore = -Infinity;
  let bestEffectScore: number | null = null;
  const bestQualityWindows: number[] = [];
  const bestEffectMeanWindows: number[] = [];

  results.forEach((result) => {
    if (result.quality > bestQualityScore) {
      bestQualityScore = result.quality;
      bestQualityWindows.length = 0;
      bestQualityWindows.push(result.effectWindowMonths);
    } else if (result.quality === bestQualityScore) {
      bestQualityWindows.push(result.effectWindowMonths);
    }

    if (result.effectMeanScore == null) return;
    if (bestEffectScore == null || result.effectMeanScore > bestEffectScore) {
      bestEffectScore = result.effectMeanScore;
      bestEffectMeanWindows.length = 0;
      bestEffectMeanWindows.push(result.effectWindowMonths);
    } else if (result.effectMeanScore === bestEffectScore) {
      bestEffectMeanWindows.push(result.effectWindowMonths);
    }
  });

  return { bestQualityWindows, bestEffectMeanWindows };
};
