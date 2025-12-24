import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projetos de Lei",
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
