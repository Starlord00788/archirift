/** A tiny syntax highlighter for the languages lessons use. */
export type Language = "java" | "ts" | "python" | "sql" | "text" | "http" | "yaml";

const KEYWORDS: Record<Language, string[]> = {
  java: "abstract boolean break case catch class default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return static super switch synchronized this throw throws try void volatile while var true false record sealed permits".split(" "),
  ts: "abstract as async await boolean break case catch class const constructor default else enum export extends false finally for from function if implements import in instanceof interface let new null number private protected public readonly return static string super switch this throw true try type undefined void while".split(" "),
  python: "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return self True try while with yield".split(" "),
  sql: "select from where insert into values update set delete create table index on primary key foreign references join left right inner outer group by order having limit and or not null unique begin commit rollback transaction as".split(" "),
  text: [],
  http: "GET POST PUT PATCH DELETE HTTP".split(" "),
  yaml: [],
};

export type Token = { kind: "keyword" | "string" | "comment" | "number" | "type" | "annotation" | "plain"; text: string };

const COMMENT: Record<Language, string> = {
  java: String.raw`\/\/.*|\/\*[\s\S]*?\*\/`,
  ts: String.raw`\/\/.*|\/\*[\s\S]*?\*\/`,
  python: "#.*",
  yaml: "#.*",
  sql: "--.*",
  text: "(?!)",
  http: "(?!)",
};

const patterns = new Map<Language, RegExp>();
function patternFor(language: Language) {
  let p = patterns.get(language);
  if (!p) {
    const strings = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'` + "|`[^`]*`";
    p = new RegExp(String.raw`(${COMMENT[language]})|(${strings})|(@\w+)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)`, "g");
    patterns.set(language, p);
  }
  return p;
}

export function tokenize(line: string, language: Language): Token[] {
  const keywords = new Set(KEYWORDS[language].map((k) => (language === "sql" ? k.toLowerCase() : k)));
  const out: Token[] = [];
  let last = 0;
  for (const m of line.matchAll(patternFor(language))) {
    if (m.index > last) out.push({ kind: "plain", text: line.slice(last, m.index) });
    const [text, comment, string, annotation, number, word] = m;
    if (comment) out.push({ kind: "comment", text });
    else if (string) out.push({ kind: "string", text });
    else if (annotation) out.push({ kind: "annotation", text });
    else if (number) out.push({ kind: "number", text });
    else if (word) {
      const k = language === "sql" ? word.toLowerCase() : word;
      if (keywords.has(k)) out.push({ kind: "keyword", text });
      else if (/^[A-Z][A-Za-z0-9]*$/.test(word) && language !== "sql" && language !== "text") out.push({ kind: "type", text });
      else out.push({ kind: "plain", text });
    } else out.push({ kind: "plain", text });
    last = m.index + text.length;
  }
  if (last < line.length) out.push({ kind: "plain", text: line.slice(last) });
  return out;
}
