// M10 optimization guards (clean-room): empty / length / html / tailwind.
const HTML_RE = /<[a-zA-Z/][^>]*>/;
const TAILWIND_RE = /class\s*=\s*["'][^"']*--tw-/;
export interface GuardResult { dirty: boolean; reason?: string }
export function guardDetail(candidate: string, limit = 20000): GuardResult {
  if (!candidate) return { dirty: true, reason: "empty" };
  if (candidate.length > limit) return { dirty: true, reason: "length" };
  if (HTML_RE.test(candidate)) return { dirty: true, reason: "html" };
  if (TAILWIND_RE.test(candidate)) return { dirty: true, reason: "tailwind" };
  return { dirty: false };
}
