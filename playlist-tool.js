#!/usr/bin/env node
/**
 * Nexus TV OS - Command Line Playlist Extraction Tool
 * Simple CLI that extracts URLs from playlists and creates output files
 */

const fs = require('fs');
const path = require('path');

function parseM3U(content) {
    const items = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXTINF')) {
            // Extract title
            const titleMatch = line.match(/,(.+)$/);
            const title = titleMatch ? titleMatch[1].trim() : 'Unknown';
            
            // Extract thumbnail
            const thumbMatch = line.match(/tvg-logo="([^"]+)"/);
            const thumb = thumbMatch ? thumbMatch[1] : '';
            
            // Extract group
            const groupMatch = line.match(/group-title="([^"]+)"/);
            const group = groupMatch ? groupMatch[1] : 'Channel';
            
            // Next line is URL
            if (i + 1 < lines.length) {
                const url = lines[i + 1].trim();
                if (url && !url.startsWith('#') && url.startsWith('http')) {
                    items.push({
                        title,
                        url,
                        group,
                        thumb,
                        epg: 'Live Stream'
                    });
                }
            }
        }
    }
    
    return items;
}

function parseJSON(content) {
    const items = [];
    try {
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
            for (const item of data) {
                if (item && item.url) {
                    items.push({
                        title: item.title || 'Unknown',
                        url: item.url,
                        group: item.group || 'Channel',
                        thumb: item.thumb || '',
                        epg: item.epg || 'Live Stream'
                    });
                }
            }
        }
    } catch (e) {
        // Not valid JSON
    }
    return items;
}

function parseTXT(content) {
    const items = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && trimmed.startsWith('http')) {
            items.push({
                title: `Channel ${items.length + 1}`,
                url: trimmed,
                group: 'Channel',
                thumb: '',
                epg: 'Live Stream'
            });
        }
    }
    
    return items;
}

function parseJS(content) {
    const items = [];
    const match = content.match(/\[(.*?)\]/s);
    
    if (match) {
        try {
            const data = JSON.parse('[' + match[1] + ']');
            for (const item of data) {
                if (item && item.url) {
                    items.push({
                        title: item.title || 'Unknown',
                        url: item.url,
                        group: item.group || 'Channel',
                        thumb: item.thumb || '',
                        epg: item.epg || 'Live Stream'
                    });
                }
            }
        } catch (e) {
            // Not valid
        }
    }
    
    return items;
}

function main() {
    if (process.argv.length < 3) {
        console.log('\nUsage: node playlist-tool.js <file.m3u|.txt|.json|.js>');
        console.log('\nExample:');
        console.log('  node playlist-tool.js myplaylist.m3u');
        process.exit(1);
    }
    
    const filepath = path.resolve(process.argv[2]);
    
    // Check file exists
    if (!fs.existsSync(filepath)) {
        console.log(`\n❌ Error: File not found: ${filepath}`);
        process.exit(1);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎬 NEXUS TV OS - PLAYLIST EXTRACTION TOOL');
    console.log('='.repeat(80));
    console.log(`File: ${filepath}`);
    console.log(`Size: ${fs.statSync(filepath).size} bytes`);
    console.log();
    
    // Read file
    const content = fs.readFileSync(filepath, 'utf-8');
    
    // Detect format and parse
    const ext = path.extname(filepath).toLowerCase();
    let items = [];
    
    if (['.m3u', '.m3u8'].includes(ext) || content.includes('#EXTINF')) {
        console.log('Format: M3U Playlist');
        items = parseM3U(content);
    } else if (ext === '.json' || content.trim().startsWith('[')) {
        console.log('Format: JSON');
        items = parseJSON(content);
    } else if (ext === '.txt') {
        console.log('Format: Text (one URL per line)');
        items = parseTXT(content);
    } else if (ext === '.js') {
        console.log('Format: JavaScript');
        items = parseJS(content);
    } else {
        console.log('Unknown format. Trying JSON...');
        items = parseJSON(content);
    }
    
    if (items.length === 0) {
        console.log('❌ No valid items found!');
        process.exit(1);
    }
    
    console.log(`✓ Extracted ${items.length} items\n`);
    
    // Show extracted data
    console.log('='.repeat(80));
    console.log('EXTRACTED DATA (showing first 20 items):');
    console.log('='.repeat(80));
    console.log();
    
    for (let i = 0; i < Math.min(20, items.length); i++) {
        const item = items[i];
        console.log(`${i + 1}. TITLE: ${item.title}`);
        console.log(`   URL: ${item.url}`);
        if (item.group) console.log(`   GROUP: ${item.group}`);
        if (item.thumb) console.log(`   THUMB: ${item.thumb}`);
        console.log();
    }
    
    if (items.length > 20) {
        console.log(`... and ${items.length - 20} more items\n`);
    }
    
    // Create output directory
    const outputDir = path.resolve('output');
    const chunksDir = path.join(outputDir, 'chunks');
    
    if (!fs.existsSync(chunksDir)) {
        fs.mkdirSync(chunksDir, { recursive: true });
    }
    
    // Split into chunks
    const numChunks = Math.max(1, Math.min(5, Math.ceil(items.length / 100)));
    const itemsPerChunk = Math.ceil(items.length / numChunks);
    
    console.log('='.repeat(80));
    console.log(`CREATING ${numChunks} CHUNK FILE(S)`);
    console.log('='.repeat(80));
    console.log();
    
    for (let i = 0; i < numChunks; i++) {
        const start = i * itemsPerChunk;
        const end = Math.min(start + itemsPerChunk, items.length);
        const chunkItems = items.slice(start, end);
        
        const chunkName = `chunk_${String(i + 1).padStart(2, '0')}`;
        const jsonFile = path.join(chunksDir, `${chunkName}.json`);
        
        // Write JSON file
        fs.writeFileSync(jsonFile, JSON.stringify(chunkItems, null, 2), 'utf-8');
        
        const stats = fs.statSync(jsonFile);
        console.log(`✓ Created: ${jsonFile}`);
        console.log(`  Items: ${chunkItems.length}`);
        console.log(`  Size: ${stats.size} bytes`);
        console.log();
    }
    
    console.log('='.repeat(80));
    console.log('✅ COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log(`Output location: ${chunksDir}`);
    console.log();
    console.log('Files created:');
    
    const files = fs.readdirSync(chunksDir).filter(f => f.endsWith('.json')).sort();
    for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(chunksDir, file), 'utf-8'));
        console.log(`  ✓ ${file} (${data.length} items)`);
    }
    console.log();
}

main();
