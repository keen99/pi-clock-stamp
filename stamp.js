// One-line time awareness for pi conversations.
//
// LLMs have no clock; every "when did X happen" or "has it been long
// since..." answer is a guess without one. This module produces the
// single compact line injected into the system prompt each turn:
//
//   Now: 2026-10-08 13:47 EDT
//
// Year kept (training-cutoff math), timezone abbreviation implies the
// UTC offset, seconds dropped (per-turn granularity makes them noise).
// tz is an IANA zone name; omitted = the machine's local zone (what a
// user means by "now"). Tests pin an explicit zone for determinism.

export function formatNow(d = new Date(), tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
    ...(tz ? { timeZone: tz } : {}),
  }).formatToParts(d);
  const g = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `Now: ${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")} ${g("timeZoneName")}`;
}
