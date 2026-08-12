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
  query Plants {
    plants {
      id
      name
      careNotes
      createdAt
      updatedAt
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
