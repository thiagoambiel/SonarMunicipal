export const PROJECTS_SEARCH_STORAGE_KEY = "projects-search-state-v1";

export const clearProjectsSearchState = () => {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(PROJECTS_SEARCH_STORAGE_KEY);
  } catch (error) {
    console.error("Erro ao limpar estado salvo da busca de projetos", error);
  }
};
