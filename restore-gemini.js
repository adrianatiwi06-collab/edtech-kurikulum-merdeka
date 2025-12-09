const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'lib', 'gemini.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the dashes that were incorrectly inserted between every character
content = content.replace(/-(.)/g, '$1');

// Remove leading dashes
content = content.replace(/^-/, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Restored gemini.ts - removed dashes');
