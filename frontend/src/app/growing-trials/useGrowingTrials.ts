import { useEffect, useRef, useState } from "react";

import {
  listGrowingTrials,
  type GrowingTrial,
  type GrowingTrialPage,
} from "@/graphql/growingTrials";

const pageSize = 20;

type ListStatus = "loading" | "ready" | "error";

export function useGrowingTrials() {
  const [page, setPage] = useState<GrowingTrialPage>({
    items: [],
    hasNextPage: false,
    hasPreviousPage: false,
    endCursor: null,
  });
  const [status, setStatus] = useState<ListStatus>("loading");
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const requestSequence = useRef(0);

  async function requestPage(
    cursor: string | null,
    mode: "visible" | "refresh",
  ) {
    const sequence = ++requestSequence.current;
    if (mode === "visible") {
      setStatus("loading");
    }

    try {
      const result = await listGrowingTrials(pageSize, cursor);
      if (sequence !== requestSequence.current) {
        return false;
      }
      setPage(result);
      setStatus("ready");
      setRefreshFailed(false);
      return true;
    } catch {
      if (sequence !== requestSequence.current) {
        return false;
      }
      if (mode === "refresh") {
        setRefreshFailed(true);
      } else {
        setStatus("error");
      }
      return false;
    }
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void requestPage(null, "visible");
    });
    return () => {
      cancelled = true;
      requestSequence.current += 1;
    };
  }, []);

  async function next() {
    if (!page.endCursor || !page.hasNextPage) return;
    const nextCursor = page.endCursor;
    if (await requestPage(nextCursor, "visible")) {
      setCursorStack((current) => [...current, nextCursor]);
    }
  }

  async function previous() {
    if (cursorStack.length === 1) return;
    const previousStack = cursorStack.slice(0, -1);
    const previousCursor = previousStack.at(-1) ?? null;
    if (await requestPage(previousCursor, "visible")) {
      setCursorStack(previousStack);
    }
  }

  function retry() {
    return requestPage(cursorStack.at(-1) ?? null, "visible");
  }

  async function acceptCreated(trial: GrowingTrial) {
    requestSequence.current += 1;
    setCursorStack([null]);
    setRefreshFailed(false);
    setStatus("ready");
    setPage((current) => {
      const items = [
        trial,
        ...current.items.filter((item) => item.id !== trial.id),
      ];
      return {
        items: items.slice(0, pageSize),
        hasNextPage: current.hasNextPage || items.length > pageSize,
        hasPreviousPage: false,
        endCursor: current.endCursor,
      };
    });
    return requestPage(null, "refresh");
  }

  function retryRefresh() {
    return requestPage(null, "refresh");
  }

  function acceptStarted(trial: GrowingTrial) {
    setPage((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === trial.id ? trial : item)),
    }));
  }

  return {
    ...page,
    status,
    refreshFailed,
    next,
    previous,
    retry,
    acceptCreated,
    acceptStarted,
    retryRefresh,
  };
}
