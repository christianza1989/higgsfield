"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useJobs } from "@/components/useJobs";
import JustifiedRows from "@/components/JustifiedRows";
import { aspectValue, formatBytes, formatUsd, isActive, mediaUrl, timeAgo } from "@/lib/shared";
import { AFFILIATE, BRAND } from "@/lib/brand";
import { LogoTile } from "@/components/Logo";

interface Stats {
  today: { usd: number; count: number };
  month: { usd: number; count: number };
  allTime: { usd: number; count: number };
  outputs: number;
  diskBytes: number;
  active: number;
  spendCap: string;
}

export default function HomePage() {
  const { jobs, loaded } = useJobs();
  const [stats, setStats] = useState<Stats | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      const [s, c] = await Promise.all([
        fetch("/api/stats", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      setStats(s);
      setConfigured(c?.configured ?? false);
    }
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  const running = jobs.filter(isActive);
  const recent = jobs.filter((j) => j.outputs.length).slice(0, 12);

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex h-[68px] items-center justify-between border-b border-edge-soft px-7">
        <h1 className="text-xl font-bold tracking-tight">Home</h1>
        <p className="hidden text-xs text-faint sm:block">{BRAND.tagline}</p>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-7">
        {configured === false && (
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3.5 transition-colors hover:border-accent/50"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">→</span>
            <div>
              <p className="text-sm font-semibold">Connect a generation provider</p>
              <p className="text-xs text-faint">
                Configure Higgsfield or OpenRouter in Settings to start generating.
              </p>
            </div>
          </Link>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Spent today" value={formatUsd(stats?.today.usd ?? 0)} sub={`${stats?.today.count ?? 0} generations`} />
          <Stat label="This month" value={formatUsd(stats?.month.usd ?? 0)} sub={stats?.spendCap ? `cap ${formatUsd(Number(stats.spendCap))}` : "no cap set"} />
          <Stat label="All time" value={formatUsd(stats?.allTime.usd ?? 0)} sub={`${stats?.allTime.count ?? 0} jobs`} />
          <Stat label="Stored locally" value={formatBytes(stats?.diskBytes ?? 0)} sub={`${stats?.outputs ?? 0} files`} />
        </section>

        <a
          href={AFFILIATE.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center gap-2.5 rounded-2xl border border-accent/25 bg-accent/[0.04] px-5 py-5 text-center transition-all duration-200 hover:border-accent/50 hover:bg-accent/[0.08]"
        >
          <LogoTile className="size-10" />
          <span>
            <span className="block text-base font-bold tracking-tight text-text">
              {AFFILIATE.label}
              <span className="ml-1.5 inline-block text-faint transition-transform duration-200 group-hover:translate-x-1">
                &rarr;
              </span>
            </span>
            <span className="mt-1 block font-mono text-xs text-accent">{AFFILIATE.display}</span>
          </span>
        </a>

        <section className="grid gap-3 sm:grid-cols-2">
          <Tile
            href="/image"
            title="Generate an image"
            body="Soul, Soul Cinema, Recraft V4.1, Popcorn, Soul Reference, Soul Character."
          />
          <Tile
            href="/video"
            title="Generate a video"
            body="Kling 2.5 Turbo Pro, Hailuo 02, Seedance 2.5, Wan 2.5, and more."
          />
        </section>

        {running.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold tracking-wide text-faint uppercase">
              In progress
            </h2>
            <div className="space-y-2">
              {running.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 rounded-xl border border-edge-soft bg-panel px-4 py-3"
                >
                  <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />
                  <p className="min-w-0 flex-1 truncate text-sm text-muted">{job.prompt}</p>
                  <span className="shrink-0 text-xs text-faint">{job.model_name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-faint uppercase">Recent</h2>
            <Link href="/library" className="text-xs text-muted hover:text-text">
              View library →
            </Link>
          </div>

          {loaded && !recent.length ? (
            <p className="rounded-xl border border-dashed border-edge-soft px-4 py-10 text-center text-sm text-faint">
              Your generations will show up here.
            </p>
          ) : (
            <JustifiedRows
              targetHeight={118}
              gap={10}
              items={recent.map((job, i) => {
                const gen = job.outputs[0];
                const src = mediaUrl(gen);
                return {
                  key: job.id,
                  ratio: aspectValue(job),
                  render: (style: React.CSSProperties) => (
                    <Link
                      key={job.id}
                      href="/library"
                      title={job.prompt}
                      style={{ ...style, "--i": i } as React.CSSProperties}
                      className="rise group relative block overflow-hidden rounded-xl border border-edge-soft bg-panel-2"
                    >
                      {src && gen.kind === "video" ? (
                        <video src={src} muted playsInline preload="metadata" className="size-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        src && <img src={src} alt={job.prompt} loading="lazy" className="size-full object-cover" />
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2 pt-6 pb-1.5 text-2xs text-white/70">
                        {timeAgo(job.created_at)}
                      </span>
                    </Link>
                  ),
                };
              })}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-edge-soft bg-panel px-4 py-3.5">
      <p className="text-xs text-faint">{label}</p>
      <p className="mt-1 font-mono text-xl tracking-tight text-text">{value}</p>
      <p className="mt-0.5 text-2xs text-faint">{sub}</p>
    </div>
  );
}

function Tile({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-edge-soft bg-panel px-4 py-4 transition-colors hover:border-edge"
    >
      <p className="text-base font-semibold text-text">
        {title}
        <span className="ml-1.5 inline-block text-faint transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </p>
      <p className="mt-1 text-xs leading-snug text-faint">{body}</p>
    </Link>
  );
}
