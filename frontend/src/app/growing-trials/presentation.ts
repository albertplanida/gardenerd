import type {
  GrowingTrialStartMethod,
  GrowingTrialStatus,
} from "@/graphql/growingTrials";

export const statusLabels = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
} satisfies Record<GrowingTrialStatus, string>;

export const statusColors = {
  PLANNED: "blue",
  ACTIVE: "green",
  COMPLETED: "gray",
  ABANDONED: "orange",
} satisfies Record<GrowingTrialStatus, string>;

export const startMethodLabels = {
  SEED: "Seed",
  SEEDLING_TRANSPLANT: "Seedling/transplant",
} satisfies Record<GrowingTrialStartMethod, string>;

export function localCalendarDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateOnly(value: string, locales?: Intl.LocalesArgument) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(locales, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
