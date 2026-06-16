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
        <Link href="/" className="flex items-center gap-4 text-white hover:text-[#00F0FF] transition-colors">
          <div className="w-10 h-10 border border-white/20 flex items-center justify-center font-serif text-lg bg-black/50 backdrop-blur-md">
            C
          </div>
          <span className="font-serif text-2xl tracking-tight">ChiefOS</span>
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
          className="text-xl md:text-2xl text-[#94A3B8] font-light max-w-2xl leading-relaxed"
        >
          ChiefOS intercepts your emails and calendar, extracting open loops and commitments into a floating 3D spatial dashboard. Scroll down to discover.
        </motion.p>
      </section>

      {/* Scrolling Content over the 3D Core */}
      <section className="min-h-screen relative z-10 bg-black/40 backdrop-blur-sm border-t border-white/10 pt-32 pb-32">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { id: "01", title: "Extract", desc: "Our neural core automatically extracts action items and commitments from your raw email stream." },
            { id: "02", title: "Synthesize", desc: "Calendar events are paired with relationship intelligence and past correspondence." },
            { id: "03", title: "Act", desc: "Transition into our hyper-usable, ultra-premium 2D workspace to knock out your daily brief." }
          ].map((item, i) => (
            <div key={item.id} className="p-12 border border-white/10 bg-black/60 backdrop-blur-md rounded-lg hover:border-[#00F0FF]/50 transition-colors">
              <div className="text-[#00F0FF] font-mono text-xl mb-6">{item.id}</div>
              <h3 className="text-3xl font-serif mb-4 text-white">{item.title}</h3>
              <p className="text-[#94A3B8] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
        
        <div className="text-center mt-32">
          <Link href="/login" className="inline-flex px-12 py-6 bg-white text-black text-sm uppercase tracking-[0.2em] font-bold hover:bg-[#00F0FF] transition-colors">
            Experience the Workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
