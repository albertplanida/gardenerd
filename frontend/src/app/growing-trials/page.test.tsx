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
  createGrowingTrial,
  listGrowingTrialContainerOptions,
  listGrowingTrialPlantOptions,
  listGrowingTrials,
} from "@/graphql/growingTrials";

import GrowingTrialsPage from "./page";

jest.mock("@mantine/notifications", () => ({
  notifications: { show: jest.fn(), hide: jest.fn() },
}));
jest.mock("@/graphql/growingTrials", () => ({
  createGrowingTrial: jest.fn(),
  listGrowingTrials: jest.fn(),
  listGrowingTrialPlantOptions: jest.fn(),
  listGrowingTrialContainerOptions: jest.fn(),
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
});
