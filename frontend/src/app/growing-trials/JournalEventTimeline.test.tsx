import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import {
  createJournalEvent,
  deleteJournalEvent,
  listJournalEvents,
  updateJournalEvent,
} from "@/graphql/journalEvents";

import { JournalEventTimeline } from "./JournalEventTimeline";

jest.mock("@mantine/notifications", () => ({
  notifications: { show: jest.fn(), hide: jest.fn() },
}));
jest.mock("@/graphql/journalEvents", () => {
  const actual = jest.requireActual("@/graphql/journalEvents");
  return {
    ...actual,
    createJournalEvent: jest.fn(),
    deleteJournalEvent: jest.fn(),
    listJournalEvents: jest.fn(),
    updateJournalEvent: jest.fn(),
  };
});

const trial = {
  id: "10",
  plant: { id: "2", name: "Radish" },
  container: { id: "3", name: "Pot 1" },
  status: "ACTIVE" as const,
  startDate: "2026-08-01",
  startMethod: "SEED" as const,
  endDate: null,
  resultSummary: "",
  createdAt: "2026-08-01T12:00:00Z",
  updatedAt: "2026-08-01T12:00:00Z",
};
const watered = {
  id: "20",
  eventType: "WATERED" as const,
  eventDate: "2026-08-10",
  note: "Watered deeply.\nSoil was dry.",
  createdAt: "2026-08-10T12:00:00Z",
  updatedAt: "2026-08-10T12:00:00Z",
};
const emptyPage = {
  items: [],
  hasNextPage: false,
  hasPreviousPage: false,
  endCursor: null,
};
const onRefreshTrials = jest.fn(async () => "applied");

function renderTimeline(status = trial.status) {
  return render(
    <MantineProvider>
      <div id={`growing-trial-${trial.id}`} tabIndex={-1}>
        <JournalEventTimeline
          onRefreshTrials={onRefreshTrials}
          trial={{ ...trial, status }}
        />
      </div>
    </MantineProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function chooseType(name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Event type" }));
  fireEvent.click(await screen.findByRole("option", { name, hidden: true }));
}

describe("JournalEventTimeline", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(listJournalEvents).mockResolvedValue(emptyPage);
  });

  it("loads only on first expansion and associates the accessible region", async () => {
    renderTimeline();
    const toggle = screen.getByRole("button", { name: "Show Journal" });
    expect(listJournalEvents).not.toHaveBeenCalled();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("region", { name: "Journal timeline" }),
    ).toHaveAttribute("id", toggle.getAttribute("aria-controls"));
    await waitFor(() =>
      expect(listJournalEvents).toHaveBeenCalledWith("10", 20, null),
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide Journal" }));
    fireEvent.click(screen.getByRole("button", { name: "Show Journal" }));
    expect(listJournalEvents).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "PLANNED",
      "Journal Events become available after this Growing Trial starts.",
    ],
    [
      "COMPLETED",
      "No Journal Events were recorded before this Growing Trial ended.",
    ],
    [
      "ABANDONED",
      "No Journal Events were recorded before this Growing Trial ended.",
    ],
  ] as const)("keeps %s timelines read-only", async (status, emptyMessage) => {
    renderTimeline(status);
    fireEvent.click(screen.getByRole("button", { name: "Show Journal" }));
    expect(await screen.findByText(emptyMessage)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add Journal Event" }),
    ).not.toBeInTheDocument();
  });

  it("appends cursor pages and preserves note line breaks", async () => {
    const older = {
      ...watered,
      id: "19",
      eventType: "PLANTED" as const,
      eventDate: "2026-08-01",
      note: "Planted seeds.",
    };
    jest
      .mocked(listJournalEvents)
      .mockResolvedValueOnce({
        items: [watered],
        hasNextPage: true,
        hasPreviousPage: false,
        endCursor: "event-cursor-20",
      })
      .mockResolvedValueOnce({
        items: [older],
        hasNextPage: false,
        hasPreviousPage: true,
        endCursor: "event-cursor-19",
      });
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: "Show Journal" }));
    const note = await screen.findByText(/Watered deeply/);
    expect(note).toHaveStyle({ whiteSpace: "pre-wrap" });
    fireEvent.click(
      screen.getByRole("button", { name: "Load more Journal Events" }),
    );
    expect(await screen.findByText("Planted seeds.")).toBeInTheDocument();
    expect(listJournalEvents).toHaveBeenLastCalledWith(
      "10",
      20,
      "event-cursor-20",
    );
  });

  it("supersedes an in-flight Load more when a mutation reconciles page one", async () => {
    const older = {
      ...watered,
      id: "19",
      eventType: "PLANTED" as const,
      eventDate: "2026-08-01",
      note: "Stale older event",
    };
    const created = {
      ...watered,
      id: "21",
      eventType: "HARVESTED" as const,
      eventDate: "2026-08-12",
      note: "Fresh first page",
    };
    const pendingOlderPage = deferred<{
      items: (typeof older)[];
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      endCursor: string | null;
    }>();
    jest
      .mocked(listJournalEvents)
      .mockResolvedValueOnce({
        ...emptyPage,
        items: [watered],
        hasNextPage: true,
        endCursor: "event-cursor-20",
      })
      .mockReturnValueOnce(pendingOlderPage.promise)
      .mockResolvedValueOnce({
        ...emptyPage,
        items: [created],
        hasNextPage: true,
        endCursor: "event-cursor-21",
      });
    jest.mocked(createJournalEvent).mockResolvedValue(created);
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: "Show Journal" }));
    await screen.findByText(/Watered deeply/);
    fireEvent.click(
      screen.getByRole("button", { name: "Load more Journal Events" }),
    );
    await waitFor(() =>
      expect(listJournalEvents).toHaveBeenLastCalledWith(
        "10",
        20,
        "event-cursor-20",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Journal Event" }));
    await chooseType("Harvested");
    fireEvent.change(screen.getByLabelText("Event date"), {
      target: { value: created.eventDate },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: created.note },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add Journal Event",
      }),
    );
    await waitFor(() => expect(createJournalEvent).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole("button", {
        name: "Edit Harvested Journal Event from 2026-08-12",
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(listJournalEvents).toHaveBeenLastCalledWith("10", 20, null),
    );

    await act(async () =>
      pendingOlderPage.resolve({
        ...emptyPage,
        items: [older],
        hasPreviousPage: true,
      }),
    );
    expect(screen.queryByText(older.note)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Edit Harvested Journal Event from 2026-08-12",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Load more Journal Events" }),
    ).toBeEnabled();
  });

  it("validates create values, submits exact normalized variables, and reconciles page one", async () => {
    jest.mocked(createJournalEvent).mockResolvedValue(watered);
    jest
      .mocked(listJournalEvents)
      .mockResolvedValueOnce(emptyPage)
      .mockResolvedValueOnce({ ...emptyPage, items: [watered] });
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: "Show Journal" }));
    await screen.findByText("No Journal Events have been recorded yet.");
    const add = screen.getByRole("button", { name: "Add Journal Event" });
    fireEvent.click(add);
    fireEvent.change(screen.getByLabelText("Event date"), {
      target: { value: "2026-07-31" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "   " },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add Journal Event",
      }),
    );
    expect(screen.getByText("Select an event type.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Event type" })).toHaveFocus();

    await chooseType("Watered");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add Journal Event",
      }),
    );
    expect(
      screen.getByText(
        "Event date cannot be before the Growing Trial start date.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Event date"), {
      target: { value: "2026-08-10" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "  Watered deeply.\nSoil was dry.  " },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add Journal Event",
      }),
    );

    await waitFor(() =>
      expect(createJournalEvent).toHaveBeenCalledWith("10", {
        eventType: "WATERED",
        eventDate: "2026-08-10",
        note: "Watered deeply.\nSoil was dry.",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    );
    expect(
      await screen.findByRole("button", {
        name: "Edit Watered Journal Event from 2026-08-10",
      }),
    ).toBeInTheDocument();
    expect(listJournalEvents).toHaveBeenLastCalledWith("10", 20, null);
    await waitFor(() => expect(add).toHaveFocus());
  });

  it("preserves form values and permits retry after a recoverable save failure", async () => {
    jest
      .mocked(createJournalEvent)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(watered);
    jest
      .mocked(listJournalEvents)
      .mockResolvedValueOnce(emptyPage)
      .mockResolvedValueOnce({ ...emptyPage, items: [watered] });
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: "Show Journal" }));
    await screen.findByText("No Journal Events have been recorded yet.");
    fireEvent.click(screen.getByRole("button", { name: "Add Journal Event" }));
    await chooseType("Watered");
    fireEvent.change(screen.getByLabelText("Event date"), {
      target: { value: watered.eventDate },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: watered.note },
    });
    const submit = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Add Journal Event",
    });
    fireEvent.click(submit);

    expect(await screen.findByText(/could not be saved/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Event type" })).toHaveValue(
      "Watered",
    );
    expect(screen.getByLabelText("Event date")).toHaveValue(watered.eventDate);
    expect(screen.getByLabelText("Note")).toHaveValue(watered.note);
    fireEvent.click(submit);

    await waitFor(() => expect(createJournalEvent).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByRole("button", {
        name: "Edit Watered Journal Event from 2026-08-10",
      }),
    ).toBeInTheDocument();
  });

  it("edits, reorders, and deletes through confirmation with first-page reconciliation", async () => {
    const edited = {
      ...watered,
      eventType: "HARVESTED" as const,
      eventDate: "2026-08-12",
      note: "First harvest",
    };
    jest
      .mocked(listJournalEvents)
      .mockResolvedValueOnce({ ...emptyPage, items: [watered] })
      .mockResolvedValueOnce({ ...emptyPage, items: [edited] })
      .mockResolvedValueOnce(emptyPage);
    jest.mocked(updateJournalEvent).mockResolvedValue(edited);
    jest.mocked(deleteJournalEvent).mockResolvedValue("20");
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: "Show Journal" }));
    const editButton = await screen.findByRole("button", {
      name: "Edit Watered Journal Event from 2026-08-10",
    });
    fireEvent.click(editButton);
    expect(screen.getByLabelText("Note")).toHaveValue(watered.note);
    await chooseType("Harvested");
    fireEvent.change(screen.getByLabelText("Event date"), {
      target: { value: "2026-08-12" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "First harvest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Journal Event" }));
    await waitFor(() =>
      expect(updateJournalEvent).toHaveBeenCalledWith(
        "20",
        expect.objectContaining({
          eventType: "HARVESTED",
          eventDate: "2026-08-12",
          note: "First harvest",
        }),
      ),
    );
    expect(await screen.findByText("First harvest")).toBeInTheDocument();
    await waitFor(() => expect(editButton).toHaveFocus());

    const deleteButton = screen.getByRole("button", {
      name: "Delete Harvested Journal Event from 2026-08-12",
    });
    fireEvent.click(deleteButton);
    expect(
      screen.getByText(/Permanently delete the Harvested event/),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Journal Event" }),
    );
    await waitFor(() => expect(deleteJournalEvent).toHaveBeenCalledWith("20"));
    expect(screen.queryByText("First harvest")).not.toBeInTheDocument();
    expect(listJournalEvents).toHaveBeenLastCalledWith("10", 20, null);
    await waitFor(() =>
      expect(document.getElementById("growing-trial-10")).toHaveFocus(),
    );
  });

  it("prevents duplicate delete or closure and refreshes after a lifecycle conflict", async () => {
    const pendingDelete = deferred<string>();
    jest
      .mocked(listJournalEvents)
      .mockResolvedValueOnce({ ...emptyPage, items: [watered] })
      .mockResolvedValueOnce({ ...emptyPage, items: [watered] });
    jest.mocked(deleteJournalEvent).mockReturnValue(pendingDelete.promise);
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: "Show Journal" }));
    const deleteButton = await screen.findByRole("button", {
      name: "Delete Watered Journal Event from 2026-08-10",
    });
    fireEvent.click(deleteButton);
    const confirm = screen.getByRole("button", {
      name: "Delete Journal Event",
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(deleteJournalEvent).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () =>
      pendingDelete.reject({
        response: {
          errors: [{ extensions: { code: "GROWING_TRIAL_NOT_ACTIVE" } }],
        },
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onRefreshTrials).toHaveBeenCalledTimes(1);
    expect(listJournalEvents).toHaveBeenLastCalledWith("10", 20, null);
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Journal Event was not changed" }),
    );
    await waitFor(() => expect(deleteButton).toHaveFocus());
  });

  it("keeps a confirmed mutation and retries failed reconciliation", async () => {
    jest.mocked(createJournalEvent).mockResolvedValue(watered);
    jest
      .mocked(listJournalEvents)
      .mockResolvedValueOnce(emptyPage)
      .mockRejectedValueOnce(new Error("refresh failed"))
      .mockResolvedValueOnce({ ...emptyPage, items: [watered] });
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: "Show Journal" }));
    await screen.findByText("No Journal Events have been recorded yet.");
    fireEvent.click(screen.getByRole("button", { name: "Add Journal Event" }));
    await chooseType("Watered");
    fireEvent.change(screen.getByLabelText("Event date"), {
      target: { value: watered.eventDate },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: watered.note },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add Journal Event",
      }),
    );

    expect(
      await screen.findByRole("button", {
        name: "Edit Watered Journal Event from 2026-08-10",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("The Journal timeline may be out of date."),
    ).toBeInTheDocument();
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "The Journal timeline could not be refreshed.",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Retry Journal refresh" }),
    );

    await waitFor(() => expect(listJournalEvents).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(
        screen.queryByText("The Journal timeline may be out of date."),
      ).toBeNull(),
    );
    expect(
      screen.getByRole("button", {
        name: "Edit Watered Journal Event from 2026-08-10",
      }),
    ).toBeInTheDocument();
  });

  it("prevents closure while saving and closes both actions on lifecycle conflict", async () => {
    let rejectSave!: (error: unknown) => void;
    const pending = new Promise<typeof watered>((_resolve, reject) => {
      rejectSave = reject;
    });
    jest.mocked(createJournalEvent).mockReturnValue(pending);
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: "Show Journal" }));
    await screen.findByText("No Journal Events have been recorded yet.");
    fireEvent.click(screen.getByRole("button", { name: "Add Journal Event" }));
    await chooseType("Watered");
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Watered" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add Journal Event",
      }),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () =>
      rejectSave({
        response: {
          errors: [{ extensions: { code: "GROWING_TRIAL_NOT_ACTIVE" } }],
        },
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onRefreshTrials).toHaveBeenCalled();
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Journal Event was not changed" }),
    );
  });

  it("refreshes the outer list when a timeline trial is missing", async () => {
    jest.mocked(listJournalEvents).mockRejectedValue({
      response: {
        errors: [{ extensions: { code: "GROWING_TRIAL_NOT_FOUND" } }],
      },
    });
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: "Show Journal" }));
    await waitFor(() => expect(onRefreshTrials).toHaveBeenCalled());
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Journal timeline unavailable" }),
    );
  });
});
