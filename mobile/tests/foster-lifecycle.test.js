import { describe, expect, test } from "bun:test";

import {
  applyFosterLifecycle,
  completedFosterPeriods,
  ensureAdoptionEvents,
  ensureFosterPeriods,
} from "../src/lib/foster-lifecycle";
import { calculateFosterDays } from "../src/lib/foster-duration";

function foster(overrides = {}) {
  return {
    id: "valor",
    isDemo: false,
    name: "Valor",
    adoptionStatus: "Available",
    fosterStartDate: "2026-09-01",
    daysInFoster: 0,
    ...overrides,
  };
}

describe("foster lifecycle", () => {
  test("freezes an adopted period and starts a separate period on reactivation", () => {
    const active = applyFosterLifecycle(undefined, foster(), "2026-09-01T12:00:00.000Z");
    const adopted = applyFosterLifecycle(
      active,
      { ...active, adoptionStatus: "Adopted" },
      "2026-09-05T12:00:00.000Z",
      "2026-09-05",
    );

    expect(calculateFosterDays(adopted, new Date("2026-09-08T12:00:00.000Z"))).toBe(4);
    expect(calculateFosterDays(adopted, new Date("2026-10-08T12:00:00.000Z"))).toBe(4);

    const reactivated = applyFosterLifecycle(
      adopted,
      { ...adopted, adoptionStatus: "Available" },
      "2026-09-07T12:00:00.000Z",
      "2026-09-07",
    );

    expect(reactivated.fosterStartDate).toBe("2026-09-01");
    expect(reactivated.fosterPeriods.at(-1)).toMatchObject({
      startedAt: "2026-09-07",
      endedAt: null,
      status: "Active",
    });
    expect(reactivated.adoptionEvents).toEqual([
      expect.objectContaining({ adoptedAt: "2026-09-05" }),
    ]);
    expect(calculateFosterDays(reactivated, new Date("2026-09-08T12:00:00.000Z"))).toBe(1);
    expect(completedFosterPeriods(reactivated)).toEqual([
      expect.objectContaining({
        startedAt: "2026-09-01",
        endedAt: "2026-09-05",
        status: "Adopted",
      }),
    ]);
  });

  test("updates the current intake date without replacing earlier history", () => {
    const active = applyFosterLifecycle(undefined, foster(), "2026-09-01T12:00:00.000Z");
    const corrected = applyFosterLifecycle(
      active,
      { ...active, fosterStartDate: "2026-08-30" },
      "2026-09-04T12:00:00.000Z",
    );

    expect(corrected.fosterPeriods).toHaveLength(1);
    expect(corrected.fosterPeriods[0]).toMatchObject({
      startedAt: "2026-08-30",
      endedAt: null,
      status: "Active",
    });
    expect(calculateFosterDays(corrected, new Date("2026-09-04T12:00:00.000Z"))).toBe(5);
  });

  test("does not invent or increment an end date for a legacy adopted profile", () => {
    const legacyAdopted = foster({ adoptionStatus: "Adopted" });
    const periods = ensureFosterPeriods(legacyAdopted, "2026-09-08T12:00:00.000Z");

    expect(periods).toEqual([
      expect.objectContaining({
        startedAt: "2026-09-01",
        endedAt: null,
        status: "Adopted",
      }),
    ]);
    expect(calculateFosterDays({ ...legacyAdopted, fosterPeriods: periods })).toBeNull();
  });

  test("uses the active profile start date when older period metadata is stale", () => {
    const activeFoster = foster({
      fosterStartDate: "August 1, 2026",
      fosterPeriods: [
        {
          id: "stale-period",
          startedAt: "2026-09-08",
          endedAt: null,
          status: "Active",
        },
      ],
    });

    expect(calculateFosterDays(activeFoster, new Date("2026-09-08T12:00:00.000Z"))).toBe(38);
  });

  test("repairs stale active period metadata before it becomes archived history", () => {
    const activeFoster = foster({
      fosterStartDate: "2026-08-01",
      fosterPeriods: [
        {
          id: "stale-period",
          startedAt: "2026-09-08",
          endedAt: null,
          status: "Active",
        },
      ],
    });

    expect(ensureFosterPeriods(activeFoster)).toEqual([
      expect.objectContaining({ startedAt: "2026-08-01", status: "Active" }),
    ]);

    const adopted = applyFosterLifecycle(
      activeFoster,
      { ...activeFoster, adoptionStatus: "Adopted" },
      "2026-09-08T12:00:00.000Z",
      "2026-09-08",
    );
    expect(calculateFosterDays(adopted, new Date("2026-09-09T12:00:00.000Z"))).toBe(38);
  });

  test("backfills legacy adoption events idempotently", () => {
    const legacy = foster({
      adoptionStatus: "Adopted",
      fosterPeriods: [{ id: "period-one", startedAt: "2026-08-01", endedAt: "2026-08-15", status: "Adopted" }],
    });
    const once = ensureAdoptionEvents(legacy, ensureFosterPeriods(legacy), "2026-09-08T12:00:00.000Z");
    const twice = ensureAdoptionEvents({ ...legacy, adoptionEvents: once }, ensureFosterPeriods(legacy), "2026-09-08T12:00:00.000Z");

    expect(once).toHaveLength(1);
    expect(twice).toEqual(once);
  });

  test("counts from common saved foster date formats", () => {
    const currentDate = new Date("2026-09-08T12:00:00.000Z");

    ["August 1 2026", "Aug 1st, 2026", "8-1-2026", "2026/8/1"].forEach((fosterStartDate) => {
      expect(calculateFosterDays(foster({ fosterStartDate }), currentDate)).toBe(38);
    });
  });
});
