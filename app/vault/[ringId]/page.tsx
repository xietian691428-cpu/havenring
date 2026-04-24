import { VaultTimeline } from "./vault-timeline";

interface VaultPageProps {
  params: Promise<{ ringId: string }>;
}

export const dynamic = "force-dynamic";

export default async function VaultPage({ params }: VaultPageProps) {
  const { ringId } = await params;
  return <VaultTimeline ringId={ringId} />;
}
