import { redirect } from "next/navigation";

import type { GrowingTrialStatus } from "@/graphql/growingTrials";

import { GrowingTrialsWorkspace } from "./growing-trials/GrowingTrialsWorkspace";

const dashboardStatuses: Record<string, GrowingTrialStatus | null> = {
  active: "ACTIVE",
  planned: "PLANNED",
  completed: "COMPLETED",
  abandoned: "ABANDONED",
  all: null,
};

type HomeProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const status = (await searchParams).status;

  if (
    Array.isArray(status) ||
    (status !== undefined && !(status in dashboardStatuses))
  ) {
    redirect("/");
  }

  return (
    <GrowingTrialsWorkspace
      statusFilter={status === undefined ? "ACTIVE" : dashboardStatuses[status]}
      variant="dashboard"
    />
  );
}
