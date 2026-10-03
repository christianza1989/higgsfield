/**
 * Zinho Automates monogram.
 *
 * Z and A locked as a single pair — same cap height, same weight, cut as solid
 * shapes so neither letter outranks the other. Drawn on a 24 grid and checked
 * down to 16px, where lighter or stacked treatments stop being readable.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M2.6 5h9v2.9L6.4 16.1h5.2V19h-9v-2.9L7.8 7.9H2.6z" />
      <path d="M14.6 5h2.2l4 14h-3l-.7-2.7h-4.8L11.6 19h-3zm.1 4.2-1.5 5.3h3z" />
    </svg>
  );
}

/** Mark in its gradient tile, as it appears in the sidebar and on the home page. */
export function LogoTile({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`brand-gradient grid shrink-0 place-items-center rounded-[10px] text-accent-ink shadow-[0_0_22px_-4px_var(--glow)] ${className}`}
    >
      <Logo className="size-[62%]" />
    </span>
  );
}
