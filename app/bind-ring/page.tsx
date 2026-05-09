import { BindRingClient } from "./bind-ring-client";

export const dynamic = "force-dynamic";

interface BindRingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BindRingPage({ searchParams }: BindRingPageProps) {
  const params = await searchParams;
  const uid =
    firstParam(params.uid) ||
    firstParam(params.nfc_uid) ||
    firstParam(params.ring_uid) ||
    "";

  return <BindRingClient initialUid={uid} />;
}
