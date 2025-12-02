const STOPWORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "para",
  "pra",
  "pro",
  "por",
  "ao",
  "aos",
  "à",
  "às",
  "e",
]);

const stripPunctuation = (text: string): string => {
  return text.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
};

const isAccent = (ch: string): boolean => Boolean(ch.match(/\p{Mn}/u));

export const normalizeAndTokenize = (text: string): string[] => {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((ch) => !isAccent(ch))
    .join("")
    .replace(/\n/g, " ");

  const cleaned = stripPunctuation(normalized);
  return cleaned.split(" ").filter((token) => token && !STOPWORDS.has(token));
};

export const jaccardSimilarity = (tokensA: Iterable<string>, tokensB: Iterable<string>): number => {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (setA.size === 0 && setB.size === 0) return 1;
  const inter = [...setA].filter((token) => setB.has(token)).length;
  const uni = new Set([...setA, ...setB]).size || 1;
  return inter / uni;
};
