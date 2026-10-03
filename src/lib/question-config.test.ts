import { describe, expect, it } from "vitest";
import {
  currentEthiopianDate,
  ethiopianAge,
  ethiopianEligibilityAge,
  gregorianToEthiopian,
  validateEthiopianDate,
} from "./question-config";

describe("Ethiopian ↔ Gregorian conversion", () => {
  it("Ethiopian New Year dates", () => {
    expect(gregorianToEthiopian(2026, 9, 11)).toEqual({ year: 2019, month: 1, day: 1 });
    expect(gregorianToEthiopian(2023, 9, 12)).toEqual({ year: 2016, month: 1, day: 1 }); // after leap 2015
    expect(gregorianToEthiopian(2024, 9, 11)).toEqual({ year: 2017, month: 1, day: 1 });
  });
  it("Pagume and leap years", () => {
    expect(gregorianToEthiopian(2023, 9, 11)).toEqual({ year: 2015, month: 13, day: 6 }); // 2015 is leap
    expect(gregorianToEthiopian(2026, 9, 10)).toEqual({ year: 2018, month: 13, day: 5 });
    expect(gregorianToEthiopian(2026, 9, 6)).toEqual({ year: 2018, month: 13, day: 1 });
    expect(validateEthiopianDate("06/13/2015")).not.toBeNull();
    expect(validateEthiopianDate("06/13/2016")).toBeNull();
    expect(validateEthiopianDate("31/01/2016")).toBeNull();
  });
  it("month boundaries", () => {
    expect(gregorianToEthiopian(2026, 10, 10)).toEqual({ year: 2019, month: 1, day: 30 });
    expect(gregorianToEthiopian(2026, 10, 11)).toEqual({ year: 2019, month: 2, day: 1 });
  });
  it("uses Addis Ababa time zone (UTC+3)", () => {
    expect(currentEthiopianDate(new Date("2026-09-10T21:30:00Z"))).toEqual({ year: 2019, month: 1, day: 1 });
    expect(currentEthiopianDate(new Date("2026-09-10T20:30:00Z"))).toEqual({ year: 2018, month: 13, day: 5 });
  });
});

describe("actual age", () => {
  const today = { year: 2019, month: 7, day: 10 };
  it("turns 7 exactly on the birthday (previous bug showed 6)", () => {
    expect(ethiopianAge(2012, 7, 10, today)).toBe(7);
    expect(ethiopianAge(2012, 7, 11, today)).toBe(6);
    expect(ethiopianAge(2012, 6, 30, today)).toBe(7);
  });
  it("Pagume birthday and New Year", () => {
    const ny = { year: 2019, month: 1, day: 1 };
    expect(ethiopianAge(2012, 13, 5, ny)).toBe(6);
    expect(ethiopianAge(2012, 1, 1, ny)).toBe(7);
    expect(ethiopianAge(2012, 13, 5, { year: 2019, month: 13, day: 5 })).toBe(7);
  });
});

describe("existing eligibility rule (unchanged)", () => {
  const today = { year: 2019, month: 1, day: 23 };
  it("months 1–6: no adjustment", () => {
    for (let m = 1; m <= 6; m++) expect(ethiopianEligibilityAge(2012, m, 30, today)).toBe(7);
  });
  it("months 7–13: subtract one", () => {
    for (let m = 7; m <= 13; m++) expect(ethiopianEligibilityAge(2012, m, 1, today)).toBe(6);
  });
  it("is independent of the current day/month", () => {
    expect(ethiopianEligibilityAge(2012, 7, 10, { year: 2019, month: 12, day: 30 })).toBe(6);
  });
});
