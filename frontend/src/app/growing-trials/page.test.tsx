import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import {
  abandonGrowingTrial,
  completeGrowingTrial,
  createGrowingTrial,
  listGrowingTrialContainerOptions,
  listGrowingTrialPlantOptions,
  listGrowingTrials,
  startGrowingTrial,
  updateGrowingTrialResult,
} from "@/graphql/growingTrials";

import GrowingTrialsPage from "./page";
import { formatDateOnly } from "./presentation";

jest.mock("@mantine/notifications", () => ({
  notifications: { show: jest.fn(), hide: jest.fn() },
}));
jest.mock("@/graphql/growingTrials", () => ({
  abandonGrowingTrial: jest.fn(),
  completeGrowingTrial: jest.fn(),
  createGrowingTrial: jest.fn(),
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
const radish = { id: "2", name: "Radish" };
const pot = { id: "3", name: "Pot 1" };
const plannedTrial = {
  id: "10",
  plant: radish,
  container: pot,
  status: "PLANNED" as const,
  startDate: null,
  startMethod: null,
  endDate: null,
  resultSummary: "",
  createdAt: "2026-08-14T12:00:00Z",
  updatedAt: "2026-08-14T12:00:00Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderPage() {
  return render(
    <MantineProvider>
      <GrowingTrialsPage />
    </MantineProvider>,
  );
}

async function openModal() {
  fireEvent.click(screen.getByRole("button", { name: "Add Growing Trial" }));
  await screen.findByRole("heading", { name: "Add Growing Trial" });
  await waitFor(() => {
    expect(listGrowingTrialPlantOptions).toHaveBeenCalled();
    expect(listGrowingTrialContainerOptions).toHaveBeenCalled();
  });
}

async function selectOption(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(
    await screen.findByRole("option", { name: option, hidden: true }),
  );
}

describe("GrowingTrialsPage", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(listGrowingTrials).mockResolvedValue(emptyPage);
    jest.mocked(listGrowingTrialPlantOptions).mockResolvedValue([radish]);
    jest.mocked(listGrowingTrialContainerOptions).mockResolvedValue([pot]);
  });

  it("loads the first cursor page and exposes initial loading accessibly", async () => {
    const pending = deferred<typeof emptyPage>();
    jest.mocked(listGrowingTrials).mockReturnValue(pending.promise);
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading Growing Trials...",
    );
    await waitFor(() =>
      expect(listGrowingTrials).toHaveBeenCalledWith(20, null),
    );
    await act(async () => pending.resolve(emptyPage));
  });

  it("navigates Next and Previous through cursor history", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce({
        items: [plannedTrial],
        hasNextPage: true,
        hasPreviousPage: false,
        endCursor: "cursor-10",
      })
      .mockResolvedValueOnce({
        items: [{ ...plannedTrial, id: "9" }],
        hasNextPage: false,
        hasPreviousPage: true,
        endCursor: "cursor-9",
      })
      .mockResolvedValueOnce({
        items: [plannedTrial],
        hasNextPage: true,
        hasPreviousPage: false,
        endCursor: "cursor-10",
      });
    renderPage();

    await screen.findByRole("heading", { name: "Radish in Pot 1" });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(listGrowingTrials).toHaveBeenLastCalledWith(20, "cursor-10"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() =>
      expect(listGrowingTrials).toHaveBeenLastCalledWith(20, null),
    );
  });

  it("opens with exactly two bounded option requests", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    await openModal();

    expect(listGrowingTrialPlantOptions).toHaveBeenCalledTimes(1);
    expect(listGrowingTrialContainerOptions).toHaveBeenCalledTimes(1);
    expect(listGrowingTrialPlantOptions).toHaveBeenCalledWith(
      "",
      20,
      expect.any(AbortSignal),
    );
  });

  it("renders a successful mutation immediately and confirms both names", async () => {
    const refresh = deferred<typeof emptyPage>();
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce(emptyPage)
      .mockReturnValueOnce(refresh.promise);
    jest.mocked(createGrowingTrial).mockResolvedValue(plannedTrial);
    renderPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    await openModal();
    await selectOption("Plant", "Radish");
    await selectOption("Container", "Pot 1");

    fireEvent.click(
      screen.getByRole("button", { name: "Create Growing Trial" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Radish in Pot 1" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Growing Trial created",
        message: "Radish in Pot 1",
        autoClose: 5000,
      }),
    );
    await act(async () =>
      refresh.resolve({ ...emptyPage, items: [plannedTrial] }),
    );
  });

  it("retains the created trial and offers Retry when refresh fails", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce(emptyPage)
      .mockRejectedValueOnce(new Error("Refresh failed"))
      .mockResolvedValueOnce({ ...emptyPage, items: [plannedTrial] });
    jest.mocked(createGrowingTrial).mockResolvedValue(plannedTrial);
    renderPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    await openModal();
    await selectOption("Plant", "Radish");
    await selectOption("Container", "Pot 1");
    fireEvent.submit(
      screen.getByRole("button", { name: "Create Growing Trial" }),
    );

    await screen.findByRole("heading", { name: "Radish in Pot 1" });
    await waitFor(() => expect(notifications.show).toHaveBeenCalledTimes(2));
    const warning = jest.mocked(notifications.show).mock.calls[1][0];
    const { getByRole } = render(
      <MantineProvider>{warning.message}</MantineProvider>,
    );
    fireEvent.click(getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(notifications.hide).toHaveBeenCalledWith(
        "growing-trial-refresh-failed",
      ),
    );
  });

  it("preserves selections after mutation failure and permits retry", async () => {
    jest.mocked(createGrowingTrial).mockRejectedValue(new Error("Save failed"));
    renderPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    await openModal();
    await selectOption("Plant", "Radish");
    await selectOption("Container", "Pot 1");
    fireEvent.submit(
      screen.getByRole("button", { name: "Create Growing Trial" }),
    );

    expect(
      await screen.findByText("Growing Trial could not be saved."),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Plant" })).toHaveValue(
      "Radish",
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "Create Growing Trial" }),
    );
    await waitFor(() => expect(createGrowingTrial).toHaveBeenCalledTimes(2));
  });

  it("debounces remote search and reuses the per-session cache", async () => {
    jest.mocked(listGrowingTrialPlantOptions).mockResolvedValue([radish]);
    renderPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    await openModal();
    const plant = screen.getByRole("combobox", { name: "Plant" });

    fireEvent.change(plant, { target: { value: "rad" } });
    expect(listGrowingTrialPlantOptions).toHaveBeenCalledTimes(1);
    await waitFor(
      () => expect(listGrowingTrialPlantOptions).toHaveBeenCalledTimes(2),
      { timeout: 500 },
    );
    fireEvent.change(plant, { target: { value: "" } });
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 350)));
    expect(listGrowingTrialPlantOptions).toHaveBeenCalledTimes(2);
  });

  it("does not refresh options or shift the modal when relationships are selected", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    await openModal();

    await selectOption("Plant", "Radish");
    await selectOption("Container", "Pot 1");
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 350)));

    expect(listGrowingTrialPlantOptions).toHaveBeenCalledTimes(1);
    expect(listGrowingTrialContainerOptions).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText("Loading Plant and Container options..."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Plant" })).toHaveValue(
      "Radish",
    );
    expect(screen.getByRole("combobox", { name: "Container" })).toHaveValue(
      "Pot 1",
    );
  });

  it("aborts option requests on close and starts a clean session on reopen", async () => {
    const pending = deferred<(typeof radish)[]>();
    jest.mocked(listGrowingTrialPlantOptions).mockReturnValue(pending.promise);
    renderPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    await openModal();
    const signal = jest.mocked(listGrowingTrialPlantOptions).mock.calls[0][2]!;
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(signal.aborted).toBe(true);

    jest.mocked(listGrowingTrialPlantOptions).mockResolvedValue([radish]);
    await openModal();
    expect(listGrowingTrialPlantOptions).toHaveBeenCalledTimes(2);
  });

  it("clears corrected errors and focuses the first invalid selector", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    await openModal();
    const submit = screen.getByRole("button", { name: "Create Growing Trial" });
    fireEvent.click(submit);

    expect(screen.getByRole("combobox", { name: "Plant" })).toHaveFocus();
    expect(screen.getByText("Select a Plant.")).toBeInTheDocument();
    await selectOption("Plant", "Radish");
    expect(screen.queryByText("Select a Plant.")).not.toBeInTheDocument();
    fireEvent.click(submit);
    expect(screen.getByRole("combobox", { name: "Container" })).toHaveFocus();
  });

  it("submits with Enter and prevents cancellation while saving", async () => {
    const pending = deferred<typeof plannedTrial>();
    jest.mocked(createGrowingTrial).mockReturnValue(pending.promise);
    renderPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    await openModal();
    await selectOption("Plant", "Radish");
    await selectOption("Container", "Pot 1");

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Container" }), {
      key: "Enter",
      code: "Enter",
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Create Growing Trial" }),
    );
    await waitFor(() => expect(createGrowingTrial).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Saving Growing Trial...",
    );
    await act(async () => pending.resolve(plannedTrial));
  });

  it("distinguishes missing records from no search matches", async () => {
    jest.mocked(listGrowingTrialPlantOptions).mockResolvedValue([]);
    renderPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    await openModal();
    expect(await screen.findByText("A Plant is required.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create a Plant" }),
    ).toHaveAttribute("href", "/plants");
  });

  it("shows a contextual Start control only for planned trials and localizes active details", async () => {
    jest.mocked(listGrowingTrials).mockResolvedValue({
      ...emptyPage,
      items: [
        plannedTrial,
        {
          ...plannedTrial,
          id: "11",
          status: "ACTIVE",
          startDate: "2026-08-13",
          startMethod: "SEEDLING_TRANSPLANT",
        },
        { ...plannedTrial, id: "12", status: "COMPLETED" },
        { ...plannedTrial, id: "13", status: "ABANDONED" },
      ],
    });
    renderPage();

    await screen.findAllByRole("heading", { name: "Radish in Pot 1" });
    expect(
      screen.getAllByRole("button", { name: "Start Radish in Pot 1" }),
    ).toHaveLength(1);
    const displayedDate = document.querySelector('time[datetime="2026-08-13"]');
    expect(displayedDate).toHaveTextContent(formatDateOnly("2026-08-13"));
    expect(
      screen.getByText("Start method: Seedling/transplant"),
    ).toBeInTheDocument();
  });

  it("opens the selected trial with local date defaults and no start method", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValue({ ...emptyPage, items: [plannedTrial] });
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Start Radish in Pot 1" }),
    );

    expect(
      screen.getByRole("heading", { name: "Start Growing Trial" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Radish in Pot 1")).toHaveLength(2);
    const date = screen.getByLabelText("Start date");
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(date).toHaveValue(expected);
    expect(date).toHaveAttribute("max", expected);
    expect(screen.getByRole("combobox", { name: "Start method" })).toHaveValue(
      "",
    );
  });

  it("recomputes the local maximum date for each modal session", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValue({ ...emptyPage, items: [plannedTrial] });
    renderPage();
    await screen.findByRole("button", { name: "Start Radish in Pot 1" });
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 14, 12));

    fireEvent.click(
      screen.getByRole("button", { name: "Start Radish in Pot 1" }),
    );
    expect(screen.getByLabelText("Start date")).toHaveAttribute(
      "max",
      "2026-08-14",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    jest.setSystemTime(new Date(2026, 7, 15, 12));
    fireEvent.click(
      screen.getByRole("button", { name: "Start Radish in Pot 1" }),
    );
    expect(screen.getByLabelText("Start date")).toHaveAttribute(
      "max",
      "2026-08-15",
    );
    jest.useRealTimers();
  });

  it("validates required and future start values", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValue({ ...emptyPage, items: [plannedTrial] });
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Start Radish in Pot 1" }),
    );
    const date = screen.getByLabelText("Start date");
    fireEvent.change(date, { target: { value: "" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Start Growing Trial" }),
    );
    expect(screen.getByText("Select a start date.")).toBeInTheDocument();
    expect(date).toHaveFocus();

    fireEvent.change(date, { target: { value: "9999-12-31" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Start Growing Trial" }),
    );
    expect(
      screen.getByText("Start date cannot be in the future."),
    ).toBeInTheDocument();
    expect(startGrowingTrial).not.toHaveBeenCalled();
  });

  it("submits exact variables and replaces only the started card", async () => {
    const other = { ...plannedTrial, id: "11" };
    const active = {
      ...plannedTrial,
      status: "ACTIVE" as const,
      startDate: "2026-08-12",
      startMethod: "SEED" as const,
    };
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce({
        ...emptyPage,
        items: [plannedTrial, other],
      })
      .mockResolvedValueOnce({ ...emptyPage, items: [active, other] });
    jest.mocked(startGrowingTrial).mockResolvedValue(active);
    renderPage();
    const startButtons = await screen.findAllByRole("button", {
      name: "Start Radish in Pot 1",
    });
    fireEvent.click(startButtons[0]);
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-08-12" },
    });
    await selectOption("Start method", "Seed");
    fireEvent.click(
      screen.getByRole("button", { name: "Start Growing Trial" }),
    );

    await waitFor(() =>
      expect(startGrowingTrial).toHaveBeenCalledWith(
        "10",
        "2026-08-12",
        "SEED",
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      document.querySelector('time[datetime="2026-08-12"]'),
    ).toHaveTextContent(formatDateOnly("2026-08-12"));
    expect(
      screen.getAllByRole("button", { name: "Start Radish in Pot 1" }),
    ).toHaveLength(1);
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Growing Trial started",
        message: "Radish in Pot 1 is now active.",
      }),
    );
    await waitFor(() =>
      expect(document.getElementById("growing-trial-10")).toHaveFocus(),
    );
  });

  it.each([
    ["START_DATE_IN_FUTURE", "Start date cannot be in the future."],
    [
      "INVALID_TIME_ZONE",
      "Browser time zone is invalid; refresh and try again.",
    ],
  ])("maps the %s GraphQL error code", async (code, message) => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValue({ ...emptyPage, items: [plannedTrial] });
    jest.mocked(startGrowingTrial).mockRejectedValue({
      response: { errors: [{ extensions: { code } }] },
    });
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Start Radish in Pot 1" }),
    );
    await selectOption("Start method", "Seed");
    fireEvent.click(
      screen.getByRole("button", { name: "Start Growing Trial" }),
    );

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it.each([
    [
      "GROWING_TRIAL_NOT_FOUND",
      "This Growing Trial no longer exists. Refreshing the list.",
    ],
    [
      "GROWING_TRIAL_NOT_PLANNED",
      "This Growing Trial is no longer planned, so it cannot be started again. Refreshing the list.",
    ],
    [
      "CONTAINER_OCCUPIED",
      "This Container now has an active Growing Trial. Refreshing the list.",
    ],
  ])("closes, refreshes, and notifies for %s", async (code, message) => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValue({ ...emptyPage, items: [plannedTrial] });
    jest.mocked(startGrowingTrial).mockRejectedValue({
      response: { errors: [{ extensions: { code } }] },
    });
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Start Radish in Pot 1" }),
    );
    await selectOption("Start method", "Seed");
    fireEvent.click(
      screen.getByRole("button", { name: "Start Growing Trial" }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Growing Trial was not started",
        message,
      }),
    );
    await waitFor(() => expect(listGrowingTrials).toHaveBeenCalledTimes(2));
    expect(startGrowingTrial).toHaveBeenCalledTimes(1);
  });

  it("does not let an older conflict refresh revert a later successful start", async () => {
    const staleRefresh = deferred<typeof emptyPage>();
    const reconciliation = deferred<typeof emptyPage>();
    const active = {
      ...plannedTrial,
      status: "ACTIVE" as const,
      startDate: "2026-08-12",
      startMethod: "SEED" as const,
    };
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce({ ...emptyPage, items: [plannedTrial] })
      .mockReturnValueOnce(staleRefresh.promise)
      .mockReturnValueOnce(reconciliation.promise);
    jest
      .mocked(startGrowingTrial)
      .mockRejectedValueOnce({
        response: {
          errors: [{ extensions: { code: "GROWING_TRIAL_NOT_PLANNED" } }],
        },
      })
      .mockResolvedValueOnce(active);
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Start Radish in Pot 1" }),
    );
    await selectOption("Start method", "Seed");
    fireEvent.click(
      screen.getByRole("button", { name: "Start Growing Trial" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(
      screen.getByRole("button", { name: "Start Radish in Pot 1" }),
    );
    await selectOption("Start method", "Seed");
    fireEvent.click(
      screen.getByRole("button", { name: "Start Growing Trial" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await act(async () =>
      staleRefresh.resolve({ ...emptyPage, items: [plannedTrial] }),
    );
    expect(
      screen.queryByRole("button", { name: "Start Radish in Pot 1" }),
    ).toBeNull();
    expect(screen.getByText("Active")).toBeInTheDocument();

    await act(async () =>
      reconciliation.resolve({ ...emptyPage, items: [active] }),
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("preserves start values after an unknown failure, prevents closure while saving, and permits retry", async () => {
    const pending = deferred<typeof plannedTrial>();
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValue({ ...emptyPage, items: [plannedTrial] });
    jest
      .mocked(startGrowingTrial)
      .mockReturnValueOnce(pending.promise)
      .mockRejectedValueOnce(new Error("network"));
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Start Radish in Pot 1" }),
    );
    await selectOption("Start method", "Seedling/transplant");
    fireEvent.click(
      screen.getByRole("button", { name: "Start Growing Trial" }),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Starting Growing Trial...",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => pending.reject(new Error("network")));

    expect(
      await screen.findByText(
        "Growing Trial could not be started. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Start method" })).toHaveValue(
      "Seedling/transplant",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Start Growing Trial" }),
    );
    await waitFor(() => expect(startGrowingTrial).toHaveBeenCalledTimes(2));
  });

  it("shows lifecycle actions by status and terminal details", async () => {
    jest.mocked(listGrowingTrials).mockResolvedValue({
      ...emptyPage,
      items: [
        plannedTrial,
        {
          ...plannedTrial,
          id: "11",
          status: "ACTIVE",
          startDate: "2026-08-10",
          startMethod: "SEED",
        },
        {
          ...plannedTrial,
          id: "12",
          status: "COMPLETED",
          startDate: "2026-08-10",
          startMethod: "SEED",
          endDate: "2026-08-15",
          resultSummary: "Harvested crisp radishes.",
        },
        {
          ...plannedTrial,
          id: "13",
          status: "ABANDONED",
          endDate: "2026-08-14",
        },
      ],
    });

    renderPage();
    await screen.findAllByRole("heading", { name: "Radish in Pot 1" });

    expect(
      screen.getAllByRole("button", { name: "Start Radish in Pot 1" }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "Complete Radish in Pot 1" }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "Abandon Radish in Pot 1" }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("button", {
        name: "Edit result for Radish in Pot 1",
      }),
    ).toHaveLength(2);
    expect(
      document.querySelector('time[datetime="2026-08-15"]'),
    ).toHaveTextContent(formatDateOnly("2026-08-15"));
    expect(screen.getAllByText("Result summary")).toHaveLength(2);
    fireEvent.click(screen.getAllByText("Result summary")[0]);
    expect(screen.getByText("Harvested crisp radishes.")).toBeVisible();
  });

  it.each([
    ["Complete Radish in Pot 1", "Complete Growing Trial"],
    ["Abandon Radish in Pot 1", "Abandon Growing Trial"],
  ])(
    "opens %s with a browser-local date default",
    async (buttonName, title) => {
      const active = {
        ...plannedTrial,
        status: "ACTIVE" as const,
        startDate: "2026-08-01",
        startMethod: "SEED" as const,
      };
      jest
        .mocked(listGrowingTrials)
        .mockResolvedValue({ ...emptyPage, items: [active] });
      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: buttonName }));

      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      expect(screen.getByLabelText("End date")).toHaveValue(expected);
      expect(screen.getByLabelText("End date")).toHaveAttribute(
        "max",
        expected,
      );
      expect(screen.getByLabelText("End date")).toHaveAttribute(
        "min",
        "2026-08-01",
      );
      expect(screen.getByLabelText("Result summary (optional)")).toHaveValue(
        "",
      );
    },
  );

  it("validates end dates before submitting", async () => {
    const active = {
      ...plannedTrial,
      status: "ACTIVE" as const,
      startDate: "2026-08-10",
      startMethod: "SEED" as const,
    };
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValue({ ...emptyPage, items: [active] });
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Complete Radish in Pot 1" }),
    );
    const date = screen.getByLabelText("End date");
    fireEvent.change(date, { target: { value: "2026-08-09" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Complete Growing Trial" }),
    );

    expect(
      screen.getByText("End date cannot be before the start date."),
    ).toBeInTheDocument();
    expect(date).toHaveFocus();
    expect(completeGrowingTrial).not.toHaveBeenCalled();
  });

  it("rejects a normalized result summary over 5,000 characters", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValue({ ...emptyPage, items: [plannedTrial] });
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Abandon Radish in Pot 1" }),
    );
    const summary = screen.getByLabelText("Result summary (optional)");
    fireEvent.change(summary, { target: { value: `  ${"x".repeat(5001)}  ` } });
    fireEvent.click(
      screen.getByRole("button", { name: "Abandon Growing Trial" }),
    );

    expect(
      screen.getByText("Result summary cannot exceed 5,000 characters."),
    ).toBeInTheDocument();
    expect(summary).toHaveFocus();
    expect(abandonGrowingTrial).not.toHaveBeenCalled();
  });

  it("submits exact Complete variables, replaces one card, and restores focus", async () => {
    const other = { ...plannedTrial, id: "11" };
    const active = {
      ...plannedTrial,
      status: "ACTIVE" as const,
      startDate: "2026-08-10",
      startMethod: "SEED" as const,
    };
    const completed = {
      ...active,
      status: "COMPLETED" as const,
      endDate: "2026-08-15",
      resultSummary: "Strong harvest",
    };
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce({ ...emptyPage, items: [active, other] })
      .mockResolvedValueOnce({ ...emptyPage, items: [completed, other] });
    jest.mocked(completeGrowingTrial).mockResolvedValue(completed);
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Complete Radish in Pot 1" }),
    );
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-08-15" },
    });
    fireEvent.change(screen.getByLabelText("Result summary (optional)"), {
      target: { value: "Strong harvest" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Complete Growing Trial" }),
    );

    await waitFor(() =>
      expect(completeGrowingTrial).toHaveBeenCalledWith(
        "10",
        "2026-08-15",
        "Strong harvest",
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Start Radish in Pot 1" }),
    ).toHaveLength(1);
    await waitFor(() =>
      expect(document.getElementById("growing-trial-10")).toHaveFocus(),
    );
  });

  it("prepopulates terminal Edit and preserves status", async () => {
    const abandoned = {
      ...plannedTrial,
      status: "ABANDONED" as const,
      endDate: "2026-08-14",
      resultSummary: "Pests damaged seedlings.",
    };
    const revised = {
      ...abandoned,
      endDate: "2026-08-15",
      resultSummary: "Revised result",
    };
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce({ ...emptyPage, items: [abandoned] })
      .mockResolvedValueOnce({ ...emptyPage, items: [revised] });
    jest.mocked(updateGrowingTrialResult).mockResolvedValue(revised);
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit result for Radish in Pot 1",
      }),
    );

    expect(screen.getByLabelText("End date")).toHaveValue("2026-08-14");
    expect(screen.getByLabelText("Result summary (optional)")).toHaveValue(
      "Pests damaged seedlings.",
    );
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-08-15" },
    });
    fireEvent.change(screen.getByLabelText("Result summary (optional)"), {
      target: { value: "Revised result" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Result" }));

    await waitFor(() =>
      expect(updateGrowingTrialResult).toHaveBeenCalledWith(
        "10",
        "2026-08-15",
        "Revised result",
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    );
    expect(screen.getByText("Abandoned")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Complete Radish in Pot 1" }),
    ).not.toBeInTheDocument();
  });

  it("keeps terminal values after recoverable failure and prevents duplicate submission", async () => {
    const active = {
      ...plannedTrial,
      status: "ACTIVE" as const,
      startDate: "2026-08-10",
      startMethod: "SEED" as const,
    };
    const pending = deferred<typeof active>();
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValue({ ...emptyPage, items: [active] });
    jest
      .mocked(abandonGrowingTrial)
      .mockReturnValueOnce(pending.promise)
      .mockRejectedValueOnce(new Error("network"));
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Abandon Radish in Pot 1" }),
    );
    fireEvent.change(screen.getByLabelText("Result summary (optional)"), {
      target: { value: "Weather damage" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Abandon Growing Trial" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Abandon Growing Trial" }),
    );
    expect(abandonGrowingTrial).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await act(async () => pending.reject(new Error("network")));

    expect(
      await screen.findByText(
        "Growing Trial could not be updated. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Result summary (optional)")).toHaveValue(
      "Weather damage",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Abandon Growing Trial" }),
    );
    await waitFor(() => expect(abandonGrowingTrial).toHaveBeenCalledTimes(2));
  });

  it("closes and refreshes after a stale terminal conflict", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValue({ ...emptyPage, items: [plannedTrial] });
    jest.mocked(abandonGrowingTrial).mockRejectedValue({
      response: {
        errors: [{ extensions: { code: "GROWING_TRIAL_NOT_ENDABLE" } }],
      },
    });
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Abandon Radish in Pot 1" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Abandon Growing Trial" }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Growing Trial was not updated",
        message:
          "This Growing Trial can no longer be abandoned. Refreshing the list.",
      }),
    );
    await waitFor(() => expect(listGrowingTrials).toHaveBeenCalledTimes(2));
  });
});
