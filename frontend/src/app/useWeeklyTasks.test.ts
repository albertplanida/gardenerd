import { act, renderHook, waitFor } from "@testing-library/react";

import { getWeeklyTasks } from "@/graphql/weeklyTasks";

import { useWeeklyTasks } from "./useWeeklyTasks";

jest.mock("@/graphql/weeklyTasks", () => ({ getWeeklyTasks: jest.fn() }));

const emptyWeek = {
  startDate: "2026-08-24",
  endDate: "2026-08-30",
  days: [],
};

describe("useWeeklyTasks", () => {
  let resolvedOptions: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    resolvedOptions = jest
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({
        locale: "en-US",
        calendar: "gregory",
        numberingSystem: "latn",
        timeZone: "Pacific/Auckland",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
  });

  afterEach(() => resolvedOptions.mockRestore());

  it("loads using the browser IANA timezone", async () => {
    jest.mocked(getWeeklyTasks).mockResolvedValue(emptyWeek);
    const { result } = renderHook(() => useWeeklyTasks());

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getWeeklyTasks).toHaveBeenCalledWith(
      "Pacific/Auckland",
      expect.any(AbortSignal),
    );
    expect(result.current.week).toEqual(emptyWeek);
  });

  it("does not refetch when unrelated dashboard status changes", async () => {
    jest.mocked(getWeeklyTasks).mockResolvedValue(emptyWeek);
    const { rerender } = renderHook(
      ({ status }) => {
        void status;
        return useWeeklyTasks();
      },
      { initialProps: { status: "ACTIVE" } },
    );
    await waitFor(() => expect(getWeeklyTasks).toHaveBeenCalledTimes(1));

    rerender({ status: "PLANNED" });

    expect(getWeeklyTasks).toHaveBeenCalledTimes(1);
  });

  it("changes to error and retries only after the retry action", async () => {
    jest
      .mocked(getWeeklyTasks)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(emptyWeek);
    const { result, rerender } = renderHook(() => useWeeklyTasks());
    await waitFor(() => expect(result.current.status).toBe("error"));

    rerender();
    expect(getWeeklyTasks).toHaveBeenCalledTimes(1);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getWeeklyTasks).toHaveBeenCalledTimes(2);
  });

  it("surfaces timezone resolution errors and can retry resolution", async () => {
    resolvedOptions
      .mockImplementationOnce(() => {
        throw new RangeError("timezone unavailable");
      })
      .mockReturnValue({
        locale: "en-US",
        calendar: "gregory",
        numberingSystem: "latn",
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
    jest.mocked(getWeeklyTasks).mockResolvedValue(emptyWeek);
    const { result } = renderHook(() => useWeeklyTasks());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(getWeeklyTasks).not.toHaveBeenCalled();

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getWeeklyTasks).toHaveBeenCalledWith(
      "America/Los_Angeles",
      expect.any(AbortSignal),
    );
  });
});
