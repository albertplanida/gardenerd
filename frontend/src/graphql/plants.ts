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

type PlantsResponse = {
  plants: Plant[];
};

type CreatePlantResponse = {
  createPlant: Plant;
};

type EditPlantResponse = {
  editPlant: Plant;
};

export async function listPlants() {
  const client = createGraphqlClient();
  const data = await client.request<PlantsResponse>(PLANTS_QUERY);

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
