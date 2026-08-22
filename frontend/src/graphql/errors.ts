export const graphqlErrorCodes = [
  "GROWING_TRIAL_NOT_FOUND",
  "GROWING_TRIAL_NOT_PLANNED",
  "GROWING_TRIAL_NOT_ACTIVE",
  "GROWING_TRIAL_NOT_ENDABLE",
  "GROWING_TRIAL_NOT_TERMINAL",
  "START_DATE_IN_FUTURE",
  "END_DATE_IN_FUTURE",
  "END_DATE_BEFORE_START",
  "INVALID_RESULT_SUMMARY",
  "CONTAINER_OCCUPIED",
  "INVALID_TIME_ZONE",
  "JOURNAL_EVENT_NOT_FOUND",
  "JOURNAL_PHOTO_NOT_FOUND",
  "EVENT_DATE_BEFORE_TRIAL_START",
  "EVENT_DATE_IN_FUTURE",
  "END_DATE_BEFORE_LATEST_JOURNAL_EVENT",
  "INVALID_JOURNAL_NOTE",
  "INTERNAL_ERROR",
] as const;

export type GraphqlErrorCode = (typeof graphqlErrorCodes)[number];

export function graphqlErrorCode(error: unknown): GraphqlErrorCode | null {
  const code = (
    error as {
      response?: { errors?: { extensions?: { code?: unknown } }[] };
    }
  )?.response?.errors?.[0]?.extensions?.code;

  return typeof code === "string" &&
    graphqlErrorCodes.includes(code as GraphqlErrorCode)
    ? (code as GraphqlErrorCode)
    : null;
}
