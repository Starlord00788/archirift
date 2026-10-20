import type { Metadata } from "next";
import { Profile } from "@/components/profile/Profile";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <Profile />
    </main>
  );
}
