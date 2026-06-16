const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/inbox/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace light mode classes to spatial mode classes
const replacements = [
  { from: /bg-\[#FAFAF9\]/g, to: "bg-black/40 backdrop-blur-xl" },
  { from: /bg-\[#FFFFFF\]/g, to: "glass-panel" },
  { from: /bg-white/g, to: "glass-panel" },
  { from: /text-\[#0C0A09\]/g, to: "text-white" },
  { from: /text-\[#57534E\]/g, to: "text-[#94A3B8]" },
  { from: /border-\[#E8ECF0\]/g, to: "border-white/10" },
  { from: /text-\[#A16207\]/g, to: "text-[#00F0FF]" },
  { from: /text-amber-400/g, to: "text-[#00F0FF]" },
  { from: /bg-slate-900\/40/g, to: "bg-white/5" },
  { from: /bg-slate-900\/20/g, to: "bg-white/5" },
  { from: /font-sans/g, to: "font-mono" }, 
  { from: /bg-amber-950\/40/g, to: "bg-[#00F0FF]/10" },
  { from: /border-amber-900\/30/g, to: "border-[#00F0FF]/30" },
  { from: /border-slate-800/g, to: "border-white/10" },
];

replacements.forEach(({ from, to }) => {
  content = content.replace(from, to);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Spatial theme applied to inbox/page.tsx');
