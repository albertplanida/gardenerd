import { useEffect, useRef, useState } from "react";

import { getWeeklyTasks, type WeeklyTaskWeek } from "@/graphql/weeklyTasks";

import { useBrowserTimeZone } from "./useBrowserTimeZone";

type WeeklyTasksState =
  | { status: "loading"; week: null }
  | { status: "ready"; week: WeeklyTaskWeek }
  | { status: "error"; week: null };

export function useWeeklyTasks() {
  const browserTimeZone = useBrowserTimeZone();
  const [state, setState] = useState<WeeklyTasksState>({
    status: "loading",
    week: null,
  });
  const [retryNonce, setRetryNonce] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    if (browserTimeZone.error) {
      return;
    }

    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    void getWeeklyTasks(browserTimeZone.timeZone, controller.signal).then(
      (week) => {
        if (sequence === requestSequence.current) {
          setState({ status: "ready", week });
        }
      },
      (error: unknown) => {
        if (
          sequence === requestSequence.current &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setState({ status: "error", week: null });
        }
      },
    );

    return () => {
      controller.abort();
      requestSequence.current += 1;
    };
  }, [browserTimeZone.error, browserTimeZone.timeZone, retryNonce]);

  function retry() {
    if (browserTimeZone.error) {
      setState({ status: "loading", week: null });
      browserTimeZone.retry();
      setRetryNonce((current) => current + 1);
      return;
    }

    // The timezone value stays stable, so use a request nonce only for retries.
    setState({ status: "loading", week: null });
    setRetryNonce((current) => current + 1);
  }

  return browserTimeZone.error
    ? ({ status: "error", week: null, retry } as const)
    : { ...state, retry };
}
