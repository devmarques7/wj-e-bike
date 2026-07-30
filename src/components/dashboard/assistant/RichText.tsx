import { Fragment } from "react";

/**
 * Minimal inline markdown renderer for the assistant chat:
 * `**bold**` becomes a highlighted bold span and `` `code` `` a subtle mono chip.
 * Keeps line breaks intact — no external markdown dependency.
 */
export default function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-wj-green">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded-md bg-wj-green/10 px-1.5 py-0.5 font-mono text-[0.85em] text-wj-green"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
