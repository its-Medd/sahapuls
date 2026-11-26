# Open bug-fixing exercises

These are genuine low-severity issues found in the original frontend and deliberately retained for future engineering work. They are not undisclosed production incidents. No syntax, security, installation or persistent-data defect was added to create exercises. Core tests remain enabled.

## BUG-01 — Relative time advances before the duration boundary

**KNOWN LOW-SEVERITY DEFECT** — Severity: Low.

- File: `web/src/lib/format.ts`, `timeAgo`.
- Input: now = Date.parse('2026-07-11T12:00:00.000Z'); timestamp = new Date(now - 59600).toISOString().
- Reproduce: call timeAgo(timestamp, now).
- Expected: `59s ago` until a full 60 seconds has elapsed.
- Actual: `1m ago`.
- Why: Math.round converts 59.6 to 60 before choosing the unit. Minute and hour boundaries have similar early transitions.
- Impact: minor imprecision in device-list metadata; server health uses exact millisecond comparisons and is unaffected.
- Acceptance: use a documented rounding policy, test 59999/60000ms and 3599999/3600000ms boundaries, retain readable labels.

## BUG-02 — Invalid relative timestamp produces NaN text

**KNOWN LOW-SEVERITY DEFECT** — Severity: Low.

- File: `web/src/lib/format.ts`, `timeAgo`.
- Input: timeAgo('not-a-date', Date.parse('2026-07-11T12:00:00Z')).
- Reproduce: invoke the formatting helper with this input.
- Expected: a documented fallback such as `unknown`.
- Actual: `NaNh ago`.
- Why: Date parsing returns NaN and no finite-date guard exists.
- Impact: defensive UI formatting only; current backend validation blocks new invalid timestamps. Legacy/imported data or direct helper consumers could expose it.
- Acceptance: invalid timestamps have a safe fallback; null stays `never`; test invalid, valid and future inputs without altering server dates.

## BUG-03 — Overview chart axis hides calendar dates across midnight

**KNOWN LOW-SEVERITY DEFECT** — Severity: Low.

- Files: `web/src/components/MetricChart.tsx` XAxis and `web/src/lib/format.ts` formatClockTime.
- Input: observations at 2026-07-10T12:00:00.000Z and 2026-07-11T12:00:00.000Z with any valid sensor values.
- Reproduce: open Overview for a station whose latest 500 samples include both observations; compare the axis labels with the full tooltip timestamps.
- Expected: a multi-day chart includes a date/day at boundaries so the two points can be distinguished without hovering.
- Actual: both axis labels contain the same local clock time. Tooltips include dates and remain correct.
- Why: Overview uses MetricChart's default showDates=false, so its labels contain only clock time even when sparse observations span days. Analytics enables date labels for longer windows and is unaffected.
- Impact: low-severity chart readability; SQL filtering, order, stored timestamps and CSV export are correct.
- Acceptance: span-aware axis labels include dates when necessary, keep compact sub-day labels, and are tested across midnight and DST.

Characterization tests in `web/src/lib/known-issues.test.ts` record the current reproductions. When implementing these tasks, replace those assertions with the corrected acceptance behavior; they are not normative product specifications.
