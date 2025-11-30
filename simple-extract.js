#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
    console.log('Usage: node simple-extract.js <file>');
    process.exit(1);
}

const fullPath = path.resolve(file);
if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    process.exit(1);
}

const content = fs.readFileSync(fullPath, 'utf-8');
const lines = content.split('\n');
const items = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('#EXTINF') || line.includes(',')) {
        const title = line.replace(/#EXTINF.*?,/, '').trim();
        const nextLine = lines[i+1] ? lines[i+1].trim() : '';
        if (nextLine.startsWith('http')) {
            items.push({ title, url: nextLine });
            i++;
        }
    } else if (line.startsWith('http')) {
        items.push({ title: `Channel ${items.length+1}`, url: line.trim() });
    }
}

const outDir = path.join(process.cwd(), 'output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, 'extracted.json');
fs.writeFileSync(outFile, JSON.stringify(items, null, 2));

console.log(`✓ Extracted: ${items.length} items`);
console.log(`✓ Saved to: ${outFile}`);
items.forEach((i, idx) => console.log(`  ${idx+1}. ${i.title}`));
