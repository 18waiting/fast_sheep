// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

export type ReviewMode = "human_review" | "full_auto";

export class ReviewModePolicy {
  isFullAuto(mode: ReviewMode): boolean {
    return mode === "full_auto";
  }

  holdsForReview(mode: ReviewMode): boolean {
    return mode === "human_review";
  }

  /** Decision emitted when a generated suggestion is first made available. */
  suggestionDecision(mode: ReviewMode): "suggestion_ready" {
    return "suggestion_ready";
  }
}