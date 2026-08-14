import { createGraphqlClient } from "./client";
import { CREATE_GROWING_TRIAL_MUTATION, GROWING_TRIALS_QUERY } from "./queries";

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
  status: "PLANNED";
  createdAt: string;
  updatedAt: string;
};

export type GrowingTrialPage = {
  items: GrowingTrial[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type GrowingTrialsResponse = {
  growingTrials: GrowingTrialPage;
};

type CreateGrowingTrialResponse = {
  createGrowingTrial: GrowingTrial;
};

export async function listGrowingTrials(limit: number, offset: number) {
  const client = createGraphqlClient();
  const data = await client.request<GrowingTrialsResponse>(
    GROWING_TRIALS_QUERY,
    { limit, offset },
  );

  return data.growingTrials;
}

export async function createGrowingTrial(plantId: string, containerId: string) {
  const client = createGraphqlClient();
  const data = await client.request<CreateGrowingTrialResponse>(
    CREATE_GROWING_TRIAL_MUTATION,
    { plantId, containerId },
  );

  return data.createGrowingTrial;
}
