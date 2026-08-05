import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";

import Home from "./page";

describe("Home", () => {
  it("renders the application name", () => {
    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Gardenerd" }),
    ).toBeInTheDocument();
  });

  it("links to Container management", () => {
    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );

    expect(screen.getByRole("link", { name: /containers/i })).toHaveAttribute(
      "href",
      "/containers",
    );
  });
});
