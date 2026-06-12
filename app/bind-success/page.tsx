import { BindSuccessClient } from "./bind-success-client";

type PageProps = {
  searchParams: Promise<{ trial?: string; pair?: string }>;
};

export default async function BindSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const plusTrialActivated = params.trial === "1";
  const showPairPrompt = params.pair === "1";

  return (
    <BindSuccessClient
      plusTrialActivated={plusTrialActivated}
      showPairPrompt={showPairPrompt}
    />
  );
}
