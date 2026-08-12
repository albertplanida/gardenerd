import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { createPlant, editPlant, listPlants } from "@/graphql/plants";

import PlantsPage from "./page";

jest.mock("@/graphql/plants", () => ({
  createPlant: jest.fn(),
  editPlant: jest.fn(),
  listPlants: jest.fn(),
}));

function renderPlantsPage() {
  return render(
    <MantineProvider>
      <PlantsPage />
    </MantineProvider>,
  );
}

describe("PlantsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the Plants page heading and add action", () => {
    jest.mocked(listPlants).mockReturnValue(new Promise(() => undefined));

    renderPlantsPage();

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("heading", { name: "Plants" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Plant" }),
    ).toBeInTheDocument();
  });

  it("shows a loading state while Plants are requested", () => {
    jest.mocked(listPlants).mockReturnValue(new Promise(() => undefined));

    renderPlantsPage();

    expect(screen.getByText("Loading Plants...")).toBeInTheDocument();
  });

  it("shows an empty state when there are no Plants", async () => {
    jest.mocked(listPlants).mockResolvedValue([]);

    renderPlantsPage();

    expect(await screen.findByText("No Plants yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add your first plant and capture plain text care notes.",
      ),
    ).toBeInTheDocument();
  });

  it("renders existing Plant names and care notes", async () => {
    jest.mocked(listPlants).mockResolvedValue([
      {
        id: "1",
        name: "Tomato",
        careNotes: "Full sun and steady water.",
        createdAt: "2026-08-01T12:00:00Z",
        updatedAt: "2026-08-01T12:00:00Z",
      },
      {
        id: "2",
        name: "Basil",
        careNotes: "",
        createdAt: "2026-08-01T12:00:00Z",
        updatedAt: "2026-08-01T12:00:00Z",
      },
    ]);

    renderPlantsPage();

    expect(await screen.findByText("Tomato")).toBeInTheDocument();
    expect(screen.getByText("Basil")).toBeInTheDocument();
    expect(screen.getByText("Full sun and steady water.")).toBeInTheDocument();
  });

  it("shows an error state when Plants cannot be loaded", async () => {
    jest.mocked(listPlants).mockRejectedValue(new Error("Network error"));

    renderPlantsPage();

    expect(
      await screen.findByText("Plants could not be loaded."),
    ).toBeInTheDocument();
  });

  it("opens the create modal from the Add Plant action", async () => {
    jest.mocked(listPlants).mockResolvedValue([]);

    renderPlantsPage();
    await screen.findByText("No Plants yet");

    fireEvent.click(screen.getByRole("button", { name: "Add Plant" }));

    expect(
      screen.getByRole("heading", { name: "Add Plant" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Plant name")).toBeInTheDocument();
    expect(screen.getByLabelText("Care notes")).toBeInTheDocument();
  });

  it("validates blank Plant names while allowing blank care notes", async () => {
    jest.mocked(listPlants).mockResolvedValue([]);

    renderPlantsPage();
    await screen.findByText("No Plants yet");

    fireEvent.click(screen.getByRole("button", { name: "Add Plant" }));
    fireEvent.change(screen.getByLabelText("Care notes"), {
      target: { value: "Water often" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Plant" }));

    expect(screen.getByText("Plant name is required.")).toBeInTheDocument();
    expect(createPlant).not.toHaveBeenCalled();
  });

  it("creates a Plant with blank care notes and shows it in the list", async () => {
    jest.mocked(listPlants).mockResolvedValue([]);
    jest.mocked(createPlant).mockResolvedValue({
      id: "1",
      name: "Tomato",
      careNotes: "",
      createdAt: "2026-08-01T12:00:00Z",
      updatedAt: "2026-08-01T12:00:00Z",
    });

    renderPlantsPage();
    await screen.findByText("No Plants yet");

    fireEvent.click(screen.getByRole("button", { name: "Add Plant" }));
    fireEvent.change(screen.getByLabelText("Plant name"), {
      target: { value: "Tomato" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Plant" }));

    await waitFor(() => {
      expect(createPlant).toHaveBeenLastCalledWith("Tomato", "");
    });
    expect(await screen.findByText("Tomato")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Add Plant" }),
    ).not.toBeInTheDocument();
  });

  it("creates a Plant with care notes", async () => {
    jest.mocked(listPlants).mockResolvedValue([]);
    jest.mocked(createPlant).mockResolvedValue({
      id: "1",
      name: "Tomato",
      careNotes: "Full sun",
      createdAt: "2026-08-01T12:00:00Z",
      updatedAt: "2026-08-01T12:00:00Z",
    });

    renderPlantsPage();
    await screen.findByText("No Plants yet");

    fireEvent.click(screen.getByRole("button", { name: "Add Plant" }));
    fireEvent.change(screen.getByLabelText("Plant name"), {
      target: { value: "Tomato" },
    });
    fireEvent.change(screen.getByLabelText("Care notes"), {
      target: { value: "Full sun" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Plant" }));

    await waitFor(() => {
      expect(createPlant).toHaveBeenLastCalledWith("Tomato", "Full sun");
    });
    expect(await screen.findByText("Full sun")).toBeInTheDocument();
  });

  it("opens the edit modal with the selected Plant values", async () => {
    jest.mocked(listPlants).mockResolvedValue([
      {
        id: "1",
        name: "Tomato",
        careNotes: "Full sun",
        createdAt: "2026-08-01T12:00:00Z",
        updatedAt: "2026-08-01T12:00:00Z",
      },
    ]);

    renderPlantsPage();
    await screen.findByText("Tomato");

    fireEvent.click(screen.getByRole("button", { name: "Edit Tomato" }));

    expect(
      screen.getByRole("heading", { name: "Edit Plant" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Tomato")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Full sun")).toBeInTheDocument();
  });

  it("edits a Plant and shows the updated values in the list", async () => {
    jest.mocked(listPlants).mockResolvedValue([
      {
        id: "1",
        name: "Tomato",
        careNotes: "Full sun",
        createdAt: "2026-08-01T12:00:00Z",
        updatedAt: "2026-08-01T12:00:00Z",
      },
    ]);
    jest.mocked(editPlant).mockResolvedValue({
      id: "1",
      name: "Cherry Tomato",
      careNotes: "Water deeply",
      createdAt: "2026-08-01T12:00:00Z",
      updatedAt: "2026-08-02T12:00:00Z",
    });

    renderPlantsPage();
    await screen.findByText("Tomato");

    fireEvent.click(screen.getByRole("button", { name: "Edit Tomato" }));
    fireEvent.change(screen.getByLabelText("Plant name"), {
      target: { value: "Cherry Tomato" },
    });
    fireEvent.change(screen.getByLabelText("Care notes"), {
      target: { value: "Water deeply" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Plant" }));

    await waitFor(() => {
      expect(editPlant).toHaveBeenLastCalledWith(
        "1",
        "Cherry Tomato",
        "Water deeply",
      );
    });
    expect(await screen.findByText("Cherry Tomato")).toBeInTheDocument();
    expect(screen.getByText("Water deeply")).toBeInTheDocument();
    expect(screen.queryByText("Tomato")).not.toBeInTheDocument();
  });

  it("shows an error when saving fails", async () => {
    jest.mocked(listPlants).mockResolvedValue([]);
    jest.mocked(createPlant).mockRejectedValue(new Error("Create failed"));

    renderPlantsPage();
    await screen.findByText("No Plants yet");

    fireEvent.click(screen.getByRole("button", { name: "Add Plant" }));
    fireEvent.change(screen.getByLabelText("Plant name"), {
      target: { value: "Tomato" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Plant" }));

    expect(
      await screen.findByText("Plant could not be saved."),
    ).toBeInTheDocument();
  });
});
