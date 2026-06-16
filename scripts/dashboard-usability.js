const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/inbox/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import for AppLayout
if (!content.includes('import AppLayout')) {
  content = content.replace(
    'import React, { useEffect, useState, useMemo } from "react";',
    'import React, { useEffect, useState, useMemo } from "react";\nimport AppLayout from "@/components/AppLayout";'
  );
}

// 2. Wrap the main return in AppLayout
// We'll replace the top-level main div with <AppLayout> and remove the background class since AppLayout handles it.
// The main return looks like: return ( <div className="min-h-screen...
content = content.replace(
  /return \(\s*<div className="[^"]*min-h-screen[^"]*">/g,
  'return (\n    <AppLayout>\n      <div className="p-8 max-w-[1600px] mx-auto">'
);

// Close the wrapper
const lastDivMatch = content.lastIndexOf('</div>');
if (lastDivMatch !== -1) {
  content = content.substring(0, lastDivMatch) + '</div>\n    </AppLayout>' + content.substring(lastDivMatch + 6);
}

// 3. Revert spatial/dark classes to Editorial Light classes
const replacements = [
  { from: /bg-black\/40 backdrop-blur-xl/g, to: "bg-[#FAFAF9]" },
  { from: /glass-panel/g, to: "bg-white border border-[#E8ECF0] shadow-sm" },
  { from: /text-white/g, to: "text-[#0C0A09]" },
  { from: /text-\[#94A3B8\]/g, to: "text-[#57534E]" },
  { from: /border-white\/10/g, to: "border-[#E8ECF0]" },
  { from: /text-\[#00F0FF\]/g, to: "text-[#A16207]" },
  { from: /bg-white\/5/g, to: "bg-[#FAFAF9]" },
  { from: /font-mono/g, to: "font-sans" }, // we keep sans for the app
  { from: /bg-\[#00F0FF\]\/10/g, to: "bg-[#FAFAF9]" },
  { from: /border-\[#00F0FF\]\/30/g, to: "border-[#E8ECF0]" },
];

replacements.forEach(({ from, to }) => {
  content = content.replace(from, to);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Dashboard transitioned to AppLayout Light Mode');
