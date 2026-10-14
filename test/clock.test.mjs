import test from "node:test";
import assert from "node:assert/strict";
import { formatNow } from "../stamp.js";

test("format: fixed date renders YYYY-MM-DD HH:MM TZ", () => {
  // 2026-10-08 17:47:22 UTC = 13:47 EDT
  const d = new Date("2026-10-08T17:47:22Z");
  const s = formatNow(d);
  assert.match(s, /^Now: \d{4}-\d{2}-\d{2} \d{2}:\d{2} [A-Z]{2,5}$/);
  assert.ok(s.includes("13:47"), s);
  assert.ok(s.includes("EDT"), s);
});

test("format: midnight uses 00, not 24 (h23 hour cycle)", () => {
  // 2026-01-15 05:00 UTC = 00:00 EST
  const d = new Date("2026-01-15T05:00:00Z");
  const s = formatNow(d);
  assert.ok(s.includes("00:00"), s);
  assert.ok(s.includes("EST"), s); // winter = EST not EDT
});

test("format: live date has current year", () => {
  const s = formatNow();
  assert.ok(s.includes(String(new Date().getFullYear())), s);
});
