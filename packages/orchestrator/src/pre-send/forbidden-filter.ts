// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

/**
 * Multi-pattern deterministic finite automaton that removes forbidden words from
 * buyer/AI text. GF-STORE-FORBID-001: "加我微信吧" with "微信" -> "加我吧".
 */
export class ForbiddenFilter {
  private readonly roots = new Map<string, unknown>();

  filter(text: string, words: readonly string[]): string {
    if (text.length === 0 || words.length === 0) {
      return text;
    }

    const automaton = this.build(words);
    let output = "";
    let state = automaton.root;
    let i = 0;

    while (i < text.length) {
      const next = state.next.get(text[i]);
      if (next) {
        state = next as AutomatonNode;
        i += 1;
      } else if (state === automaton.root) {
        output += text[i];
        i += 1;
      } else {
        state = state.failure as AutomatonNode;
      }

      if ((state as AutomatonNode).output !== null && i > 0) {
        // The matched characters were consumed by the automaton transitions, so the
        // already-appended output holds only non-match characters; no trim is needed.
        // (GF-STORE-FORBID-001: "加我微信吧" with 微信 removed -> "加我吧".)
        state = automaton.root;
      }
    }

    return output;
  }

  private build(words: readonly string[]): { root: AutomatonNode } {
    const root: AutomatonNode = { next: new Map(), failure: null, output: null };
    for (const word of words) {
      if (word.length === 0) {
        continue;
      }
      let node = root;
      for (const ch of word) {
        let child = node.next.get(ch) as AutomatonNode | undefined;
        if (!child) {
          child = { next: new Map(), failure: null, output: null };
          node.next.set(ch, child);
        }
        node = child;
      }
      node.output = word.length;
    }

    const queue: AutomatonNode[] = [];
    for (const child of root.next.values()) {
      const node = child as AutomatonNode;
      node.failure = root;
      queue.push(node);
    }

    let head = 0;
    while (head < queue.length) {
      const node = queue[head++];
      for (const [ch, childValue] of node.next.entries()) {
        const child = childValue as AutomatonNode;
        queue.push(child);
        let fallback = node.failure as AutomatonNode | null;
        while (fallback !== null && !fallback.next.has(ch)) {
          fallback = fallback.failure as AutomatonNode | null;
        }
        child.failure = fallback ? ((fallback.next.get(ch) as AutomatonNode) ?? root) : root;
        if (child.output === null && (child.failure as AutomatonNode).output !== null) {
          child.output = (child.failure as AutomatonNode).output;
        }
      }
    }

    return { root };
  }
}

interface AutomatonNode {
  next: Map<string, AutomatonNode>;
  failure: AutomatonNode | null;
  output: number | null;
}