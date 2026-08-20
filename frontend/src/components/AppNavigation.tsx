import { Anchor, Group } from "@mantine/core";

export function AppNavigation() {
  return (
    <Group component="nav" aria-label="Primary navigation">
      <Anchor href="/">Dashboard</Anchor>
      <Anchor href="/growing-trials">Growing Trials</Anchor>
    </Group>
  );
}
