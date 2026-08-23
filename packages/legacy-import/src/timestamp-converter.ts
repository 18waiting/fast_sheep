// M11 legacy timestamp conversion (clean-room). Legacy `YYYY-MM-DD HH:MM:SS` ->
// ISO-8601 UTC. If the legacy timezone is unknown an explicit `legacy_timezone`
// is required; UTC is never silently assumed.
import { LegacyImportError, IMPORT_ERROR_CODES } from "./errors.js";

const LEGACY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

export interface TimestampConversionResult {
  converted: string;
  timezone: string;
}

export function convertLegacyTimestamp(legacy: string, legacyTimezone?: string): TimestampConversionResult {
  const value = (legacy ?? "").trim();
  if (!value) {
    throw new LegacyImportError(IMPORT_ERROR_CODES.PARSE_ERROR, "empty timestamp");
  }
  // Already ISO-8601 with timezone -> canonicalize to UTC.
  if (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)) {
    const iso = new Date(value).toISOString();
    if (Number.isNaN(Date.parse(value))) {
      throw new LegacyImportError(IMPORT_ERROR_CODES.PARSE_ERROR, "invalid ISO timestamp: " + legacy);
    }
    return { converted: iso, timezone: "explicit" };
  }
  const m = LEGACY_PATTERN.exec(value);
  if (!m) {
    throw new LegacyImportError(IMPORT_ERROR_CODES.PARSE_ERROR, "unsupported legacy timestamp: " + legacy);
  }
  if (!legacyTimezone || !legacyTimezone.trim()) {
    throw new LegacyImportError(
      IMPORT_ERROR_CODES.VALIDATION_ERROR,
      "legacy timestamp has no timezone; explicit legacy_timezone required (never guessed)"
    );
  }
  // Interpret the naive local time in the explicit IANA timezone.
  let date: Date;
  try {
    date = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
    const offset = timezoneOffsetMs(legacyTimezone, date);
    date = new Date(date.getTime() - offset);
  } catch {
    throw new LegacyImportError(IMPORT_ERROR_CODES.VALIDATION_ERROR, "invalid legacy_timezone: " + legacyTimezone);
  }
  return { converted: date.toISOString(), timezone: legacyTimezone };
}

function timezoneOffsetMs(tz: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - date.getTime();
}
