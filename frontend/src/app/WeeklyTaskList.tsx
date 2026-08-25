"use client";

import {
  Alert,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";

import { useWeeklyTasks } from "./useWeeklyTasks";

function dateOnly(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError("Invalid date-only value");
  const value = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (
    value.getUTCFullYear() !== Number(match[1]) ||
    value.getUTCMonth() !== Number(match[2]) - 1 ||
    value.getUTCDate() !== Number(match[3])
  ) {
    throw new RangeError("Invalid date-only value");
  }
  return value;
}

export function formatWeeklyTaskDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateOnly(date));
}

export function formatWeeklyTaskRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(dateOnly(start))} - ${formatter.format(dateOnly(end))}`;
}

export function WeeklyTaskList() {
  const tasks = useWeeklyTasks();
  const days =
    tasks.status === "ready"
      ? [...tasks.week.days].sort((left, right) =>
          left.date.localeCompare(right.date),
        )
      : [];

  return (
    <section aria-labelledby="weekly-tasks-heading">
      <Stack gap="sm">
        <div>
          <Title id="weekly-tasks-heading" order={2}>
            This week
          </Title>
          <Text c="dimmed" mt={4}>
            A read-only plan based on your active Growing Trials.
          </Text>
        </div>

        {tasks.status === "loading" ? (
          <Group gap="sm" role="status">
            <Loader size="sm" />
            <Text>Loading this week&apos;s tasks...</Text>
          </Group>
        ) : null}

        {tasks.status === "error" ? (
          <Alert color="red" title="Weekly tasks could not be loaded.">
            <Stack align="flex-start" gap="sm">
              <Text>
                Check your connection and browser timezone, then try again.
              </Text>
              <Button mih={44} onClick={tasks.retry} variant="light">
                Try again
              </Button>
            </Stack>
          </Alert>
        ) : null}

        {tasks.status === "ready" ? (
          <>
            <Text c="dimmed">
              {formatWeeklyTaskRange(tasks.week.startDate, tasks.week.endDate)}
            </Text>
            {days.length === 0 ? (
              <Card withBorder radius="md">
                <Stack align="flex-start" gap="sm">
                  <Title order={3}>No tasks planned for this week</Title>
                  <Text c="dimmed">
                    Weekly tasks appear when you have an active Growing Trial.
                  </Text>
                  <Button
                    component="a"
                    href="/growing-trials"
                    mih={44}
                    variant="light"
                  >
                    View Growing Trials
                  </Button>
                </Stack>
              </Card>
            ) : (
              <Stack gap="sm">
                {days.map((day) => (
                  <Card
                    component="section"
                    key={day.date}
                    withBorder
                    radius="md"
                  >
                    <Title order={3}>
                      <time dateTime={day.date}>
                        {formatWeeklyTaskDate(day.date)}
                      </time>
                    </Title>
                    <ul>
                      {day.tasks.map((task) => (
                        <li key={task.key}>
                          <Text>{task.text}</Text>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </Stack>
            )}
          </>
        ) : null}
      </Stack>
    </section>
  );
}
