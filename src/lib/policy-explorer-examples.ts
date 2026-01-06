export type PolicyExplorerExample = {
  query: string;
  file: string;
  limit: number;
};

export const POLICY_EXPLORER_EXAMPLES: PolicyExplorerExample[] = [
  {
    query: "Como reduzir a violência urbana em bairros centrais?",
    file: "como-reduzir-a-violencia-urbana-em-bairros-centrais.json",
    limit: 1000,
  },
  {
    query: "Políticas para aumentar a arrecadação sem subir impostos",
    file: "politicas-para-aumentar-a-arrecadacao-sem-subir-impostos.json",
    limit: 1000,
  },
  {
    query: "Como diminuir evasão escolar no ensino médio?",
    file: "como-diminuir-evasao-escolar-no-ensino-medio.json",
    limit: 1000,
  },
  {
    query: "Ideias para melhorar mobilidade e trânsito em horário de pico",
    file: "ideias-para-melhorar-mobilidade-e-transito-em-horario-de-pico.json",
    limit: 1000,
  },
  {
    query: "Como ampliar o acesso a saneamento básico rapidamente?",
    file: "como-ampliar-o-acesso-a-saneamento-basico-rapidamente.json",
    limit: 1000,
  },
];

export const POLICY_EXPLORER_EXAMPLE_QUERIES = POLICY_EXPLORER_EXAMPLES.map((item) => item.query);

export const normalizePolicyExplorerQuery = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");

const buildExampleKey = (query: string, limit: number) => `${normalizePolicyExplorerQuery(query)}::${limit}`;

const exampleFileMap = new Map(
  POLICY_EXPLORER_EXAMPLES.map((item) => [buildExampleKey(item.query, item.limit), item.file]),
);

export const getPolicyExplorerExampleFile = (query: string, limit: number) =>
  exampleFileMap.get(buildExampleKey(query, limit)) ?? null;
