import { useEffect, useState } from "react";

import { getWeeklyTasks, type WeeklyTaskWeek } from "@/graphql/weeklyTasks";

import { useBrowserTimeZone } from "./useBrowserTimeZone";

type WeeklyTasksState =
  | { status: "loading"; week: null }
  | { status: "ready"; week: WeeklyTaskWeek }
  | { status: "error"; week: null };

export function useWeeklyTasks(refreshRevision = 0) {
  const browserTimeZone = useBrowserTimeZone();
  const [state, setState] = useState<WeeklyTasksState>({
    status: "loading",
    week: null,
  });
  const [manualRefreshRevision, setManualRefreshRevision] = useState(0);

  useEffect(() => {
    if (browserTimeZone.error) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setState({ status: "loading", week: null });
    });
    void getWeeklyTasks(browserTimeZone.timeZone, controller.signal).then(
      (week) => {
        if (!cancelled) {
          setState({ status: "ready", week });
        }
      },
      (error: unknown) => {
        if (
          !cancelled &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setState({ status: "error", week: null });
        }
      },
    );

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    browserTimeZone.error,
    browserTimeZone.timeZone,
    manualRefreshRevision,
    refreshRevision,
  ]);

  function refresh() {
    setState({ status: "loading", week: null });
    if (browserTimeZone.error) {
      browserTimeZone.retry();
    }
    setManualRefreshRevision((current) => current + 1);
  }

  return browserTimeZone.error
    ? ({ status: "error", week: null, refresh } as const)
    : { ...state, refresh };
}
