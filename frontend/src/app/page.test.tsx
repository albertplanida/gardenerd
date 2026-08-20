import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";

import Home from "./page";

jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string): never => {
    throw new Error(`redirect:${url}`);
  }),
}));
jest.mock("./growing-trials/GrowingTrialsWorkspace", () => ({
  GrowingTrialsWorkspace: ({
    statusFilter,
  }: {
    statusFilter: string | null;
  }) => <div data-testid="dashboard-status">{statusFilter ?? "ALL"}</div>,
}));

async function renderHome(status?: string | string[]) {
  const page = await Home({ searchParams: Promise.resolve({ status }) });
  render(<MantineProvider>{page}</MantineProvider>);
}

describe("Home", () => {
  beforeEach(() => jest.clearAllMocks());

  it("defaults to Active Growing Trials", async () => {
    await renderHome();

    expect(screen.getByTestId("dashboard-status")).toHaveTextContent("ACTIVE");
  });

  it.each([
    ["active", "ACTIVE"],
    ["planned", "PLANNED"],
    ["completed", "COMPLETED"],
    ["abandoned", "ABANDONED"],
    ["all", "ALL"],
  ])("maps the %s URL filter", async (status, expected) => {
    await renderHome(status);

    expect(screen.getByTestId("dashboard-status")).toHaveTextContent(expected);
  });

  it.each(["", "unknown", "ACTIVE"])(
    "redirects the invalid %s filter",
    async (status) => {
      await expect(
        Home({ searchParams: Promise.resolve({ status }) }),
      ).rejects.toThrow("redirect:/");
      expect(redirect).toHaveBeenCalledWith("/");
    },
  );

  it("redirects repeated status parameters", async () => {
    await expect(
      Home({
        searchParams: Promise.resolve({ status: ["active", "planned"] }),
      }),
    ).rejects.toThrow("redirect:/");
    expect(redirect).toHaveBeenCalledWith("/");
  });
});
