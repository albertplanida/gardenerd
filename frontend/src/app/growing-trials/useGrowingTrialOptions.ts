import { useCallback, useEffect, useRef, useState } from "react";

import {
  listGrowingTrialContainerOptions,
  listGrowingTrialPlantOptions,
  type GrowingTrialOption,
} from "@/graphql/growingTrials";

const optionLimit = 20;

type OptionRequest = (
  search: string,
  limit: number,
  signal?: AbortSignal,
) => Promise<GrowingTrialOption[]>;

function useOptionResource(opened: boolean, fetchOptions: OptionRequest) {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<GrowingTrialOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hasLoadedEmptySearch, setHasLoadedEmptySearch] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const cache = useRef(new Map<string, GrowingTrialOption[]>());
  const previousSearch = useRef("");

  const request = useCallback(
    async (value: string) => {
      const normalizedSearch = value.trim();
      const cacheKey = normalizedSearch.toLocaleLowerCase();
      controller.current?.abort();
      const currentSequence = ++sequence.current;
      const cached = cache.current.get(cacheKey);

      if (cached) {
        setOptions(cached);
        setError(false);
        setIsLoading(false);
        if (!normalizedSearch) setHasLoadedEmptySearch(true);
        return;
      }

      const nextController = new AbortController();
      controller.current = nextController;
      setIsLoading(true);
      setError(false);

      try {
        const result = await fetchOptions(
          normalizedSearch,
          optionLimit,
          nextController.signal,
        );
        if (currentSequence !== sequence.current) return;
        cache.current.set(cacheKey, result);
        setOptions(result);
        setError(false);
        if (!normalizedSearch) setHasLoadedEmptySearch(true);
      } catch (requestError) {
        if (
          currentSequence !== sequence.current ||
          nextController.signal.aborted ||
          (requestError instanceof DOMException &&
            requestError.name === "AbortError")
        ) {
          return;
        }
        setError(true);
      } finally {
        if (currentSequence === sequence.current) setIsLoading(false);
      }
    },
    [fetchOptions],
  );

  useEffect(() => {
    let cancelled = false;
    if (!opened) {
      controller.current?.abort();
      sequence.current += 1;
      cache.current.clear();
      previousSearch.current = "";
      queueMicrotask(() => {
        if (cancelled) return;
        setSearch("");
        setOptions([]);
        setIsLoading(false);
        setError(false);
        setHasLoadedEmptySearch(false);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) void request("");
    });
    return () => {
      cancelled = true;
      controller.current?.abort();
      sequence.current += 1;
    };
  }, [opened, request]);

  useEffect(() => {
    if (!opened || search === previousSearch.current) return;
    previousSearch.current = search;
    const timeout = window.setTimeout(() => void request(search), 300);
    return () => window.clearTimeout(timeout);
  }, [opened, request, search]);

  return {
    search,
    setSearch,
    options,
    isLoading,
    error,
    retry: () => request(search),
    noRecords:
      hasLoadedEmptySearch && search.trim() === "" && options.length === 0,
  };
}

export function useGrowingTrialOptions(opened: boolean) {
  return {
    plants: useOptionResource(opened, listGrowingTrialPlantOptions),
    containers: useOptionResource(opened, listGrowingTrialContainerOptions),
  };
}
