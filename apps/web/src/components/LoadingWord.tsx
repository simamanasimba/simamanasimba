const WORD = "Loading";

/** Letters bounce in sequence, like each one is dropping into place to spell the word. Not translated — used everywhere as a language-agnostic loading indicator. */
export function LoadingWord({ className = "text-muted" }: { className?: string }) {
  return (
    <span className={className} role="status" aria-label="Loading">
      {WORD.split("").map((ch, i) => (
        <span key={i} className="loading-letter inline-block" style={{ animationDelay: `${i * 0.08}s` }}>
          {ch}
        </span>
      ))}
    </span>
  );
}
