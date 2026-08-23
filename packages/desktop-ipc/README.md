# @fastwork/desktop-ipc

Clean-room M6 typed IPC foundation (TASK-021): channel constants, request/response/event
types, schema validation via @fastwork/contracts, normalized desktop errors, and the
FastWorkDesktopAPI preload surface. No Electron classes in public types.

Channels: desktop.bootstrap, shops.list, orchestrator.snapshot, worker.status (queries);
orchestrator.set_mode, orchestrator.manual_send, orchestrator.no_save_send,
orchestrator.cancel, orchestrator.focus (commands); orchestrator.event,
worker.status_changed, shops.changed (events). No generic raw channel.

Scripts: pnpm --filter @fastwork/desktop-ipc typecheck|test|build
