const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'lib', 'gemini.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Remove trailing dashes and newlines pattern
content = content.replace(/-\n/g, '\n');
content = content.replace(/-$/, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cleaned up trailing dashes in gemini.ts');
