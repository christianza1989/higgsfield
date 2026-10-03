/** Branding and outbound links, kept in one place so they're easy to change. */

export const BRAND = {
  name: "Zinho Automates",
  short: "Zinho",
  tagline: "Pay-per-generation image and video studio",
};

/**
 * Where the home-page banner sends people to create a key.
 *
 * `console.higgsfield.ai` is the real API console — the authentication docs
 * point there, and `cloud.higgsfield.ai` redirects to it. Swap in a referral
 * URL here when one is live; note `higgsfield.com` redirects to
 * `higgsfield.ai`, so an affiliate path has to exist on the `.ai` domain.
 */
export const AFFILIATE = {
  label: "Grab Your API Keys",
  display: "higgsfield.ai",
  href: "https://higgsfield.ai/?fpr=zinho-automates",
};
