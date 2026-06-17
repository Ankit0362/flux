import fs from 'fs';
import path from 'path';

const searchPatterns = [
  { regex: /Flux/g, replacement: 'Flux' },
  { regex: /flux/g, replacement: 'flux' },
  { regex: /FLUX/g, replacement: 'FLUX' },
  { regex: /Flux/g, replacement: 'Flux' },
  { regex: /flux/gi, replacement: 'flux' }
];

const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css', '.mjs', ''];
const excludeDirs = ['node_modules', '.git', '.next', '.gemini'];

function walkAndReplace(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!excludeDirs.includes(file)) {
        walkAndReplace(fullPath);
      }
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext) || file.startsWith('.env')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let modified = false;

        for (const pattern of searchPatterns) {
          if (pattern.regex.test(content)) {
            content = content.replace(pattern.regex, pattern.replacement);
            modified = true;
          }
        }

        if (modified) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`Updated ${fullPath}`);
        }
      }
    }
  }
}

walkAndReplace(process.cwd());
console.log('Replacement complete.');
