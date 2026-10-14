import test from "node:test";
import assert from "node:assert/strict";
import { formatNow } from "../stamp.js";

test("format: fixed date renders YYYY-MM-DD HH:MM TZ (pinned zone)", () => {
  // 2026-10-08 17:47:22 UTC = 13:47 in New York (EDT, summer)
  const d = new Date("2026-10-08T17:47:22Z");
  const s = formatNow(d, "America/New_York");
  assert.match(s, /^Now: \d{4}-\d{2}-\d{2} \d{2}:\d{2} [A-Z]{2,5}$/);
  assert.ok(s.includes("2026-10-08 13:47"), s);
  assert.ok(s.includes("EDT"), s);
});

test("format: midnight uses 00, not 24 (h23 hour cycle, pinned zone)", () => {
  // 2026-01-15 05:00 UTC = 00:00 in New York (EST, winter)
  const d = new Date("2026-01-15T05:00:00Z");
  const s = formatNow(d, "America/New_York");
  assert.ok(s.includes("00:00"), s);
  assert.ok(s.includes("EST"), s);
});

test("format: live date has current year (pinned UTC)", () => {
  const s = formatNow(new Date(), "UTC");
  assert.ok(s.includes(String(new Date().getUTCFullYear())), s);
});
