import type { Metadata } from "next";
import { Profiles } from "@/components/Profiles";

export const metadata: Metadata = {
  title: "Profiles",
  description: "Tell us what to call you, and keep separate budgets for yourself, your household or what-if plans.",
  alternates: { canonical: "/profile" },
  robots: { index: false },
};

export default function ProfilePage() {
  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">Your profile</p>
        <h1>Make it yours</h1>
        <p>
          Tell us what to call you, name your budget, and keep as many budgets as you like. Everything stays right here
          in this browser.
        </p>
      </header>
      <Profiles />
    </div>
  );
}
