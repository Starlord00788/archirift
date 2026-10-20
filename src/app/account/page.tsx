import type { Metadata } from "next";
import { AccountPanel } from "@/components/profile/AccountPanel";

export const metadata: Metadata = { title: "Account", description: "Sign in with Google or email to save your Archirift progress to your account." };

export default function AccountPage() {
  return (
    <main id="main" className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6">
      <AccountPanel />
    </main>
  );
}
