"use client";

import Link from "next/link";

import { clearProjectsSearchState } from "@/lib/projectsSearchStorage";

export default function MethodologyPage() {
  return (
    <div className="landing">
      <header className="minimal-nav">
        <div className="nav-brand">
          <Link className="nav-title" href="/">
            CityManager
          </Link>
        </div>
        <nav className="nav-links-minimal">
          <Link className="nav-link-minimal" href="/">
            Gerador de Políticas Públicas
          </Link>
          <Link className="nav-link-minimal" href="/projects" onClick={clearProjectsSearchState}>
            Projetos de Lei
          </Link>
          <span className="nav-link-minimal active">Metodologia</span>
        </nav>
      </header>

      <main className="landing-body page-body">
        <section className="hero">
          <div className="hero-text">
            <p className="eyebrow">Confiabilidade</p>
            <h1>Metodologia, fontes e limites</h1>
            <p className="lede">
              Como calculamos similaridade, agrupamos políticas e estimamos impacto com indicadores reais. Tudo
              documentado para você justificar a adoção local.
            </p>
            <div className="hero-actions">
              <Link className="primary-btn" href="/">
                Buscar políticas
              </Link>
              <Link className="ghost-btn" href="/projects" onClick={clearProjectsSearchState}>
                Ver projetos de lei
              </Link>
            </div>
          </div>
          <div className="hero-panel">
            <div className="stat-card highlight">
              <p className="stat-label">Fontes</p>
              <p className="stat-value">Dados públicos + indicadores</p>
              <p className="stat-detail">Projetos de lei, jurisprudência e séries históricas oficiais.</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Explicabilidade</p>
              <p className="stat-value">Similaridade + agrupamento</p>
              <p className="stat-detail">Mostramos links, janelas temporais e qualidade de cada grupo.</p>
            </div>
          </div>
        </section>

        <section className="info-grid">
          <div className="info-card">
            <p className="eyebrow">Pipeline</p>
            <h3>Do texto ao agrupamento</h3>
            <p>
              Codificamos consultas e ações em embeddings, buscamos no Qdrant e agrupamos projetos parecidos por tema
              antes de sugerir políticas.
            </p>
            <ul className="muted small">
              <li>Modelo multilingue E5 na HuggingFace para embeddings.</li>
              <li>Qdrant para busca vetorial e corte por similaridade.</li>
              <li>Agrupamento por proximidade semântica para evitar duplicidades.</li>
            </ul>
          </div>
          <div className="info-card">
            <p className="eyebrow">Indicadores</p>
            <h3>Impacto estimado e janelas</h3>
            <p>
              Indicadores reais calibram o efeito médio. A janela de impacto é múltipla da periodicidade do indicador.
            </p>
            <ul className="muted small">
              <li>Selecione o indicador e a janela (6, 12, 18, 24, 30, 36 meses).</li>
              <li>Direção do efeito respeita se o indicador “bom” é subir ou descer.</li>
              <li>Políticas sem dados suficientes são excluídas do cálculo.</li>
            </ul>
          </div>
          <div className="info-card">
            <p className="eyebrow">Fontes e auditoria</p>
            <h3>Links e verificação</h3>
            <p>
              Mantemos o link para o texto original e para o indicador usado. Você pode auditar cada precedente antes de
              replicar.
            </p>
            <ul className="muted small">
              <li>Somente dados públicos e indicadores documentados.</li>
              <li>Links diretos para ementas e séries de indicadores.</li>
              <li>Registro de município, UF e data de apresentação.</li>
            </ul>
          </div>
          <div className="info-card">
            <p className="eyebrow">Privacidade e limites</p>
            <h3>Sem dados pessoais</h3>
            <p>
              Não coletamos dados sensíveis. O cálculo de similaridade e impacto é feito apenas sobre textos públicos e
              agregados.
            </p>
            <ul className="muted small">
              <li>Sem armazenamento de consultas pessoais ou cadastros.</li>
              <li>Logs restritos a métricas de uso para manter o serviço.</li>
              <li>Indicadores sempre agregados por município.</li>
            </ul>
          </div>
          <div className="info-card">
            <p className="eyebrow">Riscos conhecidos</p>
            <h3>Limitações e cuidados</h3>
            <p>
              Resultados dependem da cobertura dos dados e podem não refletir nuances locais. Use como apoio, não como
              decisão automática.
            </p>
            <ul className="muted small">
              <li>Indicadores podem ter defasagem temporal.</li>
              <li>Políticas parecidas em texto podem divergir em execução.</li>
              <li>Verifique aderência jurídica e orçamentária local.</li>
            </ul>
          </div>
          <div className="info-card">
            <p className="eyebrow">Contato</p>
            <h3>Dúvidas ou sugestões</h3>
            <p>
              Precisa de mais transparência ou quer enviar novos indicadores? Entre em contato para priorizarmos ajustes.
            </p>
            <ul className="muted small">
              <li>Preferências de indicadores por secretaria.</li>
              <li>Solicitações de novos filtros regionais.</li>
              <li>Reportes de inconsistências nos dados.</li>
            </ul>
          </div>
        </section>

        <section className="trust-strip">
          <div>
            <p className="eyebrow">Pronto para aplicar</p>
            <h3>Volte para a busca e selecione políticas</h3>
            <p className="muted">
              Use a busca guiada para encontrar precedentes, ativar indicadores e documentar seu plano de implantação.
            </p>
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
  );
}
