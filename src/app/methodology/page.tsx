"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import MinimalNav from "@/components/MinimalNav";
import { clearProjectsSearchState } from "@/lib/projectsSearchStorage";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const formatNumber = (value: number) => numberFormatter.format(value);
const TOTAL_PROJECTS = 220_065;
const TOTAL_MUNICIPALITIES = 322;

type SaplHost = {
  ibge_id: number;
  municipio: string;
  uf: string;
  sapl_url: string;
  source?: string;
  http_status?: number;
  title?: string;
};

const navSections = [
  { id: "introducao", label: "Visão geral" },
  { id: "pipeline", label: "Do texto ao resultado" },
  { id: "exemplo", label: "Exemplo completo" },
  { id: "interpretacao", label: "Como ler resultados" },
  { id: "auditoria", label: "Auditoria rápida" },
  { id: "privacidade", label: "Privacidade e limites" },
  { id: "fontes", label: "Fontes e referências" },
  { id: "sapl", label: "SAPL usados" },
];

const pipelineSteps = [
  {
    title: "Você faz a pergunta",
    detail: "Use linguagem simples, como falaria com alguém da equipe. Ex.: “Como reduzir violência perto das escolas?”.",
    tone: "warm",
  },
  {
    title: "Buscamos textos parecidos",
    detail: "A pergunta vira pontos-chave e é comparada com 220 mil projetos via HuggingFace + Qdrant (busca semântica).",
    tone: "info",
    links: [
      { href: "https://huggingface.co/docs/api-inference/detailed_parameters#feature-extraction-task", label: "API HuggingFace" },
      { href: "https://qdrant.tech/documentation/", label: "Qdrant docs" },
    ],
  },
  {
    title: "Juntamos o que é parecido",
    detail: "Agrupamos propostas irmãs para reduzir duplicidade e mostrar variações do mesmo caminho.",
    tone: "neutral",
  },
  {
    title: "Olhamos indicador e tempo",
    detail: "Quando você escolhe um indicador, calculamos o que mudou em 6, 12, 24 ou 36 meses e respeitamos se “subir” é bom ou ruim.",
    tone: "accent",
  },
  {
    title: "Entregamos um pacote auditável",
    detail: "Cada grupo traz qualidade, efeito médio, links, município/UF, datas e série do indicador para você validar.",
    tone: "success",
  },
];

const interpretation = [
  {
    title: "Qualidade do grupo",
    points: [
      "Quantos precedentes parecidos compõem o grupo",
      "Textos completos (ementa + justificativa) e mais de um município/ano",
      "Indicador coerente com o tema e com série suficiente",
    ],
  },
  {
    title: "Efeito esperado",
    points: [
      "Média do indicador na janela escolhida (ex.: 12 meses)",
      "Direção já interpretada (subir é bom? descer é bom?)",
      "Compare 12, 24 e 36 meses para checar estabilidade",
    ],
  },
  {
    title: "Quando ficar cético",
    points: ["Poucos casos ou textos muito curtos", "Indicador com pouca cobertura na sua cidade", "Contexto jurídico ou orçamentário muito diferente"],
  },
];

const checklist = [
  "Confirme se há orçamento e competência municipal para fazer o mesmo.",
  "Verifique município, UF e ano do precedente e se seu contexto é parecido.",
  "Cheque se o indicador tem dados recentes para sua cidade na janela escolhida.",
  "Abra o texto original e a série do indicador antes de replicar.",
  "Liste adaptações locais (parcerias, custo, tempo) antes de executar.",
];

const sources = [
  {
    label: "Busca semântica",
    detail: "HuggingFace Inference API gera embeddings; Qdrant armazena e ordena por proximidade.",
    href: "https://huggingface.co/docs/api-inference",
  },
  {
    label: "Base de PLs",
    detail: "Ementas e textos integrais coletados em SAPL municipais (dados públicos).",
    href: "https://dados.gov.br/",
  },
  {
    label: "Indicadores oficiais",
    detail: "Séries históricas por município (segurança, educação, saúde, economia).",
    href: "https://sidra.ibge.gov.br/home/ipca15",
  },
  { label: "Motor de agrupamento", detail: "Qdrant + regras de similaridade para juntar propostas irmãs.", href: "https://qdrant.tech/documentation/" },
];

const reportExampleMetadata = {
  question: "Como reduzir a violência urbana em bairros centrais?",
  indicatorCode: "criminal_indicator",
  indicatorAlias: "Taxa de Homicídios por 100 mil Habitantes",
  effectWindow: "24 meses",
  windowQuality: 0.83,
  totalCandidates: 292,
  totalPolicyGroups: 22,
  positiveIsGood: false,
};

// Dados reais extraídos de reports/response.json (consulta: "Como reduzir a violência urbana em bairros centrais?")
const reportExamplePolicies: ExamplePolicy[] = [
  {
    policy: "Criar programa de combate às pichações no município.",
    effect_mean: -54.11075986418452,
    effect_std: 24.203299065874848,
    quality_score: 0.8,
    actions: [
      {
        municipio: "Olinda",
        uf: "PE",
        label: "Olinda",
        effect: -19.17808219178082,
        url: "https://sapl.olinda.pe.leg.br/materia/59",
      },
      {
        municipio: "Tijucas do Sul",
        uf: "PR",
        label: "Tijucas do Sul",
        effect: -66.66666666666666,
        url: "https://sapl.tijucasdosul.pr.leg.br/materia/622",
      },
      {
        municipio: "Natal",
        uf: "RN",
        label: "Natal",
        effect: -57.264957264957275,
        url: "https://sapl.natal.rn.leg.br/materia/812",
      },
      {
        municipio: "Esteio",
        uf: "RS",
        label: "Esteio",
        effect: -73.33333333333334,
        url: "https://sapl.esteio.rs.leg.br/materia/6416",
      },
    ],
  },
];

const formatEffectValue = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "Sem dados suficientes";
  const rounded = Number(value.toFixed(2));
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded}%`;
};

const getEffectToneForExample = (value: number | null | undefined, positiveIsGood: boolean) => {
  if (value == null) return "effect-neutral";
  if (value === 0) return "effect-neutral";
  const isPositive = value > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  return isGood ? "effect-good" : "effect-bad";
};

type ExampleAction = {
  municipio: string;
  uf?: string | null;
  label: string;
  effect?: number | null;
  url?: string;
};

type ExamplePolicy = {
  policy: string;
  effect_mean?: number | null;
  effect_std?: number | null;
  quality_score?: number | null;
  actions: ExampleAction[];
};

type ExampleTab = {
  id: string;
  label: string;
  query: string;
  indicator: string;
  indicatorWindow: string;
  indicatorNote?: string;
  usedIndicator: boolean;
  positiveIsGood: boolean;
  filters: string[];
  highlight: string;
  footer?: string;
  policies: ExamplePolicy[];
};

const exampleTabs: ExampleTab[] = [
  {
    id: "relatorio-violencia",
    label: "Violência urbana (real)",
    query: reportExampleMetadata.question,
    indicator: `${reportExampleMetadata.indicatorAlias} (queda é bom)`,
    indicatorWindow: reportExampleMetadata.effectWindow,
    indicatorNote: `Fonte: reports/response.json. ${reportExampleMetadata.totalCandidates} candidatos viraram ${reportExampleMetadata.totalPolicyGroups} agrupamentos; qualidade da janela ${reportExampleMetadata.windowQuality.toFixed(2)}.`,
    usedIndicator: true,
    positiveIsGood: reportExampleMetadata.positiveIsGood,
    filters: [
      "Fonte: reports/response.json",
      `Indicador: ${reportExampleMetadata.indicatorCode}`,
      `Janela: ${reportExampleMetadata.effectWindow} (efeitos a 24 meses)`,
      `${reportExampleMetadata.totalCandidates} candidatos → ${reportExampleMetadata.totalPolicyGroups} agrupamentos`,
    ],
    highlight: "Combate às pichações tem efeito médio de -54.11% ± 24.20% em 24 meses, aplicado em 4 municípios.",
    footer:
      "Consulta real: “Como reduzir a violência urbana em bairros centrais?”. Indicador: Taxa de Homicídios por 100 mil Habitantes; janela de 24 meses.",
    policies: reportExamplePolicies,
  },
  {
    id: "maraba",
    label: "Iluminação (Marabá/PA)",
    query: "Como reduzir violência em corredores de ônibus com iluminação?",
    indicator: "Taxa de homicídios por 100 mil hab. (queda é bom)",
    indicatorWindow: "12 meses",
    indicatorNote: "Efeito calculado pelo algoritmo: variação percentual do indicador entre a data do projeto e 12 meses depois.",
    usedIndicator: true,
    positiveIsGood: false,
    filters: ["UF: PA", "Município: Marabá", "Ordenação: Qualidade (maior primeiro)"],
    highlight: "Grupo de iluminação e monitoramento com efeito médio de -23,2% em 12 meses.",
    footer: "Série usada: 21,01 → 16,13 homicídios/100 mil (2022.1 → 2023.1). Qualidade calculada via win-rate do algoritmo.",
    policies: [
      {
        policy: "Iluminação e monitoramento em pontos críticos de transporte",
        effect_mean: -23.2,
        effect_std: 2.8,
        quality_score: 0.66,
        actions: [
          {
            municipio: "Marabá",
            uf: "PA",
            effect: -23.2,
            url: "https://sapl.maraba.pa.leg.br/materia/21563/acompanhar-materia/",
            label: "Uso obrigatório de LED na rede pública • 2021-08-30",
          },
          {
            municipio: "Marabá",
            uf: "PA",
            effect: -23.2,
            url: "https://sapl.maraba.pa.leg.br/materia/15666/acompanhar-materia/",
            label: "Iluminação em abrigos de ônibus • 2018-06-07",
          },
          {
            municipio: "Marabá",
            uf: "PA",
            effect: -23.2,
            url: "https://sapl.maraba.pa.leg.br/materia/22298/acompanhar-materia/",
            label: "Câmeras em áreas de escolas • 2022-02-11",
          },
        ],
      },
    ],
  },
  {
    id: "campinas",
    label: "Iluminação e BRT (Campinas/SP)",
    query: "Como aumentar segurança em BRT e travessias com iluminação e monitoramento?",
    indicator: "Taxa de homicídios por 100 mil hab. (queda é bom)",
    indicatorWindow: "12 meses",
    indicatorNote: "Efeito calculado pelo algoritmo com a série municipal (percentual entre 2022.1 e 2023.1).",
    usedIndicator: true,
    positiveIsGood: false,
    filters: ["UF: SP", "Município: Campinas", "Ordenação: Efeito médio (menor primeiro)"],
    highlight: "Iluminação e monitoramento agrupadas com efeito médio de -33,9% em 12 meses.",
    footer: "Série usada: 5,71 → 3,78 homicídios/100 mil (2022.1 → 2023.1). Qualidade segue win-rate do agrupamento.",
    policies: [
      {
        policy: "Iluminação e monitoramento em BRT e travessias",
        effect_mean: -33.9,
        effect_std: 1.9,
        quality_score: 0.66,
        actions: [
          {
            municipio: "Campinas",
            uf: "SP",
            effect: -33.9,
            url: "https://sapl.campinas.sp.leg.br/materia/373755/acompanhar-materia/",
            label: "LED na rede de iluminação pública • 2021-02-05",
          },
          {
            municipio: "Campinas",
            uf: "SP",
            effect: -33.9,
            url: "https://sapl.campinas.sp.leg.br/materia/371961/acompanhar-materia/",
            label: "Câmeras nas estações do BRT • 2020-09-10",
          },
          {
            municipio: "Campinas",
            uf: "SP",
            effect: -33.9,
            url: "https://sapl.campinas.sp.leg.br/materia/371025/acompanhar-materia/",
            label: "PPP de iluminação pública • 2020-07-07",
          },
        ],
      },
    ],
  },
];

export default function MethodologyPage() {
  const [activeExampleId, setActiveExampleId] = useState(exampleTabs[0].id);
  const activeExample = useMemo(
    () => exampleTabs.find((item) => item.id === activeExampleId) ?? exampleTabs[0],
    [activeExampleId],
  );
  const [activeSection, setActiveSection] = useState(navSections[0].id);
  const sidebarLinksRef = useRef<HTMLDivElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ height: number; top: number }>({ height: 0, top: 0 });
  const [saplHosts, setSaplHosts] = useState<SaplHost[]>([]);
  const [saplSearch, setSaplSearch] = useState("");
  const [rowLimit, setRowLimit] = useState(25);
  const [saplError, setSaplError] = useState<string | null>(null);
  const [saplPage, setSaplPage] = useState(1);

  useEffect(() => {
    const loadSaplHosts = async () => {
      try {
        const response = await fetch("/sapl_hosts.jsonl");
        const text = await response.text();
        const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
        const parsed = lines
          .map((line) => JSON.parse(line) as SaplHost)
          .filter((item) => item.sapl_url);
        parsed.sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR"));
        setSaplHosts(parsed);
      } catch (error) {
        console.error("Falha ao carregar SAPL hosts", error);
        setSaplError("Não foi possível carregar a lista de SAPL.");
      }
    };

    loadSaplHosts();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0.15, 0.4, 0.75] },
    );

    navSections.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const link = linkRefs.current[activeSection];
    if (link) {
      setIndicatorStyle({ top: link.offsetTop, height: link.offsetHeight });
    }
  }, [activeSection]);

  useEffect(() => {
    const handleResize = () => {
      const link = linkRefs.current[activeSection];
      if (link) {
        setIndicatorStyle({ top: link.offsetTop, height: link.offsetHeight });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeSection]);

  const filteredHosts = useMemo(() => {
    const term = saplSearch.trim().toLowerCase();
    if (!term) return saplHosts;
    return saplHosts.filter((host) => host.municipio.toLowerCase().includes(term));
  }, [saplHosts, saplSearch]);

  const pageCount = useMemo(() => {
    if (!rowLimit) return 1;
    return Math.max(1, Math.ceil(filteredHosts.length / rowLimit));
  }, [filteredHosts.length, rowLimit]);

  useEffect(() => {
    setSaplPage(1);
  }, [saplSearch, rowLimit]);

  useEffect(() => {
    setSaplPage((prev) => Math.min(prev, pageCount));
  }, [pageCount]);

  const currentPage = Math.min(Math.max(1, saplPage), pageCount);

  const displayedHosts = useMemo(() => {
    const start = (currentPage - 1) * rowLimit;
    return filteredHosts.slice(start, start + rowLimit);
  }, [filteredHosts, rowLimit, currentPage]);

  return (
    <div className="article-layout">
      <MinimalNav />

      <div className="article-shell">
        <aside className="article-sidebar" aria-label="Navegação da metodologia">
          <div className="sidebar-card">
            <p className="eyebrow">Sumário</p>
            <nav className="sidebar-links" ref={sidebarLinksRef}>
              <span
                className="sidebar-active-indicator"
                style={{
                  height: indicatorStyle.height || 0,
                  transform: `translateY(${indicatorStyle.top}px)`,
                  opacity: indicatorStyle.height ? 1 : 0,
                }}
                aria-hidden="true"
              />
              {navSections.map((item) => (
                <a
                  key={item.id}
                  ref={(element) => {
                    linkRefs.current[item.id] = element;
                  }}
                  className={`sidebar-link ${activeSection === item.id ? "active" : ""}`}
                  href={`#${item.id}`}
                  aria-current={activeSection === item.id ? "true" : undefined}
                  onClick={() => setActiveSection(item.id)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="sidebar-meta">
              <p className="muted small">Dados atualizados em novembro de 2025.</p>
            </div>
            <div className="sidebar-cta">
              <Link className="primary-btn" href="/">
                Buscar políticas
              </Link>
              <Link className="ghost-btn" href="/projects" onClick={clearProjectsSearchState}>
                Ver projetos de lei
              </Link>
            </div>
          </div>
        </aside>

        <main className="article-content">
          <section className="-hero" id="introducao">

            <div className="hero-stats">
              <div className="pill-card">
                <p className="stat-value">{formatNumber(TOTAL_PROJECTS)}</p>
                <p className="muted small">Projetos de lei indexados</p>
              </div>
              <div className="pill-card">
                <p className="stat-value">{formatNumber(TOTAL_MUNICIPALITIES)}</p>
                <p className="muted small">Municípios com Dados Cadastrados</p>
              </div>
              <div className="pill-card">
                <p className="stat-value">Nov/2025</p>
                <p className="muted small">Última atualização dos dados da plataforma</p>
              </div>
            </div>
          </section>

          <section className="article-section" id="pipeline">
            <div className="section-head">
              <p className="eyebrow">Como funciona</p>
              <h2>Do texto à resposta auditável</h2>
              <p className="muted">
                Cada passo foi pensado para quem não é técnico conseguir acompanhar o que acontece com a sua pergunta e
                onde os dados entram.
              </p>
            </div>
            <div className="timeline">
              {pipelineSteps.map((step, index) => (
                <div key={step.title} className={`timeline-card tone-${step.tone}`}>
                  <div className="timeline-step">
                    <span>{index + 1}</span>
                  </div>
                  <div>
                    <h3>{step.title}</h3>
                    <p className="muted small">{step.detail}</p>
                    {step.links && (
                      <div className="chip-row">
                        {step.links.map((link) => (
                          <a key={link.href} className="chip-link" href={link.href} target="_blank" rel="noreferrer">
                            {link.label} ↗
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="article-section" id="exemplo">
            <div className="section-head">
              <p className="eyebrow">Exemplo interativo</p>
              <h2>Veja o caminho completo</h2>
              <p className="muted">
                Troque a aba para ver buscas diferentes. À esquerda estão a pergunta, indicador e filtros; à direita, o
                mesmo card de políticas públicas que você vê na geração real.
              </p>
              <p className="muted small">
                A primeira aba replica o arquivo reports/response.json (pergunta: {reportExampleMetadata.question}); as demais
                mostram variações de uso e filtros.
              </p>
            </div>

            <div className="example-tabs" role="tablist" aria-label="Cenários de exemplo">
              {exampleTabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeExampleId === tab.id}
                  className={`example-tab ${activeExampleId === tab.id ? "active" : ""}`}
                  onClick={() => setActiveExampleId(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>


            <div className="example-grid" aria-label="Demonstração lado a lado">
              <div className="example-column">
                <div className="example-card">
                  <p className="eyebrow">Pergunta digitada</p>
                  <div className="fake-input">{activeExample.query}</div>
                </div>
                <div className="example-card">
                  <p className="eyebrow">Indicadores e filtros da busca</p>
                  <div className="metric-badge soft">
                    <span className="badge-label">Indicador selecionado</span>
                    <span className="badge-value">{activeExample.indicator}</span>
                  </div>
                  <div className="metric-badge soft">
                    <span className="badge-label">Janela avaliada</span>
                    <span className="badge-value">{activeExample.indicatorWindow}</span>
                  </div>
                  <div className="metric-badge soft">
                    <span className="badge-label">Direção interpretada</span>
                    <span className="badge-value">{activeExample.positiveIsGood ? "Subir é bom" : "Descer é bom"}</span>
                  </div>

                </div>
              </div>

              <div className="example-column">


                <div className="policy-grid single-col">
                  {activeExample.policies.map((policy, policyIndex) => {
                    const effectAvailable = activeExample.usedIndicator && policy.effect_mean != null;
                    const effectTone = getEffectToneForExample(policy.effect_mean, activeExample.positiveIsGood);
                    const effectStd =
                      activeExample.usedIndicator && policy.effect_std != null ? ` ± ${policy.effect_std.toFixed(2)}%` : null;
                    const qualityValue = policy.quality_score != null ? policy.quality_score.toFixed(2) : "Não avaliado";

                    return (
                      <article key={`${policy.policy}-${policyIndex}`} className="policy-card" aria-label="Exemplo de card de política">
                        <p className="policy-title">{policy.policy}</p>

                        <div className="policy-badges">
                          <div className="metric-badge">
                            <span className="badge-label">Efeito médio (% em {activeExample.indicatorWindow})</span>
                            <span className={`badge-value ${effectTone}`}>
                              {effectAvailable ? (
                                <>
                                  {formatEffectValue(policy.effect_mean)}
                                  {effectStd ? ` ${effectStd}` : ""}
                                </>
                              ) : (
                                <span title={activeExample.usedIndicator ? "Sem dados suficientes para esta janela." : "Selecione um indicador para estimar o efeito."}>
                                  {activeExample.usedIndicator ? "Sem dados suficientes" : "Selecione um indicador"}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="metric-badge soft">
                            <span className="badge-label">Qualidade</span>
                            <span className="badge-value">
                              {policy.quality_score != null
                                ? qualityValue
                                : activeExample.usedIndicator
                                  ? "Sem dados suficientes"
                                  : "Selecione um indicador"}
                            </span>
                          </div>
                        </div>

                        <p className="policy-count">
                          Política aplicada em {policy.actions.length} município
                          {policy.actions.length === 1 ? "" : "s"}:
                        </p>
                        <ul className="policy-city-list">
                          {policy.actions.map((action, actionIndex) => {
                            const effectLabel =
                              activeExample.usedIndicator && action.effect != null
                                ? `Variação: ${formatEffectValue(action.effect)}`
                                : "Sem indicador calculado";
                            const effectToneAction = getEffectToneForExample(action.effect, activeExample.positiveIsGood);

                            return (
                              <li
                                key={`${policy.policy}-${action.municipio}-${action.label}-${actionIndex}`}
                                className="policy-city-item"
                              >
                                <div className="city-name">
                                  <span>{action.label}</span>
                                  {action.url && (
                                    <a className="city-link" href={action.url} target="_blank" rel="noreferrer" aria-label={`Abrir ementa original de ${action.municipio}`}>
                                      <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        aria-hidden="true"
                                      >
                                        <path
                                          d="M14 4H20V10"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                        <path
                                          d="M10 14L20 4"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                        <path
                                          d="M20 14V20H4V4H10"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </a>
                                  )}
                                </div>
                                <span className={`city-effect ${effectToneAction}`}>{effectLabel}</span>
                              </li>
                            );
                          })}
                        </ul>

                        <div className="policy-card-footer">
                          <button className="secondary-btn ghost" type="button" disabled>
                            Ver detalhes (exemplo)
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

              </div>
            </div>
          </section>

          <section className="article-section" id="interpretacao">
            <div className="section-head">
              <p className="eyebrow">Como ler resultados</p>
              <h2>Badges e alertas, sem sigla</h2>
              <p className="muted">Use estes sinais como “legenda” antes de decidir copiar ou adaptar uma política.</p>
            </div>
            <div className="card-grid">
              {interpretation.map((card) => (
                <div key={card.title} className="info-card lifted">
                  <h3>{card.title}</h3>
                  <ul className="muted small">
                    {card.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="article-section" id="auditoria">
            <div className="section-head">
              <p className="eyebrow">Antes de copiar</p>
              <h2>Checklist de auditoria</h2>
              <p className="muted">Passe o olho nestes itens para evitar surpresas jurídicas, de custo ou de dados.</p>
            </div>
            <div className="audit-card">
              <ul className="checklist">
                {checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="article-section" id="privacidade">
            <div className="section-head">
              <p className="eyebrow">Privacidade e limites</p>
              <h2>Onde o modelo ajuda, onde ele para</h2>
            </div>
            <div className="card-grid">
              <div className="info-card">
                <h3>Privacidade</h3>
                <p className="muted small">
                  Só usamos textos públicos e indicadores agregados por município. As perguntas feitas na busca não são
                  armazenadas nem usadas para treinar modelos.
                </p>
              </div>
              <div className="info-card">
                <h3>Limites</h3>
                <p className="muted small">
                  Cobertura e defasagem de indicadores variam por cidade. Contexto jurídico e orçamentário sempre
                  precisa de validação humana local.
                </p>
              </div>
              <div className="info-card">
                <h3>Uso recomendado</h3>
                <p className="muted small">
                  Apoio à priorização e à argumentação. A decisão final, custos e adequação jurídica ficam com a equipe
                  que vai executar.
                </p>
              </div>
            </div>
          </section>

          <section className="article-section" id="fontes">
            <div className="section-head">
              <p className="eyebrow">Fontes e referências</p>
              <h2>De onde vêm os dados e modelos</h2>
            </div>
            <div className="source-grid">
              {sources.map((source) => (
                <a key={source.label} className="source-card" href={source.href} target="_blank" rel="noreferrer">
                  <p className="strong">{source.label}</p>
                  <p className="muted small">{source.detail}</p>
                  <span className="chip-link">Abrir ↗</span>
                </a>
              ))}
            </div>
          </section>

          <section className="article-section" id="sapl">
            <div className="section-head">
              <p className="eyebrow">Infraestrutura de coleta</p>
              <h2>SAPL usados no web-scraping</h2>
              <p className="muted">
                Lista das casas legislativas com SAPL que alimentam o pipeline. Use a busca para filtrar por município e
                limite a quantidade exibida.
              </p>
            </div>

            <div className="sapl-controls">
              <label className="sapl-control">
                <span className="muted small">Buscar por município</span>
                <input
                  className="sapl-input"
                  type="search"
                  placeholder="Ex.: Recife, Manaus, Curitiba"
                  value={saplSearch}
                  onChange={(event) => setSaplSearch(event.target.value)}
                  aria-label="Buscar SAPL por município"
                />
              </label>

              <label className="sapl-control sapl-limit">
                <span className="muted small">Limite de linhas</span>
                <select
                  className="sapl-input"
                  value={rowLimit}
                  onChange={(event) => setRowLimit(Number(event.target.value))}
                  aria-label="Definir limite de linhas da tabela"
                >
                  {[10, 25, 50, 100, 200].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sapl-count muted small">
                {saplError
                  ? saplError
                  : `Mostrando ${displayedHosts.length} de ${filteredHosts.length} (total: ${saplHosts.length})`}
              </div>
            </div>

            {saplHosts.length === 0 && !saplError ? (
              <p className="muted small">Carregando lista de SAPL...</p>
            ) : (
              <>
                <div className="table-card sapl-table-card" role="table" aria-label="Tabela de SAPL utilizados">
                  <div className="table-head sapl-table" role="row">
                    <span role="columnheader">Município</span>
                    <span role="columnheader">SAPL</span>
                    <span role="columnheader">UF</span>
                    <span role="columnheader">HTTP</span>
                  </div>
                  {displayedHosts.map((host) => {
                    const rowKey = `${host.ibge_id}-${host.sapl_url}`;
                    return (
                      <div key={rowKey} className="table-row sapl-table" role="row">
                        <span className="strong" role="cell">
                          {host.municipio}
                        </span>
                        <span role="cell">
                          <a className="row-link" href={host.sapl_url} target="_blank" rel="noreferrer">
                            Abrir SAPL
                          </a>
                          <p className="muted small sapl-url">{host.sapl_url}</p>
                        </span>
                        <span role="cell">{host.uf}</span>
                        <span className="muted" role="cell">
                          {host.http_status ?? "—"}
                        </span>
                      </div>
                    );
                  })}

                  {displayedHosts.length === 0 && !saplError && (
                    <div className="table-row sapl-table" role="row">
                      <span className="muted small" role="cell">
                        Nenhum SAPL encontrado com esse município.
                      </span>
                    </div>
                  )}
                </div>

                <div className="sapl-pagination">
                  <button
                    className="page-btn"
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setSaplPage((prev) => Math.max(1, prev - 1))}
                  >
                    Anterior
                  </button>
                  <span className="muted small">
                    Página {currentPage} de {pageCount}
                  </span>
                  <button
                    className="page-btn"
                    type="button"
                    disabled={currentPage >= pageCount || filteredHosts.length === 0}
                    onClick={() => setSaplPage((prev) => Math.min(pageCount, prev + 1))}
                  >
                    Próxima
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="article-foot">
            <div>
              <p className="eyebrow">Próximo passo</p>
              <h3>Volte para a busca e escolha um tema</h3>
              <p className="muted">Use este guia como referência rápida enquanto avalia políticas.</p>
            </div>
            <div className="trust-actions">
              <Link className="primary-btn" href="/">
                Buscar políticas
              </Link>
              <Link className="ghost-btn" href="/projects" onClick={clearProjectsSearchState}>
                Ver projetos de lei
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
