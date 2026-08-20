import { gql } from "graphql-request";

export const HEALTH_QUERY = gql`
  query Health {
    health
  }
`;

export const CONTAINERS_QUERY = gql`
  query Containers {
    containers {
      id
      name
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_CONTAINER_MUTATION = gql`
  mutation CreateContainer($name: String!) {
    createContainer(name: $name) {
      id
      name
      createdAt
      updatedAt
    }
  }
`;

export const EDIT_CONTAINER_MUTATION = gql`
  mutation EditContainer($id: ID!, $name: String!) {
    editContainer(id: $id, name: $name) {
      id
      name
      createdAt
      updatedAt
    }
  }
`;

export const PLANTS_QUERY = gql`
  query Plants($limit: Int!, $offset: Int!) {
    plants(limit: $limit, offset: $offset) {
      items {
        id
        name
        careNotes
        createdAt
        updatedAt
      }
      hasNextPage
      hasPreviousPage
    }
  }
`;

export const CREATE_PLANT_MUTATION = gql`
  mutation CreatePlant($name: String!, $careNotes: String!) {
    createPlant(name: $name, careNotes: $careNotes) {
      id
      name
      careNotes
      createdAt
      updatedAt
    }
  }
`;

export const EDIT_PLANT_MUTATION = gql`
  mutation EditPlant($id: ID!, $name: String!, $careNotes: String!) {
    editPlant(id: $id, name: $name, careNotes: $careNotes) {
      id
      name
      careNotes
      createdAt
      updatedAt
    }
  }
`;

export const GROWING_TRIAL_FIELDS = gql`
  fragment GrowingTrialFields on GrowingTrialType {
    id
    plant {
      id
      name
    }
    container {
      id
      name
    }
    status
    startDate
    startMethod
    createdAt
    updatedAt
  }
`;

export const GROWING_TRIALS_QUERY = gql`
  ${GROWING_TRIAL_FIELDS}
  query GrowingTrials($limit: Int!, $after: String) {
    growingTrials(limit: $limit, after: $after) {
      items {
        ...GrowingTrialFields
      }
      hasNextPage
      hasPreviousPage
      endCursor
    }
  }
`;

export const GROWING_TRIAL_PLANT_OPTIONS_QUERY = gql`
  query GrowingTrialPlantOptions($search: String, $limit: Int!) {
    growingTrialPlantOptions(search: $search, limit: $limit) {
      id
      name
    }
  }
`;

export const GROWING_TRIAL_CONTAINER_OPTIONS_QUERY = gql`
  query GrowingTrialContainerOptions($search: String, $limit: Int!) {
    growingTrialContainerOptions(search: $search, limit: $limit) {
      id
      name
    }
  }
`;

export const CREATE_GROWING_TRIAL_MUTATION = gql`
  ${GROWING_TRIAL_FIELDS}
  mutation CreateGrowingTrial($plantId: ID!, $containerId: ID!) {
    createGrowingTrial(plantId: $plantId, containerId: $containerId) {
      ...GrowingTrialFields
    }
  }
`;

export const START_GROWING_TRIAL_MUTATION = gql`
  ${GROWING_TRIAL_FIELDS}
  mutation StartGrowingTrial(
    $id: ID!
    $startDate: Date!
    $startMethod: GrowingTrialStartMethod!
    $timeZone: String!
  ) {
    startGrowingTrial(
      id: $id
      startDate: $startDate
      startMethod: $startMethod
      timeZone: $timeZone
    ) {
      ...GrowingTrialFields
    }
  }
`;
