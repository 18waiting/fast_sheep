# @fastwork/background-jobs

Clean-room M10 (TASK-025) Main-side BackgroundJobManager. Main owns background_jobs
(create/update/cancel/progress/recovery); the worker writes zero background_jobs.
Cooperative cancellation via M2; crash recovery never blindly replays non-idempotent
mutation jobs. Progress is monotonic.
