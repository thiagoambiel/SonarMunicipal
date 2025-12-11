import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import MinimalNav from "@/components/MinimalNav";

const primaryEmail = "thiago.ambiel@usp.br";
const secondaryEmail = "thiago.ambiel1@gmail.com";
const scholarProfile = "https://scholar.google.com.br/citations?hl=pt-BR&user=Bhxkr94AAAAJ";
const githubProfile = "https://github.com/thiagoambiel";
const icmcSite = "https://www.icmc.usp.br/";
const contactSubject = encodeURIComponent("Contato sobre o CityManager");
const contactBody = encodeURIComponent("Olá Thiago, tudo bem?\n\nGostaria de falar sobre: ");

export const metadata: Metadata = {
  title: "Contato - CityManager",
  description: "Fale com Thiago Ambiel, desenvolvedor do CityManager e pesquisador no ICMC-USP.",
};

export default function ContactPage() {
  return (
    <div className="landing">
      <MinimalNav active="contact" />

      <main className="landing-body">
        <section className="contact-section">
          <div className="contact-minimal">
            <div className="contact-portrait">
              <div className="contact-avatar">
                <Image
                  src="/author.png"
                  alt="Foto de Thiago Ambiel, criador do CityManager"
                  width={360}
                  height={360}
                  priority
                />
              </div>
              <h1 className="contact-name">Thiago Ambiel</h1>
              <p className="contact-tag">Criador do CityManager</p>
            </div>
            <div className="contact-info">
              <p className="eyebrow">Contato</p>

              <p className="contact-bio">
                Sou pesquisador no ICMC-USP, trabalhando com automação de geração de políticas públicas usando métodos de
                inteligência artificial para apoiar a formulação e avaliação em municípios. O CityManager aproxima dados,
                pesquisa acadêmica e gestores de cidades.
              </p>

              <div className="contact-help">
                <p className="contact-help-title">Como posso ajudar</p>
                <ul>
                  <li>Apoio em projetos de dados para gestão municipal.</li>
                  <li>Parcerias de pesquisa ou extensão universitária.</li>
                  <li>Colaboração em projetos de IA para políticas públicas.</li>
                </ul>
              </div>

              <div className="contact-lines">
                <div className="contact-line">
                  <span className="label">Email principal (USP)</span>
                  <Link href={`mailto:${primaryEmail}`}>{primaryEmail}</Link>
                </div>
                <div className="contact-line">
                  <span className="label">Email alternativo (pessoal)</span>
                  <Link href={`mailto:${secondaryEmail}`}>{secondaryEmail}</Link>
                </div>
                <div className="contact-line">
                  <span className="label">Instituição</span>
                  <Link className="contact-inline-link" href={icmcSite} target="_blank" rel="noreferrer">
                    <span className="contact-icon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 10.5 12 6l8 4.5M6 11.5V18H4v-6.5M20 11.5V18h-2v-6.5M10 10v8m4-8v8"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    ICMC-USP
                  </Link>
                </div>
                <div className="contact-line">
                  <span className="label">Google Scholar</span>
                  <Link className="contact-inline-link" href={scholarProfile} target="_blank" rel="noreferrer">
                    <span className="contact-icon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 3 4.5 8v13H19.5V8L12 3Z" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M8.5 14.5H15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M8.5 11.5H15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    Perfil
                  </Link>
                </div>
                <div className="contact-line">
                  <span className="label">GitHub</span>
                  <Link className="contact-inline-link" href={githubProfile} target="_blank" rel="noreferrer">
                    <span className="contact-icon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5c0-.9-.3-1.5-.6-1.8 2-.2 4.6-1 4.6-5 0-1-.3-1.8-.9-2.6.2-.7.2-1.6-.1-2.6 0 0-.8-.3-2.7 1-.8-.2-1.6-.3-2.3-.3-.7 0-1.5.1-2.3.3-1.9-1.3-2.7-1-2.7-1-.3 1-.3 1.9-.1 2.6-.6.8-.9 1.6-.9 2.6 0 4 2.6 4.8 4.6 5-.2.2-.4.6-.5 1.1-.4.2-1.4.5-2-.5 0 0-.4-.7-1.3-.7"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    thiagoambiel
                  </Link>
                </div>
              </div>

              <p className="contact-response">Geralmente respondo em até 2 dias úteis.</p>

              <div className="contact-actions">
                <Link className="contact-cta" href={`mailto:${primaryEmail}?subject=${contactSubject}&body=${contactBody}`}>
                  <span className="contact-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 6.5 10.8 11c.73.5 1.67.5 2.4 0L20 6.5"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <rect x="4" y="5" width="16" height="14" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  </span>
                  Falar sobre o CityManager
                </Link>
                <Link className="contact-link" href={scholarProfile} target="_blank" rel="noreferrer">
                  <span className="contact-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 3 4.5 8v13H19.5V8L12 3Z" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M8.5 14.5H15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M8.5 11.5H15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  Ver perfil no Google Scholar
                </Link>
                <Link className="contact-link" href={githubProfile} target="_blank" rel="noreferrer">
                  <span className="contact-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5c0-.9-.3-1.5-.6-1.8 2-.2 4.6-1 4.6-5 0-1-.3-1.8-.9-2.6.2-.7.2-1.6-.1-2.6 0 0-.8-.3-2.7 1-.8-.2-1.6-.3-2.3-.3-.7 0-1.5.1-2.3.3-1.9-1.3-2.7-1-2.7-1-.3 1-.3 1.9-.1 2.6-.6.8-.9 1.6-.9 2.6 0 4 2.6 4.8 4.6 5-.2.2-.4.6-.5 1.1-.4.2-1.4.5-2-.5 0 0-.4-.7-1.3-.7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  Ver perfil no GitHub
                </Link>
                <Link className="contact-link" href={icmcSite} target="_blank" rel="noreferrer">
                  <span className="contact-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 10.5 12 6l8 4.5M6 11.5V18H4v-6.5M20 11.5V18h-2v-6.5M10 10v8m4-8v8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  Site do ICMC-USP
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
