import { describe, expect, it } from "vitest";
import {
  buildSearchAnalyticsRequest,
  resolveDateRange,
} from "@/server/features/gsc/searchAnalytics";

const TODAY = new Date("2026-05-28T12:00:00Z");

describe("resolveDateRange", () => {
  it.each([
    ["2026-09-14T00:30:00Z", "2026-09-10", "2026-09-04"],
    ["2026-09-14T06:59:59Z", "2026-09-10", "2026-09-04"],
    ["2026-09-14T07:00:00Z", "2026-09-11", "2026-09-05"],
    ["2026-03-08T07:59:59Z", "2026-03-04", "2026-02-26"],
    ["2026-03-08T08:00:00Z", "2026-03-05", "2026-02-27"],
    ["2026-03-08T10:00:00Z", "2026-03-05", "2026-02-27"],
    ["2026-03-09T07:00:00Z", "2026-03-06", "2026-02-28"],
    ["2026-11-01T08:30:00Z", "2026-10-29", "2026-10-23"],
    ["2026-11-01T09:30:00Z", "2026-10-29", "2026-10-23"],
    ["2026-11-02T07:59:59Z", "2026-10-29", "2026-10-23"],
    ["2026-11-02T08:00:00Z", "2026-10-30", "2026-10-24"],
  ])(
    "uses the PT calendar day at %s, including DST boundaries",
    (instant, endDate, startDate) => {
      expect(
        resolveDateRange({ dateRange: "last_7_days" }, new Date(instant)),
      ).toEqual({ startDate, endDate });
    },
  );

  it("uses the PT calendar floor without shifting explicit requested dates", () => {
    const instant = new Date("2026-09-14T00:30:00Z");
    expect(
      resolveDateRange(
        { startDate: "2020-01-01", endDate: "2026-09-01" },
        instant,
      ),
    ).toEqual({ startDate: "2025-05-13", endDate: "2026-09-01" });
    expect(
      resolveDateRange(
        { startDate: "2026-08-01", endDate: "2026-09-01" },
        instant,
      ),
    ).toEqual({ startDate: "2026-08-01", endDate: "2026-09-01" });
  });

  it("ends convenience ranges 3 days back for GSC data lag", () => {
    const { endDate } = resolveDateRange({ dateRange: "last_28_days" }, TODAY);
    expect(endDate).toBe("2026-05-25");
  });

  it("requests exactly 7 inclusive days", () => {
    const range = resolveDateRange({ dateRange: "last_7_days" }, TODAY);
    expect(range).toEqual({
      startDate: "2026-05-19",
      endDate: "2026-05-25",
    });
    expect(
      (Date.parse(range.endDate) - Date.parse(range.startDate)) / 86_400_000 +
        1,
    ).toBe(7);
  });

  it("requests exactly 28 inclusive days from the lagged end", () => {
    const { startDate, endDate } = resolveDateRange(
      { dateRange: "last_28_days" },
      TODAY,
    );
    expect(startDate).toBe("2026-04-28");
    expect(endDate).toBe("2026-05-25");
    expect((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1).toBe(
      28,
    );
  });

  it("clamps the start to the 16-month floor", () => {
    const { startDate } = resolveDateRange(
      { dateRange: "last_16_months" },
      TODAY,
    );
    // end (2026-05-25) - 16 months = 2025-01-25, but floor is today - 16 months.
    expect(startDate).toBe("2025-01-28");
  });

  it("passes explicit dates through, clamping start to the floor", () => {
    const { startDate, endDate } = resolveDateRange(
      { startDate: "2020-01-01", endDate: "2026-05-01" },
      TODAY,
    );
    expect(startDate).toBe("2025-01-28"); // clamped
    expect(endDate).toBe("2026-05-01");
  });

  it("leaves an in-range explicit start untouched", () => {
    const { startDate } = resolveDateRange(
      { startDate: "2026-01-01", endDate: "2026-05-01" },
      TODAY,
    );
    expect(startDate).toBe("2026-01-01");
  });

  it("subtracts calendar months without overflowing short months", () => {
    const { startDate, endDate } = resolveDateRange(
      { dateRange: "last_3_months" },
      new Date("2026-06-03T12:00:00Z"),
    );
    expect(startDate).toBe("2026-02-28");
    expect(endDate).toBe("2026-05-31");
  });

  it("clamps the 16-month floor to the last valid day of a short month", () => {
    const { startDate } = resolveDateRange(
      { dateRange: "last_16_months" },
      new Date("2026-06-30T12:00:00Z"),
    );
    expect(startDate).toBe("2025-02-28");
  });
});

describe("buildSearchAnalyticsRequest", () => {
  it.each([
    {
      dateRange: "last_7_days" as const,
      today: "2026-03-06T12:00:00Z",
      startDate: "2026-02-25",
      endDate: "2026-03-03",
      days: 7,
    },
    {
      dateRange: "last_28_days" as const,
      today: "2026-03-06T12:00:00Z",
      startDate: "2026-02-04",
      endDate: "2026-03-03",
      days: 28,
    },
    {
      dateRange: "last_7_days" as const,
      today: "2028-03-06T12:00:00Z",
      startDate: "2028-02-26",
      endDate: "2028-03-03",
      days: 7,
    },
    {
      dateRange: "last_28_days" as const,
      today: "2028-03-06T12:00:00Z",
      startDate: "2028-02-05",
      endDate: "2028-03-03",
      days: 28,
    },
    {
      dateRange: "last_7_days" as const,
      today: "2026-01-06T12:00:00Z",
      startDate: "2025-12-28",
      endDate: "2026-01-03",
      days: 7,
    },
    {
      dateRange: "last_28_days" as const,
      today: "2026-01-06T12:00:00Z",
      startDate: "2025-12-07",
      endDate: "2026-01-03",
      days: 28,
    },
  ])(
    "preserves $days inclusive days across calendar boundaries at $today",
    ({ dateRange, today, startDate, endDate, days }) => {
      const request = buildSearchAnalyticsRequest(
        { projectId: "p1", dateRange },
        new Date(today),
      );
      expect(request).toMatchObject({ startDate, endDate });
      expect(
        (Date.parse(request.endDate) - Date.parse(request.startDate)) /
          86_400_000 +
          1,
      ).toBe(days);
    },
  );

  it("keeps explicit inclusive dates instead of expanding the convenience range", () => {
    const request = buildSearchAnalyticsRequest(
      {
        projectId: "p1",
        dateRange: "last_28_days",
        startDate: "2026-05-01",
        endDate: "2026-05-01",
      },
      TODAY,
    );
    expect(request).toMatchObject({
      startDate: "2026-05-01",
      endDate: "2026-05-01",
    });
  });

  it("wraps flat filters into a single AND dimensionFilterGroup", () => {
    const request = buildSearchAnalyticsRequest(
      {
        projectId: "p1",
        dimensions: ["query"],
        filters: [
          {
            dimension: "page",
            operator: "equals",
            expression: "https://example.com/post",
          },
        ],
      },
      TODAY,
    );
    // The whole point: GSC ignores a top-level `filters` field.
    expect(request).not.toHaveProperty("filters");
    expect(request.dimensionFilterGroups).toEqual([
      {
        groupType: "and",
        filters: [
          {
            dimension: "page",
            operator: "equals",
            expression: "https://example.com/post",
          },
        ],
      },
    ]);
  });

  it("omits dimensionFilterGroups when no filters are given", () => {
    const request = buildSearchAnalyticsRequest({ projectId: "p1" }, TODAY);
    expect(request.dimensionFilterGroups).toBeUndefined();
  });

  it("defaults dimensions, type, dataState, and rowLimit", () => {
    const request = buildSearchAnalyticsRequest({ projectId: "p1" }, TODAY);
    expect(request.dimensions).toEqual(["query"]);
    expect(request.type).toBe("web");
    expect(request.dataState).toBe("all");
    expect(request.rowLimit).toBe(1000);
  });

  it("clamps rowLimit to the 1000 ceiling", () => {
    expect(
      buildSearchAnalyticsRequest({ projectId: "p1", rowLimit: 99999 }, TODAY)
        .rowLimit,
    ).toBe(1000);
    expect(
      buildSearchAnalyticsRequest({ projectId: "p1", rowLimit: 0 }, TODAY)
        .rowLimit,
    ).toBe(1);
  });

  it("only includes startRow when positive", () => {
    expect(
      buildSearchAnalyticsRequest({ projectId: "p1" }, TODAY).startRow,
    ).toBeUndefined();
    expect(
      buildSearchAnalyticsRequest({ projectId: "p1", startRow: 1000 }, TODAY)
        .startRow,
    ).toBe(1000);
  });
});
