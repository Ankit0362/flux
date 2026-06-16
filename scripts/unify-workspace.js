const fs = require('fs');
const path = require('path');

const filesToProcess = [
  '../src/app/dashboard/page.tsx',
  '../src/app/calendar/page.tsx',
  '../src/app/contacts/page.tsx',
  '../src/app/contact/[id]/page.tsx'
];

// Revert all dark mode "AI-generated" tailwind classes to Editorial Light Mode
const replacements = [
  // Backgrounds & Surfaces
  { from: /bg-\[#05070f\]/g, to: "bg-[#FAFAF9]" },
  { from: /bg-\[#080a14\]/g, to: "bg-white" },
  { from: /bg-slate-900\/40/g, to: "bg-[#FAFAF9]" },
  { from: /bg-slate-900\/30/g, to: "bg-white border border-[#E8ECF0]" },
  { from: /bg-slate-900/g, to: "bg-white border border-[#E8ECF0]" },
  { from: /bg-slate-800\/60/g, to: "bg-[#FAFAF9] border-[#E8ECF0]" },
  { from: /bg-slate-800/g, to: "bg-white border border-[#E8ECF0]" },
  { from: /bg-slate-850/g, to: "bg-[#FAFAF9]" },
  { from: /bg-amber-950\/40/g, to: "bg-amber-50" },
  { from: /bg-amber-950\/50/g, to: "bg-amber-50" },
  { from: /bg-stone-950\/60/g, to: "bg-[#FAFAF9]" },
  { from: /bg-emerald-950\/15/g, to: "bg-emerald-50" },
  { from: /bg-emerald-950\/50/g, to: "bg-emerald-50" },
  { from: /bg-rose-950\/15/g, to: "bg-rose-50" },
  { from: /bg-rose-950\/50/g, to: "bg-rose-50" },
  { from: /glass-card/g, to: "bg-white shadow-sm border border-[#E8ECF0]" },

  // Borders
  { from: /border-slate-900\/60/g, to: "border-[#E8ECF0]" },
  { from: /border-slate-900/g, to: "border-[#E8ECF0]" },
  { from: /border-slate-800\/60/g, to: "border-[#E8ECF0]" },
  { from: /border-slate-800\/40/g, to: "border-[#E8ECF0]" },
  { from: /border-slate-800/g, to: "border-[#E8ECF0]" },
  { from: /border-slate-700\/60/g, to: "border-[#E8ECF0]" },
  { from: /border-slate-700/g, to: "border-[#E8ECF0]" },
  { from: /border-amber-900\/30/g, to: "border-amber-200" },
  { from: /border-emerald-900\/25/g, to: "border-emerald-200" },
  { from: /border-emerald-900\/30/g, to: "border-emerald-200" },
  { from: /border-rose-900\/25/g, to: "border-rose-200" },
  { from: /border-rose-900\/30/g, to: "border-rose-200" },
  { from: /border-stone-900\/40/g, to: "border-[#E8ECF0]" },

  // Typography (Text Colors)
  { from: /text-white/g, to: "text-[#0C0A09]" },
  { from: /text-slate-100/g, to: "text-[#0C0A09]" },
  { from: /text-slate-200/g, to: "text-[#0C0A09]" },
  { from: /text-slate-300/g, to: "text-[#0C0A09]" },
  { from: /text-slate-400/g, to: "text-[#57534E]" },
  { from: /text-slate-450/g, to: "text-[#57534E]" },
  { from: /text-slate-500/g, to: "text-[#94A3B8]" },
  { from: /text-amber-200/g, to: "text-amber-800" },
  { from: /text-amber-300/g, to: "text-amber-700" },
  { from: /text-amber-400/g, to: "text-amber-600" },
  { from: /text-emerald-300\/80/g, to: "text-emerald-700" },
  { from: /text-emerald-400/g, to: "text-emerald-600" },
  { from: /text-rose-300\/80/g, to: "text-rose-700" },
  { from: /text-rose-400/g, to: "text-rose-600" },

  // Background Gradients (Text)
  { from: /bg-gradient-to-r from-amber-400 to-stone-300/g, to: "bg-none" },
  { from: /text-transparent bg-clip-text/g, to: "text-[#0C0A09]" },

  // Buttons & Interactions
  { from: /hover:bg-slate-900\/40/g, to: "hover:bg-[#F3F4F6]" },
  { from: /hover:bg-slate-800/g, to: "hover:bg-[#E8ECF0]" },
  { from: /hover:text-slate-200/g, to: "hover:text-[#0C0A09]" },
  { from: /hover:text-slate-350/g, to: "hover:text-[#0C0A09]" },
  { from: /hover:border-slate-700\/50/g, to: "hover:border-[#0C0A09]" },
  { from: /hover:border-slate-700\/60/g, to: "hover:border-[#0C0A09]" },
  { from: /bg-gradient-to-r from-amber-600 to-stone-600/g, to: "bg-[#0C0A09]" },
  { from: /hover:from-amber-500 hover:to-stone-500/g, to: "hover:bg-slate-800" },
  { from: /shadow-lg shadow-amber-950\/20/g, to: "shadow-sm" },
  { from: /shadow-lg shadow-amber-900\/30/g, to: "shadow-sm" },

  // Aurora & Glow removal
  { from: /<AuroraBackground showRadialGradient={true} className="flex-1 flex flex-col overflow-y-auto w-full selection:bg-amber-900\/50 selection:text-amber-200 bg-transparent">/g, to: '<div className="flex-1 flex flex-col overflow-y-auto w-full bg-[#FAFAF9]">' },
  { from: /<\/AuroraBackground>/g, to: "</div>" },
  { from: /<div className="absolute top-0 right-1\/4 w-\[400px\] h-\[400px\] bg-amber-900\/10 rounded-full blur-\[100px\] pointer-events-none" \/>/g, to: "" },
  { from: /<div className="absolute bottom-0 left-1\/4 w-\[400px\] h-\[400px\] bg-stone-950\/10 rounded-full blur-\[100px\] pointer-events-none" \/>/g, to: "" },
];

filesToProcess.forEach((file) => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    replacements.forEach(({ from, to }) => {
      content = content.replace(from, to);
    });
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Processed: ${file}`);
  } else {
    console.log(`Not found: ${file}`);
  }
});
