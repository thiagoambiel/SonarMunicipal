import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import MinimalNav from "@/components/MinimalNav";

const primaryEmail = "thiago.ambiel@usp.br";
const secondaryEmail = "thiago.ambiel1@gmail.com";
const scholarProfile = "https://scholar.google.com.br/citations?hl=pt-BR&user=Bhxkr94AAAAJ";
const githubProfile = "https://github.com/thiagoambiel";
const icmcSite = "https://www.icmc.usp.br/";

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
            <div className="contact-avatar">
              <Image
                src="/author.png"
                alt="Foto de Thiago Ambiel"
                width={360}
                height={360}
                priority
              />
            </div>
            <div className="contact-info">
              <p className="eyebrow">Contato</p>
              <h1>Thiago Ambiel</h1>
              <p className="contact-role">
                <Link href={icmcSite} target="_blank" rel="noreferrer">
                  ICMC - USP
                </Link>
              </p>

              <div className="contact-lines">
                <div className="contact-line">
                  <span className="label">Email USP</span>
                  <Link href={`mailto:${primaryEmail}`}>{primaryEmail}</Link>
                </div>
                <div className="contact-line">
                  <span className="label">Email alternativo</span>
                  <Link href={`mailto:${secondaryEmail}`}>{secondaryEmail}</Link>
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
                <div className="contact-line">
                  <span className="label">Instituição</span>
                  <Link href={icmcSite} target="_blank" rel="noreferrer">
                    icmc.usp.br
                  </Link>
                </div>
              </div>

              <div className="contact-links">
                <Link className="contact-link" href={`mailto:${primaryEmail}`}>
                  Email USP
                </Link>
                <Link className="contact-link" href={scholarProfile} target="_blank" rel="noreferrer">
                  Google Scholar
                </Link>
                <Link className="contact-link" href={githubProfile} target="_blank" rel="noreferrer">
                  GitHub
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
