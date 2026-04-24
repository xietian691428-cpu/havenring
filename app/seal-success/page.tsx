import Link from "next/link";
import { SealCeremony } from "./seal-ceremony";

export const dynamic = "force-dynamic";

export default function SealSuccessPage() {
  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white">
      <SealCeremony />
      <noscript>
        <Link href="/" className="text-white/60 underline">
          Return
        </Link>
      </noscript>
    </main>
  );
}
