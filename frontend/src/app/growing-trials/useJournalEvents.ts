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
  hasPreviousPage: false,
  endCursor: null,
};

function newestFirst(left: JournalEvent, right: JournalEvent) {
  return (
    right.eventDate.localeCompare(left.eventDate) ||
    right.createdAt.localeCompare(left.createdAt) ||
    right.id.localeCompare(left.id, undefined, { numeric: true })
  );
}

export function useJournalEvents(growingTrialId: string) {
  const [page, setPage] = useState(emptyPage);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [reconciliationFailed, setReconciliationFailed] = useState(false);
  const sequence = useRef(0);

  useEffect(
    () => () => {
      sequence.current += 1;
    },
    [],
  );

  async function firstPage(mode: "visible" | "reconcile" = "visible") {
    const request = ++sequence.current;
    setLoadingMore(false);
    if (mode === "visible") setStatus("loading");
    try {
      const result = await listJournalEvents(growingTrialId, pageSize, null);
      if (request !== sequence.current) return "superseded" as const;
      setPage(result);
      setStatus("ready");
      setReconciliationFailed(false);
      return "applied" as const;
    } catch (error) {
      if (request !== sequence.current) return "superseded" as const;
      if (mode === "reconcile") setReconciliationFailed(true);
      else setStatus("error");
      return { error } as const;
    }
  }

  async function loadMore() {
    if (!page.hasNextPage || !page.endCursor || loadingMore) return;
    const request = ++sequence.current;
    setLoadingMore(true);
    try {
      const result = await listJournalEvents(
        growingTrialId,
        pageSize,
        page.endCursor,
      );
      if (request !== sequence.current) return;
      setPage((current) => ({
        ...result,
        items: [
          ...current.items,
          ...result.items.filter(
            (event) => !current.items.some((item) => item.id === event.id),
          ),
        ],
      }));
    } catch {
      if (request === sequence.current) setReconciliationFailed(true);
    } finally {
      if (request === sequence.current) setLoadingMore(false);
    }
  }

  function acceptCreated(event: JournalEvent) {
    sequence.current += 1;
    setPage((current) => ({
      ...current,
      items: [event, ...current.items.filter((item) => item.id !== event.id)]
        .sort(newestFirst)
        .slice(0, pageSize),
    }));
    return firstPage("reconcile");
  }

  function acceptUpdated(event: JournalEvent) {
    sequence.current += 1;
    setPage((current) => ({
      ...current,
      items: current.items
        .map((item) => (item.id === event.id ? event : item))
        .sort(newestFirst)
        .slice(0, pageSize),
    }));
    return firstPage("reconcile");
  }

  function acceptDeleted(id: string) {
    sequence.current += 1;
    setPage((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
    return firstPage("reconcile");
  }

  return {
    ...page,
    status,
    loadingMore,
    reconciliationFailed,
    firstPage,
    loadMore,
    acceptCreated,
    acceptUpdated,
    acceptDeleted,
  };
}
