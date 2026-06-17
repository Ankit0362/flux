import React from "react";

export const metadata = {
  title: "Terms of Service | Flux",
  description: "Terms of Service for Flux",
};

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto py-24 px-6 sm:px-12 prose prose-invert prose-blue">
      <h1 className="text-4xl font-serif font-bold mb-8 text-white">Terms of Service</h1>
      <p className="text-gray-400 mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">1. Agreement to Terms</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          By accessing or using Flux at fluxmail.dev (the "Service"), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the Service.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">2. Description of Service</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          Flux is an email-driven cognitive assistant that integrates with your Google Workspace accounts (Gmail and Calendar) to help manage emails, generate briefings, and assist with scheduling. We use artificial intelligence models to process data strictly for these purposes.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">3. Google Account Integration</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          To use Flux, you must grant us access to your Google account. By doing so, you authorize us to read, analyze, and (when requested by you) send emails and create calendar events on your behalf.
        </p>
        <p className="text-gray-300 leading-relaxed mb-4">
          Our use of data obtained from Google APIs is strictly governed by our <a href="/privacy" className="text-blue-400 hover:text-blue-300 underline">Privacy Policy</a> and complies with the Google API Services User Data Policy, including the Limited Use requirements.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">4. User Responsibilities</h2>
        <ul className="list-disc pl-6 mt-4 text-gray-300 space-y-2">
          <li>You are responsible for maintaining the confidentiality of your account access.</li>
          <li>You must not use the Service for any illegal or unauthorized purpose.</li>
          <li>You acknowledge that AI-generated summaries and automated scheduling intents may not always be 100% accurate, and you should review critical communications manually.</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">5. Termination</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. You may also terminate your account at any time by revoking access in your Google Account settings and notifying us.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">6. Limitation of Liability</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          In no event shall Flux, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">7. Changes to Terms</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          We reserve the right to modify or replace these Terms at any time. We will provide notice of any significant changes. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">8. Contact Us</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          If you have any questions about these Terms, please contact us at: <br />
          <a href="mailto:support@fluxmail.dev" className="text-blue-400 hover:text-blue-300">support@fluxmail.dev</a>
        </p>
      </section>
    </div>
  );
}
