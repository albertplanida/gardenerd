import { expect, type Page, test } from "@playwright/test";

type MockPlant = {
  id: string;
  name: string;
  careNotes: string;
  createdAt: string;
  updatedAt: string;
};

type MockContainer = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type MockGrowingTrial = {
  id: string;
  plant: Pick<MockPlant, "id" | "name">;
  container: Pick<MockContainer, "id" | "name">;
  status: "PLANNED";
  createdAt: string;
  updatedAt: string;
};

type GraphqlRequest = {
  operationName?: string;
  query?: string;
  variables?: Record<string, string | number>;
};

type MockGraphqlOptions = {
  initialTrials?: MockGrowingTrial[];
  queryFailures?: number;
  saveFailures?: number;
};

const graphqlRoute = /\/graphql\/?(\?.*)?$/;

const plant: MockPlant = {
  id: "1",
  name: "Radish",
  careNotes: "Keep moist",
  createdAt: "2026-08-14T12:00:00Z",
  updatedAt: "2026-08-14T12:00:00Z",
};

const container: MockContainer = {
  id: "2",
  name: "Pot 1",
  createdAt: "2026-08-14T12:00:00Z",
  updatedAt: "2026-08-14T12:00:00Z",
};

function makeTrial(id = "1"): MockGrowingTrial {
  return {
    id,
    plant: { id: plant.id, name: plant.name },
    container: { id: container.id, name: container.name },
    status: "PLANNED",
    createdAt: "2026-08-14T12:00:00Z",
    updatedAt: "2026-08-14T12:00:00Z",
  };
}

function getOperationName(body: GraphqlRequest) {
  if (body.operationName) {
    return body.operationName;
  }

  return body.query?.match(/\b(?:query|mutation)\s+(\w+)/)?.[1] ?? null;
}

async function mockGrowingTrialGraphql(
  page: Page,
  {
    initialTrials = [],
    queryFailures = 0,
    saveFailures = 0,
  }: MockGraphqlOptions = {},
) {
  const trials = [...initialTrials];
  const createRequests: Record<string, string | number>[] = [];
  let remainingQueryFailures = queryFailures;
  let remainingSaveFailures = saveFailures;

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
      if (remainingQueryFailures > 0) {
        remainingQueryFailures -= 1;
        await route.fulfill({
          contentType: "application/json",
          json: { errors: [{ message: "Growing Trials unavailable" }] },
        });
        return;
      }

      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            growingTrials: {
              items: trials,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          },
        },
      });
      return;
    }

    if (operationName === "Plants") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            plants: {
              items: [plant],
              hasNextPage: false,
              hasPreviousPage: false,
            },
          },
        },
      });
      return;
    }

    if (operationName === "Containers") {
      await route.fulfill({
        contentType: "application/json",
        json: { data: { containers: [container] } },
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

      const trial = makeTrial(String(trials.length + 1));
      trials.push(trial);
      await route.fulfill({
        contentType: "application/json",
        json: { data: { createGrowingTrial: trial } },
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      json: {
        errors: [
          {
            message: `Unexpected GraphQL operation: ${operationName ?? "unknown"}`,
          },
        ],
      },
    });
  });

  return { createRequests };
}

async function chooseTrialRelationships(page: Page) {
  await page.getByRole("combobox", { name: "Plant" }).click();
  await page.getByRole("option", { name: plant.name }).click();
  await page.getByRole("combobox", { name: "Container" }).click();
  await page.getByRole("option", { name: container.name }).click();
}

test("navigates from home to Growing Trials", async ({ page }) => {
  await mockGrowingTrialGraphql(page);

  await page.goto("/");
  await page.getByRole("link", { name: "Manage Growing Trials" }).click();

  await expect(page).toHaveURL(/\/growing-trials$/);
  await expect(
    page.getByRole("heading", { name: "No Growing Trials yet" }),
  ).toBeVisible();
});

test("shows a planned Growing Trial", async ({ page }) => {
  await mockGrowingTrialGraphql(page, { initialTrials: [makeTrial()] });

  await page.goto("/growing-trials");

  await expect(
    page.getByRole("heading", { name: "Radish in Pot 1" }),
  ).toBeVisible();
  await expect(page.getByText("Planned")).toBeVisible();
});

test("creates a planned Growing Trial with required relationships", async ({
  page,
}) => {
  const { createRequests } = await mockGrowingTrialGraphql(page);

  await page.goto("/growing-trials");
  await page.getByRole("button", { name: "Add Growing Trial" }).click();
  await page.getByRole("button", { name: "Create Growing Trial" }).click();
  await expect(page.getByText("Select a Plant.")).toBeVisible();
  await expect(page.getByText("Select a Container.")).toBeVisible();

  await chooseTrialRelationships(page);
  await page.getByRole("button", { name: "Create Growing Trial" }).click();

  await expect(
    page.getByRole("heading", { name: "Radish in Pot 1" }),
  ).toBeVisible();
  expect(createRequests).toEqual([{ plantId: "1", containerId: "2" }]);
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
  await expect(page.getByRole("combobox", { name: "Container" })).toHaveValue(
    "Pot 1",
  );
  await page.getByRole("button", { name: "Create Growing Trial" }).click();

  await expect(
    page.getByRole("heading", { name: "Radish in Pot 1" }),
  ).toBeVisible();
  expect(createRequests).toHaveLength(2);
});

test("recovers from a failed Growing Trial load", async ({ page }) => {
  await mockGrowingTrialGraphql(page, {
    initialTrials: [makeTrial()],
    queryFailures: 1,
  });

  await page.goto("/growing-trials");
  await expect(
    page.getByText("Growing Trials could not be loaded."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();

  await expect(
    page.getByRole("heading", { name: "Radish in Pot 1" }),
  ).toBeVisible();
});
