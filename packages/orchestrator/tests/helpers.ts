// Shared test harness for @fastwork/orchestrator M5 tests.
import {
  ConversationOrchestrator,
  ReviewModePolicy,
  CountdownPolicy,
  TakeoverBreakerPolicy,
  PreSendRevalidationPolicy,
  SegmentedSendPolicy,
  FeedbackIntentPolicy,
} from "../dist/index.js";
import {
  VirtualClock,
  FakeAiEngineClient,
  FakePlatformAdapter,
  CapturingEventBus,
  FakeFeedbackSink,
  InMemoryConversationRepositoryPort,
} from "@fastwork/test-kit";

export interface Harness {
  orc: ConversationOrchestrator;
  clock: VirtualClock;
  ai: FakeAiEngineClient;
  platform: FakePlatformAdapter;
  bus: CapturingEventBus;
  feedback: FakeFeedbackSink;
  repo: InMemoryConversationRepositoryPort;
}

export function buildHarness(opts: {
  mode?: "human_review" | "full_auto";
  aiScript?: Array<{ reply?: string; generation?: number; decision?: unknown }>;
  breakerThreshold?: number;
  breakerWindowMs?: number;
  segmentIntervalMs?: number;
  countdownTickMs?: number;
  seed?: Record<string, Record<string, unknown>>;
  initialState?: Record<string, unknown>;
} = {}): Harness {
  const clock = new VirtualClock();
  const platform = new FakePlatformAdapter(clock);
  const bus = new CapturingEventBus();
  const feedback = new FakeFeedbackSink();
  const repo = new InMemoryConversationRepositoryPort();
  const ai = new FakeAiEngineClient(opts.aiScript ?? [{ reply: "亲,有的哦~" }]);

  const orc = new ConversationOrchestrator({
    aiEngineClient: ai,
    platformAdapter: platform,
    clock,
    eventBus: bus,
    feedbackSink: feedback,
    repository: repo,
    segmentIntervalMs: opts.segmentIntervalMs ?? 0,
    countdownTickMs: opts.countdownTickMs ?? 1000,
    policies: {
      reviewModePolicy: new ReviewModePolicy(),
      countdownPolicy: new CountdownPolicy(opts.countdownTickMs ?? 1000),
      takeoverBreakerPolicy: new TakeoverBreakerPolicy(opts.breakerThreshold ?? 2, opts.breakerWindowMs ?? 60000, clock),
      preSendRevalidationPolicy: new PreSendRevalidationPolicy(),
      segmentedSendPolicy: new SegmentedSendPolicy(),
      feedbackIntentPolicy: new FeedbackIntentPolicy(),
    },
    initialState: opts.initialState,
  });
  if (opts.mode) {
    void orc.onSetMode("s1", "c1", opts.mode);
  }
  return { orc, clock, ai, platform, bus, feedback, repo };
}

export function decisions(orc: ConversationOrchestrator): Array<Record<string, unknown>> {
  return orc.decisionsSnapshot() as Array<Record<string, unknown>>;
}

export function lastDecision(orc: ConversationOrchestrator): Record<string, unknown> {
  const d = decisions(orc);
  return d[d.length - 1] ?? {};
}
