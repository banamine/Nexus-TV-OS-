# 🎬 Nexus TV OS - Standalone Python Application

Pure Python standalone GUI application. No dependencies, no server, no web framework needed.

## Requirements

- **Python 3.6+** (tkinter is included with Python)

## How to Run

### Windows
```
python nexus-tv-os.py
```

### Mac/Linux
```
python3 nexus-tv-os.py
```

## Features

✅ **No dependencies** - Pure Python tkinter GUI  
✅ **Standalone** - No web server, no internet needed  
✅ **Upload playlists** - Supports .m3u, .json, .txt, .js formats  
✅ **Auto-chunking** - Splits large playlists intelligently  
✅ **Generate pages** - Creates standalone HTML players  
✅ **Download ZIP** - Package files for sharing  
✅ **Local storage** - All files in `/output/` directory  

## File Formats Supported

- **.m3u/.m3u8** - M3U playlist format (most common)
- **.json** - JSON array of items with `title` and `url`
- **.txt** - One URL per line
- **.js** - JavaScript file containing JSON array

## Usage

1. **Upload Tab** - Select a playlist file
2. **Workbench Tab** - Select chunk and generate page
3. **Generated Pages Tab** - View, open, or download pages

## Output Files

All files stored in `/output/` folder:
- `chunks/` - JSON chunk files
- `standalone/` - Generated HTML pages

## Keyboard Controls (in generated pages)

- `←/→` Arrow keys - Previous/Next channel
- `Space` - Play/Pause
- `P` - Toggle playlist panel
- Click video - Fullscreen

## No Installation Needed

Just run the Python file. Everything works locally on your computer.
