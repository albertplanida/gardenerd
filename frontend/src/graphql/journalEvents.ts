import { createGraphqlClient } from "./client";
import {
  CREATE_JOURNAL_EVENT_MUTATION,
  DELETE_JOURNAL_EVENT_MUTATION,
  DELETE_JOURNAL_PHOTO_MUTATION,
  JOURNAL_EVENTS_QUERY,
  UPDATE_JOURNAL_EVENT_MUTATION,
} from "./queries";

export const journalEventTypeLabels = {
  PLANTED: "Planted",
  WATERED: "Watered",
  GERMINATED: "Germinated",
  FERTILIZED: "Fertilized",
  PRUNED: "Pruned",
  HARVESTED: "Harvested",
  PROBLEM_NOTICED: "Problem noticed",
  PHOTO_TAKEN: "Photo taken",
  GENERAL_OBSERVATION: "General observation",
} as const;

export type JournalEventEventType = keyof typeof journalEventTypeLabels;

export type JournalEvent = {
  id: string;
  eventType: JournalEventEventType;
  eventDate: string;
  note: string;
  photos: JournalPhoto[];
  createdAt: string;
  updatedAt: string;
};

export type JournalPhoto = {
  id: string;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  width: number;
  height: number;
  position: number;
  thumbnailUrl: string;
  fullSizeUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type JournalEventPage = {
  items: JournalEvent[];
  hasNextPage: boolean;
  endCursor: string | null;
};

export type JournalEventValues = {
  eventType: JournalEventEventType;
  eventDate: string;
  note: string;
  timeZone: string;
};

export async function listJournalEvents(
  growingTrialId: string,
  limit: number,
  after: string | null,
  signal?: AbortSignal,
) {
  const data = await createGraphqlClient().request<{
    journalEvents: JournalEventPage;
  }>({
    document: JOURNAL_EVENTS_QUERY,
    variables: { growingTrialId, limit, after },
    signal,
  });
  return data.journalEvents;
}

export async function createJournalEvent(
  growingTrialId: string,
  values: JournalEventValues,
) {
  const data = await createGraphqlClient().request<{
    createJournalEvent: JournalEvent;
  }>(CREATE_JOURNAL_EVENT_MUTATION, { growingTrialId, ...values });
  return data.createJournalEvent;
}

export async function updateJournalEvent(
  id: string,
  values: JournalEventValues,
) {
  const data = await createGraphqlClient().request<{
    updateJournalEvent: JournalEvent;
  }>(UPDATE_JOURNAL_EVENT_MUTATION, { id, ...values });
  return data.updateJournalEvent;
}

export async function deleteJournalEvent(id: string) {
  const data = await createGraphqlClient().request<{
    deleteJournalEvent: string;
  }>(DELETE_JOURNAL_EVENT_MUTATION, { id });
  return data.deleteJournalEvent;
}

export async function deleteJournalPhoto(id: string) {
  const data = await createGraphqlClient().request<{
    deleteJournalPhoto: boolean;
  }>(DELETE_JOURNAL_PHOTO_MUTATION, { id });
  return data.deleteJournalPhoto;
}
