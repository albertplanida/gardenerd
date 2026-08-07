import { GraphQLClient } from "graphql-request";

export function createGraphqlClient() {
  const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ?? "/graphql";
  const resolvedEndpoint =
    typeof window !== "undefined" && endpoint.startsWith("/")
      ? new URL(endpoint, window.location.origin).toString()
      : endpoint;

  return new GraphQLClient(resolvedEndpoint);
}
