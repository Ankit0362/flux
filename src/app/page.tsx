"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import NeuralCore from "@/components/NeuralCore";

export default function Home() {
  return (
    <main className="min-h-[200vh] bg-black text-white relative">
      {/* 3D Background - Fixed so it stays while scrolling */}
      <div className="fixed inset-0 z-0">
        <NeuralCore />
        {/* Vignette overlay to fade out edges */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,black_100%)] pointer-events-none"></div>
      </div>

      <motion.nav 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 1 }}
        className="w-full h-24 flex items-center justify-between px-8 relative z-20"
      >
        <Link href="/" className="flex items-center gap-4 text-white hover:text-[#C5A06D] transition-colors">
          <img src="/shortlogo.png" alt="Flux Icon" className="h-10 w-10 object-contain" />
          <span className="font-sans text-2xl tracking-wide font-extrabold uppercase">Flux</span>
        </Link>
        <Link href="/login" className="px-6 py-2 border border-[#00F0FF]/50 text-[#00F0FF] text-sm uppercase tracking-widest hover:bg-[#00F0FF]/10 transition-colors backdrop-blur-md">
          Enter Workspace
        </Link>
      </motion.nav>

      {/* Hero Section */}
      <section className="h-screen flex flex-col justify-center items-center text-center relative z-10 px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="text-[#00F0FF] text-sm font-mono uppercase tracking-[0.3em] mb-6 flex items-center justify-center gap-3"
        >
          <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse"></span>
          The Future of Work is Spatial
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 1 }}
          className="font-serif text-6xl md:text-[8rem] leading-[0.9] tracking-tighter mb-8 text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/30"
        >
          Neural <br/>Intelligence.
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1 }}
          className="text-xl md:text-2xl text-[#94A3B8] font-light max-w-3xl leading-relaxed"
        >
          Fluxmail connects to your Google Workspace to securely read your Gmail and Calendar. We automatically extract action items, summarize emails, and prepare you for upcoming meetings in an intelligent, unified dashboard.
        </motion.p>
      </section>

      {/* Scrolling Content over the 3D Core */}
      <section className="min-h-screen relative z-10 bg-black/40 backdrop-blur-sm border-t border-white/10 pt-32 pb-32">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { id: "01", title: "Email Triage", desc: "Fluxmail securely reads your Gmail to detect open loops, commitments, and action items, so you never drop the ball on an important thread." },
            { id: "02", title: "Calendar Intelligence", desc: "Syncs with Google Calendar to provide relationship intelligence, past correspondence context, and summaries before your meetings begin." },
            { id: "03", title: "Privacy First", desc: "Your data is yours. Fluxmail strictly requests read-only permissions necessary to synthesize your daily brief and never shares your personal information." }
          ].map((item, i) => (
            <div key={item.id} className="p-12 border border-white/10 bg-black/60 backdrop-blur-md rounded-lg hover:border-[#00F0FF]/50 transition-colors">
              <div className="text-[#00F0FF] font-mono text-xl mb-6">{item.id}</div>
              <h3 className="text-3xl font-serif mb-4 text-white">{item.title}</h3>
              <p className="text-[#94A3B8] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
        
        <div className="text-center mt-32 mb-16">
          <Link href="/login" className="inline-flex px-12 py-6 bg-white text-black text-sm uppercase tracking-[0.2em] font-bold hover:bg-[#00F0FF] transition-colors">
            Experience the Workspace
          </Link>
        </div>

        {/* Explicit Google Verification / Data Usage Section */}
        <div className="max-w-4xl mx-auto px-6 mb-32 text-left bg-white/5 border border-white/10 p-8 rounded-xl backdrop-blur-md">
          <h2 className="text-2xl font-serif text-white mb-4">How Fluxmail uses your Google Data</h2>
          <p className="text-[#94A3B8] mb-4 leading-relaxed">
            Fluxmail is an AI-powered executive assistant designed to organize your professional life. To provide this service, our application requires access to your Google Account (specifically Gmail and Google Calendar).
          </p>
          <ul className="list-disc pl-5 text-[#94A3B8] space-y-2 mb-4 leading-relaxed">
            <li><strong>Gmail Access (Read-Only):</strong> We analyze your emails to automatically identify and extract action items, commitments, and important follow-ups so they can be displayed on your dashboard.</li>
            <li><strong>Google Calendar Access (Read-Only):</strong> We read your calendar events to generate meeting briefs, summarize upcoming calls, and provide context on the people you are meeting with.</li>
          </ul>
          <p className="text-[#94A3B8] leading-relaxed">
            <strong>Privacy Commitment:</strong> Fluxmail only requests the minimum scopes necessary to function properly. We do not sell your personal data, and your email/calendar content is exclusively used to power the features within your personal dashboard.
          </p>
        </div>

        {/* Footer for Compliance */}
        <footer className="w-full border-t border-white/10 pt-12 pb-12 px-8 flex flex-col md:flex-row justify-between items-center gap-6 mt-12 bg-black/80 backdrop-blur-md">
          <div className="text-[#94A3B8] text-sm">
            &copy; {new Date().getFullYear()} Flux Cognitive Assistant. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm">
            <Link href="/privacy" className="text-[#94A3B8] hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-[#94A3B8] hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </footer>
      </section>
    </main>
  );
}
