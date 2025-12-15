"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import MinimalNav from "@/components/MinimalNav";
import { clearProjectsSearchState } from "@/lib/projectsSearchStorage";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const formatNumber = (value: number) => numberFormatter.format(value);
const TOTAL_PROJECTS = 220_065;
const TOTAL_MUNICIPALITIES = 322;

const navSections = [
  { id: "introducao", label: "Introdução" },
  { id: "pipeline", label: "Pipeline" },
  { id: "exemplo", label: "Exemplo interativo" },
  { id: "interpretacao", label: "Como ler resultados" },
  { id: "auditoria", label: "Checklist de auditoria" },
  { id: "privacidade", label: "Privacidade e limites" },
  { id: "fontes", label: "Fontes e referências" },
];

const pipelineSteps = [
  {
    title: "Pergunta do gestor",
    detail: "Texto livre ou seleção guiada por tema/indicador.",
    tone: "warm",
  },
  {
    title: "Busca semântica",
    detail: "Embeddings E5 via API da HuggingFace + Qdrant para proximidade vetorial.",
    tone: "info",
    links: [
      { href: "https://huggingface.co/docs/api-inference/detailed_parameters#feature-extraction-task", label: "API HuggingFace" },
      { href: "https://qdrant.tech/documentation/", label: "Qdrant docs" },
    ],
  },
  {
    title: "Agrupamento",
    detail: "Clusters por similaridade para reduzir duplicidade e revelar variações.",
    tone: "neutral",
  },
  {
    title: "Indicador e janela",
    detail: "Indicadores oficiais; janelas de 6–36 meses respeitando periodicidade e maturação.",
    tone: "accent",
  },
  {
    title: "Resultado auditável",
    detail: "Badges de qualidade/efeito, links originais, município/UF e datas.",
    tone: "success",
  },
];

const scenarios = {
  seguranca: {
    title: "Segurança em áreas centrais",
    question: "“Como reduzir violência em bairros centrais?”",
    picks: ["Tema: Segurança urbana", "Indicador: crimes violentos por 100 mil hab.", "Janela: 12–24 meses"],
    outputs: [
      "Grupos com patrulhamento orientado por dados, iluminação e câmeras comunitárias.",
      "Efeito médio: redução observada após 12–24 meses; direção correta (descer é bom).",
      "Links diretos para leis municipais e estatísticas criminais.",
    ],
  },
  educacao: {
    title: "Alfabetização",
    question: "“Como acelerar alfabetização até o 2º ano?”",
    picks: ["Tema: Educação básica", "Indicador: alfabetização na idade certa", "Janela: 18–24 meses"],
    outputs: [
      "Grupos com tutoria focalizada, material estruturado e formação continuada.",
      "Efeito médio: melhora em proficiência; direção correta (subir é bom).",
      "Links para leis locais e séries do SAEB/ANA.",
    ],
  },
  saude: {
    title: "Saúde mental",
    question: "“Como reduzir filas em saúde mental?”",
    picks: ["Tema: Saúde mental", "Indicador: tempo médio de espera", "Janela: 6–12 meses"],
    outputs: [
      "Grupos com teleatendimento, triagem multiprofissional e centros dia.",
      "Efeito médio: queda em filas; direção correta (descer é bom).",
      "Links para normas municipais e bases do e-SUS/SIH.",
    ],
  },
};

const interpretation = [
  {
    title: "Qualidade",
    points: ["Número de precedentes coerentes", "Textos completos (ementa + justificativa)", "Cobertura mínima do indicador"],
  },
  {
    title: "Efeito",
    points: ["Impacto médio na janela escolhida", "Respeita a direção do indicador (subir/descer)", "Varia entre janelas; compare 12, 24 e 36 meses"],
  },
  {
    title: "Desconfie quando",
    points: ["Poucos casos ou textos curtos", "Defasagem alta do indicador", "Contexto jurídico/orçamentário muito distinto"],
  },
];

const checklist = [
  "Confirme se o precedente tem competência e orçamento similares.",
  "Verifique município/UF/ano do precedente e aderência ao seu contexto.",
  "Cheque cobertura do indicador para o seu território na janela escolhida.",
  "Leia o texto original e a série do indicador via links.",
  "Documente ajustes locais antes de implementar.",
];

const sources = [
  { label: "Embeddings E5", detail: "HuggingFace Inference API para vetorização.", href: "https://huggingface.co/docs/api-inference" },
  { label: "Busca vetorial", detail: "Qdrant com corte de similaridade.", href: "https://qdrant.tech/documentation/" },
  { label: "Projetos de lei", detail: "Ementas e textos integrais de câmaras municipais.", href: "https://dados.gov.br/" },
  { label: "Indicadores oficiais", detail: "Séries históricas por município (educação, saúde, segurança, economia).", href: "https://sidra.ibge.gov.br/home/ipca15" },
];

export default function MethodologyPage() {
  const [activeScenario, setActiveScenario] = useState<keyof typeof scenarios>("seguranca");
  const scenario = useMemo(() => scenarios[activeScenario], [activeScenario]);

  return (
    <div className="article-layout">
      <MinimalNav />

      <div className="article-shell">
        <aside className="article-sidebar" aria-label="Navegação da metodologia">
          <div className="sidebar-card">
            <p className="eyebrow">Sumário</p>
            <nav className="sidebar-links">
              {navSections.map((item) => (
                <a key={item.id} className="sidebar-link" href={`#${item.id}`}>
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
            <h1>Como encontramos, agrupamos e explicamos precedentes</h1>
            <p className="lede">
              Tudo o que você vê na plataforma vem de um pipeline audível: pergunta → busca semântica → agrupamento →
              impacto com indicadores oficiais. Sem rodeios, no estilo artigo para leitura fluida.
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
              <h2>Pipeline em 5 passos</h2>
              <p className="muted">A leitura segue o fluxo do dado: entrada → processamento → saída auditável.</p>
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
              <p className="muted">Troque o tema para ver como a jornada muda.</p>
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
                <p className="muted small">Clique em outro tema para comparar o impacto e os grupos retornados.</p>
              </div>
            </div>
          </section>

          <section className="article-section" id="interpretacao">
            <div className="section-head">
              <p className="eyebrow">Como ler resultados</p>
              <h2>Badges e alertas</h2>
              <p className="muted">Entenda rapidamente o que significa cada selo exibido na interface.</p>
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
              <p className="muted">Minimiza risco de transportar precedentes sem aderência.</p>
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
                  Trabalhamos apenas com textos públicos e indicadores agregados por município. Não guardamos consultas
                  individuais.
                </p>
              </div>
              <div className="info-card">
                <h3>Limites</h3>
                <p className="muted small">
                  Cobertura e defasagem de indicadores variam; contexto jurídico e orçamentário requer validação humana.
                </p>
              </div>
              <div className="info-card">
                <h3>Uso recomendado</h3>
                <p className="muted small">
                  Apoio à priorização e argumentação. A decisão final e a adaptação normativa são responsabilidade do
                  gestor.
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
