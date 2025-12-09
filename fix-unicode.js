const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'lib', 'gemini.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all unicode box-drawing characters with regular characters
content = content.replace(/━/g, '=');
content = content.replace(/─/g, '-');
content = content.replace(/│/g, '|');
content = content.replace(/┌/g, '+');
content = content.replace(/┐/g, '+');
content = content.replace(/└/g, '+');
content = content.replace(/┘/g, '+');
content = content.replace(/├/g, '+');
content = content.replace(/┤/g, '+');
content = content.replace(/┬/g, '+');
content = content.replace(/┴/g, '+');
content = content.replace(/┼/g, '+');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed unicode characters in gemini.ts');
