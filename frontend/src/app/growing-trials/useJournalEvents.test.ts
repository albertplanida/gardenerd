import { act, renderHook } from "@testing-library/react";

import {
  listJournalEvents,
  type JournalEvent,
  type JournalEventPage,
} from "@/graphql/journalEvents";

import { useJournalEvents } from "./useJournalEvents";

jest.mock("@/graphql/journalEvents", () => ({
  listJournalEvents: jest.fn(),
}));

function event(id: number): JournalEvent {
  return {
    id: String(id),
    eventType: "GENERAL_OBSERVATION",
    eventDate: "2026-08-10",
    note: `Event ${id}`,
    createdAt: "2026-08-10T12:00:00Z",
    updatedAt: "2026-08-10T12:00:00Z",
  };
}

function page(
  items: JournalEvent[],
  hasNextPage: boolean,
  endCursor: string | null,
): JournalEventPage {
  return { items, hasNextPage, endCursor };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("useJournalEvents confirmed creates", () => {
  beforeEach(() => jest.resetAllMocks());

  it("does not insert a create older than the loaded range", async () => {
    jest
      .mocked(listJournalEvents)
      .mockResolvedValueOnce(page([event(20), event(19)], true, "cursor-19"));
    const { result } = renderHook(() => useJournalEvents("10"));
    await act(async () => void (await result.current.firstPage()));

    const older = { ...event(18), eventDate: "2026-08-01" };
    await act(async () => void (await result.current.acceptCreated(older)));

    expect(result.current.items.map(({ id }) => id)).toEqual(["20", "19"]);
    expect(listJournalEvents).toHaveBeenCalledTimes(1);
  });

  it("resets a full loaded page to canonical capacity after create", async () => {
    const fullPage = Array.from({ length: 20 }, (_, index) =>
      event(20 - index),
    );
    const canonical = [event(21), ...fullPage.slice(0, 19)];
    const pendingRefresh = deferred<JournalEventPage>();
    jest
      .mocked(listJournalEvents)
      .mockResolvedValueOnce(page(fullPage, false, "cursor-1"))
      .mockReturnValueOnce(pendingRefresh.promise);
    const { result } = renderHook(() => useJournalEvents("10"));
    await act(async () => void (await result.current.firstPage()));

    let reconciliation!: Promise<unknown>;
    act(() => {
      reconciliation = result.current.acceptCreated(event(21));
    });

    expect(result.current.items).toHaveLength(20);
    expect(result.current.items[0].id).toBe("21");
    expect(listJournalEvents).toHaveBeenLastCalledWith(
      "10",
      20,
      null,
      expect.any(AbortSignal),
    );
    await act(async () => {
      pendingRefresh.resolve(page(canonical, true, "cursor-2"));
      await reconciliation;
    });
    expect(result.current.items).toEqual(canonical);
  });

  it("retains multi-page capacity until resetting to the canonical first 20", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      event(40 - index),
    );
    const secondPage = Array.from({ length: 20 }, (_, index) =>
      event(20 - index),
    );
    const canonical = [event(41), ...firstPage.slice(0, 19)];
    const pendingRefresh = deferred<JournalEventPage>();
    jest
      .mocked(listJournalEvents)
      .mockResolvedValueOnce(page(firstPage, true, "cursor-21"))
      .mockResolvedValueOnce(page(secondPage, true, "cursor-1"))
      .mockReturnValueOnce(pendingRefresh.promise);
    const { result } = renderHook(() => useJournalEvents("10"));
    await act(async () => void (await result.current.firstPage()));
    await act(async () => void (await result.current.loadMore()));

    let reconciliation!: Promise<unknown>;
    act(() => {
      reconciliation = result.current.acceptCreated(event(41));
    });
    expect(result.current.items).toHaveLength(40);
    expect(result.current.items[0].id).toBe("41");
    expect(listJournalEvents).toHaveBeenLastCalledWith(
      "10",
      20,
      null,
      expect.any(AbortSignal),
    );

    await act(async () => {
      pendingRefresh.resolve(page(canonical, true, "cursor-22"));
      await reconciliation;
    });
    expect(result.current.items).toEqual(canonical);
    expect(result.current.items).toHaveLength(20);
  });
});
