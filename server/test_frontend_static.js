import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, '../client');

const files = fs.readdirSync(clientDir).filter(f => f.endsWith('.html'));

console.log('🔍 Validating HTML files and embedded scripts in client/:', files);
let errors = 0;
let warnings = 0;

for (const file of files) {
  const content = fs.readFileSync(path.join(clientDir, file), 'utf8');

  // 1. Check data-bs-target IDs
  const targetMatches = [...content.matchAll(/data-bs-target=["']#([a-zA-Z0-9_-]+)["']/g)];
  for (const m of targetMatches) {
    const id = m[1];
    if (!content.includes(`id="${id}"`) && !content.includes(`id='${id}'`)) {
      console.error(`❌ ${file}: data-bs-target "#${id}" not found in document!`);
      errors++;
    }
  }

  // 2. Check onclick functions
  const onclickMatches = [...content.matchAll(/onclick=["']([a-zA-Z0-9_.]+)\s*\(/g)];
  for (const m of onclickMatches) {
    const fn = m[1];
    if (['alert', 'confirm', 'prompt', 'return', 'window.print', 'location.reload', 'history.back', 'event.stopPropagation'].includes(fn)) continue;
    if (fn.startsWith('API.') || fn.startsWith('UI.') || fn.startsWith('bootstrap.')) continue;
    
    // Check if fn is defined in file or api.js
    const hasDef = content.includes(`function ${fn}`) || content.includes(`${fn} =`) || content.includes(`${fn}:`);
    if (!hasDef) {
      console.warn(`⚠️ ${file}: onclick function "${fn}()" may not be locally defined`);
      warnings++;
    }
  }

  // 3. Check for script syntax
  const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(content)) !== null) {
    const scriptCode = match[1];
    if (scriptCode.trim()) {
      try {
        new Function(scriptCode);
      } catch (err) {
        console.error(`❌ ${file} embedded script syntax error: ${err.message}`);
        errors++;
      }
    }
  }
}

console.log(`\nResults: ${errors} errors, ${warnings} warnings.`);
if (errors > 0) process.exit(1);
