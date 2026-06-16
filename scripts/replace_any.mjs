import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      if (dirPath.endsWith('.ts') || dirPath.endsWith('.tsx')) {
        callback(path.join(dirPath));
      }
    }
  });
}

walkDir('src', function(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content.replace(/catch \(err: any\)/g, 'catch (err: unknown)');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log('Updated', filePath);
  }
});
