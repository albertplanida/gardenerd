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
    endDate
    resultSummary
    createdAt
    updatedAt
  }
`;

export const GROWING_TRIALS_QUERY = gql`
  ${GROWING_TRIAL_FIELDS}
  query GrowingTrials(
    $limit: Int!
    $after: String
    $status: GrowingTrialStatusType
  ) {
    growingTrials(limit: $limit, after: $after, status: $status) {
      items {
        ...GrowingTrialFields
      }
      hasNextPage
      hasPreviousPage
      endCursor
    }
  }
`;

export const GROWING_TRIAL_SETUP_CONTEXT_QUERY = gql`
  query GrowingTrialSetupContext {
    plants: growingTrialPlantOptions(limit: 1) {
      id
    }
    containers: growingTrialContainerOptions(limit: 1) {
      id
    }
    trials: growingTrials(limit: 1) {
      items {
        id
      }
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

export const COMPLETE_GROWING_TRIAL_MUTATION = gql`
  ${GROWING_TRIAL_FIELDS}
  mutation CompleteGrowingTrial(
    $id: ID!
    $endDate: Date!
    $resultSummary: String
    $timeZone: String!
  ) {
    completeGrowingTrial(
      id: $id
      endDate: $endDate
      resultSummary: $resultSummary
      timeZone: $timeZone
    ) {
      ...GrowingTrialFields
    }
  }
`;

export const ABANDON_GROWING_TRIAL_MUTATION = gql`
  ${GROWING_TRIAL_FIELDS}
  mutation AbandonGrowingTrial(
    $id: ID!
    $endDate: Date!
    $resultSummary: String
    $timeZone: String!
  ) {
    abandonGrowingTrial(
      id: $id
      endDate: $endDate
      resultSummary: $resultSummary
      timeZone: $timeZone
    ) {
      ...GrowingTrialFields
    }
  }
`;

export const UPDATE_GROWING_TRIAL_RESULT_MUTATION = gql`
  ${GROWING_TRIAL_FIELDS}
  mutation UpdateGrowingTrialResult(
    $id: ID!
    $endDate: Date!
    $resultSummary: String
    $timeZone: String!
  ) {
    updateGrowingTrialResult(
      id: $id
      endDate: $endDate
      resultSummary: $resultSummary
      timeZone: $timeZone
    ) {
      ...GrowingTrialFields
    }
  }
`;

export const JOURNAL_EVENT_FIELDS = gql`
  fragment JournalEventFields on JournalEventType {
    id
    eventType
    eventDate
    note
    createdAt
    updatedAt
  }
`;

export const JOURNAL_EVENTS_QUERY = gql`
  ${JOURNAL_EVENT_FIELDS}
  query JournalEvents($growingTrialId: ID!, $limit: Int!, $after: String) {
    journalEvents(
      growingTrialId: $growingTrialId
      limit: $limit
      after: $after
    ) {
      items {
        ...JournalEventFields
      }
      hasNextPage
      endCursor
    }
  }
`;

export const CREATE_JOURNAL_EVENT_MUTATION = gql`
  ${JOURNAL_EVENT_FIELDS}
  mutation CreateJournalEvent(
    $growingTrialId: ID!
    $eventType: JournalEventEventType!
    $eventDate: Date!
    $note: String!
    $timeZone: String!
  ) {
    createJournalEvent(
      growingTrialId: $growingTrialId
      eventType: $eventType
      eventDate: $eventDate
      note: $note
      timeZone: $timeZone
    ) {
      ...JournalEventFields
    }
  }
`;

export const UPDATE_JOURNAL_EVENT_MUTATION = gql`
  ${JOURNAL_EVENT_FIELDS}
  mutation UpdateJournalEvent(
    $id: ID!
    $eventType: JournalEventEventType!
    $eventDate: Date!
    $note: String!
    $timeZone: String!
  ) {
    updateJournalEvent(
      id: $id
      eventType: $eventType
      eventDate: $eventDate
      note: $note
      timeZone: $timeZone
    ) {
      ...JournalEventFields
    }
  }
`;

export const DELETE_JOURNAL_EVENT_MUTATION = gql`
  mutation DeleteJournalEvent($id: ID!) {
    deleteJournalEvent(id: $id)
  }
`;
