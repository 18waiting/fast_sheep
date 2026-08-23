// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

export type FeedbackIntentClass = "MANUAL" | "AUTO" | "NO_SAVE";

export class FeedbackIntentPolicy {
  classify(mode: "human_review" | "full_auto", key: string): FeedbackIntentClass {
    if (key === "Alt+Enter") {
      return "NO_SAVE";
    }
    if (key === "Enter") {
      return "MANUAL";
    }
    if (mode === "full_auto" || key === "countdown" || key === "auto") {
      return "AUTO";
    }
    return "MANUAL";
  }
}