import { gql } from "graphql-request";

export const HEALTH_QUERY = gql`
  query Health {
    health
  }
`;
