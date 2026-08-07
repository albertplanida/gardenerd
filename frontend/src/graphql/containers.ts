import { createGraphqlClient } from "./client";
import {
  CONTAINERS_QUERY,
  CREATE_CONTAINER_MUTATION,
  EDIT_CONTAINER_MUTATION,
} from "./queries";

export type GardenContainer = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type ContainersResponse = {
  containers: GardenContainer[];
};

type CreateContainerResponse = {
  createContainer: GardenContainer;
};

type EditContainerResponse = {
  editContainer: GardenContainer;
};

export async function listContainers() {
  const client = createGraphqlClient();
  const data = await client.request<ContainersResponse>(CONTAINERS_QUERY);

  return data.containers;
}

export async function createContainer(name: string) {
  const client = createGraphqlClient();
  const data = await client.request<CreateContainerResponse>(
    CREATE_CONTAINER_MUTATION,
    { name },
  );

  return data.createContainer;
}

export async function editContainer(id: string, name: string) {
  const client = createGraphqlClient();
  const data = await client.request<EditContainerResponse>(
    EDIT_CONTAINER_MUTATION,
    { id, name },
  );

  return data.editContainer;
}
