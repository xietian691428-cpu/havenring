import { redirect } from "next/navigation";

// Legacy NFC URL shape — kept only to avoid 404s on rings programmed with the
// old `/seal/[ringId]?token=…` path. The one canonical entry point is
// `/hub?token=…`, which decides between sealing and reading.
interface LegacySealPageProps {
  params: Promise<{ ringId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

export default async function LegacySealPage({
  searchParams,
}: LegacySealPageProps) {
  const sp = await searchParams;
  const raw = sp.token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
  redirect(`/hub${suffix}`);
}
