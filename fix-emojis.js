const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'lib', 'gemini.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace problematic emojis with simple ASCII alternatives
const replacements = [
  // Blue circle emoji variations (could be corrupted)
  [/[\uD83D\uDD35����]/gu, '[!]'],  // Blue circle
  [/[\u2705✅���]/gu, '[OK]'],         // Check mark
  [/[\uD83D\uDCDD📝���]/gu, '[NOTE]'], // Memo
  [/[\u26A0⚠️���]/gu, '[WARNING]'],    // Warning
  [/[\uD83D\uDD34����]/gu, '[X]'],    // Red circle
  // Replace any remaining invalid UTF-8 sequences
  [/\uFFFD/g, '?'],  // Replacement character
  [/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''],  // Control characters
];

for (const [pattern, replacement] of replacements) {
  content = content.replace(pattern, replacement);
}

// Also normalize repeated blank lines (keep max 2)
content = content.replace(/\n{4,}/g, '\n\n\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replaced problematic emojis in gemini.ts');
