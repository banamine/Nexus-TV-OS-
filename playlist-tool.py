#!/usr/bin/env python3
"""
Nexus TV OS - Command Line Playlist Extraction Tool
Simple, no GUI, shows EVERYTHING in console
"""

import json
import re
import sys
from pathlib import Path

def parse_m3u(content):
    """Parse M3U playlist"""
    items = []
    lines = content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith('#EXTINF'):
            # Extract title
            title_match = re.search(r',(.+)$', line)
            title = title_match.group(1).strip() if title_match else "Unknown"
            
            # Extract thumbnail
            thumb_match = re.search(r'tvg-logo="([^"]+)"', line)
            thumb = thumb_match.group(1) if thumb_match else ""
            
            # Extract group
            group_match = re.search(r'group-title="([^"]+)"', line)
            group = group_match.group(1) if group_match else "Channel"
            
            # Next line is URL
            if i + 1 < len(lines):
                url = lines[i + 1].strip()
                if url and not url.startswith('#') and url.startswith('http'):
                    items.append({
                        'title': title,
                        'url': url,
                        'group': group,
                        'thumb': thumb,
                        'epg': 'Live Stream'
                    })
            i += 2
        else:
            i += 1
    return items

def parse_json(content):
    """Parse JSON playlist"""
    items = []
    try:
        data = json.loads(content)
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and 'url' in item:
                    items.append({
                        'title': item.get('title', 'Unknown'),
                        'url': item['url'],
                        'group': item.get('group', 'Channel'),
                        'thumb': item.get('thumb', ''),
                        'epg': item.get('epg', 'Live Stream')
                    })
    except:
        pass
    return items

def parse_txt(content):
    """Parse TXT playlist (one URL per line)"""
    items = []
    for line in content.split('\n'):
        line = line.strip()
        if line and line.startswith('http'):
            items.append({
                'title': f"Channel {len(items)+1}",
                'url': line,
                'group': 'Channel',
                'thumb': '',
                'epg': 'Live Stream'
            })
    return items

def parse_js(content):
    """Parse JavaScript playlist"""
    items = []
    match = re.search(r'\[(.*?)\]', content, re.DOTALL)
    if match:
        try:
            data = json.loads('[' + match.group(1) + ']')
            for item in data:
                if isinstance(item, dict) and 'url' in item:
                    items.append({
                        'title': item.get('title', 'Unknown'),
                        'url': item['url'],
                        'group': item.get('group', 'Channel'),
                        'thumb': item.get('thumb', ''),
                        'epg': item.get('epg', 'Live Stream')
                    })
        except:
            pass
    return items

def main():
    if len(sys.argv) < 2:
        print("Usage: python playlist-tool.py <file.m3u|.txt|.json|.js>")
        print("\nExample:")
        print("  python playlist-tool.py myplaylist.m3u")
        sys.exit(1)
    
    filepath = Path(sys.argv[1])
    
    if not filepath.exists():
        print(f"❌ Error: File not found: {filepath}")
        sys.exit(1)
    
    print("\n" + "="*80)
    print("🎬 NEXUS TV OS - PLAYLIST EXTRACTION TOOL")
    print("="*80)
    print(f"File: {filepath.absolute()}")
    print(f"Size: {filepath.stat().st_size} bytes")
    print()
    
    # Read file
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Detect format and parse
    ext = filepath.suffix.lower()
    items = []
    
    if ext in ['.m3u', '.m3u8'] or '#EXTINF' in content:
        print("Format: M3U Playlist")
        items = parse_m3u(content)
    elif ext == '.json' or content.strip().startswith('['):
        print("Format: JSON")
        items = parse_json(content)
    elif ext == '.txt':
        print("Format: Text (one URL per line)")
        items = parse_txt(content)
    elif ext == '.js':
        print("Format: JavaScript")
        items = parse_js(content)
    else:
        print("Unknown format. Trying JSON...")
        items = parse_json(content)
    
    if not items:
        print("❌ No valid items found!")
        sys.exit(1)
    
    print(f"✓ Extracted {len(items)} items\n")
    
    # Show extracted data
    print("="*80)
    print("EXTRACTED DATA (showing first 20 items):")
    print("="*80)
    print()
    
    for i, item in enumerate(items[:20], 1):
        print(f"{i}. TITLE: {item['title']}")
        print(f"   URL: {item['url']}")
        if item['group']:
            print(f"   GROUP: {item['group']}")
        if item['thumb']:
            print(f"   THUMB: {item['thumb']}")
        print()
    
    if len(items) > 20:
        print(f"... and {len(items) - 20} more items\n")
    
    # Create output directory
    output_dir = Path("output").absolute()
    chunks_dir = output_dir / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)
    
    # Split into chunks
    num_chunks = max(1, min(5, len(items) // 100))
    items_per_chunk = len(items) // num_chunks
    
    print("="*80)
    print(f"CREATING {num_chunks} CHUNK FILE(S)")
    print("="*80)
    print()
    
    for i in range(num_chunks):
        start = i * items_per_chunk
        end = start + items_per_chunk if i < num_chunks - 1 else len(items)
        chunk_items = items[start:end]
        
        # Save as JSON
        chunk_name = f"chunk_{i+1:02d}"
        json_file = chunks_dir / f"{chunk_name}.json"
        
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(chunk_items, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Created: {json_file}")
        print(f"  Items: {len(chunk_items)}")
        print(f"  Size: {json_file.stat().st_size} bytes")
        print()
    
    print("="*80)
    print("✅ COMPLETE")
    print("="*80)
    print()
    print(f"Output location: {chunks_dir}")
    print()
    print("Files created:")
    for f in sorted(chunks_dir.glob("*.json")):
        with open(f) as file:
            data = json.load(file)
        print(f"  ✓ {f.name} ({len(data)} items)")
    print()

if __name__ == "__main__":
    main()
