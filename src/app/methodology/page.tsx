"use client";

import Link from "next/link";
import type React from "react";
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
];

const pipelineSteps = [
  {
    title: "Você faz a pergunta",
    detail: 'Use linguagem simples, como falaria com a equipe. Ex.: "Como reduzir a violência perto das escolas?".',
    tone: "warm",
  },
  {
    title: "Buscamos textos parecidos",
    detail: "A pergunta vira pontos-chave e é comparada com 220 mil projetos com modelo de linguagem e base vetorial (busca semântica).",
    tone: "info",
    links: [
      { href: "https://huggingface.co/docs/api-inference/detailed_parameters#feature-extraction-task", label: "Documentação da API HuggingFace" },
      { href: "https://qdrant.tech/documentation/", label: "Documentação da Qdrant" },
    ],
  },
  {
    title: "Juntamos o que é parecido",
    detail: "Agrupamos propostas semelhantes para reduzir duplicidade e mostrar variações do mesmo tema.",
    tone: "neutral",
  },
  {
    title: "Olhamos indicador e tempo",
    detail: "Após escolher um indicador, calculamos a variação em 6, 12, 24 ou 36 meses e consideramos se subir é bom ou ruim.",
    tone: "accent",
  },
  {
    title: "Entregamos um pacote auditável",
    detail: "Cada grupo apresenta qualidade, efeito médio, links, município/UF, datas e série do indicador para conferência.",
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
    label: "Dados de segurança pública (MJSP)",
    detail: "Séries municipais de homicídios a cada 100 mil habitantes, extraídas dos dados abertos do Ministério da Justiça. Usamos essa base para calcular a taxa e acompanhar sua variação no tempo.",
    href: "https://www.gov.br/mj/pt-br/acesso-a-informacao/dados-abertos",
    linkLabel: "Abrir dados abertos do MJSP",
  },
  {
    label: "Censo Escolar (INEP)",
    detail: "Séries municipais de matrículas em ensino regular por 100 mil habitantes, obtidas nos resultados oficiais do Censo Escolar. Usamos essas séries para medir a evolução da matrícula ao longo dos anos.",
    href: "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-escolar/resultados",
    linkLabel: "Abrir resultados do Censo Escolar",
  },
  {
    label: "Modelo de linguagem (HuggingFace)",
    detail: "Transforma os textos dos projetos em vetores numéricos para identificar temas parecidos por semelhança. É o primeiro passo da busca semântica que conecta sua pergunta às políticas mais próximas.",
    href: "https://huggingface.co/docs/api-inference",
    linkLabel: "Abrir documentação do modelo",
  },
  {
    label: "Agrupamento de propostas (Qdrant)",
    detail: "Armazena e agrupa propostas similares, ordenando pela proximidade com a sua pergunta. Isso reduz duplicidade e destaca variações do mesmo tema para decisão mais rápida.",
    href: "https://qdrant.tech/documentation/",
    linkLabel: "Abrir documentação do Qdrant",
  },
];

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

const getSaplBaseUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    const match = url.match(/^(https?:\/\/)?([^/]+)/i);
    if (match) {
      return `${match[1] ?? ""}${match[2]}`;
    }
    return url;
  }
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
    label: "Violência Urbana",
    query: "Como reduzir a violência urbana em bairros centrais?",
    indicator: "Taxa de Homicídios por 100 mil Habitantes",
    indicatorWindow: "24 meses",
    indicatorNote: undefined,
    usedIndicator: true,
    positiveIsGood: false,
    filters: [],
    highlight: "",
    footer: undefined,
    policies: reportExamplePolicies,
  },
  {
    id: "evasao-escolar",
    label: "Evasão Escolar",
    query: "Como diminuir evasão escolar no ensino médio?",
    indicator: "Taxa de Matrículas em Ensino Regular por 100 mil Habitantes",
    indicatorWindow: "12 meses",
    indicatorNote: undefined,
    usedIndicator: true,
    positiveIsGood: true,
    filters: [],
    highlight: "",
    footer: undefined,
    policies: [
      {
        policy: "Informar pais ou responsáveis sobre a ausência do(a) aluno(a) na escola.",
        effect_mean: 2.91,
        effect_std: 3.04,
        quality_score: 0.75,
        actions: [
          {
            municipio: "Goianá",
            uf: "MG",
            effect: 2.25,
            label: "Goianá",
          },
          {
            municipio: "Tijucas",
            uf: "SC",
            effect: 6.23,
            label: "Tijucas",
          },
          {
            municipio: "São Mateus",
            uf: "ES",
            effect: 0.26,
            label: "São Mateus",
          },
        ],
      },
    ],
  },
  {
    id: "campinas",
    label: "Saneamento Básico",
    query: "Como ampliar o acesso a saneamento básico rapidamente?",
    indicator: "Sem indicador selecionado",
    indicatorWindow: "Escolha um indicador para selecionar a janela",
    indicatorNote: undefined,
    usedIndicator: false,
    positiveIsGood: true,
    filters: [],
    highlight: "",
    footer: undefined,
    policies: [
      {
        policy: "Criar plano municipal de saneamento básico.",
        effect_mean: null,
        effect_std: null,
        quality_score: null,
        actions: [
          {
            municipio: "Congonhal",
            uf: "MG",
            effect: null,
            label: "Congonhal",
          },
          {
            municipio: "Canela",
            uf: "RS",
            effect: null,
            label: "Canela",
          },
          {
            municipio: "Corbélia",
            uf: "PR",
            effect: null,
            label: "Corbélia",
          },
          {
            municipio: "Sarandi",
            uf: "RS",
            effect: null,
            label: "Sarandi",
          },
          {
            municipio: "Major Vieira",
            uf: "SC",
            effect: null,
            label: "Major Vieira",
          },
          {
            municipio: "Montes Claros",
            uf: "MG",
            effect: null,
            label: "Montes Claros",
          },
          {
            municipio: "Caxingó",
            uf: "PI",
            effect: null,
            label: "Caxingó",
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
  const activeSectionRef = useRef(navSections[0].id);
  const sidebarLinksRef = useRef<HTMLDivElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ height: number; top: number }>({ height: 0, top: 0 });
  const [saplHosts, setSaplHosts] = useState<SaplHost[]>([]);
  const [saplSearch, setSaplSearch] = useState("");
  const [rowLimit, setRowLimit] = useState(10);
  const [saplError, setSaplError] = useState<string | null>(null);
  const [saplPage, setSaplPage] = useState(1);
  const scrollLockRef = useRef(false);

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
    let rafId: number | null = null;
    const offset = 80;

    const updateActiveSection = () => {
      rafId = null;
      if (scrollLockRef.current) return;

      let closestId = activeSectionRef.current;
      let closestDistance = Number.POSITIVE_INFINITY;

      navSections.forEach((section) => {
        const element = document.getElementById(section.id);
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const visible = rect.bottom > 0 && rect.top < window.innerHeight;
        if (!visible) return;
        const distance = Math.abs(rect.top - offset);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestId = section.id;
        }
      });

      if (closestId !== activeSectionRef.current) {
        activeSectionRef.current = closestId;
        setActiveSection(closestId);
      }
    };

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(updateActiveSection);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    handleScroll();

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

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

  const handleSidebarClick = (event: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    event.preventDefault();
    const target = document.getElementById(sectionId);
    if (!target) return;
    const offset = 80;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    scrollLockRef.current = true;
    setActiveSection(sectionId);
    window.scrollTo({ top, behavior: "smooth" });
    window.setTimeout(() => {
      scrollLockRef.current = false;
    }, 500);
  };

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
                  onClick={(event) => handleSidebarClick(event, item.id)}
                >
                  {item.label}
                </a>
              ))}
            </nav>


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
                <p className="muted small">Municípios com dados cadastrados</p>
              </div>
              <div className="pill-card">
                <p className="stat-value">12/11/2025</p>
                <p className="muted small">Dados atualizados na plataforma</p>
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


            <div className="example-grid refined" aria-label="Demonstração lado a lado">
              <div className="example-column">
                <div className="example-card example-summary-card">
                  <p className="eyebrow">Pergunta digitada</p>
                  <p className="example-question">{activeExample.query}</p>

                  <div className="example-meta-grid">
                    <div className="example-meta indicator-meta is-full">
                      <span className="meta-label">Indicador</span>
                      <span className="meta-value">{activeExample.indicator}</span>
                    </div>
                    {activeExample.usedIndicator && (
                      <div className="example-meta">
                        <span className="meta-label">Janela</span>
                        <span className="meta-value">{activeExample.indicatorWindow}</span>
                      </div>
                    )}
                    {activeExample.usedIndicator && (
                      <div className="example-meta">
                        <span className="meta-label">Direção</span>
                        <span className="meta-value">{activeExample.positiveIsGood ? "Subir é bom" : "Descer é bom"}</span>
                      </div>
                    )}
                  </div>

                  {activeExample.indicatorNote && <p className="muted small example-note">{activeExample.indicatorNote}</p>}

                  {activeExample.highlight && (
                    <div className="example-highlight">
                      <span className="example-dot" aria-hidden="true" />
                      <p>{activeExample.highlight}</p>
                    </div>
                  )}

                  {activeExample.filters.length > 0 && (
                    <div className="example-filters" aria-label="Filtros aplicados">
                      {activeExample.filters.map((filter) => (
                        <span key={filter} className="filter-chip clean">
                          {filter}
                        </span>
                      ))}
                    </div>
                  )}

                  {activeExample.footer && <p className="muted small example-note">{activeExample.footer}</p>}
                </div>
              </div>

              <div className="example-column">


                <div className="policy-grid single-col example-policy-grid">
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
                            <span className="badge-label">Efeito médio</span>
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
              <h2>Selos e alertas em linguagem simples</h2>
              <p className="muted">Use estes sinais como legenda antes de decidir copiar ou adaptar uma política.</p>
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
              <p className="muted">Verifique estes itens para evitar surpresas jurídicas, de custo ou de dados.</p>
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
            <p className="muted small">
              Você pode abrir as fontes abaixo; aqui explicamos em linguagem simples o papel de cada uma no projeto.
            </p>
            <div className="source-grid">
              {sources.map((source) => (
                <a key={source.label} className="source-card" href={source.href} target="_blank" rel="noreferrer">
                  <p className="strong">{source.label}</p>
                  <p className="muted small">{source.detail}</p>
                  <span className="chip-link">{source.linkLabel ?? "Abrir"}</span>
                </a>
              ))}
            </div>
            <p className="muted small">
              Todos os dados citados são públicos e não usamos nenhuma informação pessoal nas buscas.
            </p>
            <div className="sapl-subsection">
              <div className="section-head">
                <p className="eyebrow">Infraestrutura de coleta</p>
                <h3>SAPL usados na coleta automatizada</h3>
                <p className="muted small">
                  Lista detalhada das casas legislativas com SAPL que alimentam o pipeline. Use a busca para filtrar por
                  município e limite a quantidade exibida.
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
                      <span role="columnheader">UF</span>
                      <span role="columnheader">SAPL</span>
                    </div>
                    {displayedHosts.map((host) => {
                      const rowKey = `${host.ibge_id}-${host.sapl_url}`;
                      return (
                        <div key={rowKey} className="table-row sapl-table" role="row">
                          <span className="strong" role="cell">
                            {host.municipio}
                          </span>
                          <span role="cell">{host.uf}</span>
                          <span role="cell">
                            <a className="row-link" href={host.sapl_url} target="_blank" rel="noreferrer">
                              Abrir SAPL
                            </a>
                            <p className="muted small sapl-url">{getSaplBaseUrl(host.sapl_url)}</p>
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
            </div>
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
