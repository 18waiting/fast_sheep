// M6 renderer entrypoint (clean-room, plain TS/HTML/CSS).
import { mountApp } from "./app.js";

function start(): void {
  const root = document.getElementById("app");
  if (!root) throw new Error("missing #app mount node");
  mountApp(root);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
