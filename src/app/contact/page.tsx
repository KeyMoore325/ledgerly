import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions, feedback or a problem with the planner? Send us a message.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="container narrow page">
      <header className="page-head">
        <p className="eyebrow">Contact</p>
        <h1>Get in touch</h1>
        <p>Questions, feedback or a problem with the planner? Send us a note. Please don&apos;t include account numbers or passwords.</p>
      </header>
      <ContactForm />
    </div>
  );
}
