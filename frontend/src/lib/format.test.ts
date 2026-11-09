import { describe, expect, it } from "vitest";
import { formatSignedTicks, formatTicks, formatUtcTime } from "./format";

describe("formatTicks", () => {
  it("formats integer ticks with the price scale", () => {
    expect(formatTicks(1_800_025, 2)).toBe("18000.25");
    expect(formatTicks(5, 2)).toBe("0.05");
    expect(formatTicks(-150, 2)).toBe("-1.50");
    expect(formatTicks(42, 0)).toBe("42");
  });
  it("refuses non-integer input instead of guessing", () => {
    expect(formatTicks(1.5, 2)).toBe("—");
    expect(formatTicks(Number.NaN, 2)).toBe("—");
  });
  it("adds a plus sign for positive moves", () => {
    expect(formatSignedTicks(250, 2)).toBe("+2.50");
    expect(formatSignedTicks(-250, 2)).toBe("-2.50");
    expect(formatSignedTicks(0, 2)).toBe("0.00");
  });
});

describe("formatUtcTime", () => {
  it("shows UTC hours and minutes", () => {
    expect(formatUtcTime("2000-01-03T16:29:00Z")).toBe("16:29 UTC");
    expect(formatUtcTime("garbage")).toBe("—");
  });
});
