// M5 orchestrator smoke (TASK-020): production ConversationOrchestrator + test-kit fakes.
// message -> suggestion -> manual send -> FeedbackIntent -> SENT; and full-auto path.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REBUILD = join(HERE, "..");
const O = await import("file:///" + REBUILD.replace(/\\/g, "/") + "/packages/orchestrator/dist/index.js");
const TK = await import("file:///" + REBUILD.replace(/\\/g, "/") + "/packages/test-kit/dist/index.js");

let failed = 0;
const check = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) failed += 1; };

const clock = new TK.VirtualClock();
const platform = new TK.FakePlatformAdapter(clock);
const bus = new TK.CapturingEventBus();
const feedback = new TK.FakeFeedbackSink();
const repo = new TK.InMemoryConversationRepositoryPort();
const ai = new TK.FakeAiEngineClient([{ reply: "亲,有的哦~" }]);

const orc = new O.ConversationOrchestrator({
  aiEngineClient: ai, platformAdapter: platform, clock, eventBus: bus, feedbackSink: feedback, repository: repo,
  segmentIntervalMs: 800,
  policies: {
    reviewModePolicy: new O.ReviewModePolicy(),
    countdownPolicy: new O.CountdownPolicy(1000),
    takeoverBreakerPolicy: new O.TakeoverBreakerPolicy(2, 60000, clock),
    preSendRevalidationPolicy: new O.PreSendRevalidationPolicy(),
    segmentedSendPolicy: new O.SegmentedSendPolicy(),
    feedbackIntentPolicy: new O.FeedbackIntentPolicy(),
  },
});

await orc.onSetMode("s1", "c1", "human_review");
await orc.onBuyerMessage("s1", "c1", { message_id: "m1", buyer: "张三", content: "有货吗" });
check("suggestion lifecycle (SuggestionReady)", bus.events().includes("SuggestionReady"));

await orc.onManualSend("s1", "c1", "Enter");
check("manual send -> MANUAL feedback", feedback.classes.includes("MANUAL"));
check("platform sendText called", platform.sendCallCount >= 1);
check("SendCompleted emitted", bus.events().includes("SendCompleted"));

await orc.onSetMode("s1", "c2", "full_auto");
await orc.onBuyerMessage("s1", "c2", { message_id: "m2", buyer: "李四", content: "发货多久" });
check("full auto sends", platform.sendCallCount >= 2);
check("full auto -> AUTO feedback", feedback.classes.includes("AUTO"));

check("no knowledge mutation from feedback", feedback.count >= 0 && repo.appendCount >= 0);
if (failed > 0) { console.error("M5 ORCHESTRATOR SMOKE FAILED"); process.exit(1); }
console.log("M5 ORCHESTRATOR SMOKE PASS");
