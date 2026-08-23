// M9 orchestrator feedback sink adapter (clean-room). FeedbackSink -> FeedbackService.
import type { FeedbackIntent } from "@fastwork/orchestrator";
import type { FeedbackService } from "../feedback-service.js";

export class OrchestratorFeedbackSink {
  constructor(private readonly service: FeedbackService) {}

  record(intent: FeedbackIntent): void {
    void this.service.handle(intent);
  }
}
