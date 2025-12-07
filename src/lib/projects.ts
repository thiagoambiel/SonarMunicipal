export type ProjectDetail = {
  slug: string;
  index?: number;
  score?: number | null;
  municipio?: string | null;
  uf?: string | null;
  acao?: string | null;
  ementa?: string | null;
  data_apresentacao?: string | null;
  link_publico?: string | null;
  sapl_url?: string | null;
  tipo_label?: string | null;
  effect?: number | null;
  effect_window_months?: number | null;
  indicator_alias?: string | null;
  indicator_positive_is_good?: boolean | null;
  source?: "policy" | "search";
};

const slugify = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const buildProjectSlug = ({
  acao,
  ementa,
  municipio,
  index,
}: {
  acao?: string | null;
  ementa?: string | null;
  municipio?: string | null;
  index?: number | string | null;
}): string => {
  const base = acao || ementa || municipio || "projeto";
  const normalized = slugify(base);
  const hasIndex = index != null && Number.isFinite(Number(index));
  return `${normalized || "projeto"}${hasIndex ? `-${Number(index)}` : ""}`;
};

export const getPreferredSourceLink = (project: ProjectDetail): string | null => {
  if (project.link_publico) return project.link_publico;
  if (project.sapl_url) return project.sapl_url;
  return null;
};
