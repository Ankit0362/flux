const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/inbox/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  { from: /bg-\[#05070f\]/g, to: "bg-[#FAFAF9]" },
  { from: /bg-\[#080a14\]/g, to: "bg-[#FFFFFF]" },
  { from: /bg-\[#060810\]/g, to: "bg-[#FFFFFF]" },
  { from: /bg-\[#070912\]/g, to: "bg-[#FAFAF9]" },
  { from: /bg-\[#05070e\]/g, to: "bg-[#FFFFFF]" },
  { from: /text-slate-100/g, to: "text-[#0C0A09]" },
  { from: /text-slate-200/g, to: "text-[#0C0A09]" },
  { from: /text-slate-300/g, to: "text-[#0C0A09]" },
  { from: /text-slate-400/g, to: "text-[#57534E]" },
  { from: /text-slate-500/g, to: "text-[#57534E]" },
  { from: /border-slate-800/g, to: "border-[#E8ECF0]" },
  { from: /border-slate-900/g, to: "border-[#E8ECF0]" },
  { from: /bg-slate-900\/40/g, to: "bg-[#FAFAF9]" },
  { from: /bg-slate-900\/20/g, to: "bg-[#FAFAF9]" },
  { from: /bg-slate-800/g, to: "bg-[#FAFAF9]" },
  { from: /border-slate-700/g, to: "border-[#E8ECF0]" },
  { from: /bg-amber-950\/40/g, to: "bg-[#FAFAF9]" },
  { from: /text-amber-200/g, to: "text-[#A16207]" },
  { from: /text-amber-300/g, to: "text-[#A16207]" },
  { from: /text-amber-400/g, to: "text-[#A16207]" },
  { from: /border-amber-900\/30/g, to: "border-[#E8ECF0]" },
  { from: /bg-amber-950\/20/g, to: "bg-[#FAFAF9]" },
  { from: /bg-gradient-to-r from-amber-400 to-stone-300 bg-clip-text text-transparent/g, to: "text-[#0C0A09] font-serif" },
  { from: /bg-gradient-to-tr from-amber-600 to-stone-500/g, to: "bg-[#0C0A09]" },
  { from: /text-slate-100/g, to: "text-[#0C0A09]" },
  { from: /font-sans/g, to: "font-sans" }, // unchanged but ensures we have it
];

replacements.forEach(({ from, to }) => {
  content = content.replace(from, to);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Theme updated for inbox/page.tsx');
