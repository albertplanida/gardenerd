export const graphqlErrorCodes = [
  "GROWING_TRIAL_NOT_FOUND",
  "GROWING_TRIAL_NOT_PLANNED",
  "START_DATE_IN_FUTURE",
  "CONTAINER_OCCUPIED",
  "INVALID_TIME_ZONE",
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
