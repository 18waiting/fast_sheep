// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

export interface PreSendRevalidationDecision {
  shouldRevalidate: boolean;
}

/**
 * Human-initiated sends revalidate a previously generated suggestion before it
 * leaves the workstation. Full-auto sends do not revalidate in this path.
 */
export class PreSendRevalidationPolicy {
  shouldRevalidate(mode: "human_review" | "full_auto", key: string): boolean {
    return mode === "human_review" && key === "Enter";
  }
}