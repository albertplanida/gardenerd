import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";

import { createGraphqlClient } from "@/graphql/client";

import ContainersPage from "./page";

jest.mock("@/graphql/client", () => ({
  createGraphqlClient: jest.fn(),
}));

const request = jest.fn();

function renderContainersPage() {
  return render(
    <MantineProvider>
      <ContainersPage />
    </MantineProvider>,
  );
}

describe("ContainersPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createGraphqlClient).mockReturnValue({ request } as never);
  });

  it("renders the Containers page heading and add action", () => {
    request.mockReturnValue(new Promise(() => undefined));

    renderContainersPage();

    expect(
      screen.getByRole("heading", { name: "Containers" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Container" }),
    ).toBeInTheDocument();
  });

  it("shows a loading state while Containers are requested", () => {
    request.mockReturnValue(new Promise(() => undefined));

    renderContainersPage();

    expect(screen.getByText("Loading Containers...")).toBeInTheDocument();
  });

  it("shows an empty state when there are no Containers", async () => {
    request.mockResolvedValue({ containers: [] });

    renderContainersPage();

    expect(
      await screen.findByText("No Containers yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Add your first pot or growing place to get started."),
    ).toBeInTheDocument();
  });

  it("renders existing Container names", async () => {
    request.mockResolvedValue({
      containers: [
        {
          id: "1",
          name: "Pot 1",
          createdAt: "2026-08-01T12:00:00Z",
          updatedAt: "2026-08-01T12:00:00Z",
        },
        {
          id: "2",
          name: "Pot 2",
          createdAt: "2026-08-01T12:00:00Z",
          updatedAt: "2026-08-01T12:00:00Z",
        },
      ],
    });

    renderContainersPage();

    expect(await screen.findByText("Pot 1")).toBeInTheDocument();
    expect(screen.getByText("Pot 2")).toBeInTheDocument();
  });

  it("shows an error state when Containers cannot be loaded", async () => {
    request.mockRejectedValue(new Error("Network error"));

    renderContainersPage();

    expect(
      await screen.findByText("Containers could not be loaded."),
    ).toBeInTheDocument();
  });
});
