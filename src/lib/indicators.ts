import fs from "fs";
import path from "path";

import { parse } from "csv-parse/sync";

export type IndicatorSpec = {
  id: string;
  path: string;
  city_col: string;
  value_col: string;
  alias: string;
  positive_is_good: boolean;
  min_value: number;
  periods_per_year: number;
  period_col?: string;
};

export type BillRecord = {
  index: number;
  municipio?: string;
  uf?: string;
  acao?: string | null;
  ementa?: string | null;
  data_apresentacao?: string | null;
  url?: string | null;
};

export type IndicatorEffect = {
  index: number;
  municipio?: string;
  uf?: string;
  acao?: string | null;
  data_apresentacao?: string | null;
  effect: number;
  start_value: number;
  end_value: number;
};

type IndicatorRow = {
  city: string;
  uf: string;
  year: number;
  period: number;
  value: number;
};

export type IndicatorSeriesPoint = {
  year: number;
  period: number;
  date: string;
  value: number;
};

const defaultIndicatorSpecs = (): IndicatorSpec[] => {
  const minValueRaw = Number.parseFloat(process.env.CRIMINAL_INDICATOR_MIN_VALUE ?? "5");
  const minValue = Number.isFinite(minValueRaw) ? minValueRaw : 0;
  const minEducationRaw = Number.parseFloat(process.env.EDUCATION_INDICATOR_MIN_VALUE ?? "0");
  const minEducationValue = Number.isFinite(minEducationRaw) ? minEducationRaw : 0;

  return [
    {
      id: process.env.CRIMINAL_INDICATOR_KEY ?? "criminal_indicator",
      path: process.env.CRIMINAL_INDICATOR_PATH ?? "indicators/homicidios.csv",
      city_col: process.env.CRIMINAL_INDICATOR_CITY_COL ?? "municipio_norm",
      value_col: process.env.CRIMINAL_INDICATOR_VALUE_COL ?? "taxa_homicidios_100k",
      alias: process.env.CRIMINAL_INDICATOR_ALIAS ?? "Taxa de Homicídios por 100 mil Habitantes",
      positive_is_good: false,
      min_value: minValue,
      periods_per_year: 2,
      period_col: process.env.CRIMINAL_INDICATOR_PERIOD_COL ?? "semestre",
    },
    {
      id: process.env.EDUCATION_INDICATOR_KEY ?? "education_enrollment",
      path: process.env.EDUCATION_INDICATOR_PATH ?? "indicators/matriculas.csv",
      city_col: process.env.EDUCATION_INDICATOR_CITY_COL ?? "municipio",
      value_col: process.env.EDUCATION_INDICATOR_VALUE_COL ?? "taxa_matriculas_100k",
      alias:
        process.env.EDUCATION_INDICATOR_ALIAS ?? "Taxa de Matrículas em Ensino Regular por 100 mil Habitantes",
      positive_is_good: true,
      min_value: minEducationValue,
      periods_per_year: 1,
    },
  ];
};

const indicatorCache = new Map<string, IndicatorRow[]>();

export const listIndicatorSpecs = (): IndicatorSpec[] => {
  const specs = defaultIndicatorSpecs();
  return specs;
};

export const getIndicatorSpec = (id: string): IndicatorSpec | undefined => {
  return listIndicatorSpecs().find((item) => item.id === id);
};

const resolvePath = (inputPath: string): string => {
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.join(process.cwd(), inputPath);
};

const toNumber = (value: unknown): number => {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) ? parsed : NaN;
};

const normalizeCity = (value: unknown): string => {
  const base = String(value ?? "").trim();
  if (!base) return "";
  const withoutDiacritics = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleaned = withoutDiacritics.replace(/[^A-Za-z0-9\s-]/g, " ");
  return cleaned.replace(/\s+/g, " ").trim().toUpperCase();
};

const monthsPerPeriod = (spec: IndicatorSpec): number => {
  const periodsPerYear = spec.periods_per_year > 0 ? spec.periods_per_year : 1;
  const months = 12 / periodsPerYear;
  const rounded = Math.round(months);
  return rounded > 0 ? rounded : 1;
};

export const encodePeriod = (dateStr: string, spec: IndicatorSpec): { year: number; period: number } | null => {
  const [yearRaw, monthRaw] = dateStr.split("-").slice(0, 2);
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  const periodSizeMonths = monthsPerPeriod(spec);
  const periodsPerYear = spec.periods_per_year > 0 ? spec.periods_per_year : 1;
  const computed = Math.floor((month - 1) / periodSizeMonths) + 1;
  const period = Math.min(periodsPerYear, Math.max(1, computed));
  return { year, period };
};

export const advancePeriod = (year: number, period: number, periodsAhead: number, spec: IndicatorSpec) => {
  const periodsPerYear = spec.periods_per_year > 0 ? spec.periods_per_year : 1;
  const target = period - 1 + periodsAhead;
  return { year: year + Math.floor(target / periodsPerYear), period: (target % periodsPerYear) + 1 };
};

const resolvePeriodFromRow = (row: Record<string, unknown>, spec: IndicatorSpec): number | null => {
  if (spec.periods_per_year <= 1) return 1;
  const column = spec.period_col ?? "semestre";
  const raw = row[column] ?? row[String(column).toUpperCase()];
  const parsed = toNumber(raw);
  if (!Number.isFinite(parsed)) return null;
  const period = Math.trunc(parsed);
  if (period < 1 || period > spec.periods_per_year) return null;
  return period;
};

const percentChange = (current: number, future: number) => {
  if (current === 0) throw new Error("Base zero para variação percentual");
  return ((future - current) / current) * 100.0;
};

const buildLookup = (rows: IndicatorRow[]) => {
  const lookup = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.city}|${row.uf}|${row.year}|${row.period}`;
    lookup.set(key, row.value);
  }
  return lookup;
};

export const loadIndicatorRows = (spec: IndicatorSpec): IndicatorRow[] => {
  const cached = indicatorCache.get(spec.id);
  if (cached) return cached;

  const absolutePath = resolvePath(spec.path);
  const csvText = fs.readFileSync(absolutePath, "utf8");
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, unknown>>;

  const rows: IndicatorRow[] = [];
  for (const row of records) {
    const city = normalizeCity(row[spec.city_col]);
    const uf = normalizeCity(row["uf"] ?? row["UF"]);
    const year = toNumber(row["ano"] ?? row["ANO"]);
    const period = resolvePeriodFromRow(row, spec);
    const value = toNumber(row[spec.value_col]);

    if (!city || !uf || !Number.isFinite(year) || period == null || !Number.isFinite(value)) {
      continue;
    }
    rows.push({
      city,
      uf,
      year: Math.trunc(year),
      period,
      value,
    });
  }

  indicatorCache.set(spec.id, rows);
  return rows;
};

export const periodStartDate = (year: number, period: number, spec: IndicatorSpec): string => {
  const months = monthsPerPeriod(spec);
  const monthIndex = Math.max(0, (period - 1) * months);
  const date = new Date(Date.UTC(year, Math.min(11, monthIndex), 1));
  return date.toISOString().slice(0, 10);
};

export const buildIndicatorSeries = (spec: IndicatorSpec, municipio: string, uf: string): IndicatorSeriesPoint[] => {
  const city = normalizeCity(municipio);
  const state = normalizeCity(uf);
  if (!city || !state) return [];

  const rows = loadIndicatorRows(spec).filter((row) => row.city === city && row.uf === state);

  return rows
    .sort((a, b) => (a.year === b.year ? a.period - b.period : a.year - b.year))
    .map((row) => ({
      year: row.year,
      period: row.period,
      date: periodStartDate(row.year, row.period, spec),
      value: row.value,
    }));
};

export const computeIndicatorEffects = (
  bills: BillRecord[],
  spec: IndicatorSpec,
  effectWindowMonths: number,
): IndicatorEffect[] => {
  const rows = loadIndicatorRows(spec);
  const lookup = buildLookup(rows);
  const periodsAhead = Math.max(1, Math.floor(effectWindowMonths / monthsPerPeriod(spec)) || 1);

  const effects: IndicatorEffect[] = [];

  for (const bill of bills) {
    if (!bill || bill.index == null) continue;
    if (!bill.municipio || !bill.uf || !bill.data_apresentacao) continue;
    const periodData = encodePeriod(String(bill.data_apresentacao), spec);
    if (!periodData) continue;

    const city = normalizeCity(bill.municipio);
    const uf = normalizeCity(bill.uf);
    const { year, period } = periodData;

    const current = lookup.get(`${city}|${uf}|${year}|${period}`);
    const target = advancePeriod(year, period, periodsAhead, spec);
    const future = lookup.get(`${city}|${uf}|${target.year}|${target.period}`);

    if (current == null || future == null) continue;
    if (current < spec.min_value) continue;

    try {
      const delta = percentChange(current, future);
      effects.push({
        index: bill.index,
        municipio: bill.municipio,
        uf: bill.uf,
        acao: bill.acao ?? bill.ementa ?? null,
        data_apresentacao: bill.data_apresentacao ?? null,
        effect: delta,
        start_value: current,
        end_value: future,
      });
    } catch {
      // ignore divisions by zero
    }
  }

  return effects;
};
