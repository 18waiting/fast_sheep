// M8 shared platform permission policy (clean-room): deny by default.
export const SENSITIVE_PERMISSIONS = [
  "camera", "microphone", "geolocation", "notifications", "midi", "bluetooth",
  "usb", "serial", "screen", "hid", "clipboard-read", "media", "display-capture",
] as const;

export function platformPermissionDecision(_permission: string): boolean {
  return false;
}
