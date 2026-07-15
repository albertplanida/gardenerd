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
});
