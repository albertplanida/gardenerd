import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  listGrowingTrials,
  type GrowingTrial,
  type GrowingTrialPage,
  type GrowingTrialStatus,
} from "@/graphql/growingTrials";

const pageSize = 20;

type ListStatus = "loading" | "ready" | "error";
export type ListRequestOutcome = "applied" | "superseded" | "failed";

export function useGrowingTrials(
  statusFilter: GrowingTrialStatus | null = null,
) {
  const [page, setPage] = useState<GrowingTrialPage>({
    items: [],
    hasNextPage: false,
    hasPreviousPage: false,
    endCursor: null,
  });
  const [status, setStatus] = useState<ListStatus>("loading");
  const [loadedFilter, setLoadedFilter] = useState<GrowingTrialStatus | null>(
    statusFilter,
  );
  const [refreshFailed, setRefreshFailed] = useState(false);
  const requestSequence = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const currentFilter = useRef(statusFilter);
  const latestPage = useRef(page);
  const cursorStackRef = useRef<(string | null)[]>([null]);
  useLayoutEffect(() => {
    currentFilter.current = statusFilter;
  }, [statusFilter]);

  async function requestPage(
    cursor: string | null,
    mode: "visible" | "refresh",
  ) {
    const requestedFilter = currentFilter.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const sequence = ++requestSequence.current;
    if (mode === "visible") {
      setStatus("loading");
    }

    try {
      const result = await listGrowingTrials({
        limit: pageSize,
        after: cursor,
        status: requestedFilter,
        signal: controller.signal,
      });
      if (sequence !== requestSequence.current) {
        return "superseded" as const;
      }
      setPage(result);
      latestPage.current = result;
      setLoadedFilter(requestedFilter);
      setStatus("ready");
      setRefreshFailed(false);
      return "applied" as const;
    } catch (error) {
      if (
        sequence !== requestSequence.current ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return "superseded" as const;
      }
      setLoadedFilter(requestedFilter);
      if (mode === "refresh") {
        setRefreshFailed(true);
      } else {
        setStatus("error");
      }
      return "failed" as const;
    }
  }

  useEffect(() => {
    let cancelled = false;
    requestController.current?.abort();
    requestSequence.current += 1;
    queueMicrotask(() => {
      if (!cancelled) {
        cursorStackRef.current = [null];
        setPage({
          items: [],
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: null,
        });
        setStatus("loading");
        void requestPage(null, "visible");
      }
    });
    return () => {
      cancelled = true;
      requestController.current?.abort();
      requestSequence.current += 1;
    };
  }, [statusFilter]);

  async function next() {
    if (!page.endCursor || !page.hasNextPage) return;
    const nextCursor = page.endCursor;
    if ((await requestPage(nextCursor, "visible")) === "applied") {
      cursorStackRef.current = [...cursorStackRef.current, nextCursor];
    }
  }

  async function previous() {
    if (cursorStackRef.current.length === 1) return;
    const previousStack = cursorStackRef.current.slice(0, -1);
    const previousCursor = previousStack.at(-1) ?? null;
    if ((await requestPage(previousCursor, "visible")) === "applied") {
      cursorStackRef.current = previousStack;
    }
  }

  function retry() {
    return requestPage(cursorStackRef.current.at(-1) ?? null, "visible");
  }

  async function acceptCreated(trial: GrowingTrial) {
    requestController.current?.abort();
    requestSequence.current += 1;
    cursorStackRef.current = [null];
    setRefreshFailed(false);
    setStatus("ready");
    setPage((current) => {
      const items = [
        trial,
        ...current.items.filter((item) => item.id !== trial.id),
      ];
      const updatedPage = {
        items: items.slice(0, pageSize),
        hasNextPage: current.hasNextPage || items.length > pageSize,
        hasPreviousPage: false,
        endCursor: current.endCursor,
      };
      latestPage.current = updatedPage;
      return updatedPage;
    });
    return requestPage(null, "refresh");
  }

  async function refreshCurrentPage() {
    const currentStack = cursorStackRef.current;
    const cursor = currentStack.at(-1) ?? null;
    const outcome = await requestPage(cursor, "refresh");
    if (
      outcome !== "applied" ||
      cursor === null ||
      latestPage.current.items.length > 0 ||
      !latestPage.current.hasPreviousPage
    ) {
      return outcome;
    }

    const previousStack = currentStack.slice(0, -1);
    const previousCursor = previousStack.at(-1) ?? null;
    const previousOutcome = await requestPage(previousCursor, "refresh");
    if (previousOutcome === "applied") {
      cursorStackRef.current = previousStack;
    }
    return previousOutcome;
  }

  function retryRefresh() {
    return refreshCurrentPage();
  }

  async function acceptUpdated(trial: GrowingTrial) {
    requestController.current?.abort();
    requestSequence.current += 1;
    setPage((current) => ({
      ...current,
      items:
        currentFilter.current === null || trial.status === currentFilter.current
          ? current.items.map((item) => (item.id === trial.id ? trial : item))
          : current.items.filter((item) => item.id !== trial.id),
    }));
    return refreshCurrentPage();
  }

  const filterMatchesPage = loadedFilter === statusFilter;

  return {
    ...(filterMatchesPage
      ? page
      : {
          items: [],
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: null,
        }),
    status: filterMatchesPage ? status : "loading",
    refreshFailed,
    next,
    previous,
    retry,
    acceptCreated,
    acceptUpdated,
    retryRefresh,
  };
}
