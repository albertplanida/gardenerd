import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  abandonGrowingTrial,
  completeGrowingTrial,
  getGrowingTrialSetupContext,
  listGrowingTrialContainerOptions,
  listGrowingTrialPlantOptions,
  listGrowingTrials,
  startGrowingTrial,
} from "@/graphql/growingTrials";

import { WeeklyTaskList } from "../WeeklyTaskList";
import { GrowingTrialsWorkspace } from "./GrowingTrialsWorkspace";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("@mantine/notifications", () => ({
  notifications: { show: jest.fn(), hide: jest.fn() },
}));
jest.mock("../WeeklyTaskList", () => ({
  WeeklyTaskList: jest.fn(() => <h2>This week</h2>),
}));
jest.mock("@/graphql/growingTrials", () => ({
  abandonGrowingTrial: jest.fn(),
  completeGrowingTrial: jest.fn(),
  createGrowingTrial: jest.fn(),
  getGrowingTrialSetupContext: jest.fn(),
  listGrowingTrials: jest.fn(),
  listGrowingTrialPlantOptions: jest.fn(),
  listGrowingTrialContainerOptions: jest.fn(),
  startGrowingTrial: jest.fn(),
  updateGrowingTrialResult: jest.fn(),
}));

const emptyPage = {
  items: [],
  hasNextPage: false,
  hasPreviousPage: false,
  endCursor: null,
};
const activeTrial = {
  id: "10",
  plant: { id: "1", name: "Radish" },
  container: { id: "2", name: "Pot 1" },
  status: "ACTIVE" as const,
  startDate: "2026-08-14",
  startMethod: "SEED" as const,
  endDate: null,
  resultSummary: "",
  createdAt: "2026-08-14T12:00:00Z",
  updatedAt: "2026-08-14T12:00:00Z",
};
const plannedTrial = {
  ...activeTrial,
  status: "PLANNED" as const,
  startDate: null,
  startMethod: null,
};

function latestWeeklyTaskRevision() {
  return jest.mocked(WeeklyTaskList).mock.calls.at(-1)?.[0].refreshRevision;
}

function renderDashboard(statusFilter: "ACTIVE" | "PLANNED" | null = "ACTIVE") {
  return render(
    <MantineProvider>
      <GrowingTrialsWorkspace statusFilter={statusFilter} variant="dashboard" />
    </MantineProvider>,
  );
}

describe("GrowingTrialsWorkspace dashboard", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(WeeklyTaskList).mockImplementation(() => <h2>This week</h2>);
    jest.mocked(listGrowingTrials).mockResolvedValue(emptyPage);
    jest.mocked(getGrowingTrialSetupContext).mockResolvedValue({
      hasPlants: true,
      hasContainers: true,
      hasGrowingTrials: true,
    });
    jest.mocked(listGrowingTrialPlantOptions).mockResolvedValue([]);
    jest.mocked(listGrowingTrialContainerOptions).mockResolvedValue([]);
  });

  it("loads Active by default and exposes the selected filter", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValue({ ...emptyPage, items: [activeTrial] });
    renderDashboard();

    await screen.findByRole("heading", { name: "Radish in Pot 1" });
    expect(listGrowingTrials).toHaveBeenCalledWith({
      limit: 20,
      after: null,
      status: "ACTIVE",
      signal: expect.any(AbortSignal),
    });
    expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders the weekly plan before Growing Trial management", async () => {
    renderDashboard();

    await screen.findByRole("heading", { name: "No Active Growing Trials" });
    const weeklyHeading = screen.getByRole("heading", { name: "This week" });
    const trialsHeading = screen.getByRole("heading", {
      name: "Growing Trials",
      level: 2,
    });
    expect(
      weeklyHeading.compareDocumentPosition(trialsHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it.each([
    ["Active", "/"],
    ["Planned", "/?status=planned"],
    ["Completed", "/?status=completed"],
    ["Abandoned", "/?status=abandoned"],
    ["All", "/?status=all"],
  ])("navigates the %s filter through the URL", async (label, href) => {
    renderDashboard();
    await screen.findByRole("heading", { name: "No Active Growing Trials" });

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(mockPush).toHaveBeenCalledWith(href);
  });

  it("guides users to add both missing prerequisites", async () => {
    jest.mocked(getGrowingTrialSetupContext).mockResolvedValue({
      hasPlants: false,
      hasContainers: false,
      hasGrowingTrials: false,
    });
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Set up your garden first" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a Plant" })).toHaveAttribute(
      "href",
      "/plants",
    );
    expect(
      screen.getByRole("link", { name: "Add a Container" }),
    ).toHaveAttribute("href", "/containers");
  });

  it("offers creation when prerequisites exist but no trials do", async () => {
    jest.mocked(getGrowingTrialSetupContext).mockResolvedValue({
      hasPlants: true,
      hasContainers: true,
      hasGrowingTrials: false,
    });
    renderDashboard();

    expect(
      await screen.findByRole("heading", {
        name: "Plan your first Growing Trial",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add Growing Trial" })[1],
    );
    await waitFor(() =>
      expect(listGrowingTrialPlantOptions).toHaveBeenCalled(),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("offers All when the selected status has no matches", async () => {
    renderDashboard("PLANNED");

    await screen.findByRole("heading", { name: "No Planned Growing Trials" });
    fireEvent.click(
      screen.getByRole("button", { name: "View all Growing Trials" }),
    );

    expect(mockPush).toHaveBeenCalledWith("/?status=all");
  });

  it("retries a failed setup-context request", async () => {
    jest
      .mocked(getGrowingTrialSetupContext)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        hasPlants: true,
        hasContainers: true,
        hasGrowingTrials: true,
      });
    renderDashboard();

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByRole("heading", { name: "No Active Growing Trials" });
    expect(getGrowingTrialSetupContext).toHaveBeenCalledTimes(2);
  });

  it("refreshes weekly tasks after a successful start", async () => {
    const started = {
      ...plannedTrial,
      status: "ACTIVE" as const,
      startDate: "2026-08-20",
      startMethod: "SEED" as const,
    };
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValue({ ...emptyPage, items: [plannedTrial] });
    jest.mocked(startGrowingTrial).mockResolvedValue(started);
    renderDashboard("PLANNED");
    fireEvent.click(
      await screen.findByRole("button", { name: "Start Radish in Pot 1" }),
    );
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-08-20" },
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Start method" }));
    fireEvent.click(
      await screen.findByRole("option", { name: "Seed", hidden: true }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Start Growing Trial" }),
    );

    await waitFor(() => expect(latestWeeklyTaskRevision()).toBe(1));
  });

  it.each([
    [
      "Complete Radish in Pot 1",
      "Complete Growing Trial",
      completeGrowingTrial,
      "COMPLETED",
    ],
    [
      "Abandon Radish in Pot 1",
      "Abandon Growing Trial",
      abandonGrowingTrial,
      "ABANDONED",
    ],
  ] as const)(
    "refreshes weekly tasks after %s succeeds",
    async (openButton, submitButton, operation, status) => {
      const updated = {
        ...activeTrial,
        status,
        endDate: "2026-08-20",
      };
      jest
        .mocked(listGrowingTrials)
        .mockResolvedValue({ ...emptyPage, items: [activeTrial] });
      jest.mocked(operation).mockResolvedValue(updated);
      renderDashboard();
      fireEvent.click(await screen.findByRole("button", { name: openButton }));
      fireEvent.change(screen.getByLabelText("End date"), {
        target: { value: "2026-08-20" },
      });

      fireEvent.click(screen.getByRole("button", { name: submitButton }));

      await waitFor(() => expect(latestWeeklyTaskRevision()).toBe(1));
    },
  );
});
