import { formatDateOnly, localCalendarDate } from "./presentation";

describe("date-only presentation", () => {
  it("keeps a saved day across negative and positive offsets and a DST boundary", () => {
    const instant = new Date("2026-03-08T00:00:00Z");
    expect(
      new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeZone: "America/Los_Angeles",
      }).format(instant),
    ).toBe("March 7, 2026");
    expect(
      new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeZone: "Pacific/Kiritimati",
      }).format(instant),
    ).toBe("March 8, 2026");
    expect(formatDateOnly("2026-03-08", "en-US")).toBe("March 8, 2026");
  });

  it("uses local calendar fields at midnight", () => {
    expect(localCalendarDate(new Date(2026, 2, 8, 0, 0))).toBe("2026-03-08");
  });

  it("returns malformed or impossible values unchanged", () => {
    expect(formatDateOnly("not-a-date", "en-US")).toBe("not-a-date");
    expect(formatDateOnly("2026-02-30", "en-US")).toBe("2026-02-30");
  });
});
