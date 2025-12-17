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

const scenarios = {
  seguranca: {
    title: "Segurança em áreas centrais",
    question: "“Como reduzir violência em áreas comerciais sem grandes obras?”",
    picks: [
      "Pergunta: segurança no entorno de escolas e comércio",
      "Indicador: homicídios por 100 mil hab. (queda é bom)",
      "Janela: 12 e 24 meses para ver consistência",
    ],
    outputs: [
      "Grupos típicos: iluminação de pontos críticos, câmeras comunitárias, patrulhamento escolar.",
      "Mostramos variações: LED vs. troca gradual, convênios com comércio, monitoramento por bairro.",
      "Quando há indicador, exibimos efeito médio (queda ou alta), antes/depois e links das leis.",
    ],
  },
  educacao: {
    title: "Alfabetização",
    question: "“Como acelerar alfabetização até o 2º ano?”",
    picks: [
      "Pergunta: alfabetização na idade certa",
      "Indicador: matrículas e frequência (subir é bom)",
      "Janela: 18–24 meses para respeitar o ciclo escolar",
    ],
    outputs: [
      "Grupos com tutoria focalizada, material estruturado e formação continuada.",
      "Mostramos janelas diferentes (12, 24, 36 meses) para ver estabilidade do efeito.",
      "Links para leis locais e séries públicas para você conferir valores.",
    ],
  },
  saude: {
    title: "Saúde mental",
    question: "“Como reduzir filas em saúde mental?”",
    picks: [
      "Pergunta: atendimento em saúde mental",
      "Indicador: tempo médio de espera (descer é bom)",
      "Janela: 6–12 meses para serviços de curta maturação",
    ],
    outputs: [
      "Grupos com teleatendimento, triagem multiprofissional e centros dia.",
      "Você vê o antes/depois do indicador quando há dados suficientes.",
      "Links para normas municipais, prestação de contas e bases públicas de saúde.",
    ],
  },
};

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

const apiExamples = [
  {
    title: "POST /api/search — busca por texto livre",
    description: "Você envia a pergunta em português e recebe os projetos mais próximos já cadastrados.",
    request: `{
  "query": "Como melhorar a segurança noturna no entorno das escolas?",
  "top_k": 3
}`,
    response: `{
  "query": "Como melhorar a segurança noturna no entorno das escolas?",
  "top_k": 3,
  "returned": 3,
  "results": [
    {
      "index": 18754,
      "score": 0.83,
      "municipio": "Natal",
      "uf": "RN",
      "acao": "Alterar gradativamente as lâmpadas de vapor metálico, de sódio e mercúrio utilizadas na rede de iluminação pública municipal por lâmpadas de LED.",
      "data_apresentacao": "2022-02-21",
      "ementa": "Dispõe sobre a substituição gradativa das lâmpadas ... por lâmpadas de Led.",
      "link_publico": "https://sapl.natal.rn.leg.br/materia/18754/acompanhar-materia/",
      "sapl_url": "https://sapl.natal.rn.leg.br",
      "tipo_label": "PL Projeto de Lei "
    },
    {
      "index": 18864,
      "score": 0.79,
      "municipio": "Natal",
      "uf": "RN",
      "acao": "Implementar serviço de manutenção da iluminação pública no município.",
      "data_apresentacao": "2022-02-22",
      "ementa": "Dispõe sobre a essencialidade do serviço de manutenção da iluminação pública no município de Natal.",
      "link_publico": "https://sapl.natal.rn.leg.br/materia/18864/acompanhar-materia/",
      "sapl_url": "https://sapl.natal.rn.leg.br",
      "tipo_label": "PL Projeto de Lei "
    },
    {
      "index": 18605,
      "score": 0.76,
      "municipio": "Natal",
      "uf": "RN",
      "acao": "Registrar e divulgar semestralmente os índices de violência contra a população LGBTQIA+ no município.",
      "data_apresentacao": "2022-02-15",
      "ementa": "Dispõe sobre o registro e a divulgação semestral dos índices de violência contra a população LGBTQIA+.",
      "link_publico": "https://sapl.natal.rn.leg.br/materia/18605/acompanhar-materia/",
      "sapl_url": "https://sapl.natal.rn.leg.br",
      "tipo_label": "PL Projeto de Lei "
    }
  ]
}`,
  },
  {
    title: "POST /api/policies — agrupamento com indicador",
    description: "Com os IDs retornados na busca, pedimos um agrupamento usando o indicador de homicídios (queda é bom).",
    request: `{
  "bill_indexes": [18754, 18864, 18605],
  "use_indicator": true,
  "indicator": "criminal_indicator",
  "effect_window_months": 12
}`,
    response: `{
  "indicator": "criminal_indicator",
  "used_indicator": true,
  "selected_effect_window": 12,
  "total_candidates": 3,
  "policies": [
    {
      "policy": "Iluminação e monitoramento em áreas escolares e corredores de ônibus",
      "effect_mean": -30.1,
      "effect_std": 4.5,
      "quality_score": 0.78,
      "actions": [
        {
          "municipio": "Natal",
          "uf": "RN",
          "acao": "Alterar gradativamente as lâmpadas ... por lâmpadas de LED.",
          "effect": -30.1,
          "url": "https://sapl.natal.rn.leg.br/materia/18754",
          "data_apresentacao": "2022-02-21",
          "ementa": "Dispõe sobre a substituição gradativa das lâmpadas ... por lâmpadas de Led.",
          "indicator_before": 12.38,
          "indicator_after": 8.65
        },
        {
          "municipio": "Natal",
          "uf": "RN",
          "acao": "Implementar serviço de manutenção da iluminação pública no município.",
          "effect": -30.1,
          "url": "https://sapl.natal.rn.leg.br/materia/18864",
          "data_apresentacao": "2022-02-22",
          "ementa": "Dispõe sobre a essencialidade do serviço de manutenção da iluminação pública no município de Natal.",
          "indicator_before": 12.38,
          "indicator_after": 8.65
        },
        {
          "municipio": "Natal",
          "uf": "RN",
          "acao": "Registrar e divulgar semestralmente os índices de violência contra a população LGBTQIA+ no município.",
          "effect": -30.1,
          "url": "https://sapl.natal.rn.leg.br/materia/18605",
          "data_apresentacao": "2022-02-15",
          "ementa": "Dispõe sobre o registro e a divulgação semestral dos índices de violência contra a população LGBTQIA+.",
          "indicator_before": 12.38,
          "indicator_after": 8.65
        }
      ]
    }
  ],
  "best_quality_effect_window": 12,
  "best_quality_effect_windows": [12, 24],
  "best_effect_mean_window": 24,
  "best_effect_mean_windows": [24, 12]
}`,
  },
];

export default function MethodologyPage() {
  const [activeScenario, setActiveScenario] = useState<keyof typeof scenarios>("seguranca");
  const scenario = useMemo(() => scenarios[activeScenario], [activeScenario]);
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
          <section className="article-hero" id="introducao">
            <div className="hero-badge">Metodologia explicada</div>
            <h1>Metodologia sem jargão: do texto ao indicador</h1>
            <p className="lede">
              Aqui você vê, em linguagem direta, como transformamos uma pergunta em grupos de políticas com efeito
              estimado usando dados públicos. Tudo fica auditável, com links para as leis e para as séries dos
              indicadores.
            </p>
            <div className="hero-stats">
              <div className="pill-card">
                <p className="stat-value">{formatNumber(TOTAL_PROJECTS)}</p>
                <p className="muted small">projetos indexados</p>
              </div>
              <div className="pill-card">
                <p className="stat-value">{formatNumber(TOTAL_MUNICIPALITIES)}</p>
                <p className="muted small">municípios com dados</p>
              </div>
              <div className="pill-card">
                <p className="stat-value">Nov/2025</p>
                <p className="muted small">última atualização da base</p>
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
                Troque o tema e acompanhe o que você escolhe, o que o sistema entrega e como os dados aparecem. Logo
                abaixo colocamos a resposta real da API para a mesma ideia.
              </p>
            </div>
            <div className="scenario-switcher" role="group" aria-label="Escolha um cenário">
              {Object.entries(scenarios).map(([key, value]) => (
                <button
                  key={key}
                  className={`scenario-btn ${activeScenario === key ? "active" : ""}`}
                  onClick={() => setActiveScenario(key as keyof typeof scenarios)}
                >
                  {value.title}
                </button>
              ))}
            </div>
            <div className="scenario-card">
              <div className="scenario-header">
                <p className="muted small">Pergunta</p>
                <p className="strong">{scenario.question}</p>
              </div>
              <div className="scenario-grid">
                <div className="scenario-block">
                  <p className="eyebrow">Escolhas na plataforma</p>
                  <ul className="muted small">
                    {scenario.picks.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="scenario-block">
                  <p className="eyebrow">O que entregamos</p>
                  <ul className="muted small">
                    {scenario.outputs.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="scenario-foot">
                <p className="muted small">
                  Clique em outro tema para comparar as variações e as janelas de tempo usadas na resposta.
                </p>
              </div>
            </div>

            <div className="api-samples" aria-label="Exemplos reais da API">
              <div className="section-head api-samples-head">
                <p className="eyebrow">API em ação</p>
                <p className="muted small">
                  Respostas reais da plataforma (dados de Natal/RN, indicador de homicídios por 100 mil habitantes).
                </p>
              </div>
              <div className="api-sample-grid">
                {apiExamples.map((sample) => (
                  <div key={sample.title} className="api-sample-card">
                    <div className="api-sample-meta">
                      <p className="strong">{sample.title}</p>
                      <p className="muted small">{sample.description}</p>
                    </div>
                    <div className="api-sample-body">
                      <p className="eyebrow">Requisição</p>
                      <pre className="code-block" aria-label={`Exemplo de requisição ${sample.title}`}>
                        <code>{sample.request}</code>
                      </pre>
                      <p className="eyebrow">Resposta</p>
                      <pre className="code-block" aria-label={`Exemplo de resposta ${sample.title}`}>
                        <code>{sample.response}</code>
                      </pre>
                    </div>
                  </div>
                ))}
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
