// M8 JD status projector (clean-room). Presentation-only status projection.
import type { StatusView } from "../platform-session-coordinator.js";

export function projectJDStatus(status: StatusView | null): StatusView | null {
  if (!status) return null;
  return { ...status, platform: "jd" };
}
