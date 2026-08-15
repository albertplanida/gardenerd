import { createGraphqlClient } from "./client";
import {
  CREATE_GROWING_TRIAL_MUTATION,
  GROWING_TRIAL_CONTAINER_OPTIONS_QUERY,
  GROWING_TRIAL_PLANT_OPTIONS_QUERY,
  GROWING_TRIALS_QUERY,
  START_GROWING_TRIAL_MUTATION,
} from "./queries";

export type GrowingTrialOption = {
  id: string;
  name: string;
};

export type GrowingTrial = {
  id: string;
  plant: {
    id: string;
    name: string;
  };
  container: {
    id: string;
    name: string;
  };
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "ABANDONED";
  startDate: string | null;
  startMethod: GrowingTrialStartMethod | null;
  createdAt: string;
  updatedAt: string;
};

export type GrowingTrialStartMethod = "SEED" | "SEEDLING_TRANSPLANT";

export type GrowingTrialPage = {
  items: GrowingTrial[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  endCursor: string | null;
};

type GrowingTrialsResponse = {
  growingTrials: GrowingTrialPage;
};

type CreateGrowingTrialResponse = {
  createGrowingTrial: GrowingTrial;
};

type StartGrowingTrialResponse = {
  startGrowingTrial: GrowingTrial;
};

export async function listGrowingTrials(
  limit: number,
  after: string | null,
  signal?: AbortSignal,
) {
  const client = createGraphqlClient();
  const data = await client.request<GrowingTrialsResponse>({
    document: GROWING_TRIALS_QUERY,
    variables: { limit, after },
    signal,
  });

  return data.growingTrials;
}

type PlantOptionsResponse = {
  growingTrialPlantOptions: GrowingTrialOption[];
};

type ContainerOptionsResponse = {
  growingTrialContainerOptions: GrowingTrialOption[];
};

export async function listGrowingTrialPlantOptions(
  search: string,
  limit: number,
  signal?: AbortSignal,
) {
  const client = createGraphqlClient();
  const data = await client.request<PlantOptionsResponse>({
    document: GROWING_TRIAL_PLANT_OPTIONS_QUERY,
    variables: { search, limit },
    signal,
  });
  return data.growingTrialPlantOptions;
}

export async function listGrowingTrialContainerOptions(
  search: string,
  limit: number,
  signal?: AbortSignal,
) {
  const client = createGraphqlClient();
  const data = await client.request<ContainerOptionsResponse>({
    document: GROWING_TRIAL_CONTAINER_OPTIONS_QUERY,
    variables: { search, limit },
    signal,
  });
  return data.growingTrialContainerOptions;
}

export async function createGrowingTrial(plantId: string, containerId: string) {
  const client = createGraphqlClient();
  const data = await client.request<CreateGrowingTrialResponse>(
    CREATE_GROWING_TRIAL_MUTATION,
    { plantId, containerId },
  );

  return data.createGrowingTrial;
}

export async function startGrowingTrial(
  id: string,
  startDate: string,
  startMethod: GrowingTrialStartMethod,
  timeZone: string,
) {
  const client = createGraphqlClient();
  const data = await client.request<StartGrowingTrialResponse>(
    START_GROWING_TRIAL_MUTATION,
    { id, startDate, startMethod, timeZone },
  );

  return data.startGrowingTrial;
}
