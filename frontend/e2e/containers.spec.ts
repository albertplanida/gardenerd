import { expect, type Page, test } from "@playwright/test";

type MockContainer = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type GraphqlRequest = {
  operationName?: string;
  query?: string;
  variables?: Record<string, string>;
};

type MockGraphqlOptions = {
  initialContainers?: MockContainer[];
  queryFailures?: number;
  saveFailures?: number;
};

const graphqlRoute = /\/graphql\/?(\?.*)?$/;

function makeContainer(id: string, name: string): MockContainer {
  return {
    id,
    name,
    createdAt: "2026-08-01T12:00:00Z",
    updatedAt: "2026-08-01T12:00:00Z",
  };
}

function getOperationName(body: GraphqlRequest) {
  if (body.operationName) {
    return body.operationName;
  }

  return body.query?.match(/\b(?:query|mutation)\s+(\w+)/)?.[1] ?? null;
}

async function mockContainerGraphql(
  page: Page,
  {
    initialContainers = [],
    queryFailures = 0,
    saveFailures = 0,
  }: MockGraphqlOptions = {},
) {
  const containers = [...initialContainers];
  let remainingQueryFailures = queryFailures;
  let remainingSaveFailures = saveFailures;

  await page.route(graphqlRoute, async (route) => {
    const rawBody = route.request().postData() ?? "{}";
    let parsedBody: GraphqlRequest | string;

    try {
      parsedBody = JSON.parse(rawBody) as GraphqlRequest | string;
    } catch {
      parsedBody = rawBody;
    }

    const body =
      typeof parsedBody === "string" ? { query: parsedBody } : parsedBody;
    const variables = body.variables ?? {};
    const operationName = getOperationName(body);

    if (operationName === "CreateContainer") {
      if (remainingSaveFailures > 0) {
        remainingSaveFailures -= 1;

        await route.fulfill({
          contentType: "application/json",
          json: { errors: [{ message: "Container could not be saved" }] },
        });
        return;
      }

      const container = makeContainer(
        String(containers.length + 1),
        variables.name ?? "",
      );
      containers.push(container);

      await route.fulfill({
        contentType: "application/json",
        json: { data: { createContainer: container } },
      });
      return;
    }

    if (operationName === "EditContainer") {
      if (remainingSaveFailures > 0) {
        remainingSaveFailures -= 1;

        await route.fulfill({
          contentType: "application/json",
          json: { errors: [{ message: "Container could not be saved" }] },
        });
        return;
      }

      const id = variables.id ?? "";
      const name = variables.name ?? "";
      const index = containers.findIndex((container) => container.id === id);

      if (index === -1) {
        await route.fulfill({
          contentType: "application/json",
          json: { errors: [{ message: "Container not found" }] },
        });
        return;
      }

      containers[index] = {
        ...containers[index],
        name,
        updatedAt: "2026-08-02T12:00:00Z",
      };

      await route.fulfill({
        contentType: "application/json",
        json: { data: { editContainer: containers[index] } },
      });
      return;
    }

    if (operationName === "Containers") {
      if (remainingQueryFailures > 0) {
        remainingQueryFailures -= 1;

        await route.fulfill({
          contentType: "application/json",
          json: { errors: [{ message: "Containers unavailable" }] },
        });
        return;
      }

      await route.fulfill({
        contentType: "application/json",
        json: { data: { containers } },
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
}

async function createContainer(page: Page, name: string) {
  await page.getByRole("button", { name: "Add Container" }).click();
  await page.getByLabel("Container name").fill(name);
  await page.getByRole("button", { name: "Create Container" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test("navigates from home to Containers", async ({ page }) => {
  await mockContainerGraphql(page);

  await page.goto("/");
  await page.getByRole("link", { name: /containers/i }).click();

  await expect(page).toHaveURL(/\/containers$/);
  await expect(page.getByRole("heading", { name: "Containers" })).toBeVisible();
});

test("creates the initial four pots", async ({ page }) => {
  await mockContainerGraphql(page);

  await page.goto("/containers");

  await page.getByRole("button", { name: "Add Container" }).click();
  await page.getByRole("button", { name: "Create Container" }).click();
  await expect(page.getByText("Container name is required.")).toBeVisible();
  await page.getByLabel("Container name").fill("Pot 1");
  await page.getByRole("button", { name: "Create Container" }).click();

  await expect(page.getByRole("heading", { name: "Pot 1" })).toBeVisible();

  await createContainer(page, "Pot 2");
  await createContainer(page, "Pot 3");
  await createContainer(page, "Pot 4");

  await expect(page.getByRole("heading", { name: "Pot 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pot 2" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pot 3" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pot 4" })).toBeVisible();
});

test("edits a Container name", async ({ page }) => {
  await mockContainerGraphql(page, {
    initialContainers: [makeContainer("1", "Pot 1")],
  });

  await page.goto("/containers");
  await page.getByRole("button", { name: "Edit Pot 1" }).click();

  await expect(page.getByLabel("Container name")).toHaveValue("Pot 1");
  await page.getByLabel("Container name").fill("Front Porch Pot");
  await page.getByRole("button", { name: "Save Container" }).click();

  await expect(
    page.getByRole("heading", { name: "Front Porch Pot" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pot 1" })).toHaveCount(0);
});

test("cancels editing without saving", async ({ page }) => {
  await mockContainerGraphql(page, {
    initialContainers: [makeContainer("2", "Pot 2")],
  });

  await page.goto("/containers");
  await page.getByRole("button", { name: "Edit Pot 2" }).click();
  await page.getByLabel("Container name").fill("Unsaved name");
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByRole("heading", { name: "Pot 2" })).toBeVisible();
  await expect(page.getByText("Unsaved name")).toHaveCount(0);
});

test("prevents blank Container names", async ({ page }) => {
  await mockContainerGraphql(page, {
    initialContainers: [makeContainer("1", "Pot 1")],
  });

  await page.goto("/containers");

  await page.getByRole("button", { name: "Add Container" }).click();
  await page.getByRole("button", { name: "Create Container" }).click();
  await expect(page.getByText("Container name is required.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Edit Pot 1" }).click();
  await page.getByLabel("Container name").fill("");
  await page.getByRole("button", { name: "Save Container" }).click();

  await expect(page.getByText("Container name is required.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Pot 1" })).toBeVisible();
});

test("recovers from a failed Container save", async ({ page }) => {
  await mockContainerGraphql(page, { saveFailures: 1 });

  await page.goto("/containers");
  await page.getByRole("button", { name: "Add Container" }).click();
  await page.getByLabel("Container name").fill("Pot 1");
  await page.getByRole("button", { name: "Create Container" }).click();

  await expect(page.getByText("Container could not be saved.")).toBeVisible();

  await page.getByRole("button", { name: "Create Container" }).click();

  await expect(page.getByRole("heading", { name: "Pot 1" })).toBeVisible();
  await expect(page.getByText("Container could not be saved.")).toHaveCount(0);
});

test("recovers from a failed Container load", async ({ page }) => {
  await mockContainerGraphql(page, {
    initialContainers: [makeContainer("1", "Pot 1")],
    queryFailures: 1,
  });

  await page.goto("/containers");

  await expect(page.getByText("Containers could not be loaded.")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();

  await expect(page.getByRole("heading", { name: "Pot 1" })).toBeVisible();
});
