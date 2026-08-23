// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

import type { TransferDecision } from "../ports/ai-engine-client.js";

export interface SuggestionState {
  reply: string;
  generation: number;
  createdAt: number;
  mode?: "human_review" | "full_auto";
  status: "pending" | "sent" | "cancelled";
  decision?: TransferDecision;
  [key: string]: unknown;
}