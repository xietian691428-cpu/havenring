import type { Metadata } from "next";
import SetupClient from "./SetupClient";

export const metadata: Metadata = {
  title: "Install Haven — HavenRing",
  description: "Add Haven to your Home Screen or install the app for the best experience.",
};

export default function SetupPage() {
  return <SetupClient />;
}
