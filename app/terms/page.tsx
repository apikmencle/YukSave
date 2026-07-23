import type { Metadata } from "next";
import TermsContent from "@/components/TermsContent";

export const metadata: Metadata = {
  title: "Syarat Ketentuan — YukSave",
  description: "Syarat dan ketentuan penggunaan layanan YukSave.",
};

export default function TermsPage() {
  return <TermsContent />;
}
