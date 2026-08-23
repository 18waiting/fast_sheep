// M6 app lifecycle helpers (offline). Pure logic for testability.
export function isReadyToShow(ready: boolean, hidden: boolean): boolean {
  return ready && !hidden;
}

export function shouldQuitOnAllClosed(testMode: boolean): boolean {
  return !testMode;
}
