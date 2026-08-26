import { act, renderHook, waitFor } from "@testing-library/react";

import { getWeeklyTasks } from "@/graphql/weeklyTasks";

import { useWeeklyTasks } from "./useWeeklyTasks";

jest.mock("@/graphql/weeklyTasks", () => ({ getWeeklyTasks: jest.fn() }));

const emptyWeek = {
  startDate: "2026-08-17",
  endDate: "2026-08-23",
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
    act(() => result.current.refresh());
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

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getWeeklyTasks).toHaveBeenCalledWith(
      "America/Los_Angeles",
      expect.any(AbortSignal),
    );
  });

  it("refetches once when the lifecycle refresh revision changes", async () => {
    jest.mocked(getWeeklyTasks).mockResolvedValue(emptyWeek);
    const { rerender } = renderHook(
      ({ revision }) => useWeeklyTasks(revision),
      { initialProps: { revision: 0 } },
    );
    await waitFor(() => expect(getWeeklyTasks).toHaveBeenCalledTimes(1));

    rerender({ revision: 1 });

    await waitFor(() => expect(getWeeklyTasks).toHaveBeenCalledTimes(2));
  });

  it("prevents a superseded request from overwriting newer results", async () => {
    let resolveFirst!: (value: typeof emptyWeek) => void;
    const firstRequest = new Promise<typeof emptyWeek>((resolve) => {
      resolveFirst = resolve;
    });
    const refreshedWeek = {
      ...emptyWeek,
      days: [
        {
          date: "2026-08-19",
          tasks: [
            {
              key: "weekly-task:v1:2026-08-19:garden-health",
              text: "Check active Growing Trials for pests or other problems.",
            },
          ],
        },
      ],
    };
    jest
      .mocked(getWeeklyTasks)
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(refreshedWeek);
    const { result, rerender } = renderHook(
      ({ revision }) => useWeeklyTasks(revision),
      { initialProps: { revision: 0 } },
    );
    await waitFor(() => expect(getWeeklyTasks).toHaveBeenCalledTimes(1));

    rerender({ revision: 1 });
    await waitFor(() => expect(result.current.week).toEqual(refreshedWeek));
    act(() => resolveFirst(emptyWeek));

    await waitFor(() => expect(result.current.week).toEqual(refreshedWeek));
  });

  it("aborts the request when unmounted", async () => {
    jest.mocked(getWeeklyTasks).mockReturnValue(new Promise(() => undefined));
    const { unmount } = renderHook(() => useWeeklyTasks());
    await waitFor(() => expect(getWeeklyTasks).toHaveBeenCalledTimes(1));
    const signal = jest.mocked(getWeeklyTasks).mock.calls[0][1];

    unmount();

    expect(signal.aborted).toBe(true);
  });
});
