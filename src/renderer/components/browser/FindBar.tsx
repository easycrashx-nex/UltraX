import type { FindInPageResult } from "@shared/types";
import { CaseSensitive, ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FindBarProps = {
  open: boolean;
  tabId: string;
  onClose: () => void;
};

const EMPTY_RESULT: FindInPageResult = {
  requestId: 0,
  activeMatchOrdinal: 0,
  matches: 0,
  finalUpdate: true,
};

export function FindBar({ open, tabId, onClose }: FindBarProps) {
  const [query, setQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [result, setResult] = useState<FindInPageResult>(EMPTY_RESULT);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => window.ultraX.onFindInPageResult(setResult), []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setResult(EMPTY_RESULT);
    const timeout = window.setTimeout(() => {
      void window.ultraX.findInPage(query, { matchCase, findNext: true });
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [matchCase, open, query, tabId]);

  if (!open) return null;

  const move = (forward: boolean) => {
    if (!query.trim()) return;
    void window.ultraX.findInPage(query, { matchCase, findNext: false, forward });
  };

  return (
    <section
      data-testid="find-bar"
      aria-label="Find in page"
      className="find-bar glass-panel fixed right-3 top-[116px] z-[55] flex h-11 w-[360px] items-center gap-1 rounded-lg px-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        } else if (event.key === "Enter") {
          event.preventDefault();
          move(!event.shiftKey);
        }
      }}
    >
      <input
        ref={inputRef}
        aria-label="Find in page"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find in page"
        className="min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <span aria-live="polite" className="w-12 text-center text-xs tabular-nums text-muted-foreground">
        {query ? `${result.activeMatchOrdinal} / ${result.matches}` : "0 / 0"}
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Match case"
        aria-pressed={matchCase}
        title="Match case"
        onClick={() => setMatchCase((value) => !value)}
        className={cn("size-8", matchCase && "bg-primary/15 text-primary")}
      >
        <CaseSensitive aria-hidden="true" />
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label="Previous match" title="Previous match" onClick={() => move(false)} className="size-8">
        <ChevronUp aria-hidden="true" />
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label="Next match" title="Next match" onClick={() => move(true)} className="size-8">
        <ChevronDown aria-hidden="true" />
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label="Close find" title="Close find" onClick={onClose} className="size-8">
        <X aria-hidden="true" />
      </Button>
    </section>
  );
}
