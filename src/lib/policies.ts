import { jaccardSimilarity, normalizeAndTokenize } from "./text";

export type GroupedPolicyAction = {
  municipio: string;
  acao: string;
  score: number;
  rawEffect?: number | null;
};

export type PolicyCandidate = {
  policy: string;
  actions: GroupedPolicyAction[];
  effectMean: number;
  effectStd: number;
  qualityScore: number;
};

type GroupMember = {
  municipio: string;
  phrase: string;
  score: number;
  similarity: number;
  rawEffect?: number | null;
};

const computeMeanAndStd = (values: number[]): { mean: number; std: number } => {
  if (!values.length) return { mean: 0, std: 0 };
  if (values.length === 1) return { mean: values[0], std: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / (values.length - 1 || 1);
  const std = Math.sqrt(variance);
  return { mean, std };
};

const byWinRate = (scores: number[]): number => {
  if (!scores.length) return 0;
  const n = scores.length;
  const winRate = scores.filter((s) => s < 0).length / n;
  const evidence = n / (n + 1);
  return winRate * evidence;
};

const bestMembersPerCity = (members: GroupMember[]): GroupMember[] => {
  const best = new Map<string, GroupMember>();
  for (const member of members) {
    const current = best.get(member.municipio);
    if (!current || member.score < current.score) {
      best.set(member.municipio, member);
    }
  }
  return Array.from(best.values());
};

const groupBillsByStructure = (bills: GroupedPolicyAction[], threshold: number): GroupMember[][] => {
  if (!bills.length) return [];
  const groups: { repTokens: string[]; repPhrase: string; members: GroupMember[] }[] = [];

  for (const bill of bills) {
    const tokens = normalizeAndTokenize(bill.acao);
    if (!groups.length) {
      groups.push({
        repTokens: tokens,
        repPhrase: bill.acao,
        members: [{ municipio: bill.municipio, phrase: bill.acao, score: bill.score, similarity: 1, rawEffect: bill.rawEffect }],
      });
      continue;
    }

    let bestIndex = -1;
    let bestSim = 0;
    groups.forEach((group, index) => {
      const sim = jaccardSimilarity(tokens, group.repTokens);
      if (sim > bestSim) {
        bestSim = sim;
        bestIndex = index;
      }
    });

    if (bestIndex !== -1 && bestSim >= threshold) {
      groups[bestIndex].members.push({
        municipio: bill.municipio,
        phrase: bill.acao,
        score: bill.score,
        similarity: bestSim,
        rawEffect: bill.rawEffect,
      });
    } else {
      groups.push({
        repTokens: tokens,
        repPhrase: bill.acao,
        members: [{ municipio: bill.municipio, phrase: bill.acao, score: bill.score, similarity: 1, rawEffect: bill.rawEffect }],
      });
    }
  }

  return groups.map((g) => g.members);
};

export const generatePoliciesFromBills = (
  bills: GroupedPolicyAction[],
  minGroupMembers: number,
  similarityThreshold: number,
): PolicyCandidate[] => {
  const grouped = groupBillsByStructure(bills, similarityThreshold);
  const candidates: PolicyCandidate[] = [];

  grouped.forEach((members) => {
    const bestPerCity = bestMembersPerCity(members);
    if (bestPerCity.length < minGroupMembers) return;

    const scores = bestPerCity.map((item) => item.score);
    const effects = bestPerCity
      .map((item) => item.rawEffect)
      .filter((value): value is number => value != null && Number.isFinite(value));

    const { mean, std } = computeMeanAndStd(effects.length ? effects : scores);
    const qualityScore = byWinRate(scores);
    const actions = bestPerCity.map((item) => ({
      municipio: item.municipio,
      acao: item.phrase,
      score: item.score,
      rawEffect: item.rawEffect ?? null,
    }));

    candidates.push({
      policy: members[0]?.phrase ?? "Política sem título",
      actions,
      effectMean: mean,
      effectStd: std,
      qualityScore,
    });
  });

  candidates.sort((a, b) => b.qualityScore - a.qualityScore);
  return candidates;
};
