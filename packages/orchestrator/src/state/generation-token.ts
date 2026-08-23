// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

/**
 * Monotonic generation counter for a conversation. Advancing the token invalidates
 * in-flight or pending AI work that was issued against an earlier generation.
 */
export class GenerationToken {
  private value = 0;

  next(): number {
    this.value += 1;
    return this.value;
  }

  current(): number {
    return this.value;
  }

  /** Test/setup helper: seed the token at a fixed generation. */
  set(value: number): void {
    this.value = value;
  }
}