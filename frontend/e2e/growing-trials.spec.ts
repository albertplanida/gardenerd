import { expect, type Page, test } from "@playwright/test";

type MockOption = { id: string; name: string };
type MockGrowingTrial = {
  id: string;
  plant: MockOption;
  container: MockOption;
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "ABANDONED";
  startDate: string | null;
  startMethod: "SEED" | "SEEDLING_TRANSPLANT" | null;
  createdAt: string;
  updatedAt: string;
};
type GraphqlRequest = {
  operationName?: string;
  query?: string;
  variables?: Record<string, string | number | null>;
};
type MockGraphqlOptions = {
  initialTrials?: MockGrowingTrial[];
  plants?: MockOption[];
  containers?: MockOption[];
  queryFailures?: number;
  refreshFailures?: number;
  plantOptionFailures?: number;
  saveFailures?: number;
  startErrors?: string[];
};

const graphqlRoute = /\/graphql\/?(\?.*)?$/;
const unknownOperations = new WeakMap<Page, string[]>();
const plant = { id: "1", name: "Radish" };
const container = { id: "2", name: "Pot 1" };

function makeTrial(id = "1"): MockGrowingTrial {
  return {
    id,
    plant,
    container,
    status: "PLANNED",
    startDate: null,
    startMethod: null,
    createdAt: "2026-08-14T12:00:00Z",
    updatedAt: "2026-08-14T12:00:00Z",
  };
}

function getOperationName(body: GraphqlRequest) {
  return (
    body.operationName ??
    body.query?.match(/\b(?:query|mutation)\s+(\w+)/)?.[1] ??
    "unknown"
  );
}

async function mockGrowingTrialGraphql(
  page: Page,
  {
    initialTrials = [],
    plants = [plant],
    containers = [container],
    queryFailures = 0,
    refreshFailures = 0,
    plantOptionFailures = 0,
    saveFailures = 0,
    startErrors = [],
  }: MockGraphqlOptions = {},
) {
  const trials = [...initialTrials].sort((a, b) => Number(b.id) - Number(a.id));
  const createRequests: Record<string, string | number | null>[] = [];
  const startRequests: Record<string, string | number | null>[] = [];
  const listRequests: Record<string, string | number | null>[] = [];
  const unexpected: string[] = [];
  unknownOperations.set(page, unexpected);
  let remainingQueryFailures = queryFailures;
  let remainingRefreshFailures = refreshFailures;
  let remainingPlantOptionFailures = plantOptionFailures;
  let remainingSaveFailures = saveFailures;
  let hasCreated = false;

  await page.route(graphqlRoute, async (route) => {
    const rawBody = route.request().postData() ?? "{}";
    let body: GraphqlRequest;
    try {
      const parsed = JSON.parse(rawBody) as GraphqlRequest | string;
      body = typeof parsed === "string" ? { query: parsed } : parsed;
    } catch {
      body = { query: rawBody };
    }
    const operationName = getOperationName(body);
    const variables = body.variables ?? {};

    if (operationName === "GrowingTrials") {
      listRequests.push(variables);
      const shouldFailInitial = remainingQueryFailures > 0;
      const shouldFailRefresh = hasCreated && remainingRefreshFailures > 0;
      if (shouldFailInitial || shouldFailRefresh) {
        if (shouldFailInitial) remainingQueryFailures -= 1;
        if (shouldFailRefresh) remainingRefreshFailures -= 1;
        await route.fulfill({
          contentType: "application/json",
          json: { errors: [{ message: "Growing Trials unavailable" }] },
        });
        return;
      }

      const limit = Number(variables.limit ?? 20);
      const after = variables.after as string | null;
      const afterId = after ? after.replace("cursor:", "") : null;
      const start = afterId
        ? trials.findIndex((trial) => trial.id === afterId) + 1
        : 0;
      const items = trials.slice(start, start + limit);
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            growingTrials: {
              items,
              hasNextPage: start + limit < trials.length,
              hasPreviousPage: Boolean(after),
              endCursor: items.length
                ? `cursor:${items[items.length - 1].id}`
                : null,
            },
          },
        },
      });
      return;
    }

    if (
      operationName === "GrowingTrialPlantOptions" ||
      operationName === "GrowingTrialContainerOptions"
    ) {
      if (
        operationName === "GrowingTrialPlantOptions" &&
        remainingPlantOptionFailures > 0
      ) {
        remainingPlantOptionFailures -= 1;
        await route.fulfill({
          contentType: "application/json",
          json: { errors: [{ message: "Plant options unavailable" }] },
        });
        return;
      }
      const records =
        operationName === "GrowingTrialPlantOptions" ? plants : containers;
      const search = String(variables.search ?? "")
        .trim()
        .toLocaleLowerCase();
      const limit = Number(variables.limit ?? 20);
      const options = records
        .filter((record) => record.name.toLocaleLowerCase().includes(search))
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        )
        .slice(0, limit);
      const field =
        operationName === "GrowingTrialPlantOptions"
          ? "growingTrialPlantOptions"
          : "growingTrialContainerOptions";
      await route.fulfill({
        contentType: "application/json",
        json: { data: { [field]: options } },
      });
      return;
    }

    if (operationName === "CreateGrowingTrial") {
      createRequests.push(variables);
      if (remainingSaveFailures > 0) {
        remainingSaveFailures -= 1;
        await route.fulfill({
          contentType: "application/json",
          json: { errors: [{ message: "Growing Trial could not be saved" }] },
        });
        return;
      }
      const nextId = String(
        Math.max(0, ...trials.map((trial) => Number(trial.id))) + 1,
      );
      const trial = makeTrial(nextId);
      trials.unshift(trial);
      hasCreated = true;
      await route.fulfill({
        contentType: "application/json",
        json: { data: { createGrowingTrial: trial } },
      });
      return;
    }

    if (operationName === "StartGrowingTrial") {
      startRequests.push(variables);
      const errorCode = startErrors.shift();
      if (errorCode) {
        const trialIndex = trials.findIndex((item) => item.id === variables.id);
        if (errorCode === "GROWING_TRIAL_NOT_FOUND" && trialIndex >= 0) {
          trials.splice(trialIndex, 1);
        }
        if (errorCode === "GROWING_TRIAL_NOT_PLANNED" && trialIndex >= 0) {
          trials[trialIndex].status = "ACTIVE";
          trials[trialIndex].startDate = String(variables.startDate);
          trials[trialIndex].startMethod = variables.startMethod as
            "SEED" | "SEEDLING_TRANSPLANT";
        }
        await route.fulfill({
          contentType: "application/json",
          json: {
            errors: [
              { message: "Start failed", extensions: { code: errorCode } },
            ],
          },
        });
        return;
      }
      const trial = trials.find((item) => item.id === variables.id);
      if (!trial) throw new Error(`Unknown trial ${variables.id}`);
      trial.status = "ACTIVE";
      trial.startDate = String(variables.startDate);
      trial.startMethod = variables.startMethod as
        "SEED" | "SEEDLING_TRANSPLANT";
      await route.fulfill({
        contentType: "application/json",
        json: { data: { startGrowingTrial: trial } },
      });
      return;
    }

    unexpected.push(operationName);
    await route.fulfill({
      contentType: "application/json",
      json: {
        errors: [{ message: `Unexpected GraphQL operation: ${operationName}` }],
      },
    });
  });

  return { createRequests, listRequests, startRequests };
}

async function chooseTrialRelationships(page: Page) {
  await page.getByRole("combobox", { name: "Plant" }).click();
  await page.getByRole("option", { name: plant.name }).click();
  await page.getByRole("combobox", { name: "Container" }).click();
  await page.getByRole("option", { name: container.name }).click();
}

async function createTrial(page: Page) {
  await page.getByRole("button", { name: "Add Growing Trial" }).click();
  await chooseTrialRelationships(page);
  await page.getByRole("button", { name: "Create Growing Trial" }).click();
}

test.afterEach(async ({ page }) => {
  expect(unknownOperations.get(page) ?? []).toEqual([]);
});

test("navigates from home to Growing Trials", async ({ page }) => {
  await mockGrowingTrialGraphql(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Manage Growing Trials" }).click();
  await expect(page).toHaveURL(/\/growing-trials$/);
  await expect(
    page.getByRole("heading", { name: "No Growing Trials yet" }),
  ).toBeVisible();
});

test("creates and visibly confirms a planned Growing Trial", async ({
  page,
}) => {
  const { createRequests } = await mockGrowingTrialGraphql(page);
  await page.goto("/growing-trials");
  await page.getByRole("button", { name: "Add Growing Trial" }).click();
  await page.getByRole("button", { name: "Create Growing Trial" }).click();
  await expect(page.getByText("Select a Plant.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Plant" })).toBeFocused();
  await chooseTrialRelationships(page);
  await page.getByRole("button", { name: "Create Growing Trial" }).click();

  await expect(
    page.getByRole("heading", { name: "Radish in Pot 1" }),
  ).toBeVisible();
  await expect(page.getByText("Growing Trial created")).toBeVisible();
  await expect(page.getByText("Radish in Pot 1").last()).toBeVisible();
  expect(createRequests).toEqual([{ plantId: "1", containerId: "2" }]);
});

test("creates from a full first page without hiding the result", async ({
  page,
}) => {
  const trials = Array.from({ length: 20 }, (_, index) =>
    makeTrial(String(index + 1)),
  );
  await mockGrowingTrialGraphql(page, { initialTrials: trials });
  await page.goto("/growing-trials");
  await createTrial(page);
  await expect(page.getByText("Growing Trial created")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Radish in Pot 1" }).first(),
  ).toBeVisible();
});

test("creates from a later page and returns to page one", async ({ page }) => {
  const trials = Array.from({ length: 21 }, (_, index) =>
    makeTrial(String(index + 1)),
  );
  await mockGrowingTrialGraphql(page, { initialTrials: trials });
  await page.goto("/growing-trials");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: "Previous" })).toBeEnabled();
  await createTrial(page);
  await expect(page.getByText("Growing Trial created")).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
});

test("keeps a successful creation when refresh fails and retries", async ({
  page,
}) => {
  await mockGrowingTrialGraphql(page, { refreshFailures: 1 });
  await page.goto("/growing-trials");
  await createTrial(page);
  await expect(
    page.getByRole("heading", { name: "Radish in Pot 1" }),
  ).toBeVisible();
  await expect(
    page.getByText("The Growing Trial list could not be refreshed."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByText("The Growing Trial list could not be refreshed."),
  ).not.toBeVisible();
});

test("preserves selections and retries a failed save", async ({ page }) => {
  const { createRequests } = await mockGrowingTrialGraphql(page, {
    saveFailures: 1,
  });
  await page.goto("/growing-trials");
  await page.getByRole("button", { name: "Add Growing Trial" }).click();
  await chooseTrialRelationships(page);
  await page.getByRole("button", { name: "Create Growing Trial" }).click();
  await expect(
    page.getByText("Growing Trial could not be saved."),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Plant" })).toHaveValue(
    "Radish",
  );
  await page.getByRole("button", { name: "Create Growing Trial" }).click();
  await expect(page.getByText("Growing Trial created")).toBeVisible();
  expect(createRequests).toHaveLength(2);
});

test("searches remote options and recovers from a search failure", async ({
  page,
}) => {
  const basil = { id: "3", name: "Thai Basil" };
  await mockGrowingTrialGraphql(page, {
    plants: [plant, basil],
    plantOptionFailures: 1,
  });
  await page.goto("/growing-trials");
  await page.getByRole("button", { name: "Add Growing Trial" }).click();
  await expect(page.getByText("Plants could not be loaded.")).toBeVisible();
  await page.getByRole("button", { name: "Try Plants again" }).click();
  const selector = page.getByRole("combobox", { name: "Plant" });
  await selector.fill("thai");
  await expect(page.getByRole("option", { name: "Thai Basil" })).toBeVisible();
});

test("supports keyboard submission and restores modal focus", async ({
  page,
}) => {
  await mockGrowingTrialGraphql(page);
  await page.goto("/growing-trials");
  const add = page.getByRole("button", { name: "Add Growing Trial" });
  await add.click();
  await chooseTrialRelationships(page);
  await page
    .getByRole("button", { name: "Create Growing Trial" })
    .press("Enter");
  await expect(page.getByText("Growing Trial created")).toBeVisible();
  await expect(add).toBeFocused();
});

test("supports selector interaction at the configured viewport", async ({
  page,
}, testInfo) => {
  await mockGrowingTrialGraphql(page);
  await page.goto("/growing-trials");
  await page.getByRole("button", { name: "Add Growing Trial" }).click();
  await chooseTrialRelationships(page);
  await expect(page.getByRole("combobox", { name: "Plant" })).toHaveValue(
    "Radish",
  );
  expect(["chromium", "mobile-chrome"]).toContain(testInfo.project.name);
});

test("starts a planned trial in place with exact mutation variables", async ({
  page,
}) => {
  const { startRequests } = await mockGrowingTrialGraphql(page, {
    initialTrials: [makeTrial("7")],
  });
  await page.goto("/growing-trials");
  await page.getByRole("button", { name: "Start Radish in Pot 1" }).click();
  const date = page.getByLabel("Start date");
  const startDate = await date.inputValue();
  expect(await date.getAttribute("max")).toBe(startDate);
  await page.getByRole("combobox", { name: "Start method" }).click();
  await page.getByRole("option", { name: "Seedling/transplant" }).click();
  await page.getByRole("button", { name: "Start Growing Trial" }).click();

  await expect(
    page.getByText("Start method: Seedling/transplant"),
  ).toBeVisible();
  await expect(page.locator(`time[datetime="${startDate}"]`)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start Radish in Pot 1" }),
  ).toHaveCount(0);
  await expect(page.getByText("Growing Trial started")).toBeVisible();
  await expect(page.locator("#growing-trial-7")).toBeFocused();
  expect(startRequests).toEqual([
    {
      id: "7",
      startDate,
      startMethod: "SEEDLING_TRANSPLANT",
      timeZone: await page.evaluate(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    },
  ]);
});

test("closes, refreshes, and notifies for an occupied Container conflict", async ({
  page,
}) => {
  const { listRequests, startRequests } = await mockGrowingTrialGraphql(page, {
    initialTrials: [makeTrial("7")],
    startErrors: ["CONTAINER_OCCUPIED"],
  });
  await page.goto("/growing-trials");
  await page.getByRole("button", { name: "Start Radish in Pot 1" }).click();
  await page.getByRole("combobox", { name: "Start method" }).click();
  await page.getByRole("option", { name: "Seed", exact: true }).click();
  await page.getByRole("button", { name: "Start Growing Trial" }).click();
  await expect(
    page.getByText(
      "This Container now has an active Growing Trial. Refreshing the list.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => listRequests.length).toBe(2);
  expect(startRequests).toHaveLength(1);
});

test("refreshes a card after a stale lifecycle conflict", async ({ page }) => {
  await mockGrowingTrialGraphql(page, {
    initialTrials: [makeTrial("7")],
    startErrors: ["GROWING_TRIAL_NOT_PLANNED"],
  });
  await page.goto("/growing-trials");
  await page.getByRole("button", { name: "Start Radish in Pot 1" }).click();
  await page.getByRole("combobox", { name: "Start method" }).click();
  await page.getByRole("option", { name: "Seed", exact: true }).click();
  await page.getByRole("button", { name: "Start Growing Trial" }).click();
  await expect(
    page.getByText(
      "This Growing Trial is no longer planned, so it cannot be started again. Refreshing the list.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start Radish in Pot 1" }),
  ).toHaveCount(0);
  await expect(page.getByText("Active")).toBeVisible();
});

test("keeps the planned card within the mobile viewport with a touch-friendly action", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome");
  await mockGrowingTrialGraphql(page, { initialTrials: [makeTrial("7")] });
  await page.goto("/growing-trials");

  const start = page.getByRole("button", { name: "Start Radish in Pot 1" });
  await expect(start).toBeVisible();
  const box = await start.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});
