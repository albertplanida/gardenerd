import { expect, type Page, test } from "@playwright/test";

type Status = "PLANNED" | "ACTIVE" | "COMPLETED" | "ABANDONED";
type Trial = {
  id: string;
  plant: { id: string; name: string };
  container: { id: string; name: string };
  status: Status;
  startDate: string | null;
  startMethod: "SEED" | "SEEDLING_TRANSPLANT" | null;
  endDate: string | null;
  resultSummary: string;
  createdAt: string;
  updatedAt: string;
};
type WeeklyTaskWeek = {
  startDate: string;
  endDate: string;
  days: { date: string; tasks: { key: string; text: string }[] }[];
};

const plant = { id: "1", name: "Radish" };
const container = { id: "2", name: "Pot 1" };
const populatedWeek: WeeklyTaskWeek = {
  startDate: "2026-08-17",
  endDate: "2026-08-23",
  days: [
    {
      date: "2026-08-17",
      tasks: [
        {
          key: "weekly-task:v1:2026-08-17:soil-moisture:1",
          text: "Check soil moisture for Radish in Pot 1. Water only if the top inch feels dry.",
        },
      ],
    },
    {
      date: "2026-08-19",
      tasks: [
        {
          key: "weekly-task:v1:2026-08-19:garden-health",
          text: "Check active Growing Trials for pests or other problems.",
        },
      ],
    },
  ],
};

function trial(id: string, status: Status): Trial {
  const started = status !== "PLANNED";
  const ended = status === "COMPLETED" || status === "ABANDONED";
  return {
    id,
    plant,
    container: { ...container, name: `Pot ${id}` },
    status,
    startDate: started ? "2026-08-14" : null,
    startMethod: started ? "SEED" : null,
    endDate: ended ? "2026-08-20" : null,
    resultSummary: ended ? "Learned from this trial." : "",
    createdAt: "2026-08-14T12:00:00Z",
    updatedAt: "2026-08-14T12:00:00Z",
  };
}

async function mockDashboardGraphql(
  page: Page,
  options: {
    initialTrials?: Trial[];
    plants?: (typeof plant)[];
    containers?: (typeof container)[];
    weeklyTasks?: WeeklyTaskWeek;
    weeklyFailures?: number;
  } = {},
) {
  const trials = [...(options.initialTrials ?? [])];
  const plants = options.plants ?? [plant];
  const containers = options.containers ?? [container];
  const listStatuses: (Status | null)[] = [];
  const weeklyTimeZones: string[] = [];
  let weeklyFailures = options.weeklyFailures ?? 0;
  let weeklyRequests = 0;

  await page.route(/\/graphql\/?(\?.*)?$/, async (route) => {
    const body = route.request().postDataJSON() as {
      operationName?: string;
      query?: string;
      variables?: Record<string, string | number | null>;
    };
    const operation =
      body.operationName ??
      body.query?.match(/\b(?:query|mutation)\s+(\w+)/)?.[1];
    const variables = body.variables ?? {};

    if (operation === "WeeklyTasks") {
      weeklyRequests += 1;
      weeklyTimeZones.push(String(variables.timeZone));
      if (weeklyFailures > 0) {
        weeklyFailures -= 1;
        await route.fulfill({
          contentType: "application/json",
          json: { errors: [{ message: "Weekly tasks are unavailable." }] },
        });
      } else {
        await route.fulfill({
          contentType: "application/json",
          json: {
            data: {
              weeklyTasks:
                options.weeklyTasks ??
                (trials.some((item) => item.status === "ACTIVE")
                  ? populatedWeek
                  : {
                      startDate: "2026-08-17",
                      endDate: "2026-08-23",
                      days: [],
                    }),
            },
          },
        });
      }
      return;
    }

    if (operation === "GrowingTrials") {
      const status = (variables.status as Status | null) ?? null;
      listStatuses.push(status);
      const matching = status
        ? trials.filter((item) => item.status === status)
        : trials;
      const limit = Number(variables.limit ?? 20);
      const after = variables.after as string | null;
      const start = after
        ? matching.findIndex(
            (item) => item.id === after.replace("cursor:", ""),
          ) + 1
        : 0;
      const items = matching.slice(start, start + limit);
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            growingTrials: {
              items,
              hasNextPage: start + limit < matching.length,
              hasPreviousPage: Boolean(after),
              endCursor: items.length ? `cursor:${items.at(-1)?.id}` : null,
            },
          },
        },
      });
      return;
    }

    if (operation === "GrowingTrialSetupContext") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            plants: plants.slice(0, 1),
            containers: containers.slice(0, 1),
            trials: { items: trials.slice(0, 1).map(({ id }) => ({ id })) },
          },
        },
      });
      return;
    }

    if (
      operation === "GrowingTrialPlantOptions" ||
      operation === "GrowingTrialContainerOptions"
    ) {
      const field =
        operation === "GrowingTrialPlantOptions"
          ? "growingTrialPlantOptions"
          : "growingTrialContainerOptions";
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: { [field]: field.includes("Plant") ? plants : containers },
        },
      });
      return;
    }

    if (operation === "CreateGrowingTrial") {
      const created = trial(String(trials.length + 1), "PLANNED");
      trials.unshift(created);
      await route.fulfill({
        contentType: "application/json",
        json: { data: { createGrowingTrial: created } },
      });
      return;
    }

    if (operation === "StartGrowingTrial") {
      const index = trials.findIndex((item) => item.id === variables.id);
      const started: Trial = {
        ...trials[index],
        status: "ACTIVE",
        startDate: String(variables.startDate),
        startMethod: variables.startMethod as Trial["startMethod"],
        updatedAt: "2026-08-20T12:00:00Z",
      };
      trials[index] = started;
      await route.fulfill({
        contentType: "application/json",
        json: { data: { startGrowingTrial: started } },
      });
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: "application/json",
      json: { errors: [{ message: `Unexpected operation: ${operation}` }] },
    });
  });

  return {
    listStatuses,
    weeklyTimeZones,
    weeklyRequestCount: () => weeklyRequests,
  };
}

test("shows a populated weekly plan without mobile overflow", async ({
  page,
}) => {
  await mockDashboardGraphql(page, {
    initialTrials: [trial("1", "ACTIVE")],
    weeklyTasks: populatedWeek,
  });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
  await expect(page.getByText("Aug 17, 2026 - Aug 23, 2026")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Monday, August 17" }),
  ).toBeVisible();
  await expect(page.getByText(/Radish in Pot 1\. Water only/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Tuesday/ })).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test("empty weekly plan leaves one clear garden action", async ({ page }) => {
  await mockDashboardGraphql(page, { initialTrials: [] });
  await page.goto("/");

  await expect(page.getByText(/No tasks are planned/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Plan your first Growing Trial" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Growing Trials" }),
  ).toHaveCount(0);
});

test("starting a planned trial refreshes weekly tasks without reload", async ({
  page,
}) => {
  const requests = await mockDashboardGraphql(page, {
    initialTrials: [trial("1", "PLANNED")],
  });
  await page.goto("/?status=planned");
  await expect(page.getByText(/No tasks are planned/)).toBeVisible();
  expect(requests.weeklyRequestCount()).toBe(1);

  await page.getByRole("button", { name: "Start Radish in Pot 1" }).click();
  await page.getByRole("combobox", { name: "Start method" }).click();
  await page.getByRole("option", { name: "Seed", exact: true }).click();
  await page.getByRole("button", { name: "Start Growing Trial" }).click();

  await expect(page.getByText(/Radish in Pot 1\. Water only/)).toBeVisible();
  expect(requests.weeklyRequestCount()).toBe(2);
});

test("retries a failed weekly request", async ({ page }) => {
  const requests = await mockDashboardGraphql(page, {
    initialTrials: [trial("1", "ACTIVE")],
    weeklyTasks: populatedWeek,
    weeklyFailures: 1,
  });
  await page.goto("/");

  await expect(
    page.getByText("Weekly tasks could not be loaded."),
  ).toBeVisible();
  expect(requests.weeklyRequestCount()).toBe(1);
  await page.getByRole("button", { name: "Try again" }).last().click();
  await expect(
    page.getByRole("heading", { name: "Monday, August 17" }),
  ).toBeVisible();
  expect(requests.weeklyRequestCount()).toBe(2);
});

test("sends browser timezone once and ignores Growing Trial filters", async ({
  page,
}) => {
  const requests = await mockDashboardGraphql(page, {
    initialTrials: [trial("1", "ACTIVE"), trial("2", "PLANNED")],
    weeklyTasks: populatedWeek,
  });
  await page.goto("/");
  await expect(page.getByText(/Radish in Pot 1\. Water only/)).toBeVisible();
  const browserTimeZone = await page.evaluate(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  await page.getByRole("button", { name: "Planned" }).click();
  await expect(page).toHaveURL(/\?status=planned$/);
  await expect(page.getByText(/Radish in Pot 1\. Water only/)).toBeVisible();
  expect(requests.weeklyTimeZones).toEqual([browserTimeZone]);
  expect(requests.weeklyRequestCount()).toBe(1);
});

test("defaults to Active and navigates URL-backed filters", async ({
  page,
}) => {
  const requests = await mockDashboardGraphql(page, {
    initialTrials: [
      trial("3", "COMPLETED"),
      trial("2", "PLANNED"),
      trial("1", "ACTIVE"),
    ],
  });
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Active" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Radish in Pot 1" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Radish in Pot 2" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Planned" }).click();
  await expect(page).toHaveURL(/\?status=planned$/);
  await expect(
    page.getByRole("heading", { name: "Radish in Pot 2" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "All" }).click();
  await expect(page).toHaveURL(/\?status=all$/);
  await expect(
    page.getByRole("heading", { name: /Radish in Pot/ }),
  ).toHaveCount(3);
  expect(requests.listStatuses).toEqual(
    expect.arrayContaining(["ACTIVE", "PLANNED", null]),
  );
});

test("redirects an invalid status to Active", async ({ page }) => {
  await mockDashboardGraphql(page, { initialTrials: [trial("1", "ACTIVE")] });

  await page.goto("/?status=unknown");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Active" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("guides an empty garden through prerequisites", async ({ page }) => {
  await mockDashboardGraphql(page, { plants: [], containers: [] });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Set up your garden first" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Add a Plant" })).toHaveAttribute(
    "href",
    "/plants",
  );
  await expect(
    page.getByRole("link", { name: "Add a Container" }),
  ).toHaveAttribute("href", "/containers");
});

test("creates a trial and switches to Planned", async ({ page }) => {
  await mockDashboardGraphql(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Plan your first Growing Trial" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add Growing Trial" }).first().click();
  await page.getByRole("combobox", { name: "Plant" }).click();
  await page.getByRole("option", { name: "Radish" }).click();
  await page.getByRole("combobox", { name: "Container" }).click();
  await page.getByRole("option", { name: "Pot 1" }).click();
  await page.getByRole("button", { name: "Create Growing Trial" }).click();

  await expect(page).toHaveURL(/\?status=planned$/);
  await expect(
    page.getByRole("heading", { name: "Radish in Pot 1" }),
  ).toBeVisible();
});

test("dashboard controls are mobile-safe touch targets", async ({ page }) => {
  await mockDashboardGraphql(page, { initialTrials: [trial("1", "ACTIVE")] });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Radish in Pot 1" }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  for (const label of ["Active", "Planned", "Completed", "Abandoned", "All"]) {
    const box = await page.getByRole("button", { name: label }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});
