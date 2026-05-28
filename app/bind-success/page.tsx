import { BindSuccessClient } from "./bind-success-client";

type PageProps = {
  searchParams: Promise<{ trial?: string }>;
};

export default async function BindSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const plusTrialActivated = params.trial === "1";

  return <BindSuccessClient plusTrialActivated={plusTrialActivated} />;
}
