import { useEffect, useRef, useState } from "react";

import {
  listJournalEvents,
  type JournalEvent,
  type JournalEventPage,
} from "@/graphql/journalEvents";

const pageSize = 20;
const emptyPage: JournalEventPage = {
  items: [],
  hasNextPage: false,
  endCursor: null,
};

function newestFirst(left: JournalEvent, right: JournalEvent) {
  return (
    right.eventDate.localeCompare(left.eventDate) ||
    right.createdAt.localeCompare(left.createdAt) ||
    right.id.localeCompare(left.id, undefined, { numeric: true })
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

type FirstPageMode = "initial" | "refresh";

export function useJournalEvents(growingTrialId: string) {
  const [page, setPage] = useState(emptyPage);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [failedLoadMoreCursor, setFailedLoadMoreCursor] = useState<
    string | null
  >(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const loadedCapacity = useRef(pageSize);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
      activeController.current?.abort();
    };
  }, []);

  function beginRequest() {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    return {
      controller,
      request: ++requestSequence.current,
    };
  }

  function isLatest(request: number) {
    return mounted.current && request === requestSequence.current;
  }

  async function firstPage(mode: FirstPageMode = "initial") {
    const { controller, request } = beginRequest();
    setLoadingMore(false);
    setFailedLoadMoreCursor(null);
    if (mode === "initial") {
      setRefreshing(false);
      setStatus("loading");
    } else {
      setRefreshing(true);
      setRefreshFailed(false);
    }

    try {
      const result = await listJournalEvents(
        growingTrialId,
        pageSize,
        null,
        controller.signal,
      );
      if (!isLatest(request)) return "superseded" as const;
      loadedCapacity.current = pageSize;
      setPage(result);
      setStatus("ready");
      setRefreshFailed(false);
      return "applied" as const;
    } catch (error) {
      if (
        !isLatest(request) ||
        controller.signal.aborted ||
        isAbortError(error)
      ) {
        return "superseded" as const;
      }
      if (mode === "refresh") setRefreshFailed(true);
      else setStatus("error");
      return { error } as const;
    } finally {
      if (isLatest(request)) {
        activeController.current = null;
        setRefreshing(false);
      }
    }
  }

  async function loadMore() {
    const cursor = failedLoadMoreCursor ?? page.endCursor;
    if (!page.hasNextPage || !cursor || loadingMore) return;
    const { controller, request } = beginRequest();
    setLoadingMore(true);
    setRefreshing(false);
    setFailedLoadMoreCursor(null);

    try {
      const result = await listJournalEvents(
        growingTrialId,
        pageSize,
        cursor,
        controller.signal,
      );
      if (!isLatest(request)) return "superseded" as const;
      loadedCapacity.current += pageSize;
      setPage((current) => ({
        ...result,
        items: [
          ...current.items,
          ...result.items.filter(
            (event) => !current.items.some((item) => item.id === event.id),
          ),
        ],
      }));
      setFailedLoadMoreCursor(null);
      return "applied" as const;
    } catch (error) {
      if (
        !isLatest(request) ||
        controller.signal.aborted ||
        isAbortError(error)
      ) {
        return "superseded" as const;
      }
      setFailedLoadMoreCursor(cursor);
      return { error } as const;
    } finally {
      if (isLatest(request)) {
        activeController.current = null;
        setLoadingMore(false);
      }
    }
  }

  function acceptCreated(event: JournalEvent) {
    activeController.current?.abort();
    requestSequence.current += 1;
    setLoadingMore(false);
    setRefreshing(false);
    setFailedLoadMoreCursor(null);

    const oldest = page.items.at(-1);
    const belongsInLoadedRange =
      !page.hasNextPage || !oldest || newestFirst(event, oldest) <= 0;
    if (!belongsInLoadedRange) return Promise.resolve("local" as const);

    const needsRefresh =
      page.hasNextPage || page.items.length >= loadedCapacity.current;
    setPage((current) => {
      const items = [
        event,
        ...current.items.filter((item) => item.id !== event.id),
      ].sort(newestFirst);
      return {
        ...current,
        items: items.slice(0, loadedCapacity.current),
      };
    });
    return needsRefresh
      ? firstPage("refresh")
      : Promise.resolve("local" as const);
  }

  function acceptUpdated(event: JournalEvent, previousEventDate: string) {
    activeController.current?.abort();
    requestSequence.current += 1;
    setLoadingMore(false);
    setRefreshing(false);
    setFailedLoadMoreCursor(null);
    setPage((current) => ({
      ...current,
      items: current.items
        .map((item) => (item.id === event.id ? event : item))
        .sort(newestFirst),
    }));
    return event.eventDate !== previousEventDate && page.hasNextPage
      ? firstPage("refresh")
      : Promise.resolve("local" as const);
  }

  function acceptDeleted(id: string) {
    activeController.current?.abort();
    requestSequence.current += 1;
    setLoadingMore(false);
    setRefreshing(false);
    setFailedLoadMoreCursor(null);
    setPage((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
    return page.hasNextPage
      ? firstPage("refresh")
      : Promise.resolve("local" as const);
  }

  return {
    ...page,
    status,
    loadingMore,
    loadMoreFailed: failedLoadMoreCursor !== null,
    refreshing,
    refreshFailed,
    firstPage,
    loadMore,
    acceptCreated,
    acceptUpdated,
    acceptDeleted,
  };
}
