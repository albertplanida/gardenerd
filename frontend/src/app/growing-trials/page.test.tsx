import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { listContainers } from "@/graphql/containers";
import { createGrowingTrial, listGrowingTrials } from "@/graphql/growingTrials";
import { listPlants } from "@/graphql/plants";

import GrowingTrialsPage from "./page";

jest.mock("@/graphql/growingTrials", () => ({
  createGrowingTrial: jest.fn(),
  listGrowingTrials: jest.fn(),
}));
jest.mock("@/graphql/plants", () => ({ listPlants: jest.fn() }));
jest.mock("@/graphql/containers", () => ({ listContainers: jest.fn() }));

const emptyPage = {
  items: [],
  hasNextPage: false,
  hasPreviousPage: false,
};

const radish = {
  id: "2",
  name: "Radish",
  careNotes: "Keep moist",
  createdAt: "2026-08-14T12:00:00Z",
  updatedAt: "2026-08-14T12:00:00Z",
};

const pot = {
  id: "3",
  name: "Pot 1",
  createdAt: "2026-08-14T12:00:00Z",
  updatedAt: "2026-08-14T12:00:00Z",
};

const plannedTrial = {
  id: "1",
  plant: { id: radish.id, name: radish.name },
  container: { id: pot.id, name: pot.name },
  status: "PLANNED" as const,
  createdAt: "2026-08-14T12:00:00Z",
  updatedAt: "2026-08-14T12:00:00Z",
};

function renderGrowingTrialsPage() {
  return render(
    <MantineProvider>
      <GrowingTrialsPage />
    </MantineProvider>,
  );
}

function selectOption(label: string, option: string) {
  const input = screen.getByRole("combobox", { name: label });
  fireEvent.click(input);
  fireEvent.click(screen.getByRole("option", { name: option, hidden: true }));
}

describe("GrowingTrialsPage", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(listPlants).mockResolvedValue({
      items: [radish],
      hasNextPage: false,
      hasPreviousPage: false,
    });
    jest.mocked(listContainers).mockResolvedValue([pot]);
  });

  it("renders navigation, heading, and loading state", () => {
    jest
      .mocked(listGrowingTrials)
      .mockReturnValue(new Promise(() => undefined));

    renderGrowingTrialsPage();

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByRole("link", { name: "Growing Trials" }),
    ).toHaveAttribute("href", "/growing-trials");
    expect(
      screen.getByRole("heading", { name: "Growing Trials" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Loading Growing Trials...")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    jest.mocked(listGrowingTrials).mockResolvedValue(emptyPage);

    renderGrowingTrialsPage();

    expect(
      await screen.findByRole("heading", { name: "No Growing Trials yet" }),
    ).toBeInTheDocument();
  });

  it("renders planned Growing Trial cards", async () => {
    jest.mocked(listGrowingTrials).mockResolvedValue({
      items: [
        {
          id: "1",
          plant: { id: "2", name: "Radish" },
          container: { id: "3", name: "Pot 1" },
          status: "PLANNED",
          createdAt: "2026-08-14T12:00:00Z",
          updatedAt: "2026-08-14T12:00:00Z",
        },
      ],
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderGrowingTrialsPage();

    expect(
      await screen.findByRole("heading", { name: "Radish in Pot 1" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
  });

  it("shows an error and retries the current page", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(emptyPage);

    renderGrowingTrialsPage();

    expect(
      await screen.findByText("Growing Trials could not be loaded."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "No Growing Trials yet" }),
    ).toBeInTheDocument();
    expect(listGrowingTrials).toHaveBeenLastCalledWith(20, 0);
  });

  it("requests the next bounded page", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce({
        items: [
          {
            id: "1",
            plant: { id: "2", name: "Radish" },
            container: { id: "3", name: "Pot 1" },
            status: "PLANNED",
            createdAt: "2026-08-14T12:00:00Z",
            updatedAt: "2026-08-14T12:00:00Z",
          },
        ],
        hasNextPage: true,
        hasPreviousPage: false,
      })
      .mockResolvedValueOnce(emptyPage);

    renderGrowingTrialsPage();
    await screen.findByRole("heading", { name: "Radish in Pot 1" });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(listGrowingTrials).toHaveBeenLastCalledWith(20, 20);
    });
  });

  it("opens the creation modal and requires both selections", async () => {
    jest.mocked(listGrowingTrials).mockResolvedValue(emptyPage);

    renderGrowingTrialsPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    fireEvent.click(screen.getByRole("button", { name: "Add Growing Trial" }));

    expect(
      await screen.findByRole("heading", { name: "Add Growing Trial" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("combobox", { name: "Plant" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Container" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Create Growing Trial" }),
    );

    expect(screen.getByText("Select a Plant.")).toBeInTheDocument();
    expect(screen.getByText("Select a Container.")).toBeInTheDocument();
    expect(createGrowingTrial).not.toHaveBeenCalled();
  });

  it("loads every Plant page for the selector", async () => {
    jest.mocked(listGrowingTrials).mockResolvedValue(emptyPage);
    jest
      .mocked(listPlants)
      .mockResolvedValueOnce({
        items: [radish],
        hasNextPage: true,
        hasPreviousPage: false,
      })
      .mockResolvedValueOnce({
        items: [{ ...radish, id: "4", name: "Basil" }],
        hasNextPage: false,
        hasPreviousPage: true,
      });

    renderGrowingTrialsPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    fireEvent.click(screen.getByRole("button", { name: "Add Growing Trial" }));
    await screen.findByRole("combobox", { name: "Plant" });

    expect(listPlants).toHaveBeenNthCalledWith(1, 50, 0);
    expect(listPlants).toHaveBeenNthCalledWith(2, 50, 50);
  });

  it("creates a trial and refreshes the bounded list", async () => {
    jest
      .mocked(listGrowingTrials)
      .mockResolvedValueOnce(emptyPage)
      .mockResolvedValueOnce({
        items: [plannedTrial],
        hasNextPage: false,
        hasPreviousPage: false,
      });
    jest.mocked(createGrowingTrial).mockResolvedValue(plannedTrial);

    renderGrowingTrialsPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    fireEvent.click(screen.getByRole("button", { name: "Add Growing Trial" }));

    await screen.findByRole("combobox", { name: "Plant" });
    selectOption("Plant", "Radish");
    selectOption("Container", "Pot 1");
    fireEvent.click(
      screen.getByRole("button", { name: "Create Growing Trial" }),
    );

    await waitFor(() => {
      expect(createGrowingTrial).toHaveBeenCalledWith("2", "3");
    });
    expect(
      await screen.findByRole("heading", { name: "Radish in Pot 1" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Add Growing Trial" }),
    ).not.toBeInTheDocument();
  });

  it("preserves selections and permits retry after a save failure", async () => {
    jest.mocked(listGrowingTrials).mockResolvedValue(emptyPage);
    jest
      .mocked(createGrowingTrial)
      .mockRejectedValueOnce(new Error("Save failed"))
      .mockResolvedValueOnce(plannedTrial);

    renderGrowingTrialsPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    fireEvent.click(screen.getByRole("button", { name: "Add Growing Trial" }));
    await screen.findByRole("combobox", { name: "Plant" });
    selectOption("Plant", "Radish");
    selectOption("Container", "Pot 1");
    fireEvent.click(
      screen.getByRole("button", { name: "Create Growing Trial" }),
    );

    expect(
      await screen.findByText("Growing Trial could not be saved."),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Plant" })).toHaveValue(
      "Radish",
    );
    expect(screen.getByRole("combobox", { name: "Container" })).toHaveValue(
      "Pot 1",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Create Growing Trial" }),
    );
    await waitFor(() => expect(createGrowingTrial).toHaveBeenCalledTimes(2));
  });

  it("prevents cancellation and duplicate submission while saving", async () => {
    let resolveCreate: (trial: typeof plannedTrial) => void = () => undefined;
    const pendingCreate = new Promise<typeof plannedTrial>((resolve) => {
      resolveCreate = resolve;
    });
    jest.mocked(listGrowingTrials).mockResolvedValue(emptyPage);
    jest.mocked(createGrowingTrial).mockReturnValue(pendingCreate);

    renderGrowingTrialsPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    fireEvent.click(screen.getByRole("button", { name: "Add Growing Trial" }));
    await screen.findByRole("combobox", { name: "Plant" });
    selectOption("Plant", "Radish");
    selectOption("Container", "Pot 1");
    fireEvent.click(
      screen.getByRole("button", { name: "Create Growing Trial" }),
    );

    await waitFor(() => expect(createGrowingTrial).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Create Growing Trial" }),
    ).toBeDisabled();

    resolveCreate(plannedTrial);
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Add Growing Trial" }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows an actionable state when selector options cannot be loaded", async () => {
    jest.mocked(listGrowingTrials).mockResolvedValue(emptyPage);
    jest.mocked(listPlants).mockRejectedValue(new Error("Network error"));

    renderGrowingTrialsPage();
    await screen.findByRole("heading", { name: "No Growing Trials yet" });
    fireEvent.click(screen.getByRole("button", { name: "Add Growing Trial" }));

    expect(
      await screen.findByText("Plants and Containers could not be loaded."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Growing Trial" }),
    ).toBeDisabled();
  });
});
