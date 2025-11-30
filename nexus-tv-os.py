#!/usr/bin/env python3
"""
NEXUS TV OS - Hybrid Playlist Extractor & Auto-Chunking Engine
All-in-one standalone Python application for Windows/Mac/Linux
NO external dependencies - uses only Python standard library
"""

import os
import sys
import json
import re
import math
from urllib.parse import unquote
from pathlib import Path
from typing import List, Dict, Tuple, Any


class ParsedItem:
    """Represents a single playlist item"""
    def __init__(self, title: str, url: str, logo: str = "", thumb: str = "", 
                 category: str = "", lang: str = "en", group: str = "", 
                 quality: str = "HD", item_type: str = "STREAM", epg: str = "", tags: List[str] = None):
        self.title = title
        self.url = url
        self.logo = logo
        self.thumb = thumb
        self.category = category
        self.lang = lang
        self.group = group
        self.quality = quality
        self.type = item_type
        self.epg = epg
        self.tags = tags or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "url": self.url,
            "logo": self.logo,
            "thumb": self.thumb,
            "category": self.category,
            "lang": self.lang,
            "group": self.group,
            "quality": self.quality,
            "type": self.type,
            "epg": self.epg,
            "tags": self.tags
        }


def detect_stream_type(url: str) -> str:
    """Detect stream type from URL"""
    url_lower = url.lower()
    if ".m3u" in url_lower:
        return "HLS"
    elif ".m3u8" in url_lower:
        return "HLS"
    elif ".mpd" in url_lower:
        return "DASH"
    elif "rtmp" in url_lower:
        return "RTMP"
    elif "rtsp" in url_lower:
        return "RTSP"
    elif ".mp4" in url_lower:
        return "MP4"
    elif ".mkv" in url_lower:
        return "MKV"
    elif ".avi" in url_lower:
        return "AVI"
    elif ".mov" in url_lower:
        return "MOV"
    elif ".webm" in url_lower:
        return "WEBM"
    return "STREAM"


def infer_quality(url: str) -> str:
    """Infer video quality from URL"""
    if "1080" in url:
        return "FHD"
    elif "720" in url:
        return "HD"
    elif "480" in url:
        return "SD"
    elif "4k" in url.lower():
        return "UHD"
    return "HD"


def extract_title_from_url(url: str) -> str:
    """Extract real title from URL filename"""
    try:
        filename = url.split("/")[-1]
        decoded = unquote(filename)
        decoded = re.sub(r'\.(mp4|mkv|avi|mov|webm|m3u8|m3u|mpd).*$', '', decoded, flags=re.IGNORECASE)
        decoded = re.sub(r'\.ia$', '', decoded)
        decoded = re.sub(r'\s+', ' ', decoded).strip()
        return decoded if decoded else "Stream"
    except:
        return "Stream"


def parse_m3u(content: str) -> List[ParsedItem]:
    """Parse M3U playlist format"""
    items = []
    lines = content.split('\n')
    current_title = None
    current_logo = ""
    current_group = ""

    for line in lines:
        trimmed = line.strip()

        if trimmed.startswith("#EXTINF:"):
            parts = trimmed.split(',', 1)
            if len(parts) > 1:
                current_title = parts[1].strip()
                extinf_part = parts[0]
                
                logo_match = re.search(r'tvg-logo="([^"]+)"', extinf_part)
                group_match = re.search(r'group-title="([^"]+)"', extinf_part)
                
                if logo_match:
                    current_logo = logo_match.group(1)
                if group_match:
                    current_group = group_match.group(1)

        elif trimmed and not trimmed.startswith("#") and "://" in trimmed:
            if current_title:
                items.append(ParsedItem(
                    title=current_title,
                    url=trimmed,
                    logo=current_logo,
                    group=current_group,
                    item_type=detect_stream_type(trimmed),
                    quality=infer_quality(trimmed)
                ))
                current_title = None
                current_logo = ""
                current_group = ""

    return items


def parse_csv(content: str) -> List[ParsedItem]:
    """Parse CSV playlist format"""
    items = []
    lines = content.split('\n')

    for line in lines:
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue

        parts = [p.strip() for p in trimmed.split(',')]
        url = ""
        category = "General"

        for i, part in enumerate(parts):
            if "://" in part:
                url = part
                if i > 2:
                    category = parts[2].strip()
                break

        if url:
            title = extract_title_from_url(url)
            item = ParsedItem(
                title=title,
                url=url,
                category=category,
                item_type=detect_stream_type(url),
                quality=infer_quality(url)
            )
            items.append(item)

    return items


def parse_json(content: str) -> List[ParsedItem]:
    """Parse JSON playlist format"""
    items = []
    try:
        data = json.loads(content)
        if isinstance(data, list):
            for entry in data:
                if isinstance(entry, str) and "://" in entry:
                    item = ParsedItem(
                        title=entry,
                        url=entry,
                        item_type=detect_stream_type(entry)
                    )
                    items.append(item)
                elif isinstance(entry, dict) and ("url" in entry or "link" in entry):
                    url = entry.get("url") or entry.get("link")
                    item = ParsedItem(
                        title=entry.get("title") or entry.get("name") or url or "Untitled",
                        url=url,
                        logo=entry.get("logo") or entry.get("thumb", ""),
                        group=entry.get("group") or entry.get("category", ""),
                        epg=entry.get("epg") or entry.get("description", ""),
                        item_type=detect_stream_type(url)
                    )
                    items.append(item)
    except:
        pass

    return items


def parse_raw_text(content: str) -> List[ParsedItem]:
    """Parse raw text file with URLs"""
    items = []
    lines = content.split('\n')

    for line in lines:
        trimmed = line.strip()
        if trimmed and "://" in trimmed:
            url_match = re.search(r'(https?://[^\s,]+)', trimmed)
            if url_match:
                url = url_match.group(1)
                title = trimmed.replace(url, "").split(",")[0].strip() or "Stream"
                item = ParsedItem(
                    title=title,
                    url=url,
                    item_type=detect_stream_type(url)
                )
                items.append(item)

    return items


def parse_playlist_file(file_path: str) -> List[ParsedItem]:
    """Parse playlist file and return items"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        with open(file_path, 'r', encoding='latin-1') as f:
            content = f.read()

    ext = Path(file_path).suffix.lower()

    if ext in ['.m3u', '.m3u8']:
        items = parse_m3u(content)
    elif ext == '.json':
        items = parse_json(content)
        if not items:
            items = parse_raw_text(content)
    elif ext in ['.csv', '.txt']:
        items = parse_csv(content)
        if not items:
            items = parse_raw_text(content)
    else:
        items = parse_raw_text(content)

    return items


def calculate_chunks(item_count: int) -> Tuple[int, int]:
    """Calculate optimal chunk configuration"""
    if item_count > 5000:
        num_chunks = 20
    elif item_count > 1500:
        num_chunks = 12
    elif item_count > 800:
        num_chunks = 8
    elif item_count > 400:
        num_chunks = 4
    elif item_count > 150:
        num_chunks = 2
    else:
        num_chunks = 1

    items_per_chunk = math.ceil(item_count / num_chunks)
    return num_chunks, items_per_chunk


def create_chunks(items: List[ParsedItem], num_chunks: int, items_per_chunk: int) -> Dict[int, List[ParsedItem]]:
    """Split items into chunks"""
    chunks = {}
    for i in range(num_chunks):
        start = i * items_per_chunk
        end = min(start + items_per_chunk, len(items))
        chunks[i + 1] = items[start:end]
    return chunks


def escape_html(text: str) -> str:
    """Escape HTML special characters"""
    replacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }
    for char, escaped in replacements.items():
        text = text.replace(char, escaped)
    return text


def generate_standalone_html(title: str, items: List[ParsedItem]) -> str:
    """Generate standalone HTML player page"""
    clean_items = [
        {
            "title": item.title,
            "url": item.url,
            "thumb": item.thumb or "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect fill='%231a1a2e' width='320' height='180'/%3E%3Ctext x='160' y='90' fill='%2300f3ff' text-anchor='middle' dy='.3em' font-size='14' font-weight='bold'%3E📺%3C/text%3E%3C/svg%3E",
            "epg": item.epg or "Live Stream",
            "group": item.group or "Channel"
        }
        for item in items
    ]

    playlist_json = json.dumps(clean_items, indent=2)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">
  <title>{escape_html(title)}</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    html, body {{ width: 100%; height: 100%; background: #0b0e27; color: #00f3ff; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 500; overflow: hidden; }}
    body::before {{ content: ''; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle at 20% 50%, rgba(0, 243, 255, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(57, 255, 20, 0.02) 0%, transparent 50%); pointer-events: none; z-index: 0; }}
    #container {{ display: flex; flex-direction: column; width: 100%; height: 100%; position: relative; z-index: 1; }}
    #top-banner {{ background: rgba(11, 14, 39, 0.8); backdrop-filter: blur(12px); border-bottom: 2px solid rgba(0, 243, 255, 0.3); padding: 12px 20px; flex-shrink: 0; z-index: 100; box-shadow: 0 4px 20px rgba(0, 243, 255, 0.1); }}
    .banner-content {{ display: flex; justify-content: space-between; align-items: center; gap: 20px; max-width: 100%; font-size: 13px; font-weight: 600; }}
    .channel-info {{ flex: 1; min-width: 0; }}
    .channel-title {{ font-size: 16px; font-weight: bold; color: #00f3ff; margin-bottom: 4px; text-shadow: 0 0 8px rgba(0, 243, 255, 0.4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    .banner-info-line {{ font-size: 12px; color: rgba(0, 243, 255, 0.7); display: flex; gap: 12px; flex-wrap: wrap; }}
    .info-now {{ color: #00f3ff; font-weight: 600; }}
    .info-next {{ color: rgba(0, 243, 255, 0.6); }}
    #clock {{ font-size: 16px; font-weight: 900; color: #00f3ff; text-shadow: 0 0 10px rgba(0, 243, 255, 0.5); font-family: 'Courier New', monospace; letter-spacing: 2px; flex-shrink: 0; }}
    #player-container {{ flex: 1; position: relative; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; }}
    video {{ width: 100%; height: 100%; object-fit: contain; background: #000; }}
    #banner {{ position: fixed; top: 60px; left: 0; right: 0; background: linear-gradient(135deg, rgba(0, 243, 255, 0.15), rgba(57, 255, 20, 0.05)); backdrop-filter: blur(12px); border-bottom: 2px solid rgba(0, 243, 255, 0.2); padding: 16px 20px; z-index: 99; display: flex; gap: 16px; transition: opacity 0.3s, transform 0.3s; opacity: 0; pointer-events: none; transform: translateY(-100%); }}
    #banner.show {{ opacity: 1; pointer-events: auto; transform: translateY(0); }}
    #banner-thumb {{ width: 140px; height: 79px; object-fit: cover; border-radius: 6px; border: 2px solid rgba(0, 243, 255, 0.3); flex-shrink: 0; box-shadow: 0 0 15px rgba(0, 243, 255, 0.2); }}
    #banner-info {{ flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; }}
    #banner-title {{ font-size: 18px; font-weight: bold; color: #00f3ff; margin-bottom: 6px; text-shadow: 0 0 10px rgba(0, 243, 255, 0.3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    #banner-epg {{ font-size: 13px; color: #39ff14; opacity: 0.9; }}
    #playlist-panel {{ width: 100%; max-height: 180px; background: rgba(11, 14, 39, 0.95); border-top: 2px solid rgba(0, 243, 255, 0.2); overflow-y: auto; display: none; flex-shrink: 0; z-index: 50; }}
    #playlist-panel.show {{ display: flex; flex-direction: column; }}
    #playlist-list {{ display: flex; flex-direction: column; }}
    .playlist-item {{ padding: 10px 16px; border-bottom: 1px solid rgba(0, 243, 255, 0.1); cursor: pointer; transition: all 0.2s; display: flex; gap: 12px; align-items: center; }}
    .playlist-item:hover {{ background: rgba(0, 243, 255, 0.08); }}
    .playlist-item.active {{ background: rgba(0, 243, 255, 0.15); border-left: 3px solid #00f3ff; padding-left: 13px; }}
    .playlist-thumb {{ width: 56px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(0, 243, 255, 0.2); flex-shrink: 0; }}
    .playlist-info {{ flex: 1; min-width: 0; }}
    .playlist-title {{ font-size: 12px; color: #00f3ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }}
    .playlist-index {{ font-size: 11px; color: rgba(0, 243, 255, 0.5); }}
    #controls {{ position: fixed; bottom: 20px; right: 20px; display: flex; gap: 8px; z-index: 101; flex-wrap: wrap; justify-content: flex-end; }}
    button {{ padding: 8px 14px; background: rgba(0, 243, 255, 0.1); border: 1px solid rgba(0, 243, 255, 0.4); color: #00f3ff; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s; text-shadow: 0 0 5px rgba(0, 243, 255, 0.3); backdrop-filter: blur(10px); }}
    button:hover {{ background: rgba(0, 243, 255, 0.2); box-shadow: 0 0 20px rgba(0, 243, 255, 0.3); border-color: rgba(0, 243, 255, 0.6); }}
    button:active {{ transform: scale(0.95); }}
    #playlist-panel::-webkit-scrollbar {{ width: 6px; }}
    #playlist-panel::-webkit-scrollbar-track {{ background: rgba(0, 243, 255, 0.05); }}
    #playlist-panel::-webkit-scrollbar-thumb {{ background: rgba(0, 243, 255, 0.2); border-radius: 3px; }}
    @media (max-width: 768px) {{
      .banner-content {{ flex-direction: column; align-items: flex-start; gap: 8px; }}
      #clock {{ align-self: flex-end; margin-top: -32px; font-size: 14px; }}
      #banner {{ top: 80px; flex-direction: column; padding: 12px 16px; }}
      #banner-thumb {{ width: 100%; height: 100px; }}
      #controls {{ bottom: 10px; right: 10px; gap: 6px; }}
      button {{ padding: 6px 10px; font-size: 11px; }}
    }}
  </style>
</head>
<body>
  <div id="container">
    <div id="top-banner">
      <div class="banner-content">
        <div class="channel-info">
          <div class="channel-title">📺 {escape_html(title)}</div>
          <div class="banner-info-line">
            <span class="info-now">NOW: <span id="now-playing">Loading...</span></span>
            <span class="played-time">(<span id="played-time">0:00:00</span>)</span>
          </div>
          <div class="banner-info-line">
            <span class="info-next">UP NEXT: <span id="next-title">-</span> at <span id="next-time">--:--</span></span>
          </div>
        </div>
        <div id="clock">00:00:00</div>
      </div>
    </div>
    <div id="player-container">
      <div id="banner">
        <img id="banner-thumb" src="" alt="thumbnail">
        <div id="banner-info">
          <div id="banner-title">Loading...</div>
          <div id="banner-epg">EPG Info</div>
        </div>
      </div>
      <video id="player" autoplay playsinline controls></video>
    </div>
    <div id="playlist-panel">
      <div id="playlist-list"></div>
    </div>
  </div>
  <div id="controls">
    <button id="toggle-list">📋 PLAYLIST</button>
    <button id="prev-btn">◀ PREV</button>
    <button id="next-btn">NEXT ▶</button>
  </div>
  <script>
    const PLAYLIST = {playlist_json};
    let currentIndex = 0;
    const video = document.getElementById('player');
    const banner = document.getElementById('banner');
    const bannerTitle = document.getElementById('banner-title');
    const bannerEpg = document.getElementById('banner-epg');
    const bannerThumb = document.getElementById('banner-thumb');
    const playlistPanel = document.getElementById('playlist-panel');
    const playlistList = document.getElementById('playlist-list');
    const toggleBtn = document.getElementById('toggle-list');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const clock = document.getElementById('clock');
    const nowPlaying = document.getElementById('now-playing');
    const nextTitle = document.getElementById('next-title');
    const nextTime = document.getElementById('next-time');
    const playedTime = document.getElementById('played-time');

    function updateClock() {{
      const now = new Date();
      clock.textContent = now.toLocaleTimeString('en-US', {{hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}});
    }}
    updateClock();
    setInterval(updateClock, 1000);

    function formatTime(seconds) {{
      const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
      const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
      const s = Math.floor(seconds % 60).toString().padStart(2, '0');
      return `${{h}}:${{m}}:${{s}}`;
    }}

    function updateTopBanner() {{
      const item = PLAYLIST[currentIndex];
      if (item) {{
        nowPlaying.textContent = item.title;
        const nextIdx = (currentIndex + 1) % PLAYLIST.length;
        nextTitle.textContent = PLAYLIST[nextIdx].title;
      }}
    }}

    function showNowPlayingBanner() {{
      const item = PLAYLIST[currentIndex];
      if (item) {{
        bannerTitle.textContent = item.title;
        bannerEpg.textContent = item.epg;
        bannerThumb.src = item.thumb;
        banner.classList.add('show');
        setTimeout(() => banner.classList.remove('show'), 4000);
      }}
    }}

    function calculateNextTime() {{
      if (video.duration) {{
        const remaining = video.duration - video.currentTime;
        const nextStart = new Date(Date.now() + remaining * 1000);
        nextTime.textContent = nextStart.toLocaleTimeString('en-US', {{hour: '2-digit', minute: '2-digit', hour12: false}});
      }}
    }}

    video.addEventListener('timeupdate', () => {{
      playedTime.textContent = formatTime(video.currentTime);
      calculateNextTime();
    }});

    function updatePlaylist() {{
      playlistList.innerHTML = PLAYLIST.map((item, idx) => `
        <div class="playlist-item ${{idx === currentIndex ? 'active' : ''}}" onclick="jumpTo(${{idx}})">
          <img class="playlist-thumb" src="${{item.thumb}}" alt="${{item.title}}">
          <div class="playlist-info">
            <div class="playlist-title">${{item.title}}</div>
            <div class="playlist-index">#${{idx + 1}} • ${{item.group}}</div>
          </div>
        </div>
      `).join('');
    }}

    function jumpTo(index) {{
      currentIndex = Math.max(0, Math.min(index, PLAYLIST.length - 1));
      loadCurrent();
    }}

    function nextTrack() {{
      currentIndex = (currentIndex + 1) % PLAYLIST.length;
      loadCurrent();
    }}

    function prevTrack() {{
      currentIndex = (currentIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
      loadCurrent();
    }}

    function loadCurrent() {{
      if (PLAYLIST.length === 0) return;
      const item = PLAYLIST[currentIndex];
      if (item && item.url) {{
        video.src = item.url;
        video.play().catch(() => {{}});
        updatePlaylist();
        updateTopBanner();
        showNowPlayingBanner();
        playedTime.textContent = '0:00:00';
      }}
    }}

    video.addEventListener('ended', nextTrack);
    video.addEventListener('click', () => {{
      if (video.requestFullscreen) {{
        video.requestFullscreen();
      }} else if (video.webkitEnterFullscreen) {{
        video.webkitEnterFullscreen();
      }}
    }});

    toggleBtn.addEventListener('click', () => {{
      playlistPanel.classList.toggle('show');
    }});

    prevBtn.addEventListener('click', prevTrack);
    nextBtn.addEventListener('click', nextTrack);

    document.addEventListener('keydown', (e) => {{
      if (e.key === 'ArrowLeft') prevTrack();
      if (e.key === 'ArrowRight') nextTrack();
      if (e.key === ' ') {{
        e.preventDefault();
        video.paused ? video.play() : video.pause();
      }}
      if (e.key === 'p' || e.key === 'P') {{
        playlistPanel.classList.toggle('show');
      }}
    }});

    updatePlaylist();
    updateTopBanner();
    loadCurrent();
  </script>
</body>
</html>"""

    return html


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("=" * 70)
        print("NEXUS TV OS - Hybrid Playlist Extractor & Auto-Chunking Engine")
        print("=" * 70)
        print()
        print("USAGE:")
        print("  python nexus-tv-os.py <playlist_file>")
        print()
        print("SUPPORTED FORMATS:")
        print("  .m3u, .m3u8   - M3U playlists")
        print("  .csv          - CSV format")
        print("  .txt          - Text files with URLs")
        print("  .json         - JSON format")
        print("  .js           - JavaScript files")
        print()
        print("EXAMPLE:")
        print("  python nexus-tv-os.py playlist.m3u")
        print()
        print("OUTPUT:")
        print("  - output/extracted.json      (Extracted data)")
        print("  - output/chunks/             (Chunk files)")
        print("  - output/standalone/         (Generated HTML pages)")
        print("=" * 70)
        return

    file_path = sys.argv[1]

    if not os.path.exists(file_path):
        print(f"ERROR: File not found: {file_path}")
        return

    print(f"\n{'='*70}")
    print(f"NEXUS TV OS - Processing: {os.path.basename(file_path)}")
    print(f"{'='*70}\n")

    try:
        items = parse_playlist_file(file_path)
        print(f"✓ PARSED: {len(items)} items extracted\n")

        if len(items) == 0:
            print("ERROR: No items found in file")
            return

        num_chunks, items_per_chunk = calculate_chunks(len(items))
        chunks = create_chunks(items, num_chunks, items_per_chunk)
        print(f"✓ CHUNKING: {num_chunks} chunks ({items_per_chunk} items per chunk)\n")

        os.makedirs("output", exist_ok=True)
        os.makedirs("output/chunks", exist_ok=True)
        os.makedirs("output/standalone", exist_ok=True)

        extracted_json = [item.to_dict() for item in items]
        with open("output/extracted.json", "w", encoding="utf-8") as f:
            json.dump(extracted_json, f, indent=2)
        print(f"✓ SAVED: output/extracted.json ({len(items)} items)\n")

        for chunk_num, chunk_items in chunks.items():
            chunk_file = f"output/chunks/chunk_{chunk_num:02d}.js"
            chunk_data = [item.to_dict() for item in chunk_items]
            with open(chunk_file, "w", encoding="utf-8") as f:
                f.write(f"window.NEXUS_CHUNK_{chunk_num:02d} = {json.dumps(chunk_data, indent=2)};")
            print(f"  ✓ chunk_{chunk_num:02d}.js ({len(chunk_items)} items, ~{os.path.getsize(chunk_file)//1024}KB)")

        print()

        for chunk_num, chunk_items in chunks.items():
            if len(chunk_items) > 0:
                title = f"chunk_{chunk_num:02d}".replace("_", " ")
                html = generate_standalone_html(title, chunk_items)
                html_file = f"output/standalone/chunk_{chunk_num:02d}.html"
                with open(html_file, "w", encoding="utf-8") as f:
                    f.write(html)
                print(f"  ✓ chunk_{chunk_num:02d}.html (~{os.path.getsize(html_file)//1024}KB)")

        print(f"\n{'='*70}")
        print("✓ COMPLETE - All files generated successfully")
        print(f"{'='*70}")
        print(f"\nOUTPUT DIRECTORY: {os.path.abspath('output')}")
        print(f"\nFILES:")
        print(f"  • extracted.json         - All extracted items as JSON")
        print(f"  • chunks/                - Chunk data files")
        print(f"  • standalone/            - HTML player pages (OPEN IN BROWSER)")
        print(f"\nTO VIEW:")
        print(f"  Open any HTML file from 'standalone' folder in your web browser")
        print(f"  All files work 100% offline - no internet needed")
        print()

    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
