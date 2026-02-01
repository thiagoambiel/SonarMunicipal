"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { clearProjectsSearchState } from "@/lib/projectsSearchStorage";

type NavSection = "home" | "projects" | "methodology" | "contact";

type NavItem = {
  key: NavSection;
  href: string;
  label: string;
  onClick?: () => void;
};

const navItems: NavItem[] = [
  { key: "home", href: "/", label: "Sugestão de Políticas Públicas" },
  { key: "projects", href: "/projects", label: "Projetos de Lei", onClick: clearProjectsSearchState },
  { key: "methodology", href: "/methodology", label: "Metodologia" },
  { key: "contact", href: "/contact", label: "Contato" },
];

const deriveSectionFromPath = (pathname: string | null): NavSection => {
  if (!pathname) return "home";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/methodology")) return "methodology";
  if (pathname.startsWith("/contact")) return "contact";
  return "home";
};

export default function MinimalNav({ active }: { active?: NavSection }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentSection = useMemo(
    () => active ?? deriveSectionFromPath(pathname),
    [active, pathname],
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="minimal-nav">
      <div className="nav-brand">
        <Link className="nav-title" href="/">
          <Image
            src="/logo.png"
            alt="Sonar Municipal"
            width={160}
            height={60}
            className="nav-logo"
            priority
          />
        </Link>
      </div>

      <button
        type="button"
        className="nav-toggle"
        aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        <span className={`nav-toggle-icon ${menuOpen ? "open" : ""}`} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <nav className={`nav-links-minimal ${menuOpen ? "open" : ""}`}>
        {navItems.map((item) => (
          <Link
            key={item.key}
            className={`nav-link-minimal ${item.key === currentSection ? "active" : ""}`}
            href={item.href}
            onClick={() => {
              item.onClick?.();
              setMenuOpen(false);
            }}
          >
            {item.label}
          </Link>
        ))}
        <a
          className="nav-link-minimal nav-repo-link"
          href="https://github.com/thiagoambiel/SonarMunicipal"
          target="_blank"
          rel="noreferrer"
          onClick={() => setMenuOpen(false)}
        >
          <span className="sr-only">Repositório no GitHub</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.43 7.86 10.96.57.1.78-.25.78-.55v-2.1c-3.2.7-3.88-1.54-3.88-1.54-.53-1.35-1.3-1.71-1.3-1.71-1.06-.73.08-.72.08-.72 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.72 1.27 3.39.97.1-.75.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.3 1.19-3.11-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.19.92-.26 1.91-.39 2.9-.39.98 0 1.98.13 2.9.39 2.2-1.5 3.18-1.19 3.18-1.19.63 1.59.23 2.77.11 3.06.74.81 1.19 1.85 1.19 3.11 0 4.43-2.69 5.4-5.25 5.68.42.36.79 1.08.79 2.18v3.23c0 .3.2.66.79.55 4.57-1.53 7.86-5.86 7.86-10.96C23.5 5.74 18.27.5 12 .5Z" />
          </svg>
        </a>
      </nav>
    </header>
  );
}
