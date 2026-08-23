// M7 PDD permission policy (clean-room): deny sensitive permissions by default.
export const SENSITIVE_PERMISSIONS = [
  "camera", "microphone", "geolocation", "notifications", "midi", "bluetooth",
  "usb", "serial", "screen", "hid", "clipboard-read", "media", "display-capture",
] as const;

export function pddPermissionDecision(permission: string): boolean {
  // Deny everything by default. No M7 platform flow requires a browser permission.
  void permission;
  return false;
}

export function isSensitivePermission(permission: string): boolean {
  return (SENSITIVE_PERMISSIONS as readonly string[]).includes(permission);
}
