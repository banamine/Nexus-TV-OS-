#!/usr/bin/env python3
"""
NEXUS TV OS - GUI Application
Standalone Tkinter interface with real-time extraction preview
"""

import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
import tkinter.ttk as ttk
import json
import os
import sys
import re
import math
import webbrowser
from urllib.parse import unquote
from pathlib import Path
from typing import List, Dict, Any
import threading


class ParsedItem:
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
            "title": self.title, "url": self.url, "logo": self.logo, "thumb": self.thumb,
            "category": self.category, "lang": self.lang, "group": self.group,
            "quality": self.quality, "type": self.type, "epg": self.epg, "tags": self.tags
        }


def detect_stream_type(url: str) -> str:
    url_lower = url.lower()
    if ".m3u8" in url_lower: return "HLS"
    elif ".m3u" in url_lower: return "HLS"
    elif ".mpd" in url_lower: return "DASH"
    elif "rtmp" in url_lower: return "RTMP"
    elif ".mp4" in url_lower: return "MP4"
    elif ".mkv" in url_lower: return "MKV"
    return "STREAM"


def infer_quality(url: str) -> str:
    if "1080" in url: return "FHD"
    elif "720" in url: return "HD"
    elif "480" in url: return "SD"
    elif "4k" in url.lower(): return "UHD"
    return "HD"


def extract_title_from_url(url: str) -> str:
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
    items = []
    lines = content.split('\n')
    current_item = {}
    
    for line in lines:
        trimmed = line.strip()
        
        if trimmed.startswith("#EXTINF:"):
            match = re.match(r'#EXTINF:\s*-?\d+\s*,\s*(.+)', trimmed)
            if match:
                title = match.group(1).strip()
                current_item = {"title": title}
                
                logo_match = re.search(r'tvg-logo="([^"]+)"', trimmed)
                group_match = re.search(r'group-title="([^"]+)"', trimmed)
                
                if logo_match: current_item["logo"] = logo_match.group(1)
                if group_match: current_item["group"] = group_match.group(1)
        
        elif trimmed and not trimmed.startswith("#") and "://" in trimmed:
            if "title" in current_item:
                current_item["url"] = trimmed
                current_item["type"] = detect_stream_type(trimmed)
                current_item["quality"] = infer_quality(trimmed)
                items.append(ParsedItem(
                    title=current_item.get("title", "Untitled"),
                    url=current_item.get("url", ""),
                    logo=current_item.get("logo", ""),
                    group=current_item.get("group", ""),
                    quality=current_item.get("quality", "HD"),
                    item_type=current_item.get("type", "STREAM")
                ))
                current_item = {}
    
    return items


def parse_csv(content: str) -> List[ParsedItem]:
    items = []
    for line in content.split('\n'):
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"): continue
        
        parts = [p.strip() for p in trimmed.split(',')]
        url = ""
        for part in parts:
            if "://" in part:
                url = part
                break
        
        if url:
            title = extract_title_from_url(url)
            items.append(ParsedItem(
                title=title, url=url, item_type=detect_stream_type(url),
                quality=infer_quality(url)
            ))
    
    return items


def parse_json(content: str) -> List[ParsedItem]:
    items = []
    try:
        data = json.loads(content)
        if isinstance(data, list):
            for entry in data:
                if isinstance(entry, str) and "://" in entry:
                    items.append(ParsedItem(title=entry, url=entry, item_type=detect_stream_type(entry)))
                elif isinstance(entry, dict) and ("url" in entry or "link" in entry):
                    url = entry.get("url") or entry.get("link")
                    items.append(ParsedItem(
                        title=entry.get("title") or entry.get("name") or url or "Untitled",
                        url=url, logo=entry.get("logo") or entry.get("thumb", ""),
                        group=entry.get("group") or entry.get("category", ""),
                        item_type=detect_stream_type(url)
                    ))
    except: pass
    return items


def parse_file(file_path: str) -> List[ParsedItem]:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        with open(file_path, 'r', encoding='latin-1') as f:
            content = f.read()
    
    ext = Path(file_path).suffix.lower()
    if ext in ['.m3u', '.m3u8']: return parse_m3u(content)
    elif ext == '.json': return parse_json(content)
    elif ext in ['.csv', '.txt']: return parse_csv(content)
    else: return parse_csv(content)


def generate_html(title: str, items: List[ParsedItem]) -> str:
    clean_items = [{
        "title": item.title, "url": item.url,
        "thumb": item.thumb or "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect fill='%231a1a2e' width='320' height='180'/%3E%3Ctext x='160' y='90' fill='%2300f3ff' text-anchor='middle' dy='.3em' font-size='14'%3E📺%3C/text%3E%3C/svg%3E",
        "epg": item.epg or "Live Stream", "group": item.group or "Channel"
    } for item in items]
    
    playlist_json = json.dumps(clean_items, indent=2)
    
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title><style>*{{margin:0;padding:0;box-sizing:border-box}}html,body{{width:100%;height:100%;background:#0b0e27;color:#00f3ff;font-family:Arial,sans-serif;overflow:hidden}}#container{{display:flex;flex-direction:column;width:100%;height:100%}}#banner{{background:rgba(11,14,39,0.9);border-bottom:2px solid rgba(0,243,255,0.3);padding:15px 20px;flex-shrink:0}}#banner h1{{font-size:18px;color:#00f3ff;margin:0}}#player-container{{flex:1;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}}video{{width:100%;height:100%;object-fit:contain}}#controls{{position:fixed;bottom:20px;right:20px;display:flex;gap:10px;z-index:100}}button{{padding:8px 14px;background:rgba(0,243,255,0.2);border:1px solid rgba(0,243,255,0.5);color:#00f3ff;border-radius:5px;cursor:pointer;font-weight:bold;transition:all 0.2s}}button:hover{{background:rgba(0,243,255,0.4);box-shadow:0 0 15px rgba(0,243,255,0.3)}}#playlist{{position:fixed;bottom:80px;right:20px;width:300px;max-height:400px;background:rgba(11,14,39,0.95);border:2px solid rgba(0,243,255,0.3);border-radius:5px;overflow-y:auto;display:none;z-index:99}}.item{{padding:8px;border-bottom:1px solid rgba(0,243,255,0.1);cursor:pointer;font-size:12px}}.item:hover{{background:rgba(0,243,255,0.1)}}.item.active{{background:rgba(0,243,255,0.2);border-left:3px solid #00f3ff}}</style></head><body><div id="container"><div id="banner"><h1>📺 {title} - {len(clean_items)} Items</h1></div><div id="player-container"><video id="player" autoplay controls></video></div><div id="playlist"></div><div id="controls"><button onclick="togglePlaylist()">📋 LIST</button><button onclick="prevTrack()">◀ PREV</button><button onclick="nextTrack()">NEXT ▶</button></div></div><script>const PLAYLIST={playlist_json};let idx=0;const video=document.getElementById('player');function load(){{if(PLAYLIST.length===0)return;const item=PLAYLIST[idx];video.src=item.url;video.play().catch(()=>{{}})}};function nextTrack(){{idx=(idx+1)%PLAYLIST.length;load();updateList()}};function prevTrack(){{idx=(idx-1+PLAYLIST.length)%PLAYLIST.length;load();updateList()}};function togglePlaylist(){{document.getElementById('playlist').style.display=document.getElementById('playlist').style.display==='none'?'block':'none'}};function updateList(){{document.getElementById('playlist').innerHTML=PLAYLIST.map((item,i)=>`<div class="item ${{i===idx?'active':''}}" onclick="idx=${{i}};load();updateList()">${{item.title}}</div>`).join('')}};video.addEventListener('ended',nextTrack);load();updateList();</script></body></html>"""


class NexusTVOSGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("🎬 NEXUS TV OS - Standalone GUI")
        self.root.geometry("1200x700")
        self.root.configure(bg="#0b0e27")
        
        self.items = []
        self.output_dir = Path("output").absolute()
        self.output_dir.mkdir(exist_ok=True)
        (self.output_dir / "standalone").mkdir(exist_ok=True)
        
        self.build_ui()
    
    def build_ui(self):
        main_frame = tk.Frame(self.root, bg="#0b0e27")
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        title_label = tk.Label(main_frame, text="🎬 NEXUS TV OS - Playlist Extractor", 
                              font=("Arial", 16, "bold"), bg="#0b0e27", fg="#00f3ff")
        title_label.pack(pady=10)
        
        button_frame = tk.Frame(main_frame, bg="#0b0e27")
        button_frame.pack(fill=tk.X, pady=5)
        
        tk.Button(button_frame, text="📂 SELECT FILE", command=self.select_file,
                 bg="#00f3ff", fg="#000", font=("Arial", 10, "bold"), padx=15, pady=8).pack(side=tk.LEFT, padx=5)
        
        self.file_label = tk.Label(button_frame, text="No file selected", 
                                   bg="#0b0e27", fg="#39ff14", font=("Arial", 10))
        self.file_label.pack(side=tk.LEFT, padx=10)
        
        info_frame = tk.LabelFrame(main_frame, text="📊 EXTRACTION RESULTS", 
                                  bg="#0b0e27", fg="#00f3ff", font=("Arial", 10, "bold"))
        info_frame.pack(fill=tk.X, pady=10)
        
        self.info_text = tk.Label(info_frame, text="Ready to extract", 
                                 bg="#0b0e27", fg="#00f3ff", font=("Arial", 10),
                                 justify=tk.LEFT)
        self.info_text.pack(padx=10, pady=10, anchor="w")
        
        list_frame = tk.LabelFrame(main_frame, text="📋 EXTRACTED ITEMS", 
                                  bg="#0b0e27", fg="#00f3ff", font=("Arial", 10, "bold"))
        list_frame.pack(fill=tk.BOTH, expand=True, pady=10)
        
        self.tree = ttk.Treeview(list_frame, columns=("Title", "URL", "Type"), height=15)
        self.tree.column("#0", width=0, stretch=tk.NO)
        self.tree.column("Title", anchor=tk.W, width=300)
        self.tree.column("URL", anchor=tk.W, width=500)
        self.tree.column("Type", anchor=tk.CENTER, width=80)
        
        self.tree.heading("#0", text="", anchor=tk.W)
        self.tree.heading("Title", text="TITLE", anchor=tk.W)
        self.tree.heading("URL", text="URL", anchor=tk.W)
        self.tree.heading("Type", text="TYPE", anchor=tk.CENTER)
        
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscroll=scrollbar.set)
        
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        action_frame = tk.Frame(main_frame, bg="#0b0e27")
        action_frame.pack(fill=tk.X, pady=10)
        
        tk.Button(action_frame, text="⚡ GENERATE HTML", command=self.generate_html,
                 bg="#39ff14", fg="#000", font=("Arial", 10, "bold"), padx=15, pady=8).pack(side=tk.LEFT, padx=5)
        
        tk.Button(action_frame, text="🌐 OPEN IN BROWSER", command=self.open_html,
                 bg="#00f3ff", fg="#000", font=("Arial", 10, "bold"), padx=15, pady=8).pack(side=tk.LEFT, padx=5)
        
        self.progress = ttk.Progressbar(action_frame, length=300, mode='indeterminate')
        self.progress.pack(side=tk.LEFT, padx=20)
    
    def select_file(self):
        file_path = filedialog.askopenfilename(
            title="Select Playlist File",
            filetypes=[("All Playlists", "*.m3u *.m3u8 *.csv *.json *.txt"), ("All Files", "*.*")]
        )
        
        if not file_path:
            return
        
        self.file_label.config(text=f"Processing: {Path(file_path).name}")
        self.progress.start()
        self.root.update()
        
        threading.Thread(target=self._process_file, args=(file_path,), daemon=True).start()
    
    def _process_file(self, file_path: str):
        try:
            self.items = parse_file(file_path)
            
            self.root.after(0, self._update_results)
        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("Error", f"Failed to parse: {str(e)}"))
        finally:
            self.root.after(0, self.progress.stop)
    
    def _update_results(self):
        self.file_label.config(text=f"✓ Extracted {len(self.items)} items", fg="#39ff14")
        
        info_text = f"Total Items: {len(self.items)}\n"
        groups = set(item.group for item in self.items if item.group)
        types = set(item.type for item in self.items if item.type)
        info_text += f"Groups: {len(groups)} | Types: {', '.join(sorted(types))}"
        self.info_text.config(text=info_text)
        
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        for item in self.items:
            self.tree.insert("", "end", values=(item.title[:50], item.url[:70], item.type))
    
    def generate_html(self):
        if not self.items:
            messagebox.showwarning("Warning", "No items extracted. Select a file first.")
            return
        
        title = "NEXUS TV OS Playlist"
        html = generate_html(title, self.items)
        
        output_file = self.output_dir / "standalone" / "playlist.html"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(html)
        
        self.output_file = str(output_file)
        messagebox.showinfo("Success", f"HTML generated!\n\n{output_file}\n\nItems: {len(self.items)}")
    
    def open_html(self):
        if hasattr(self, 'output_file') and os.path.exists(self.output_file):
            webbrowser.open(f"file://{self.output_file}")
        else:
            messagebox.showwarning("Warning", "Generate HTML first")


if __name__ == "__main__":
    root = tk.Tk()
    app = NexusTVOSGUI(root)
    root.mainloop()
