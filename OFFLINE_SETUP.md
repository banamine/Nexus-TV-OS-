# 🎬 Nexus TV OS - Offline Standalone Application

Run the **complete Nexus TV OS application** on your local computer with zero internet connection needed!

## What You Get

✅ Full file upload interface  
✅ Hybrid playlist parser (supports .m3u, .json, .txt, .js)  
✅ Auto-chunking system  
✅ Standalone HTML page generator  
✅ Real-time clock & EPG tracking  
✅ Professional Nexus TV OS GUI  
✅ ZIP download with embedded assets  

## Prerequisites

You need **Node.js** installed on your computer:

### Windows
1. Download from: https://nodejs.org/
2. Choose "LTS" version
3. Run the installer and follow steps
4. Restart your computer

### Mac
1. Download from: https://nodejs.org/
2. Choose "LTS" version for Mac
3. Run the installer
4. Follow steps

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install nodejs npm
```

## Installation & Setup

### Step 1: Extract the Files
1. Download `nexus-tv-os-offline.zip`
2. Extract to any folder on your computer

### Step 2: Run the Application

**Windows Users:**
1. Double-click `start-windows.bat`
2. A terminal will appear and start the server
3. Wait for message: "Server running on http://localhost:5000"

**Mac Users:**
1. Open Terminal
2. Navigate to the extracted folder
3. Run: `bash start-mac-linux.sh`

**Linux Users:**
1. Open Terminal
2. Navigate to the extracted folder
3. Run: `bash start-mac-linux.sh`

### Step 3: Open in Browser
1. Once the server starts, open your browser
2. Go to: **http://localhost:5000**
3. You should see the Nexus TV OS interface

## How to Use

### Upload Files
1. Click **"Upload Playlist"** tab
2. Drag & drop or select a playlist file (.m3u, .json, .txt, .js)
3. System auto-parses and chunks the file
4. Output files generated to local `/output/` folder

### Generate Standalone Pages
1. Go to **"Workbench"** tab
2. Select a chunk file
3. (Optional) Add custom title
4. Click **"GENERATE STANDALONE PAGE"**
5. Page is generated in `/output/standalone/`

### Download & Use Offline
1. Go to **"Generated Pages"** tab
2. Click **"ZIP"** button
3. Download the complete package
4. Extract ZIP anywhere
5. Open the `.html` file in any browser
6. **Works completely offline!** 🎉

## Stopping the Server

Press `Ctrl+C` in the terminal to stop the application.

## Troubleshooting

### "Node.js is not installed"
- Install Node.js from https://nodejs.org/
- Restart your computer
- Run the start script again

### "Port 5000 already in use"
- Another app is using port 5000
- Either close that app or restart your computer
- Then try again

### Browser shows "Cannot connect"
- Make sure the terminal is still running (didn't close)
- Check the terminal shows "Server running on http://localhost:5000"
- Try refreshing the browser (Ctrl+R or Cmd+R)

## Features & Shortcuts

### Playlist Upload
- Supports all formats: .m3u, .json, .txt, .js
- Auto-detects format and extracts URLs
- Generates optimized chunks automatically

### Workbench
- Select chunks and customize page titles
- Real-time generation with progress indicator
- Download as ZIP with all assets

### Generated Pages
- Each page includes embedded playlist
- Professional Nexus TV OS aesthetic
- Full keyboard controls (arrows, spacebar, P)
- Real-time clock and EPG tracking
- Works on any device (desktop, tablet, mobile)

## File Structure

```
nexus-tv-os-offline/
├── start-windows.bat        ← Run this on Windows
├── start-mac-linux.sh       ← Run this on Mac/Linux
├── package.json
├── server/                  ← Backend code
├── client/                  ← Frontend code
├── output/                  ← Generated files (created automatically)
│   ├── chunks/              ← Chunk files
│   └── standalone/          ← Generated HTML pages
└── OFFLINE_SETUP.md         ← This file
```

## Output Files

All generated files are saved to the local `/output/` folder:

- **chunks/** - JavaScript chunk files with your playlist data
- **standalone/** - Complete HTML pages ready to open in browser

You can share these files via email, USB drive, or cloud storage!

## Security & Privacy

✅ **100% offline** - No data sent anywhere  
✅ **No tracking** - No analytics or telemetry  
✅ **Your files stay local** - Everything runs on your computer  
✅ **Works without internet** - Perfect for secure environments  

## Questions?

Need help? Check that:
1. Node.js is properly installed (`node --version` in terminal)
2. The start script doesn't show any errors
3. You can access http://localhost:5000 in your browser
4. The terminal stays open while using the app

---

**Enjoy your offline Nexus TV OS! 🎬**
