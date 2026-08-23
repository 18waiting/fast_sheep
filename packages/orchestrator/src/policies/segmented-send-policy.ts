// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

export interface SegmentedSendPart {
  text: string;
  virtualTimeMs: number;
}

export class SegmentedSendPolicy {
  /**
   * Split a reply on the "###" segment separator. Empty and pure-separator
   * segments are skipped; SEG-002 ("###") therefore yields no send calls.
   * Virtual timestamps are relative to the start of the send.
   */
  split(reply: string, intervalMs: number): SegmentedSendPart[] {
    if (typeof reply !== "string" || reply.length === 0) {
      return [];
    }

    const parts = reply.split("###");
    const nonEmpty = parts.filter((part) => part.length > 0);
    const step = intervalMs > 0 ? intervalMs : 0;

    return nonEmpty.map((text, index) => ({
      text,
      virtualTimeMs: index * step,
    }));
  }
}