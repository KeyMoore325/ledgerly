import type { Metadata } from "next";
import { Profiles } from "@/components/Profiles";

export const metadata: Metadata = {
  title: "Profiles",
  description: "Create separate budget profiles for yourself, your household or what-if scenarios.",
  alternates: { canonical: "/profile" },
  robots: { index: false },
};

export default function ProfilePage() {
  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">Profiles</p>
        <h1>Your profiles</h1>
        <p>
          Each profile keeps its own budget. Profiles are stored on this device. Use export and import to move one to
          another browser.
        </p>
      </header>
      <Profiles />
    </div>
  );
}
