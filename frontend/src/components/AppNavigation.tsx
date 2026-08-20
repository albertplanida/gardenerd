import { Anchor, Group } from "@mantine/core";

export function AppNavigation() {
  const links = [
    ["Dashboard", "/"],
    ["Growing Trials", "/growing-trials"],
    ["Plants", "/plants"],
    ["Containers", "/containers"],
  ];

  return (
    <Group component="nav" aria-label="Primary navigation" wrap="wrap">
      {links.map(([label, href]) => (
        <Anchor
          href={href}
          key={href}
          style={{
            alignItems: "center",
            display: "inline-flex",
            minHeight: 44,
          }}
        >
          {label}
        </Anchor>
      ))}
    </Group>
  );
}
