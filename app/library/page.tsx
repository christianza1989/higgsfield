"use client";

import { useMemo, useState } from "react";
import ResultGrid from "@/components/ResultGrid";
import { useJobs } from "@/components/useJobs";

export default function LibraryPage() {
  const [favorites, setFavorites] = useState(false);
  const { jobs, loaded, refresh } = useJobs(undefined, favorites);
  const [kind, setKind] = useState<"all" | "image" | "video">("all");
  const [model, setModel] = useState("all");
  const [query, setQuery] = useState("");
  const [clearing, setClearing] = useState(false);

  // Failed, blocked and cancelled jobs hold nothing worth keeping — Higgsfield
  // doesn't charge for them — so clearing is offered as a single action.
  const failedCount = useMemo(
    () => jobs.filter((j) => ["failed", "nsfw", "canceled"].includes(j.status)).length,
    [jobs],
  );

  async function clearFailed() {
    setClearing(true);
    try {
      await fetch("/api/jobs/failed", { method: "DELETE" });
      await refresh();
    } finally {
      setClearing(false);
    }
  }

  const models = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.model_name))).sort(),
    [jobs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.map(j => favorites ? { ...j, outputs: j.outputs.filter(g => g.favorite) } : j).filter(
      (j) =>
        (!favorites || j.outputs.length > 0) && (kind === "all" || j.kind === kind) &&
        (model === "all" || j.model_name === model) &&
        (!q || j.prompt.toLowerCase().includes(q)),
    );
  }, [jobs, kind, model, query, favorites]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-[68px] shrink-0 flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-edge-soft px-7 py-3.5">
        <h1 className="shrink-0 text-xl font-bold tracking-tight">Library</h1>
        <button onClick={() => setFavorites(!favorites)} className={`rounded-lg border border-edge px-3 py-1.5 text-xs ${favorites ? 'text-accent' : 'text-faint'}`}>★ Favorites</button>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search prompts…"
          className="ml-2 w-56 rounded-lg border border-edge-soft bg-panel-2 px-3 py-1.5 text-sm outline-none placeholder:text-faint focus:border-edge"
        />

        <div className="flex gap-1 rounded-lg border border-edge-soft bg-panel-2 p-0.5">
          {(["all", "image", "video"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-md px-2.5 py-1 text-xs capitalize transition-colors ${
                kind === k ? "bg-panel text-text" : "text-faint hover:text-muted"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-lg border border-edge-soft bg-panel-2 px-2.5 py-1.5 text-xs text-muted outline-none"
        >
          <option value="all">All models</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {failedCount > 0 && (
          <button
            onClick={clearFailed}
            disabled={clearing}
            className="ml-auto shrink-0 rounded-full border border-danger/30 bg-danger/5 px-3 py-1.5 text-xs text-danger transition-colors hover:border-danger/60 hover:bg-danger/10 disabled:opacity-50"
          >
            {clearing ? "Clearing…" : `Clear ${failedCount} failed`}
          </button>
        )}

        <p className={`shrink-0 text-xs text-faint ${failedCount > 0 ? "" : "ml-auto"}`}>
          {filtered.length} shown
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-7 py-6">
        <ResultGrid
          jobs={filtered}
          loaded={loaded}
          onChanged={refresh}
          emptyHint="Everything you generate is saved here, including a local copy of the file."
        />
      </div>
    </div>
  );
}
