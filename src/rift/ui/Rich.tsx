import { Fragment } from "react";

/**
 * Renders lesson text with a tiny, safe subset of Markdown: paragraphs, **bold**, *emphasis* and
 * `code`. Content authors write plain YAML strings; nothing here interprets HTML.
 */
export function Rich({ text, inline = false }: { text: string; inline?: boolean }) {
  if (inline) return <>{renderInline(text.replace(/\s*\n\s*/g, " "))}</>;
  const paragraphs = text.trim().split(/\n\s*\n/);
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i}>{renderInline(p.replace(/\s*\n\s*/g, " "))}</p>
      ))}
    </>
  );
}

const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;

function renderInline(text: string) {
  const parts = text.split(TOKEN);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.88em] text-flow">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
