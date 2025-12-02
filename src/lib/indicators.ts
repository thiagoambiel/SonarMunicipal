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
};

type IndicatorRow = {
  city: string;
  uf: string;
  year: number;
  semester: number;
  value: number;
};

const defaultIndicatorSpecs = (): IndicatorSpec[] => {
  const minValueRaw = Number.parseFloat(process.env.CRIMINAL_INDICATOR_MIN_VALUE ?? "5");
  const minValue = Number.isFinite(minValueRaw) ? minValueRaw : 0;
  return [
    {
      id: process.env.CRIMINAL_INDICATOR_KEY ?? "criminal_indicator",
      path: process.env.CRIMINAL_INDICATOR_PATH ?? "experiments/backend/data/criminal_indicator.csv",
      city_col: process.env.CRIMINAL_INDICATOR_CITY_COL ?? "municipio_norm",
      value_col: process.env.CRIMINAL_INDICATOR_VALUE_COL ?? "taxa_homicidios_100k",
      alias: process.env.CRIMINAL_INDICATOR_ALIAS ?? "Taxa de Homicídios por 100 mil Habitantes",
      positive_is_good: false,
      min_value: minValue,
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

const normalizeCity = (value: unknown): string => String(value ?? "").trim().toUpperCase();

const encodeSemester = (dateStr: string): { year: number; semester: number } | null => {
  const [yearRaw, monthRaw] = dateStr.split("-").slice(0, 2);
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const semester = month <= 6 ? 1 : 2;
  return { year, semester };
};

const advanceSemester = (year: number, semester: number, semestersAhead: number) => {
  const target = semester - 1 + semestersAhead;
  return { year: year + Math.floor(target / 2), semester: (target % 2) + 1 };
};

const percentChange = (current: number, future: number) => {
  if (current === 0) throw new Error("Base zero para variação percentual");
  return ((future - current) / current) * 100.0;
};

const buildLookup = (rows: IndicatorRow[]) => {
  const lookup = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.city}|${row.uf}|${row.year}|${row.semester}`;
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
    const semester = toNumber(row["semestre"] ?? row["SEMESTRE"]);
    const value = toNumber(row[spec.value_col]);

    if (!city || !uf || !Number.isFinite(year) || !Number.isFinite(semester) || !Number.isFinite(value)) {
      continue;
    }
    rows.push({
      city,
      uf,
      year: Math.trunc(year),
      semester: Math.trunc(semester),
      value,
    });
  }

  indicatorCache.set(spec.id, rows);
  return rows;
};

export const computeIndicatorEffects = (
  bills: BillRecord[],
  spec: IndicatorSpec,
  effectWindowMonths: number,
): IndicatorEffect[] => {
  const rows = loadIndicatorRows(spec);
  const lookup = buildLookup(rows);
  const semestersAhead = Math.max(1, Math.floor(effectWindowMonths / 6) || 1);

  const effects: IndicatorEffect[] = [];

  for (const bill of bills) {
    if (!bill || bill.index == null) continue;
    if (!bill.municipio || !bill.uf || !bill.data_apresentacao) continue;
    const semesterData = encodeSemester(String(bill.data_apresentacao));
    if (!semesterData) continue;

    const city = normalizeCity(bill.municipio);
    const uf = normalizeCity(bill.uf);
    const { year, semester } = semesterData;

    const current = lookup.get(`${city}|${uf}|${year}|${semester}`);
    const target = advanceSemester(year, semester, semestersAhead);
    const future = lookup.get(`${city}|${uf}|${target.year}|${target.semester}`);

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
      });
    } catch {
      // ignore divisions by zero
    }
  }

  return effects;
};
