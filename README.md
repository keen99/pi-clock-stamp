# pi-clock-stamp

A [pi](https://pi.dev) extension that injects a fresh one-line timestamp into the system prompt every turn, so the model always knows the current wall-clock time.

![release-watch](https://github.com/keen99/pi-clock-stamp/actions/workflows/release-watch.yml/badge.svg)

```
Now: 2026-10-08 13:47 EDT
```

LLMs have no clock. Every "when did that happen" or "how long has it been" answer is a guess without one. This stamp re-injects per turn via `before_agent_start`, so it never goes stale the way a session-start injection would. Cost: ~12 tokens/turn.

## Install

```
pi install git:github.com/keen99/pi-clock-stamp
```

## License

MIT
