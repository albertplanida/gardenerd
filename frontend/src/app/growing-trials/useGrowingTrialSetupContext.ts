import { useEffect, useState } from "react";

import {
  getGrowingTrialSetupContext,
  type GrowingTrialSetupContext,
} from "@/graphql/growingTrials";

type SetupState =
  | { status: "idle" | "loading" | "error"; context: null }
  | { status: "ready"; context: GrowingTrialSetupContext };

export function useGrowingTrialSetupContext(enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SetupState>({
    status: "idle",
    context: null,
  });

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    queueMicrotask(() => setState({ status: "loading", context: null }));
    void getGrowingTrialSetupContext(controller.signal).then(
      (context) => {
        if (!controller.signal.aborted) setState({ status: "ready", context });
      },
      () => {
        if (!controller.signal.aborted)
          setState({ status: "error", context: null });
      },
    );

    return () => controller.abort();
  }, [enabled, attempt]);

  return {
    ...state,
    retry: () => setAttempt((current) => current + 1),
  };
}
