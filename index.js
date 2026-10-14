import { formatNow } from "./stamp.js";

// Injects a fresh one-line timestamp into the system prompt every turn,
// so the model always knows the current wall-clock time.
//
// before_agent_start fires per turn and its return value appends to the
// chained system prompt, so the stamp can never go stale the way a
// session-start injection would.

export default function clockStamp(pi) {
  pi.on("before_agent_start", async (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${formatNow()}`,
  }));
}

export { formatNow } from "./stamp.js";
