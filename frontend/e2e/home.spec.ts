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

const plant = { id: "1", name: "Radish" };
const container = { id: "2", name: "Pot 1" };

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
  } = {},
) {
  const trials = [...(options.initialTrials ?? [])];
  const plants = options.plants ?? [plant];
  const containers = options.containers ?? [container];
  const listStatuses: (Status | null)[] = [];

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

    await route.fulfill({
      status: 500,
      contentType: "application/json",
      json: { errors: [{ message: `Unexpected operation: ${operation}` }] },
    });
  });

  return { listStatuses };
}

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
