// M8 Doudian status projector (clean-room). Presentation-only status projection.
import type { StatusView } from "../platform-session-coordinator.js";

export function projectDoudianStatus(status: StatusView | null): StatusView | null {
  if (!status) return null;
  return { ...status, platform: "doudian" };
}
