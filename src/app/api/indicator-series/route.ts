import { NextRequest, NextResponse } from "next/server";

import {
  advancePeriod,
  buildIndicatorSeries,
  encodePeriod,
  getIndicatorSpec,
  periodStartDate,
} from "@/lib/indicators";

export const dynamic = "force-dynamic";

const monthsPerPeriod = (periodsPerYear: number) => {
  const safe = periodsPerYear > 0 ? periodsPerYear : 1;
  const months = Math.round(12 / safe);
  return months > 0 ? months : 1;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const indicatorId = url.searchParams.get("indicator_id");
  const municipio = url.searchParams.get("city") ?? url.searchParams.get("municipio");
  const uf = url.searchParams.get("uf");
  const presentationDate = url.searchParams.get("presentation_date");
  const effectWindowRaw = url.searchParams.get("effect_window_months");

  if (!indicatorId || !municipio || !uf) {
    return NextResponse.json(
      { detail: "Informe indicator_id, city/municipio e uf para obter a série." },
      { status: 400 },
    );
  }

  const spec = getIndicatorSpec(indicatorId);
  if (!spec) {
    return NextResponse.json({ detail: "Indicador não encontrado." }, { status: 404 });
  }

  const effectWindow = effectWindowRaw != null ? Number.parseInt(effectWindowRaw, 10) : null;
  const series = buildIndicatorSeries(spec, municipio, uf);

  let presentationPoint: { input_date: string; period_date: string; value: number | null } | null = null;
  let referencePoint: { period_date: string; value: number | null; target_year: number; target_period: number } | null =
    null;

  const periodsAhead =
    effectWindow != null && Number.isFinite(effectWindow)
      ? Math.max(1, Math.floor(effectWindow / monthsPerPeriod(spec.periods_per_year)) || 1)
      : null;

  if (presentationDate) {
    const basePeriod = encodePeriod(presentationDate, spec);
    if (basePeriod) {
      const baseDate = periodStartDate(basePeriod.year, basePeriod.period, spec);
      const match = series.find((item) => item.year === basePeriod.year && item.period === basePeriod.period);
      presentationPoint = {
        input_date: presentationDate,
        period_date: baseDate,
        value: match ? match.value : null,
      };

      if (periodsAhead != null) {
        const target = advancePeriod(basePeriod.year, basePeriod.period, periodsAhead, spec);
        const referenceDate = periodStartDate(target.year, target.period, spec);
        const referenceMatch = series.find((item) => item.year === target.year && item.period === target.period);
        referencePoint = {
          period_date: referenceDate,
          value: referenceMatch ? referenceMatch.value : null,
          target_year: target.year,
          target_period: target.period,
        };
      }
    }
  }

  return NextResponse.json({
    indicator_id: indicatorId,
    municipio,
    uf,
    series,
    presentation_point: presentationPoint,
    reference_point: referencePoint,
    effect_window_months: Number.isFinite(effectWindow) ? effectWindow : null,
  });
}
