import React from "react";

export const metadata = {
  title: "Privacy Policy | ChiefOS",
  description: "Privacy Policy for ChiefOS",
};

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto py-24 px-6 sm:px-12 prose prose-invert prose-blue">
      <h1 className="text-4xl font-serif font-bold mb-8 text-white">Privacy Policy</h1>
      <p className="text-gray-400 mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">1. Introduction</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          Welcome to ChiefOS ("we," "our," or "us"), operated on fluxmail.dev. We are committed to protecting your privacy and ensuring you understand how your information is used. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data when you use our email-driven cognitive assistant application (the "Service").
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">2. Information We Collect</h2>
        <h3 className="text-xl font-medium mb-2 text-gray-200">2.1. Account Information</h3>
        <p className="text-gray-300 leading-relaxed mb-4">
          When you sign up, we collect your name, email address, and authentication tokens provided by OAuth providers (such as Google).
        </p>
        
        <h3 className="text-xl font-medium mb-2 text-gray-200">2.2. Google User Data</h3>
        <p className="text-gray-300 leading-relaxed mb-4">
          ChiefOS requires access to your Google account to function. Specifically, we request access to your Gmail and Google Calendar to analyze incoming communications, generate executive briefings, identify commitments, and manage your schedule.
        </p>
      </section>

      <section className="mb-12 p-6 bg-gray-900 border border-gray-800 rounded-xl">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">3. Google API Services User Data Policy (Limited Use)</h2>
        <p className="text-gray-300 leading-relaxed">
          ChiefOS's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
        </p>
        <ul className="list-disc pl-6 mt-4 text-gray-300 space-y-2">
          <li><strong>Allowed Use:</strong> We only use access to read, write, modify, or control Gmail message bodies (including attachments), metadata, headers, and settings to provide a cognitive assistant that helps you manage emails and scheduling.</li>
          <li><strong>No Data Selling:</strong> We do not transfer or sell your Google user data to third parties for advertising, market research, email campaign tracking, or other unrelated purposes.</li>
          <li><strong>Human Access:</strong> We do not allow humans to read your data unless we have your affirmative agreement for specific messages, doing so is necessary for security purposes such as investigating abuse, to comply with applicable law, or for the App's internal operations and even then only when the data have been aggregated and anonymized.</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">4. How We Use Your Information</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          We use the information we collect to:
        </p>
        <ul className="list-disc pl-6 text-gray-300 space-y-2">
          <li>Provide, operate, and maintain the ChiefOS service.</li>
          <li>Analyze email content using artificial intelligence (Google Gemini) strictly for the purpose of generating personal summaries, commitments, and scheduling intents.</li>
          <li>Communicate with you regarding service updates or technical issues.</li>
          <li>Improve the accuracy and functionality of our cognitive assistant.</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">5. Third-Party Artificial Intelligence Processing</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          To provide our cognitive capabilities, we securely transmit portions of your email and calendar data to Google Gemini AI via its API. This data is transmitted securely and is processed solely for generating your immediate results. Data processed through this API is governed by strict enterprise terms and is <strong>not</strong> used to train public AI models.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">6. Data Retention and Deletion</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          We retain your data only for as long as your account is active or as needed to provide you the Service. You can revoke ChiefOS's access to your Google account at any time via your Google Account Security settings. Upon account deletion, we immediately purge all cached emails, summaries, and authentication tokens from our active databases.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">7. Security</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          We implement strong security measures, including at-rest encryption for OAuth tokens and secure TLS connections for all API requests, to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-sans font-semibold mb-4 text-white">8. Contact Us</h2>
        <p className="text-gray-300 leading-relaxed mb-4">
          If you have any questions about this Privacy Policy, please contact us at: <br />
          <a href="mailto:support@fluxmail.dev" className="text-blue-400 hover:text-blue-300">support@fluxmail.dev</a>
        </p>
      </section>
    </div>
  );
}
