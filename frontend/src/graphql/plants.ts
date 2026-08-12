import { createGraphqlClient } from "./client";
import {
  CREATE_PLANT_MUTATION,
  EDIT_PLANT_MUTATION,
  PLANTS_QUERY,
} from "./queries";

export type Plant = {
  id: string;
  name: string;
  careNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type PlantPage = {
  items: Plant[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type PlantsResponse = {
  plants: PlantPage;
};

type CreatePlantResponse = {
  createPlant: Plant;
};

type EditPlantResponse = {
  editPlant: Plant;
};

export async function listPlants(limit: number, offset: number) {
  const client = createGraphqlClient();
  const data = await client.request<PlantsResponse>(PLANTS_QUERY, {
    limit,
    offset,
  });

  return data.plants;
}

export async function createPlant(name: string, careNotes: string) {
  const client = createGraphqlClient();
  const data = await client.request<CreatePlantResponse>(
    CREATE_PLANT_MUTATION,
    { name, careNotes },
  );

  return data.createPlant;
}

export async function editPlant(id: string, name: string, careNotes: string) {
  const client = createGraphqlClient();
  const data = await client.request<EditPlantResponse>(EDIT_PLANT_MUTATION, {
    id,
    name,
    careNotes,
  });

  return data.editPlant;
}
