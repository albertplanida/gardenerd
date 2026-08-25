import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { useWeeklyTasks } from "./useWeeklyTasks";
import {
  formatWeeklyTaskDate,
  formatWeeklyTaskRange,
  WeeklyTaskList,
} from "./WeeklyTaskList";

jest.mock("./useWeeklyTasks", () => ({ useWeeklyTasks: jest.fn() }));

const retry = jest.fn();
const week = {
  startDate: "2026-08-17",
  endDate: "2026-08-23",
  days: [
    {
      date: "2026-08-19",
      tasks: [
        {
          key: "2026-08-19:pests",
          text: "Check active Growing Trials for pests or other problems.",
        },
      ],
    },
    {
      date: "2026-08-17",
      tasks: [
        {
          key: "2026-08-17:moisture:1",
          text: "Check soil moisture for Radish in Patio Pot.",
        },
      ],
    },
  ],
};

function renderList() {
  return render(
    <MantineProvider>
      <WeeklyTaskList />
    </MantineProvider>,
  );
}

describe("WeeklyTaskList", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("announces an independent loading state", () => {
    jest.mocked(useWeeklyTasks).mockReturnValue({
      status: "loading",
      week: null,
      retry,
    });
    renderList();

    expect(screen.getByRole("heading", { name: "This week" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading this week's tasks...",
    );
  });

  it("renders the range, populated days, and task text as accessible lists", () => {
    jest.mocked(useWeeklyTasks).mockReturnValue({
      status: "ready",
      week,
      retry,
    });
    renderList();

    expect(screen.getByText("Aug 17, 2026 - Aug 23, 2026")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Monday, August 17" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Wednesday, August 19" }),
    ).toBeVisible();
    expect(screen.queryByText(/Tuesday, August 18/)).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Monday, August 17", "Wednesday, August 19"]);
    const lists = screen.getAllByRole("list");
    expect(within(lists[0]).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText(/Radish in Patio Pot/)).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit|complete|refresh/i }),
    ).not.toBeInTheDocument();
  });

  it("links the empty state to Growing Trials", () => {
    jest.mocked(useWeeklyTasks).mockReturnValue({
      status: "ready",
      week: { ...week, days: [] },
      retry,
    });
    renderList();

    expect(
      screen.getByRole("heading", { name: "No tasks planned for this week" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View Growing Trials" }),
    ).toHaveAttribute("href", "/growing-trials");
  });

  it("shows one retry action for request and timezone failures", () => {
    jest.mocked(useWeeklyTasks).mockReturnValue({
      status: "error",
      week: null,
      retry,
    });
    renderList();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Weekly tasks could not be loaded.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("weekly task date formatting", () => {
  it("formats date-only values without a timezone calendar shift", () => {
    expect(formatWeeklyTaskDate("2026-08-24")).toBe("Monday, August 24");
    expect(formatWeeklyTaskRange("2026-08-24", "2026-08-30")).toBe(
      "Aug 24, 2026 - Aug 30, 2026",
    );
  });

  it("rejects invalid date-only values rather than silently shifting them", () => {
    expect(() => formatWeeklyTaskDate("2026-02-30")).toThrow(RangeError);
    expect(() => formatWeeklyTaskDate("2026-08-24T00:00:00Z")).toThrow(
      RangeError,
    );
  });
});
