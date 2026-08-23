// M8 Kuaishou status projector (clean-room). Presentation-only status projection.
import type { StatusView } from "../platform-session-coordinator.js";

export function projectKuaishouStatus(status: StatusView | null): StatusView | null {
  if (!status) return null;
  return { ...status, platform: "kuaishou" };
}
