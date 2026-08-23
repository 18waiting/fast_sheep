// M5 test fake: feedback intent sink (no knowledge mutation).
export interface FeedbackIntentLike { class: string; trust?: string; conversation_id?: string; reply?: string }

export class FakeFeedbackSink {
  intents: FeedbackIntentLike[] = [];
  record(intent: FeedbackIntentLike): void { this.intents.push(intent); }
  get classes(): string[] { return this.intents.map((i) => i.class); }
  get count(): number { return this.intents.length; }
}
