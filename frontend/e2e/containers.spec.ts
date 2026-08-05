import { expect, type Page, test } from "@playwright/test";

type MockContainer = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type GraphqlRequest = {
  query?: string;
  variables?: Record<string, string>;
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

async function mockContainerGraphql(
  page: Page,
  initialContainers: MockContainer[] = [],
) {
  const containers = [...initialContainers];

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
    const query = body.query ?? "";
    const variables = body.variables ?? {};

    if (
      query.includes("createContainer") ||
      (variables.name && !variables.id)
    ) {
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

    if (query.includes("editContainer") || variables.id) {
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

    await route.fulfill({
      contentType: "application/json",
      json: { data: { containers } },
    });
  });
}

async function mockContainerQueryFailure(page: Page) {
  await page.route(graphqlRoute, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { errors: [{ message: "Containers unavailable" }] },
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

test("shows an empty Containers state", async ({ page }) => {
  await mockContainerGraphql(page);

  await page.goto("/containers");

  await expect(page.getByText("No Containers yet")).toBeVisible();
  await expect(
    page.getByText("Add your first pot or growing place to get started."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Container" }),
  ).toBeVisible();
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
  await mockContainerGraphql(page, [makeContainer("1", "Pot 1")]);

  await page.goto("/containers");
  await page.getByRole("button", { name: "Edit Pot 1" }).click();

  await expect(page.getByLabel("Container name")).toHaveValue("Pot 1");
  await page.getByLabel("Container name").fill("");
  await page.getByRole("button", { name: "Save Container" }).click();
  await expect(page.getByText("Container name is required.")).toBeVisible();

  await page.getByLabel("Container name").fill("Front Porch Pot");
  await page.getByRole("button", { name: "Save Container" }).click();

  await expect(
    page.getByRole("heading", { name: "Front Porch Pot" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pot 1" })).toHaveCount(0);
});

test("cancels editing without saving", async ({ page }) => {
  await mockContainerGraphql(page, [makeContainer("2", "Pot 2")]);

  await page.goto("/containers");
  await page.getByRole("button", { name: "Edit Pot 2" }).click();
  await page.getByLabel("Container name").fill("Unsaved name");
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByRole("heading", { name: "Pot 2" })).toBeVisible();
  await expect(page.getByText("Unsaved name")).toHaveCount(0);
});

test("shows a useful error when Containers cannot load", async ({ page }) => {
  await mockContainerQueryFailure(page);

  await page.goto("/containers");

  await expect(page.getByText("Containers could not be loaded.")).toBeVisible();
});
