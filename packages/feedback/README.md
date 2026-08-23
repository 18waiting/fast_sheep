# @fastwork/feedback

Clean-room M9 (TASK-024) Main-side FeedbackService. Records FeedbackIntent to the
FeedbackRecord store (Main single-writer), applies knowledge effects through the M2
worker RPC `feedback.apply` (Worker single-writer for knowledge), and tracks durable
effect status with idempotent, bounded retry. NO_SAVE performs zero worker knowledge
calls. Platform-neutral; no Learning/Review/Audit/Optimization.
