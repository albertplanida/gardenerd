import { useState } from "react";

type BrowserTimeZone =
  { timeZone: string; error: false } | { timeZone: null; error: true };

function resolveBrowserTimeZone(): BrowserTimeZone {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone
      ? { timeZone, error: false }
      : { timeZone: null, error: true };
  } catch {
    return { timeZone: null, error: true };
  }
}

export function useBrowserTimeZone() {
  const [browserTimeZone, setBrowserTimeZone] = useState(
    resolveBrowserTimeZone,
  );

  return {
    ...browserTimeZone,
    retry: () => setBrowserTimeZone(resolveBrowserTimeZone()),
  };
}
