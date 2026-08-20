import { act, renderHook, waitFor } from "@testing-library/react";

import { listGrowingTrials } from "@/graphql/growingTrials";

import { useGrowingTrials } from "./useGrowingTrials";

jest.mock("@/graphql/growingTrials", () => ({
  listGrowingTrials: jest.fn(),
}));

const emptyPage = {
  items: [],
  hasNextPage: false,
  hasPreviousPage: false,
  endCursor: null,
};
const activeTrial = {
  id: "1",
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
  id: "2",
  status: "PLANNED" as const,
  startDate: null,
  startMethod: null,
};

describe("useGrowingTrials", () => {
  beforeEach(() => jest.resetAllMocks());

  it("removes a trial that changes out of the selected status", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce({ ...emptyPage, items: [activeTrial] })
      .mockResolvedValueOnce(emptyPage);
    const { result } = renderHook(() => useGrowingTrials("ACTIVE"));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.acceptUpdated({
        ...activeTrial,
        status: "COMPLETED",
        endDate: "2026-08-20",
      });
    });

    expect(result.current.items).toEqual([]);
    expect(listGrowingTrials).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ACTIVE" }),
    );
  });

  it("keeps a changed trial visible under All", async () => {
    const completed = {
      ...activeTrial,
      status: "COMPLETED" as const,
      endDate: "2026-08-20",
    };
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce({ ...emptyPage, items: [activeTrial] })
      .mockResolvedValueOnce({ ...emptyPage, items: [completed] });
    const { result } = renderHook(() => useGrowingTrials(null));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.acceptUpdated(completed);
    });

    expect(result.current.items[0].status).toBe("COMPLETED");
  });

  it("resets pagination and requests page one when the filter changes", async () => {
    jest.mocked(listGrowingTrials).mockResolvedValue(emptyPage);
    const { rerender } = renderHook(({ status }) => useGrowingTrials(status), {
      initialProps: { status: "ACTIVE" as "ACTIVE" | "PLANNED" },
    });
    await waitFor(() => expect(listGrowingTrials).toHaveBeenCalledTimes(1));

    rerender({ status: "PLANNED" });

    await waitFor(() => expect(listGrowingTrials).toHaveBeenCalledTimes(2));
    expect(listGrowingTrials).toHaveBeenLastCalledWith({
      limit: 20,
      after: null,
      status: "PLANNED",
      signal: expect.any(AbortSignal),
    });
  });

  it("returns to the previous page when a transition empties a later page", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce({
        ...emptyPage,
        items: [{ ...activeTrial, id: "2" }],
        hasNextPage: true,
        endCursor: "cursor-2",
      })
      .mockResolvedValueOnce({
        ...emptyPage,
        items: [activeTrial],
        hasPreviousPage: true,
      })
      .mockResolvedValueOnce({ ...emptyPage, hasPreviousPage: true })
      .mockResolvedValueOnce({
        ...emptyPage,
        items: [{ ...activeTrial, id: "2" }],
        hasNextPage: true,
        endCursor: "cursor-2",
      });
    const { result } = renderHook(() => useGrowingTrials("ACTIVE"));
    await waitFor(() => expect(result.current.items[0]?.id).toBe("2"));

    await act(async () => result.current.next());
    expect(result.current.items[0]?.id).toBe("1");
    await act(async () => {
      await result.current.acceptUpdated({
        ...activeTrial,
        status: "COMPLETED",
        endDate: "2026-08-20",
      });
    });

    expect(result.current.items[0]?.id).toBe("2");
    expect(result.current.hasPreviousPage).toBe(false);
    expect(listGrowingTrials).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: null, status: "ACTIVE" }),
    );
  });

  it("uses the current filter when an older mutation finishes", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce({ ...emptyPage, items: [activeTrial] })
      .mockResolvedValue({ ...emptyPage, items: [plannedTrial] });
    const { result, rerender } = renderHook(
      ({ status }) => useGrowingTrials(status),
      { initialProps: { status: "ACTIVE" as "ACTIVE" | "PLANNED" } },
    );
    await waitFor(() => expect(result.current.items[0]?.status).toBe("ACTIVE"));
    const staleAcceptUpdated = result.current.acceptUpdated;

    rerender({ status: "PLANNED" });
    await waitFor(() =>
      expect(result.current.items[0]?.status).toBe("PLANNED"),
    );
    await act(async () => staleAcceptUpdated(activeTrial));

    expect(result.current.items[0]?.status).toBe("PLANNED");
    expect(listGrowingTrials).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "PLANNED" }),
    );
  });

  it("returns to the previous page after retrying a failed transition refresh", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce({
        ...emptyPage,
        items: [{ ...activeTrial, id: "2" }],
        hasNextPage: true,
        endCursor: "cursor-2",
      })
      .mockResolvedValueOnce({
        ...emptyPage,
        items: [activeTrial],
        hasPreviousPage: true,
      })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ...emptyPage, hasPreviousPage: true })
      .mockResolvedValueOnce({
        ...emptyPage,
        items: [{ ...activeTrial, id: "2" }],
        hasNextPage: true,
        endCursor: "cursor-2",
      });
    const { result } = renderHook(() => useGrowingTrials("ACTIVE"));
    await waitFor(() => expect(result.current.items[0]?.id).toBe("2"));
    await act(async () => result.current.next());

    await act(async () => {
      await result.current.acceptUpdated({
        ...activeTrial,
        status: "COMPLETED",
        endDate: "2026-08-20",
      });
    });
    expect(result.current.refreshFailed).toBe(true);
    await act(async () => result.current.retryRefresh());

    expect(result.current.items[0]?.id).toBe("2");
    expect(result.current.hasPreviousPage).toBe(false);
  });
});
