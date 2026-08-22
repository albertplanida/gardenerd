import { expect, type Page, test } from "@playwright/test";

type MockOption = { id: string; name: string };
type MockGrowingTrial = {
  id: string;
  plant: MockOption;
  container: MockOption;
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "ABANDONED";
  startDate: string | null;
  startMethod: "SEED" | "SEEDLING_TRANSPLANT" | null;
  endDate: string | null;
  resultSummary: string;
  createdAt: string;
  updatedAt: string;
};
type MockJournalEvent = {
  id: string;
  eventType:
    | "PLANTED"
    | "WATERED"
    | "GERMINATED"
    | "FERTILIZED"
    | "PRUNED"
    | "HARVESTED"
    | "PROBLEM_NOTICED"
    | "PHOTO_TAKEN"
    | "GENERAL_OBSERVATION";
  eventDate: string;
  note: string;
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
  initialJournalEvents?: Record<string, MockJournalEvent[]>;
  journalMutationErrors?: string[];
  journalQueryFailures?: number;
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
    endDate: null,
    resultSummary: "",
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
    initialJournalEvents = {},
    journalMutationErrors = [],
    journalQueryFailures = 0,
  }: MockGraphqlOptions = {},
) {
  const trials = [...initialTrials].sort((a, b) => Number(b.id) - Number(a.id));
  const createRequests: Record<string, string | number | null>[] = [];
  const startRequests: Record<string, string | number | null>[] = [];
  const terminalRequests: Record<string, string | number | null>[] = [];
  const listRequests: Record<string, string | number | null>[] = [];
  const journalRequests: {
    operationName: string;
    variables: Record<string, string | number | null>;
  }[] = [];
  const journalEvents = new Map(
    Object.entries(initialJournalEvents).map(([id, events]) => [
      id,
      [...events],
    ]),
  );
  const unexpected: string[] = [];
  unknownOperations.set(page, unexpected);
  let remainingQueryFailures = queryFailures;
  let remainingRefreshFailures = refreshFailures;
  let remainingPlantOptionFailures = plantOptionFailures;
  let remainingSaveFailures = saveFailures;
  let hasCreated = false;
  let remainingJournalQueryFailures = journalQueryFailures;

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

    if (operationName === "GrowingTrialSetupContext") {
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

    if (operationName === "JournalEvents") {
      journalRequests.push({ operationName, variables });
      if (remainingJournalQueryFailures > 0) {
        remainingJournalQueryFailures -= 1;
        await route.fulfill({
          contentType: "application/json",
          json: { errors: [{ message: "Journal Events unavailable" }] },
        });
        return;
      }
      const growingTrialId = String(variables.growingTrialId);
      if (!trials.some((trial) => trial.id === growingTrialId)) {
        await route.fulfill({
          contentType: "application/json",
          json: {
            errors: [
              {
                message: "Growing Trial not found.",
                extensions: { code: "GROWING_TRIAL_NOT_FOUND" },
              },
            ],
          },
        });
        return;
      }
      const events = journalEvents.get(growingTrialId) ?? [];
      const limit = Number(variables.limit ?? 20);
      const after = variables.after as string | null;
      const afterId = after ? after.replace("journal-cursor:", "") : null;
      const start = afterId
        ? events.findIndex((event) => event.id === afterId) + 1
        : 0;
      const items = events.slice(start, start + limit);
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            journalEvents: {
              items,
              hasNextPage: start + limit < events.length,
              hasPreviousPage: Boolean(after),
              endCursor: items.length
                ? `journal-cursor:${items[items.length - 1].id}`
                : null,
            },
          },
        },
      });
      return;
    }

    if (
      operationName === "CreateJournalEvent" ||
      operationName === "UpdateJournalEvent" ||
      operationName === "DeleteJournalEvent"
    ) {
      journalRequests.push({ operationName, variables });
      const errorCode = journalMutationErrors.shift();
      if (errorCode) {
        if (errorCode === "GROWING_TRIAL_NOT_ACTIVE") {
          const id = String(variables.growingTrialId ?? "7");
          const staleTrial = trials.find((trial) => trial.id === id);
          if (staleTrial) staleTrial.status = "COMPLETED";
        }
        await route.fulfill({
          contentType: "application/json",
          json: {
            errors: [
              {
                message: "Journal mutation failed",
                extensions: { code: errorCode },
              },
            ],
          },
        });
        return;
      }
      if (operationName === "CreateJournalEvent") {
        const growingTrialId = String(variables.growingTrialId);
        const events = journalEvents.get(growingTrialId) ?? [];
        const event: MockJournalEvent = {
          id: String(Math.max(0, ...events.map((item) => Number(item.id))) + 1),
          eventType: variables.eventType as MockJournalEvent["eventType"],
          eventDate: String(variables.eventDate),
          note: String(variables.note),
          createdAt: "2026-08-20T12:00:00Z",
          updatedAt: "2026-08-20T12:00:00Z",
        };
        events.unshift(event);
        journalEvents.set(growingTrialId, events);
        await route.fulfill({
          contentType: "application/json",
          json: { data: { createJournalEvent: event } },
        });
        return;
      }
      const entry = [...journalEvents.entries()].find(([, events]) =>
        events.some((event) => event.id === variables.id),
      );
      if (!entry) throw new Error(`Unknown Journal Event ${variables.id}`);
      const [growingTrialId, events] = entry;
      const index = events.findIndex((event) => event.id === variables.id);
      if (operationName === "DeleteJournalEvent") {
        events.splice(index, 1);
        journalEvents.set(growingTrialId, events);
        await route.fulfill({
          contentType: "application/json",
          json: { data: { deleteJournalEvent: variables.id } },
        });
        return;
      }
      const event = {
        ...events[index],
        eventType: variables.eventType as MockJournalEvent["eventType"],
        eventDate: String(variables.eventDate),
        note: String(variables.note),
        updatedAt: "2026-08-20T13:00:00Z",
      };
      events.splice(index, 1);
      events.push(event);
      events.sort(
        (left, right) =>
          right.eventDate.localeCompare(left.eventDate) ||
          right.createdAt.localeCompare(left.createdAt),
      );
      journalEvents.set(growingTrialId, events);
      await route.fulfill({
        contentType: "application/json",
        json: { data: { updateJournalEvent: event } },
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

    if (
      operationName === "CompleteGrowingTrial" ||
      operationName === "AbandonGrowingTrial" ||
      operationName === "UpdateGrowingTrialResult"
    ) {
      terminalRequests.push(variables);
      const trial = trials.find((item) => item.id === variables.id);
      if (!trial) throw new Error(`Unknown trial ${variables.id}`);
      if (operationName === "CompleteGrowingTrial") {
        trial.status = "COMPLETED";
      } else if (operationName === "AbandonGrowingTrial") {
        trial.status = "ABANDONED";
      }
      trial.endDate = String(variables.endDate);
      trial.resultSummary = String(variables.resultSummary ?? "").trim();
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            [operationName === "CompleteGrowingTrial"
              ? "completeGrowingTrial"
              : operationName === "AbandonGrowingTrial"
                ? "abandonGrowingTrial"
                : "updateGrowingTrialResult"]: trial,
          },
        },
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

  return {
    createRequests,
    journalRequests,
    listRequests,
    startRequests,
    terminalRequests,
  };
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
  await page.getByRole("link", { name: "Growing Trials", exact: true }).click();
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

test("completes an active trial with exact variables and edits its result", async ({
  page,
}) => {
  const active = {
    ...makeTrial("7"),
    status: "ACTIVE" as const,
    startDate: "2026-08-01",
    startMethod: "SEED" as const,
  };
  const { terminalRequests } = await mockGrowingTrialGraphql(page, {
    initialTrials: [active],
  });
  await page.goto("/growing-trials");
  await page.getByRole("button", { name: "Complete Radish in Pot 1" }).click();
  const date = page.getByLabel("End date");
  const endDate = await date.inputValue();
  await page.getByLabel("Result summary (optional)").fill("  Strong harvest  ");
  await page.getByRole("button", { name: "Complete Growing Trial" }).click();

  await expect(page.getByText("Growing Trial completed")).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.locator(`time[datetime="${endDate}"]`)).toBeVisible();
  await expect(page.locator("#growing-trial-7")).toBeFocused();
  await page.getByText("Result summary").click();
  await expect(page.getByText("Strong harvest")).toBeVisible();
  expect(terminalRequests[0]).toEqual({
    id: "7",
    endDate,
    resultSummary: "  Strong harvest  ",
    timeZone: await page.evaluate(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
  });

  await page
    .getByRole("button", { name: "Edit result for Radish in Pot 1" })
    .click();
  await expect(page.getByLabel("End date")).toHaveValue(endDate);
  await expect(page.getByLabel("Result summary (optional)")).toHaveValue(
    "Strong harvest",
  );
  await page.getByLabel("Result summary (optional)").fill("Revised result");
  await page.getByRole("button", { name: "Save Result" }).click();
  await expect(page.getByText("Growing Trial result updated")).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  expect(terminalRequests[1]).toEqual(
    expect.objectContaining({
      id: "7",
      endDate,
      resultSummary: "Revised result",
    }),
  );
});

test("keeps the planned card within the mobile viewport with a touch-friendly action", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome");
  await mockGrowingTrialGraphql(page, { initialTrials: [makeTrial("7")] });
  await page.goto("/growing-trials");

  const start = page.getByRole("button", { name: "Start Radish in Pot 1" });
  const abandon = page.getByRole("button", { name: "Abandon Radish in Pot 1" });
  await expect(start).toBeVisible();
  await expect(abandon).toBeVisible();
  const box = await start.boundingBox();
  const abandonBox = await abandon.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(abandonBox?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

test("creates, edits, and deletes a Journal Event with exact variables", async ({
  page,
}, testInfo) => {
  const active = {
    ...makeTrial("7"),
    status: "ACTIVE" as const,
    startDate: "2026-08-01",
    startMethod: "SEED" as const,
  };
  const { journalRequests } = await mockGrowingTrialGraphql(page, {
    initialTrials: [active],
  });
  await page.goto("/growing-trials");
  const show = page.getByRole("button", { name: "Show Journal" });
  await expect(show).toHaveAttribute("aria-expanded", "false");
  await show.click();
  await expect(
    page.getByRole("button", { name: "Hide Journal" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText("No Journal Events have been recorded yet."),
  ).toBeVisible();

  const add = page.getByRole("button", { name: "Add Journal Event" });
  if (testInfo.project.name === "mobile-chrome") {
    expect((await add.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  await add.click();
  await page.getByRole("button", { name: "Add Journal Event" }).last().click();
  await expect(page.getByText("Select an event type.")).toBeVisible();
  await page.getByRole("combobox", { name: "Event type" }).click();
  await page.getByRole("option", { name: "Watered" }).click();
  await page.getByLabel("Event date").fill("2026-08-10");
  await page.getByLabel("Note").fill("  Watered deeply.\nSoil was dry.  ");
  await page.getByRole("button", { name: "Add Journal Event" }).last().click();
  await expect(page.getByText("Journal Event added")).toBeVisible();
  await expect(page.getByText(/Watered deeply/)).toBeVisible();
  await expect(add).toBeFocused();

  const edit = page.getByRole("button", {
    name: "Edit Watered Journal Event from 2026-08-10",
  });
  if (testInfo.project.name === "mobile-chrome") {
    expect((await edit.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  await edit.click();
  await page.getByRole("combobox", { name: "Event type" }).click();
  await page.getByRole("option", { name: "Harvested" }).click();
  await page.getByLabel("Event date").fill("2026-08-12");
  await page.getByLabel("Note").fill("First harvest");
  await page.getByRole("button", { name: "Save Journal Event" }).click();
  await expect(page.getByText("First harvest")).toBeVisible();

  const remove = page.getByRole("button", {
    name: "Delete Harvested Journal Event from 2026-08-12",
  });
  if (testInfo.project.name === "mobile-chrome") {
    expect((await remove.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  await remove.click();
  await expect(
    page.getByText(/Permanently delete the Harvested event/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete Journal Event" }).click();
  await expect(page.getByText("Journal Event deleted")).toBeVisible();
  await expect(page.getByText("First harvest")).toHaveCount(0);

  const timeZone = await page.evaluate(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  expect(journalRequests).toEqual([
    {
      operationName: "JournalEvents",
      variables: { growingTrialId: "7", limit: 20, after: null },
    },
    {
      operationName: "CreateJournalEvent",
      variables: {
        growingTrialId: "7",
        eventType: "WATERED",
        eventDate: "2026-08-10",
        note: "Watered deeply.\nSoil was dry.",
        timeZone,
      },
    },
    {
      operationName: "JournalEvents",
      variables: { growingTrialId: "7", limit: 20, after: null },
    },
    {
      operationName: "UpdateJournalEvent",
      variables: {
        id: "1",
        eventType: "HARVESTED",
        eventDate: "2026-08-12",
        note: "First harvest",
        timeZone,
      },
    },
    {
      operationName: "JournalEvents",
      variables: { growingTrialId: "7", limit: 20, after: null },
    },
    {
      operationName: "DeleteJournalEvent",
      variables: { id: "1" },
    },
    {
      operationName: "JournalEvents",
      variables: { growingTrialId: "7", limit: 20, after: null },
    },
  ]);
});

test("loads older Journal Events on Pixel 5 without horizontal overflow", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome");
  const active = {
    ...makeTrial("7"),
    status: "ACTIVE" as const,
    startDate: "2026-07-01",
    startMethod: "SEED" as const,
  };
  const events = Array.from({ length: 21 }, (_, index) => ({
    id: String(21 - index),
    eventType: (index === 0 ? "HARVESTED" : "GENERAL_OBSERVATION") as
      "HARVESTED" | "GENERAL_OBSERVATION",
    eventDate: `2026-08-${String(20 - Math.min(index, 19)).padStart(2, "0")}`,
    note: index === 0 ? "Newest event" : `Observation ${index}`,
    createdAt: `2026-08-20T${String(23 - index).padStart(2, "0")}:00:00Z`,
    updatedAt: "2026-08-20T12:00:00Z",
  }));
  const { journalRequests } = await mockGrowingTrialGraphql(page, {
    initialTrials: [active],
    initialJournalEvents: { "7": events },
  });
  await page.goto("/growing-trials");
  await page.getByRole("button", { name: "Show Journal" }).click();
  await expect(page.getByText("Newest event")).toBeVisible();
  const loadMore = page.getByRole("button", {
    name: "Load more Journal Events",
  });
  const box = await loadMore.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await loadMore.click();
  await expect(page.getByText("Observation 20")).toBeVisible();
  expect(journalRequests.at(-1)?.variables.after).toBe("journal-cursor:2");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

test("keeps planned and terminal Journal timelines read-only", async ({
  page,
}) => {
  const planned = makeTrial("8");
  const completed = {
    ...makeTrial("7"),
    status: "COMPLETED" as const,
    startDate: "2026-08-01",
    startMethod: "SEED" as const,
    endDate: "2026-08-15",
  };
  await mockGrowingTrialGraphql(page, {
    initialTrials: [planned, completed],
    initialJournalEvents: {
      "7": [
        {
          id: "1",
          eventType: "HARVESTED",
          eventDate: "2026-08-15",
          note: "Final harvest",
          createdAt: "2026-08-15T12:00:00Z",
          updatedAt: "2026-08-15T12:00:00Z",
        },
      ],
    },
  });
  await page.goto("/growing-trials");
  const toggles = page.getByRole("button", { name: "Show Journal" });
  await toggles.last().click();
  await toggles.click();
  await expect(page.getByText("Final harvest")).toBeVisible();
  await expect(
    page.getByText(
      "Journal Events become available after this Growing Trial starts.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Journal Event" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Edit .*Journal Event/ }),
  ).toHaveCount(0);
});

test("retries a failed Journal query and refreshes a stale active trial", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  const active = {
    ...makeTrial("7"),
    status: "ACTIVE" as const,
    startDate: "2026-08-01",
    startMethod: "SEED" as const,
  };
  await mockGrowingTrialGraphql(page, {
    initialTrials: [active],
    journalQueryFailures: 1,
    journalMutationErrors: ["GROWING_TRIAL_NOT_ACTIVE"],
  });
  await page.goto("/growing-trials");
  await page.getByRole("button", { name: "Show Journal" }).click();
  await expect(
    page.getByText("Journal Events could not be loaded."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try Journal again" }).click();
  await expect(
    page.getByText("No Journal Events have been recorded yet."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add Journal Event" }).click();
  await page.getByRole("combobox", { name: "Event type" }).click();
  await page.getByRole("option", { name: "Watered" }).click();
  await page.getByLabel("Note").fill("Watered");
  await page.getByRole("button", { name: "Add Journal Event" }).last().click();
  await expect(page.getByText("Journal Event was not changed")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
});
