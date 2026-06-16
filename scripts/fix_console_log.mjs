import fs from 'fs';
import path from 'path';

const filesToFix = [
  "src/app/api/ask/action/route.ts",
  "src/app/api/cron/daily-brief/route.ts",
  "src/app/api/webhooks/corsair/route.ts",
  "src/app/api/auth/google/callback/route.ts"
];

for (const relPath of filesToFix) {
  const filePath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/console\.log/g, 'console.info');
  fs.writeFileSync(filePath, content);
  console.log('Fixed console.log in', filePath);
}
