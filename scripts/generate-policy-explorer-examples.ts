import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { POLICY_EXPLORER_EXAMPLES } from "../src/lib/policy-explorer-examples";

const DEFAULT_SIMILARITY_THRESHOLD = 0.75;
const DEFAULT_MIN_GROUP_MEMBERS = 2;

const loadEnvFile = async (filePath: string) => {
  try {
    const content = await readFile(filePath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) return;
      const key = trimmed.slice(0, separatorIndex).trim();
      if (process.env[key]) return;
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    });
  } catch {
    // ignore missing env file
  }
};

const run = async () => {
  await loadEnvFile(path.join(process.cwd(), ".env.local"));
  await loadEnvFile(path.join(process.cwd(), ".env"));

  const { listIndicatorSpecs } = await import("../src/lib/indicators");
  const {
    buildBillRecords,
    buildPolicies,
    DEFAULT_EFFECT_WINDOW_MONTHS,
    resolveEffectWindows,
    summarizeWindowResults,
  } = await import("../src/lib/policy-engine");
  const { searchProjects } = await import("../src/lib/semantic-search");

  const buildPayload = async (query: string, limit: number) => {
    const searchResults = await searchProjects({ query, limit });
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

    return {
      question: query,
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

  const outputDir = path.join(process.cwd(), "public", "policy-explorer-examples");
  await mkdir(outputDir, { recursive: true });

  for (const example of POLICY_EXPLORER_EXAMPLES) {
    console.log(`Gerando exemplo: ${example.query}`);
    const payload = await buildPayload(example.query, example.limit);
    const outputPath = path.join(outputDir, example.file);
    await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
};

run().catch((error) => {
  console.error("Falha ao gerar exemplos:", error);
  process.exitCode = 1;
});
