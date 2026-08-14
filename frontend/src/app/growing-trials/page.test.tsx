import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { listGrowingTrials } from "@/graphql/growingTrials";

import GrowingTrialsPage from "./page";

jest.mock("@/graphql/growingTrials", () => ({
  listGrowingTrials: jest.fn(),
}));

const emptyPage = {
  items: [],
  hasNextPage: false,
  hasPreviousPage: false,
};

function renderGrowingTrialsPage() {
  return render(
    <MantineProvider>
      <GrowingTrialsPage />
    </MantineProvider>,
  );
}

describe("GrowingTrialsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
