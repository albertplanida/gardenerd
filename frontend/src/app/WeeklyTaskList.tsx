"use client";

import { useState } from "react";
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

type WeeklyTaskListProps = {
  refreshRevision?: number;
};

export function WeeklyTaskList({ refreshRevision = 0 }: WeeklyTaskListProps) {
  const tasks = useWeeklyTasks(refreshRevision);
  const [weekExpanded, setWeekExpanded] = useState(false);
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const days =
    tasks.status === "ready"
      ? [...tasks.week.days].sort((left, right) =>
          left.date.localeCompare(right.date),
        )
      : [];
  const currentDay = days.find((day) => day.date >= today) ?? days[0];

  return (
    <section
      className={`weekly-panel ${weekExpanded ? "week-expanded" : ""}`}
      aria-labelledby="weekly-tasks-heading"
    >
      <Stack gap="sm">
        <div>
          <Title id="weekly-tasks-heading" order={2}>
            This week
          </Title>
          <Text c="dimmed" mt={4} size="sm">
            A read-only plan based on your active Growing Trials.
          </Text>
          <Button
            className="week-toggle"
            variant="subtle"
            onClick={() => setWeekExpanded(!weekExpanded)}
            aria-expanded={weekExpanded}
          >
            {weekExpanded ? "Close week" : "View week"} &gt;
          </Button>
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
              <Button mih={44} onClick={tasks.refresh} variant="light">
                Try again
              </Button>
            </Stack>
          </Alert>
        ) : null}

        {tasks.status === "ready" ? (
          <>
            <Text c="dimmed" className="week-range" size="xs">
              {formatWeeklyTaskRange(tasks.week.startDate, tasks.week.endDate)}
            </Text>
            {currentDay && (
              <div className="mobile-week-highlight">
                <Text size="xs" c="dimmed">
                  <time dateTime={currentDay.date}>
                    {formatWeeklyTaskDate(currentDay.date)}
                  </time>
                </Text>
                <ul>
                  {currentDay.tasks.map((task) => (
                    <li key={task.key}>
                      <Text size="sm">{task.text}</Text>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {days.length === 0 ? (
              <Text c="dimmed">
                No tasks are planned. Weekly tasks appear when you have an
                active Growing Trial.
              </Text>
            ) : (
              <Stack gap="sm" className="weekly-days">
                {days.map((day) => (
                  <Card
                    component="section"
                    key={day.date}
                    withBorder
                    radius="md"
                    className={`weekly-day ${day.date === today ? "is-today" : ""}`}
                  >
                    <Title order={3}>
                      <time dateTime={day.date}>
                        {formatWeeklyTaskDate(day.date)}
                        {day.date === today ? " / Today" : ""}
                      </time>
                    </Title>
                    <ul>
                      {day.tasks.map((task) => (
                        <li key={task.key}>
                          <Text size="sm">{task.text}</Text>
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
