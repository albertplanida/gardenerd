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

export const GROWING_TRIALS_QUERY = gql`
  query GrowingTrials($limit: Int!, $offset: Int!) {
    growingTrials(limit: $limit, offset: $offset) {
      items {
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
        createdAt
        updatedAt
      }
      hasNextPage
      hasPreviousPage
    }
  }
`;

export const CREATE_GROWING_TRIAL_MUTATION = gql`
  mutation CreateGrowingTrial($plantId: ID!, $containerId: ID!) {
    createGrowingTrial(plantId: $plantId, containerId: $containerId) {
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
      createdAt
      updatedAt
    }
  }
`;
