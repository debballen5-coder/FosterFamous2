import { describe, expect, test } from "bun:test";

import {
  fosterDurationLabel,
  getFosterDuration,
  normalizeFosterDate,
} from "../src/lib/foster-duration";

function foster(overrides = {}) {
  return {
    id: "valor",
    isDemo: false,
    name: "Valor",
    adoptionStatus: "Not Yet Available",
    fosterStartDate: "2026-09-01",
    daysInFoster: 0,
    ...overrides,
  };
}

describe("foster duration", () => {
  test("uses the saved Foster Start Date as the active foster source of truth", () => {
    const duration = getFosterDuration(
      foster({
        fosterStartDate: "September 1, 2026",
        fosterPeriods: [
          { id: "stale-period", startedAt: "2026-09-08", endedAt: null, status: "Active" },
        ],
      }),
      new Date("2026-09-08T12:00:00")
    );

    expect(duration).toEqual({ days: 7, state: "valid" });
    expect(fosterDurationLabel(duration, false)).toBe("7 days in foster");
  });

  test("canonicalizes common legacy text dates before they are saved", () => {
    expect(normalizeFosterDate(" Sep 1st, 2026 ")).toBe("2026-09-01");
    expect(normalizeFosterDate("Sept 20, 2026")).toBe("2026-09-20");
    expect(normalizeFosterDate("9-1-2026")).toBe("2026-09-01");
    expect(normalizeFosterDate("2026/9/1")).toBe("2026-09-01");
  });

  test("uses the Adoption Date and the same saved Foster Start Date after adoption", () => {
    const duration = getFosterDuration(
      foster({
        adoptionStatus: "Adopted",
        fosterStartDate: "2026-09-01",
        fosterPeriods: [
          // A legacy nested start date must not override the saved profile start date.
          { id: "adopted-period", startedAt: "2026-09-08", endedAt: "2026-09-08", status: "Adopted" },
        ],
      }),
      new Date("2026-09-09T12:00:00")
    );

    expect(duration).toEqual({ days: 7, state: "valid" });
  });

  test("does not disguise a future date as zero days", () => {
    const duration = getFosterDuration(
      foster({ fosterStartDate: "2026-09-09" }),
      new Date("2026-09-08T12:00:00")
    );

    expect(duration).toEqual({ days: null, state: "future-start-date" });
    expect(fosterDurationLabel(duration, false)).toBe("Start date needs correction");
  });

  test("labels a genuine same-day foster clearly instead of showing a misleading zero", () => {
    const duration = getFosterDuration(
      foster({ fosterStartDate: "2026-09-08" }),
      new Date("2026-09-08T12:00:00")
    );

    expect(duration).toEqual({ days: 0, state: "valid" });
    expect(fosterDurationLabel(duration, false)).toBe("Started today");
  });
});
