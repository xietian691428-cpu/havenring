import type { Metadata } from "next";
import { readSetupReturnPath } from "@/lib/setupReturnPath";
import SetupClient from "./SetupClient";

export const metadata: Metadata = {
  title: "Install Haven — HavenRing",
  description: "Add Haven to your Home Screen or install the app for the best experience.",
};

type SetupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickQueryParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const params = await searchParams;
  const returnPath = readSetupReturnPath(
    pickQueryParam(params, "return") || pickQueryParam(params, "next")
  );

  return <SetupClient returnPath={returnPath} />;
}
