import fs from 'fs';
import path from 'path';

const filesToFix = [
  "src/app/admin/sync-debug/page.tsx",
  "src/app/calendar/page.tsx",
  "src/app/contact/[id]/page.tsx",
  "src/app/contacts/page.tsx",
  "src/app/dashboard/page.tsx",
  "src/components/CommandPalette.tsx",
  "src/hooks/useCommitments.ts",
  "src/services/calendarSync.ts",
  "scripts/testExtraction.ts"
];

for (const relPath of filesToFix) {
  const filePath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  // Simple regex to replace err.message with a safe check
  content = content.replace(/err\.message/g, '(err instanceof Error ? err.message : String(err))');
  fs.writeFileSync(filePath, content);
  console.log('Fixed err.message in', filePath);
}
