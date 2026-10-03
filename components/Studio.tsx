"use client";

import PromptBar from "./PromptBar";
import ResultGrid from "./ResultGrid";
import { useJobs } from "./useJobs";

/** Image and Video pages are the same surface over a different model set. */
export default function Studio({ kind }: { kind: "image" | "video" }) {
  const { jobs, loaded, refresh } = useJobs(kind);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-edge-soft px-7">
        <h1 className="text-xl font-bold tracking-tight capitalize">{kind}</h1>
        <p className="text-xs text-faint">
          {jobs.length} {jobs.length === 1 ? "generation" : "generations"}
        </p>
      </header>

      {/* Bottom padding clears the floating composer. */}
      <div className="flex-1 overflow-y-auto px-7 pt-6 pb-72">
        <ResultGrid
          jobs={jobs}
          loaded={loaded}
          onChanged={refresh}
          emptyTitle={kind === "image" ? "No images yet" : "No videos yet"}
          emptyHint={
            kind === "image"
              ? "Describe an image below and pick a model to get started."
              : "Describe a shot below, or attach an image to animate it."
          }
        />
      </div>

      <PromptBar kind={kind} onSubmitted={refresh} />
    </div>
  );
}
