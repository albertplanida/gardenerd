import { createGraphqlClient } from "./client";
import {
  ABANDON_GROWING_TRIAL_MUTATION,
  COMPLETE_GROWING_TRIAL_MUTATION,
  CREATE_GROWING_TRIAL_MUTATION,
  GROWING_TRIAL_CONTAINER_OPTIONS_QUERY,
  GROWING_TRIAL_PLANT_OPTIONS_QUERY,
  GROWING_TRIAL_SETUP_CONTEXT_QUERY,
  GROWING_TRIALS_QUERY,
  START_GROWING_TRIAL_MUTATION,
  UPDATE_GROWING_TRIAL_RESULT_MUTATION,
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
  status: GrowingTrialStatus;
  startDate: string | null;
  startMethod: GrowingTrialStartMethod | null;
  endDate: string | null;
  resultSummary: string;
  createdAt: string;
  updatedAt: string;
};

export type GrowingTrialStartMethod = "SEED" | "SEEDLING_TRANSPLANT";
export type GrowingTrialStatus =
  "PLANNED" | "ACTIVE" | "COMPLETED" | "ABANDONED";

export type GrowingTrialPage = {
  items: GrowingTrial[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  endCursor: string | null;
};

type GrowingTrialsResponse = {
  growingTrials: GrowingTrialPage;
};

export type ListGrowingTrialsOptions = {
  limit: number;
  after?: string | null;
  status?: GrowingTrialStatus | null;
  signal?: AbortSignal;
};

type CreateGrowingTrialResponse = {
  createGrowingTrial: GrowingTrial;
};

type StartGrowingTrialResponse = {
  startGrowingTrial: GrowingTrial;
};

export type TerminalGrowingTrialVariables = {
  id: string;
  endDate: string;
  resultSummary: string | null;
  timeZone: string;
};

export type CompleteGrowingTrialResponse = {
  completeGrowingTrial: GrowingTrial;
};

export type AbandonGrowingTrialResponse = {
  abandonGrowingTrial: GrowingTrial;
};

export type UpdateGrowingTrialResultResponse = {
  updateGrowingTrialResult: GrowingTrial;
};

export async function listGrowingTrials({
  limit,
  after = null,
  status = null,
  signal,
}: ListGrowingTrialsOptions) {
  const client = createGraphqlClient();
  const data = await client.request<GrowingTrialsResponse>({
    document: GROWING_TRIALS_QUERY,
    variables: { limit, after, status },
    signal,
  });

  return data.growingTrials;
}

type GrowingTrialSetupContextResponse = {
  plants: { id: string }[];
  containers: { id: string }[];
  trials: { items: { id: string }[] };
};

export type GrowingTrialSetupContext = {
  hasPlants: boolean;
  hasContainers: boolean;
  hasGrowingTrials: boolean;
};

export async function getGrowingTrialSetupContext(signal?: AbortSignal) {
  const client = createGraphqlClient();
  const data = await client.request<GrowingTrialSetupContextResponse>({
    document: GROWING_TRIAL_SETUP_CONTEXT_QUERY,
    signal,
  });

  return {
    hasPlants: data.plants.length > 0,
    hasContainers: data.containers.length > 0,
    hasGrowingTrials: data.trials.items.length > 0,
  } satisfies GrowingTrialSetupContext;
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

export async function completeGrowingTrial(
  id: string,
  endDate: string,
  resultSummary: string | null,
  timeZone: string,
) {
  const client = createGraphqlClient();
  const variables: TerminalGrowingTrialVariables = {
    id,
    endDate,
    resultSummary,
    timeZone,
  };
  const data = await client.request<CompleteGrowingTrialResponse>(
    COMPLETE_GROWING_TRIAL_MUTATION,
    variables,
  );

  return data.completeGrowingTrial;
}

export async function abandonGrowingTrial(
  id: string,
  endDate: string,
  resultSummary: string | null,
  timeZone: string,
) {
  const client = createGraphqlClient();
  const variables: TerminalGrowingTrialVariables = {
    id,
    endDate,
    resultSummary,
    timeZone,
  };
  const data = await client.request<AbandonGrowingTrialResponse>(
    ABANDON_GROWING_TRIAL_MUTATION,
    variables,
  );

  return data.abandonGrowingTrial;
}

export async function updateGrowingTrialResult(
  id: string,
  endDate: string,
  resultSummary: string | null,
  timeZone: string,
) {
  const client = createGraphqlClient();
  const variables: TerminalGrowingTrialVariables = {
    id,
    endDate,
    resultSummary,
    timeZone,
  };
  const data = await client.request<UpdateGrowingTrialResultResponse>(
    UPDATE_GROWING_TRIAL_RESULT_MUTATION,
    variables,
  );

  return data.updateGrowingTrialResult;
}
