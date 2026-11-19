import { redirect } from "next/navigation";
import type { GrowingTrialStatus } from "@/graphql/growingTrials";
import { GrowingTrialsWorkspace } from "./GrowingTrialsWorkspace";

export default async function GrowingTrialsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status } = await searchParams;
  if (
    status !== undefined &&
    (typeof status !== "string" ||
      !["active", "planned", "completed", "abandoned", "all"].includes(status))
  )
    redirect("/growing-trials");
  return (
    <GrowingTrialsWorkspace
      statusFilter={
        status && status !== "all"
          ? (status.toUpperCase() as GrowingTrialStatus)
          : null
      }
      variant="management"
    />
  );
}
