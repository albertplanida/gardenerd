import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  createContainer,
  editContainer,
  listContainers,
} from "@/graphql/containers";

import ContainersPage from "./page";

jest.mock("@/graphql/containers", () => ({
  createContainer: jest.fn(),
  editContainer: jest.fn(),
  listContainers: jest.fn(),
}));

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
  });

  it("renders the Containers page heading and add action", () => {
    jest.mocked(listContainers).mockReturnValue(new Promise(() => undefined));

    renderContainersPage();

    expect(
      screen.getByRole("heading", { name: "Containers" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Container" }),
    ).toBeInTheDocument();
  });

  it("shows a loading state while Containers are requested", () => {
    jest.mocked(listContainers).mockReturnValue(new Promise(() => undefined));

    renderContainersPage();

    expect(screen.getByText("Loading Containers...")).toBeInTheDocument();
  });

  it("shows an empty state when there are no Containers", async () => {
    jest.mocked(listContainers).mockResolvedValue([]);

    renderContainersPage();

    expect(await screen.findByText("No Containers yet")).toBeInTheDocument();
    expect(
      screen.getByText("Add your first pot or growing place to get started."),
    ).toBeInTheDocument();
  });

  it("renders existing Container names", async () => {
    jest.mocked(listContainers).mockResolvedValue([
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
    ]);

    renderContainersPage();

    expect(await screen.findByText("Pot 1")).toBeInTheDocument();
    expect(screen.getByText("Pot 2")).toBeInTheDocument();
  });

  it("shows an error state when Containers cannot be loaded", async () => {
    jest.mocked(listContainers).mockRejectedValue(new Error("Network error"));

    renderContainersPage();

    expect(
      await screen.findByText("Containers could not be loaded."),
    ).toBeInTheDocument();
  });

  it("opens the create modal from the Add Container action", async () => {
    jest.mocked(listContainers).mockResolvedValue([]);

    renderContainersPage();
    await screen.findByText("No Containers yet");

    fireEvent.click(screen.getByRole("button", { name: "Add Container" }));

    expect(
      screen.getByRole("heading", { name: "Add Container" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Container name")).toBeInTheDocument();
  });

  it("validates blank Container names when creating", async () => {
    jest.mocked(listContainers).mockResolvedValue([]);

    renderContainersPage();
    await screen.findByText("No Containers yet");

    fireEvent.click(screen.getByRole("button", { name: "Add Container" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Container" }));

    expect(screen.getByText("Container name is required.")).toBeInTheDocument();
  });

  it("creates a Container and shows it in the list", async () => {
    jest.mocked(listContainers).mockResolvedValue([]);
    jest.mocked(createContainer).mockResolvedValue({
      id: "1",
      name: "Pot 1",
      createdAt: "2026-08-01T12:00:00Z",
      updatedAt: "2026-08-01T12:00:00Z",
    });

    renderContainersPage();
    await screen.findByText("No Containers yet");

    fireEvent.click(screen.getByRole("button", { name: "Add Container" }));
    fireEvent.change(screen.getByLabelText("Container name"), {
      target: { value: "Pot 1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Container" }));

    await waitFor(() => {
      expect(createContainer).toHaveBeenLastCalledWith("Pot 1");
    });
    expect(await screen.findByText("Pot 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Add Container" }),
    ).not.toBeInTheDocument();
  });

  it("opens the edit modal with the selected Container name", async () => {
    jest.mocked(listContainers).mockResolvedValue([
      {
        id: "1",
        name: "Pot 1",
        createdAt: "2026-08-01T12:00:00Z",
        updatedAt: "2026-08-01T12:00:00Z",
      },
    ]);

    renderContainersPage();
    await screen.findByText("Pot 1");

    fireEvent.click(screen.getByRole("button", { name: "Edit Pot 1" }));

    expect(
      screen.getByRole("heading", { name: "Edit Container" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Pot 1")).toBeInTheDocument();
  });

  it("cancels editing without changing the visible Container name", async () => {
    jest.mocked(listContainers).mockResolvedValue([
      {
        id: "2",
        name: "Pot 2",
        createdAt: "2026-08-01T12:00:00Z",
        updatedAt: "2026-08-01T12:00:00Z",
      },
    ]);

    renderContainersPage();
    await screen.findByText("Pot 2");

    fireEvent.click(screen.getByRole("button", { name: "Edit Pot 2" }));
    fireEvent.change(screen.getByLabelText("Container name"), {
      target: { value: "Unsaved name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Pot 2")).toBeInTheDocument();
    expect(screen.queryByText("Unsaved name")).not.toBeInTheDocument();
  });

  it("validates blank Container names when editing", async () => {
    jest.mocked(listContainers).mockResolvedValue([
      {
        id: "1",
        name: "Pot 1",
        createdAt: "2026-08-01T12:00:00Z",
        updatedAt: "2026-08-01T12:00:00Z",
      },
    ]);

    renderContainersPage();
    await screen.findByText("Pot 1");

    fireEvent.click(screen.getByRole("button", { name: "Edit Pot 1" }));
    fireEvent.change(screen.getByLabelText("Container name"), {
      target: { value: " " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Container" }));

    expect(screen.getByText("Container name is required.")).toBeInTheDocument();
  });

  it("edits a Container and shows the updated name in the list", async () => {
    jest.mocked(listContainers).mockResolvedValue([
      {
        id: "1",
        name: "Pot 1",
        createdAt: "2026-08-01T12:00:00Z",
        updatedAt: "2026-08-01T12:00:00Z",
      },
    ]);
    jest.mocked(editContainer).mockResolvedValue({
      id: "1",
      name: "Front Porch Pot",
      createdAt: "2026-08-01T12:00:00Z",
      updatedAt: "2026-08-02T12:00:00Z",
    });

    renderContainersPage();
    await screen.findByText("Pot 1");

    fireEvent.click(screen.getByRole("button", { name: "Edit Pot 1" }));
    fireEvent.change(screen.getByLabelText("Container name"), {
      target: { value: "Front Porch Pot" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Container" }));

    await waitFor(() => {
      expect(editContainer).toHaveBeenLastCalledWith("1", "Front Porch Pot");
    });
    expect(await screen.findByText("Front Porch Pot")).toBeInTheDocument();
    expect(screen.queryByText("Pot 1")).not.toBeInTheDocument();
  });

  it("shows an error when editing fails", async () => {
    jest.mocked(listContainers).mockResolvedValue([
      {
        id: "1",
        name: "Pot 1",
        createdAt: "2026-08-01T12:00:00Z",
        updatedAt: "2026-08-01T12:00:00Z",
      },
    ]);
    jest.mocked(editContainer).mockRejectedValue(new Error("Edit failed"));

    renderContainersPage();
    await screen.findByText("Pot 1");

    fireEvent.click(screen.getByRole("button", { name: "Edit Pot 1" }));
    fireEvent.change(screen.getByLabelText("Container name"), {
      target: { value: "Front Porch Pot" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Container" }));

    expect(
      await screen.findByText("Container could not be saved."),
    ).toBeInTheDocument();
  });
});
