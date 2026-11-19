"use client";

import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";

const theme = createTheme({
  primaryColor: "forest",
  primaryShade: 7,
  colors: {
    forest: [
      "#f2f5e9",
      "#e5ebd7",
      "#dce8bd",
      "#b9cca8",
      "#95b183",
      "#6d8e60",
      "#355e3e",
      "#244d37",
      "#183d2b",
      "#122f21",
    ],
  },
  fontFamily: 'Lato, "Trebuchet MS", sans-serif',
  headings: {
    fontFamily: '"Playfair Display", Georgia, serif',
    fontWeight: "400",
  },
  defaultRadius: "md",
  components: {
    Button: { defaultProps: { mih: 44 } },
    Modal: {
      defaultProps: {
        centered: true,
        radius: "lg",
        padding: "xl",
        overlayProps: { backgroundOpacity: 0.4, blur: 3 },
      },
    },
    TextInput: { defaultProps: { size: "md" } },
    Textarea: { defaultProps: { size: "md" } },
    Select: { defaultProps: { size: "md" } },
  },
});

export function GardenProvider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} forceColorScheme="light">
      <Notifications position="top-right" />
      {children}
    </MantineProvider>
  );
}
