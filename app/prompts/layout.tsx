import type { Metadata } from 'next';

// Also applies when the user navigates here with the client-side router.
export const metadata: Metadata = { referrer: 'no-referrer' };

export default function PromptsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
