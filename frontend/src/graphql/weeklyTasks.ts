import { createGraphqlClient } from "./client";
import { WEEKLY_TASKS_QUERY } from "./queries";

export type WeeklyTask = {
  key: string;
  text: string;
};

export type WeeklyTaskDay = {
  date: string;
  tasks: WeeklyTask[];
};

export type WeeklyTaskWeek = {
  startDate: string;
  endDate: string;
  days: WeeklyTaskDay[];
};

type WeeklyTasksResponse = {
  weeklyTasks: WeeklyTaskWeek;
};

export async function getWeeklyTasks(timeZone: string, signal?: AbortSignal) {
  const client = createGraphqlClient();
  const data = await client.request<WeeklyTasksResponse>({
    document: WEEKLY_TASKS_QUERY,
    variables: { timeZone },
    signal,
  });

  return data.weeklyTasks;
}
