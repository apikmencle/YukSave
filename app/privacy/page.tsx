import type { Metadata } from "next";
import PrivacyContent from "@/components/PrivacyContent";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — YukSave",
  description: "Kebijakan privasi penggunaan layanan YukSave.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
