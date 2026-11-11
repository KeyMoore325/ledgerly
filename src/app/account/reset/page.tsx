import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/NewPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="container page" style={{ maxWidth: 480 }}>
      <header className="page-head" style={{ textAlign: "center" }}>
        <p className="eyebrow">Your account</p>
        <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.2rem)" }}>Pick a new password</h1>
        <p style={{ margin: "0 auto" }}>You&apos;re almost back in. Choose something you&apos;ll remember.</p>
      </header>
      <div className="card">
        <NewPasswordForm redirectTo="/planner" />
      </div>
    </div>
  );
}
