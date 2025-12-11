"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { clearProjectsSearchState } from "@/lib/projectsSearchStorage";

type NavSection = "home" | "projects" | "methodology" | "contact";

type NavItem = {
  key: NavSection;
  href: string;
  label: string;
  onClick?: () => void;
};

const navItems: NavItem[] = [
  { key: "home", href: "/", label: "Gerador de Políticas Públicas" },
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
          CityManager
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
      </nav>
    </header>
  );
}
