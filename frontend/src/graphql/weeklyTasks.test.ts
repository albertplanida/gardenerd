import { createGraphqlClient } from "./client";
import { WEEKLY_TASKS_QUERY } from "./queries";
import { getWeeklyTasks } from "./weeklyTasks";

jest.mock("./client", () => ({ createGraphqlClient: jest.fn() }));

describe("getWeeklyTasks", () => {
  it("requests the typed weekly operation with timezone and signal", async () => {
    const week = {
      startDate: "2026-08-24",
      endDate: "2026-08-30",
      days: [],
    };
    const request = jest.fn().mockResolvedValue({ weeklyTasks: week });
    jest.mocked(createGraphqlClient).mockReturnValue({ request } as never);
    const signal = new AbortController().signal;

    await expect(getWeeklyTasks("Europe/Paris", signal)).resolves.toBe(week);
    expect(request).toHaveBeenCalledWith({
      document: WEEKLY_TASKS_QUERY,
      variables: { timeZone: "Europe/Paris" },
      signal,
    });
  });
});
