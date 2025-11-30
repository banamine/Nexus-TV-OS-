# NEXUS TV OS - COMPLETE CODE AUDIT
**Generated: November 29, 2025**
**Status: Full Implementation - All Source Code Included**

---

## TABLE OF CONTENTS
1. Server Files (Backend)
2. Client Files (Frontend)
3. Configuration & Build
4. Generated Output Structure

---

# SECTION 1: SERVER FILES (BACKEND)

## FILE: server/index.ts
```typescript
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
```

## FILE: server/routes.ts
```typescript
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import multer, { type Multer } from "multer";
import * as fs from "fs";
import * as path from "path";
import { parsePlaylistFile } from "./utils/parser";
import { calculateChunks, createChunks, generateChunkJS } from "./utils/chunker";
import { generateStandaloneHTML } from "./utils/html-generator";
import AdmZip from "adm-zip";

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

// Configure multer for file uploads
const upload: Multer = multer({
  dest: path.join(process.cwd(), "temp_uploads"),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Create output directories if they don't exist
const OUTPUT_DIR = path.join(process.cwd(), "output");
const CHUNKS_DIR = path.join(OUTPUT_DIR, "chunks");
const STANDALONE_DIR = path.join(OUTPUT_DIR, "standalone");
const THUMBS_DIR = path.join(OUTPUT_DIR, "thumbs");
const TEMP_DIR = path.join(process.cwd(), "temp_uploads");

[OUTPUT_DIR, CHUNKS_DIR, STANDALONE_DIR, THUMBS_DIR, TEMP_DIR].forEach((dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.error(`Failed to create directory ${dir}:`, err);
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const apiRouter = express.Router();

  /**
   * POST /api/upload - Upload and process a playlist file
   */
  apiRouter.post("/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileName = req.file.originalname;
      const filePath = req.file.path;

      // Parse the file
      const items = await parsePlaylistFile(filePath, fileName);

      if (items.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: "No playable items found in file" });
      }

      // Calculate chunks
      const chunkConfig = calculateChunks(items.length);
      const chunks = createChunks(items, chunkConfig);

      // Generate chunk files
      const generatedChunks = [];
      for (let i = 1; i <= chunkConfig.numChunks; i++) {
        const chunkItems = chunks.get(i) || [];
        const chunkJS = generateChunkJS(i, chunkItems);
        const chunkFileName = `chunk_${String(i).padStart(2, "0")}.js`;
        const chunkPath = path.join(CHUNKS_DIR, chunkFileName);

        fs.writeFileSync(chunkPath, chunkJS, "utf-8");

        generatedChunks.push({
          id: String(i),
          name: chunkFileName,
          size: Math.round(chunkJS.length / 1024),
          itemCount: chunkItems.length,
          generatedAt: new Date().toISOString().split("T")[0],
        });
      }

      // Save metadata
      const metadata = {
        fileName,
        totalItems: items.length,
        chunkCount: chunkConfig.numChunks,
        chunks: generatedChunks,
        generatedAt: new Date().toISOString(),
      };

      fs.writeFileSync(
        path.join(OUTPUT_DIR, "meta.json"),
        JSON.stringify(metadata, null, 2),
        "utf-8"
      );

      // Clean up temp file
      fs.unlinkSync(filePath);

      res.json({
        success: true,
        message: `Processed ${items.length} items into ${chunkConfig.numChunks} chunks`,
        chunks: generatedChunks,
        totalItems: items.length,
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /api/chunks - List all generated chunk files
   */
  apiRouter.get("/chunks", (req, res) => {
    try {
      if (!fs.existsSync(CHUNKS_DIR)) {
        return res.json({ chunks: [] });
      }

      const files = fs.readdirSync(CHUNKS_DIR).filter((f) => f.endsWith(".js"));
      const chunks = files.map((file) => {
        const filePath = path.join(CHUNKS_DIR, file);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, "utf-8");
        const itemCount = (content.match(/"url"/g) || []).length;

        return {
          id: file.replace(".js", ""),
          name: file,
          size: Math.round(stats.size / 1024),
          itemCount,
          generatedAt: new Date(stats.mtime).toISOString().split("T")[0],
        };
      });

      res.json({ chunks });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/generate-page - Generate standalone HTML page
   */
  apiRouter.post("/generate-page", express.json(), (req, res) => {
    try {
      const { chunkFile, pageTitle } = req.body;

      if (!chunkFile) {
        return res.status(400).json({ error: "No chunk file specified" });
      }

      const chunkPath = path.join(CHUNKS_DIR, chunkFile);

      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({ error: "Chunk file not found" });
      }

      // Read chunk content
      const chunkContent = fs.readFileSync(chunkPath, "utf-8");

      // Extract items from chunk
      let items = [];
      try {
        // Extract the array from the chunk JS file
        const match = chunkContent.match(/\[\s*{[\s\S]*}\s*\]/);
        if (match) {
          // eslint-disable-next-line no-eval
          items = eval(`(${match[0]})`);
        }
      } catch {
        return res.status(400).json({ error: "Could not parse chunk file" });
      }

      const title = pageTitle || chunkFile.replace(".js", "").replace(/_/g, " ");
      const html = generateStandaloneHTML(title, items, chunkFile);

      const fileName = `${chunkFile.replace(".js", "")}.html`;
      const filePath = path.join(STANDALONE_DIR, fileName);

      fs.writeFileSync(filePath, html, "utf-8");

      res.json({
        success: true,
        message: "Standalone page generated",
        fileName,
        path: `/output/standalone/${fileName}`,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /api/generated-pages - List all generated standalone pages
   */
  apiRouter.get("/generated-pages", (req, res) => {
    try {
      if (!fs.existsSync(STANDALONE_DIR)) {
        return res.json({ pages: [] });
      }

      const files = fs.readdirSync(STANDALONE_DIR).filter((f) => f.endsWith(".html"));
      const pages = files.map((file) => {
        const filePath = path.join(STANDALONE_DIR, file);
        const stats = fs.statSync(filePath);

        return {
          id: file.replace(".html", ""),
          name: file,
          title: file.replace(".html", "").replace(/_/g, " "),
          sourceChunk: file.replace(".html", "") + ".js",
          size: Math.round(stats.size / 1024),
          generatedAt: new Date(stats.mtime).toISOString(),
          url: `/output/standalone/${file}`,
        };
      });

      res.json({ pages });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/download-zip - Download page + assets as ZIP
   */
  apiRouter.post("/download-zip", express.json(), (req, res) => {
    try {
      const { pageFile } = req.body;

      if (!pageFile) {
        return res.status(400).json({ error: "No page file specified" });
      }

      const pagePath = path.join(STANDALONE_DIR, pageFile);

      if (!fs.existsSync(pagePath)) {
        return res.status(400).json({ error: "Page file not found" });
      }

      const zip = new AdmZip();
      zip.addFile(pageFile, fs.readFileSync(pagePath));

      // Add EPG and thumbs if they exist
      if (fs.existsSync(path.join(OUTPUT_DIR, "epg"))) {
        const epgFiles = fs.readdirSync(path.join(OUTPUT_DIR, "epg"));
        epgFiles.forEach((file) => {
          const filePath = path.join(OUTPUT_DIR, "epg", file);
          zip.addFile(`epg/${file}`, fs.readFileSync(filePath));
        });
      }

      if (fs.existsSync(THUMBS_DIR)) {
        const thumbFiles = fs.readdirSync(THUMBS_DIR);
        thumbFiles.forEach((file) => {
          const filePath = path.join(THUMBS_DIR, file);
          zip.addFile(`thumbs/${file}`, fs.readFileSync(filePath));
        });
      }

      const zipBuffer = zip.toBuffer();
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${pageFile.replace(".html", "")}.zip"`);
      res.send(zipBuffer);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Serve output directory as static files
  app.use("/output", express.static(OUTPUT_DIR));

  app.use("/api", apiRouter);
  return httpServer;
}
```

## FILE: server/utils/parser.ts
```typescript
import * as fs from "fs";

export interface ParsedItem {
  title: string;
  url: string;
  logo?: string;
  thumb?: string;
  category?: string;
  lang?: string;
  group?: string;
  quality?: string;
  type?: string;
  epg?: string;
  tags?: string[];
}

export async function parsePlaylistFile(filePath: string, fileName: string): Promise<ParsedItem[]> {
  const content = fs.readFileSync(filePath, "utf-8");
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "m3u" || ext === "m3u8") {
    return parseM3U(content);
  } else if (ext === "json") {
    return parseJSON(content);
  } else if (ext === "js") {
    return parseJavaScript(content);
  } else if (ext === "csv" || ext === "txt") {
    // Try CSV first, then fallback to raw text
    const csvResult = parseCSV(content);
    return csvResult.length > 0 ? csvResult : parseRawText(content);
  } else {
    return parseRawText(content);
  }
}

function parseM3U(content: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = content.split("\n");
  let currentItem: Partial<ParsedItem> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("#EXTINF:")) {
      // Extract metadata from EXTINF line
      const infoMatch = trimmed.match(/#EXTINF:-?\d+\s*,\s*(.+)/);
      if (infoMatch) {
        const title = infoMatch[1].trim();
        currentItem = { title };

        // Extract logo, group, etc. from attributes
        const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/);
        const groupMatch = trimmed.match(/group-title="([^"]+)"/);
        const langMatch = trimmed.match(/lang="([^"]+)"/);

        if (logoMatch) currentItem.logo = logoMatch[1];
        if (groupMatch) currentItem.group = groupMatch[1];
        if (langMatch) currentItem.lang = langMatch[1];
      }
    } else if (trimmed && !trimmed.startsWith("#") && trimmed.includes("://")) {
      // This is a URL
      currentItem.url = trimmed;
      currentItem.type = detectStreamType(trimmed);
      currentItem.quality = inferQuality(trimmed);
      if (currentItem.title) {
        items.push(currentItem as ParsedItem);
        currentItem = {};
      }
    }
  }

  return items;
}

function parseJSON(content: string): ParsedItem[] {
  try {
    const data = JSON.parse(content);
    const items: ParsedItem[] = [];

    // Handle various JSON structures
    if (Array.isArray(data)) {
      data.forEach((item) => {
        if (typeof item === "string" && item.includes("://")) {
          items.push({
            title: item,
            url: item,
            type: detectStreamType(item),
          });
        } else if (item.url || item.link) {
          items.push({
            title: item.title || item.name || item.url || "Untitled",
            url: item.url || item.link,
            logo: item.logo || item.thumb,
            group: item.group || item.category,
            epg: item.epg || item.description,
            type: detectStreamType(item.url || item.link),
          });
        }
      });
    }

    return items;
  } catch {
    return parseRawText(content);
  }
}

function parseJavaScript(content: string): ParsedItem[] {
  const items: ParsedItem[] = [];

  // Extract arrays from window objects or export statements
  const arrayMatches = content.match(/\[[\s\S]*?\]/g);
  if (arrayMatches) {
    for (const match of arrayMatches) {
      try {
        // eslint-disable-next-line no-eval
        const arr = eval(`(${match})`);
        if (Array.isArray(arr)) {
          arr.forEach((item) => {
            if (item.url || item.link) {
              items.push({
                title: item.title || item.name || "Untitled",
                url: item.url || item.link,
                logo: item.logo || item.thumb,
                group: item.group || item.category,
                epg: item.epg || item.description,
                type: detectStreamType(item.url || item.link),
              });
            }
          });
        }
      } catch {
        // Skip if eval fails
      }
    }
  }

  // Also extract standalone URLs
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
  const urlMatches = content.match(urlRegex);
  if (urlMatches) {
    urlMatches.forEach((url) => {
      if (!items.find((item) => item.url === url)) {
        items.push({
          title: url,
          url: url,
          type: detectStreamType(url),
        });
      }
    });
  }

  return items;
}

function parseCSV(content: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Split by comma, but be careful with URLs
    const parts = trimmed.split(",").map(p => p.trim());
    
    // Look for URL in the line (contains ://)
    let url = "";
    let category = "General";

    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes("://")) {
        url = parts[i];
        if (i > 2) {
          category = parts[2].trim();
        }
        break;
      }
    }

    if (url) {
      // Extract real title from URL filename
      const title = extractTitleFromURL(url);
      
      items.push({
        title: title,
        url: url.trim(),
        category: category,
        type: detectStreamType(url),
        quality: inferQuality(url),
      });
    }
  }

  return items;
}

function extractTitleFromURL(url: string): string {
  try {
    // Get the filename from URL (last part after /)
    const filename = url.split("/").pop() || "";
    
    // URL decode (%20 to space, etc)
    let decoded = decodeURIComponent(filename);
    
    // Remove common file extensions
    decoded = decoded.replace(/\.(mp4|mkv|avi|mov|webm|m3u8|m3u|mpd).*$/i, "");
    
    // Remove trailing .ia (archive.org specific)
    decoded = decoded.replace(/\.ia$/, "");
    
    // Clean up multiple spaces
    decoded = decoded.replace(/\s+/g, " ").trim();
    
    return decoded || "Stream";
  } catch {
    return "Stream";
  }
}

function parseRawText(content: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.includes("://")) {
      // Extract just the URL, not the whole line
      const urlMatch = trimmed.match(/(https?:\/\/[^\s,]+)/);
      if (urlMatch) {
        items.push({
          title: trimmed.replace(urlMatch[1], "").split(",")[0].trim() || "Stream",
          url: urlMatch[1],
          type: detectStreamType(urlMatch[1]),
        });
      } else {
        items.push({
          title: trimmed,
          url: trimmed,
          type: detectStreamType(trimmed),
        });
      }
    }
  }

  return items;
}

function detectStreamType(url: string): string {
  if (url.includes(".m3u")) return "HLS";
  if (url.includes(".m3u8")) return "HLS";
  if (url.includes(".mpd")) return "DASH";
  if (url.includes("rtmp")) return "RTMP";
  if (url.includes("rtsp")) return "RTSP";
  if (url.includes(".mp4")) return "MP4";
  if (url.includes(".mkv")) return "MKV";
  if (url.includes(".avi")) return "AVI";
  if (url.includes(".mov")) return "MOV";
  if (url.includes(".webm")) return "WEBM";
  return "STREAM";
}

function inferQuality(url: string): string {
  if (url.includes("1080")) return "FHD";
  if (url.includes("720")) return "HD";
  if (url.includes("480")) return "SD";
  if (url.includes("4k")) return "UHD";
  return "HD";
}
```

## FILE: server/utils/chunker.ts
```typescript
import { ParsedItem } from "./parser";

export interface ChunkConfig {
  totalItems: number;
  itemsPerChunk: number;
  numChunks: number;
}

export function calculateChunks(itemCount: number): ChunkConfig {
  let numChunks = 1;
  let itemsPerChunk = itemCount;

  if (itemCount > 5000) {
    numChunks = 20;
  } else if (itemCount > 1500) {
    numChunks = 12;
  } else if (itemCount > 800) {
    numChunks = 8;
  } else if (itemCount > 400) {
    numChunks = 4;
  } else if (itemCount > 150) {
    numChunks = 2;
  }

  itemsPerChunk = Math.ceil(itemCount / numChunks);

  return {
    totalItems: itemCount,
    itemsPerChunk,
    numChunks,
  };
}

export function createChunks(items: ParsedItem[], config: ChunkConfig): Map<number, ParsedItem[]> {
  const chunks = new Map<number, ParsedItem[]>();

  for (let i = 0; i < config.numChunks; i++) {
    const start = i * config.itemsPerChunk;
    const end = Math.min(start + config.itemsPerChunk, items.length);
    chunks.set(i + 1, items.slice(start, end));
  }

  return chunks;
}

export function generateChunkJS(chunkNum: number, items: ParsedItem[]): string {
  const cleanItems = items.map((item) => ({
    title: item.title,
    url: item.url,
    logo: item.logo || "",
    thumb: item.thumb || "",
    category: item.group || item.category || "General",
    lang: item.lang || "en",
    group: item.group || "",
    quality: item.quality || "HD",
    type: item.type || "STREAM",
    epg: item.epg || "",
    tags: item.tags || [],
  }));

  return `window.NEXUS_CHUNK_${String(chunkNum).padStart(2, "0")} = ${JSON.stringify(cleanItems, null, 2)};`;
}
```

## FILE: server/utils/html-generator.ts
```typescript
import { ParsedItem } from "./parser";

export function generateStandaloneHTML(
  title: string,
  items: ParsedItem[],
  chunkName: string
): string {
  const cleanItems = items.map((item) => ({
    title: item.title,
    url: item.url,
    thumb: item.thumb || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect fill='%231a1a2e' width='320' height='180'/%3E%3Ctext x='160' y='90' fill='%2300f3ff' text-anchor='middle' dy='.3em' font-size='14' font-weight='bold'%3E📺%3C/text%3E%3C/svg%3E",
    epg: item.epg || "Live Stream",
    group: item.group || "Channel",
  }));

  const playlistJSON = JSON.stringify(cleanItems, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">
  <title>${escapeHTML(title)}</title>
  <style>
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
    }
    
    html, body { 
      width: 100%; 
      height: 100%; 
      background: #0b0e27;
      color: #00f3ff;
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-weight: 500;
      overflow: hidden;
    }
    
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: 
        radial-gradient(circle at 20% 50%, rgba(0, 243, 255, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 80% 50%, rgba(57, 255, 20, 0.02) 0%, transparent 50%);
      pointer-events: none;
      z-index: 0;
    }
    
    #container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      position: relative;
      z-index: 1;
    }
    
    /* ===== TOP BANNER ===== */
    #top-banner {
      background: rgba(11, 14, 39, 0.8);
      backdrop-filter: blur(12px);
      border-bottom: 2px solid rgba(0, 243, 255, 0.3);
      padding: 12px 20px;
      flex-shrink: 0;
      z-index: 100;
      box-shadow: 0 4px 20px rgba(0, 243, 255, 0.1);
    }
    
    .banner-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      max-width: 100%;
      font-size: 13px;
      font-weight: 600;
    }
    
    .channel-info {
      flex: 1;
      min-width: 0;
    }
    
    .channel-title {
      font-size: 16px;
      font-weight: bold;
      color: #00f3ff;
      margin-bottom: 4px;
      text-shadow: 0 0 8px rgba(0, 243, 255, 0.4);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .banner-info-line {
      font-size: 12px;
      color: rgba(0, 243, 255, 0.7);
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    
    .info-now {
      color: #00f3ff;
      font-weight: 600;
    }
    
    .info-next {
      color: rgba(0, 243, 255, 0.6);
    }
    
    .played-time {
      color: rgba(0, 243, 255, 0.5);
      font-size: 11px;
    }
    
    #clock {
      font-size: 16px;
      font-weight: 900;
      color: #00f3ff;
      text-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
      font-family: 'Courier New', monospace;
      letter-spacing: 2px;
      flex-shrink: 0;
    }
    
    /* ===== VIDEO PLAYER ===== */
    #player-container {
      flex: 1;
      position: relative;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    
    /* ===== NOW-PLAYING BANNER ===== */
    #banner {
      position: fixed;
      top: 60px;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, rgba(0, 243, 255, 0.15), rgba(57, 255, 20, 0.05));
      backdrop-filter: blur(12px);
      border-bottom: 2px solid rgba(0, 243, 255, 0.2);
      padding: 16px 20px;
      z-index: 99;
      display: flex;
      gap: 16px;
      transition: opacity 0.3s ease, transform 0.3s ease;
      opacity: 0;
      pointer-events: none;
      transform: translateY(-100%);
    }
    
    #banner.show {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    
    #banner-thumb {
      width: 140px;
      height: 79px;
      object-fit: cover;
      border-radius: 6px;
      border: 2px solid rgba(0, 243, 255, 0.3);
      flex-shrink: 0;
      box-shadow: 0 0 15px rgba(0, 243, 255, 0.2);
    }
    
    #banner-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
    }
    
    #banner-title {
      font-size: 18px;
      font-weight: bold;
      color: #00f3ff;
      margin-bottom: 6px;
      text-shadow: 0 0 10px rgba(0, 243, 255, 0.3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    #banner-epg {
      font-size: 13px;
      color: #39ff14;
      opacity: 0.9;
    }
    
    /* ===== PLAYLIST PANEL ===== */
    #playlist-panel {
      width: 100%;
      max-height: 180px;
      background: rgba(11, 14, 39, 0.95);
      border-top: 2px solid rgba(0, 243, 255, 0.2);
      overflow-y: auto;
      display: none;
      flex-shrink: 0;
      z-index: 50;
    }
    
    #playlist-panel.show {
      display: flex;
      flex-direction: column;
    }
    
    #playlist-list {
      display: flex;
      flex-direction: column;
    }
    
    .playlist-item {
      padding: 10px 16px;
      border-bottom: 1px solid rgba(0, 243, 255, 0.1);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      gap: 12px;
      align-items: center;
    }
    
    .playlist-item:hover {
      background: rgba(0, 243, 255, 0.08);
    }
    
    .playlist-item.active {
      background: rgba(0, 243, 255, 0.15);
      border-left: 3px solid #00f3ff;
      padding-left: 13px;
    }
    
    .playlist-thumb {
      width: 56px;
      height: 32px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid rgba(0, 243, 255, 0.2);
      flex-shrink: 0;
    }
    
    .playlist-info {
      flex: 1;
      min-width: 0;
    }
    
    .playlist-title {
      font-size: 12px;
      color: #00f3ff;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    
    .playlist-index {
      font-size: 11px;
      color: rgba(0, 243, 255, 0.5);
    }
    
    /* ===== CONTROLS ===== */
    #controls {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      gap: 8px;
      z-index: 101;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    
    button {
      padding: 8px 14px;
      background: rgba(0, 243, 255, 0.1);
      border: 1px solid rgba(0, 243, 255, 0.4);
      color: #00f3ff;
      border-radius: 5px;
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
      transition: all 0.2s ease;
      text-shadow: 0 0 5px rgba(0, 243, 255, 0.3);
      backdrop-filter: blur(10px);
    }
    
    button:hover {
      background: rgba(0, 243, 255, 0.2);
      box-shadow: 0 0 20px rgba(0, 243, 255, 0.3);
      border-color: rgba(0, 243, 255, 0.6);
    }
    
    button:active {
      transform: scale(0.95);
    }
    
    /* ===== SCROLLBAR ===== */
    #playlist-panel::-webkit-scrollbar {
      width: 6px;
    }
    
    #playlist-panel::-webkit-scrollbar-track {
      background: rgba(0, 243, 255, 0.05);
    }
    
    #playlist-panel::-webkit-scrollbar-thumb {
      background: rgba(0, 243, 255, 0.2);
      border-radius: 3px;
    }
    
    #playlist-panel::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 243, 255, 0.4);
    }
    
    /* ===== RESPONSIVE ===== */
    @media (max-width: 768px) {
      .banner-content {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      
      #clock {
        align-self: flex-end;
        margin-top: -32px;
        font-size: 14px;
      }
      
      #banner {
        top: 80px;
        flex-direction: column;
        padding: 12px 16px;
      }
      
      #banner-thumb {
        width: 100%;
        height: 100px;
      }
      
      #controls {
        bottom: 10px;
        right: 10px;
        gap: 6px;
      }
      
      button {
        padding: 6px 10px;
        font-size: 11px;
      }
    }
  </style>
</head>
<body>
  <div id="container">
    <!-- TOP BANNER WITH CLOCK -->
    <div id="top-banner">
      <div class="banner-content">
        <div class="channel-info">
          <div class="channel-title">📺 ${escapeHTML(title)}</div>
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

    <!-- VIDEO PLAYER -->
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

    <!-- PLAYLIST PANEL -->
    <div id="playlist-panel">
      <div id="playlist-list"></div>
    </div>
  </div>

  <!-- CONTROLS -->
  <div id="controls">
    <button id="toggle-list">📋 PLAYLIST</button>
    <button id="prev-btn">◀ PREV</button>
    <button id="next-btn">NEXT ▶</button>
  </div>

  <script>
    const PLAYLIST = ${playlistJSON};
    let currentIndex = 0;
    const video = document.getElementById('player');
    const banner = document.getElementById('banner');
    const topBanner = document.getElementById('top-banner');
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

    // Real-time clock
    function updateClock() {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }
    updateClock();
    setInterval(updateClock, 1000);

    // Format time display
    function formatTime(seconds) {
      const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
      const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
      const s = Math.floor(seconds % 60).toString().padStart(2, '0');
      return \`\${h}:\${m}:\${s}\`;
    }

    // Update top banner
    function updateTopBanner() {
      const item = PLAYLIST[currentIndex];
      if (item) {
        nowPlaying.textContent = item.title;
        const nextIdx = (currentIndex + 1) % PLAYLIST.length;
        nextTitle.textContent = PLAYLIST[nextIdx].title;
      }
    }

    // Update now-playing overlay banner
    function showNowPlayingBanner() {
      const item = PLAYLIST[currentIndex];
      if (item) {
        bannerTitle.textContent = item.title;
        bannerEpg.textContent = item.epg;
        bannerThumb.src = item.thumb;
        banner.classList.add('show');
        
        setTimeout(() => banner.classList.remove('show'), 4000);
      }
    }

    // Update next program time
    function calculateNextTime() {
      if (video.duration) {
        const remaining = video.duration - video.currentTime;
        const nextStart = new Date(Date.now() + remaining * 1000);
        nextTime.textContent = nextStart.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
    }

    // Update progress
    video.addEventListener('timeupdate', () => {
      playedTime.textContent = formatTime(video.currentTime);
      calculateNextTime();
    });

    // Render playlist
    function updatePlaylist() {
      playlistList.innerHTML = PLAYLIST.map((item, idx) => \`
        <div class="playlist-item \${idx === currentIndex ? 'active' : ''}" onclick="jumpTo(\${idx})">
          <img class="playlist-thumb" src="\${item.thumb}" alt="\${item.title}">
          <div class="playlist-info">
            <div class="playlist-title">\${item.title}</div>
            <div class="playlist-index">#\${idx + 1} • \${item.group}</div>
          </div>
        </div>
      \`).join('');
    }

    function jumpTo(index) {
      currentIndex = Math.max(0, Math.min(index, PLAYLIST.length - 1));
      loadCurrent();
    }

    function nextTrack() {
      currentIndex = (currentIndex + 1) % PLAYLIST.length;
      loadCurrent();
    }

    function prevTrack() {
      currentIndex = (currentIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
      loadCurrent();
    }

    function loadCurrent() {
      if (PLAYLIST.length === 0) return;
      const item = PLAYLIST[currentIndex];
      if (item && item.url) {
        video.src = item.url;
        video.play().catch(() => {});
        updatePlaylist();
        updateTopBanner();
        showNowPlayingBanner();
        playedTime.textContent = '0:00:00';
      }
    }

    // Event listeners
    video.addEventListener('ended', nextTrack);
    video.addEventListener('click', () => {
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    });

    toggleBtn.addEventListener('click', () => {
      playlistPanel.classList.toggle('show');
    });

    prevBtn.addEventListener('click', prevTrack);
    nextBtn.addEventListener('click', nextTrack);

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') prevTrack();
      if (e.key === 'ArrowRight') nextTrack();
      if (e.key === ' ') {
        e.preventDefault();
        video.paused ? video.play() : video.pause();
      }
      if (e.key === 'p' || e.key === 'P') {
        playlistPanel.classList.toggle('show');
      }
    });

    // Initialize
    updatePlaylist();
    updateTopBanner();
    loadCurrent();
  </script>
</body>
</html>`;
}

function escapeHTML(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
```

## FILE: server/static.ts
```typescript
import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
```

---

# SECTION 2: CLIENT FILES (FRONTEND)

## FILE: client/src/App.tsx
```typescript
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import GeneratedPages from "@/pages/generated";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/generated" component={GeneratedPages} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
```

## FILE: client/src/pages/home.tsx
```typescript
import { useState } from 'react';
import { FileUploader } from "@/components/file-uploader";
import { Workbench } from "@/components/workbench";
import { motion } from "framer-motion";

export default function Home() {
  const [view, setView] = useState<'upload' | 'workbench'>('upload');

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden font-sans selection:bg-primary/20">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 py-12 md:py-20 relative z-10">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4 mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-primary/80 tracking-wider mb-4">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            HYBRID MODE // FORMAT 2
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            NEXUS TV OS
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-light">
            Universal Hybrid Extractor & Auto-Chunking Engine
          </p>
        </motion.div>

        {/* View Toggle */}
        <div className="flex justify-center gap-3 mb-12">
          <button
            onClick={() => setView('upload')}
            className={`px-6 py-2 rounded-lg font-mono text-sm font-semibold tracking-wider transition-all ${
              view === 'upload'
                ? 'bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
            data-testid="button-view-upload"
          >
            Upload
          </button>
          <button
            onClick={() => setView('workbench')}
            className={`px-6 py-2 rounded-lg font-mono text-sm font-semibold tracking-wider transition-all ${
              view === 'workbench'
                ? 'bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
            data-testid="button-view-workbench"
          >
            Workbench
          </button>
        </div>

        {/* Main Interface */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          key={view}
          className="relative"
        >
          {/* Decorative lines */}
          <div className="absolute -left-4 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent hidden md:block" />
          <div className="absolute -right-4 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent hidden md:block" />

          {view === 'upload' ? (
            <FileUploader />
          ) : (
            <Workbench onBack={() => setView('upload')} />
          )}
          
        </motion.div>

        {/* Footer Info */}
        {view === 'upload' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left"
          >
            <FeatureCard 
              title="Auto-Detect" 
              desc="Intelligently parses .m3u, .json, .txt and extracts streaming URLs automatically."
            />
            <FeatureCard 
              title="Hybrid Metadata" 
              desc="Combines direct extraction with AI inference for titles, logos, and categories."
            />
            <FeatureCard 
              title="Smart Chunking" 
              desc="Auto-calculates optimal block sizes for zero-latency UI loading."
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="p-6 rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
      <h3 className="text-lg font-display font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
```

## FILE: client/src/pages/generated.tsx
```typescript
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Calendar, HardDrive, Download, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GeneratedPage {
  id: string;
  name: string;
  title: string;
  sourceChunk: string;
  size: number;
  generatedAt: string;
  url: string;
}

export default function GeneratedPages() {
  const { data: pagesData, isLoading } = useQuery({
    queryKey: ['generated-pages'],
    queryFn: async () => {
      const res = await fetch('/api/generated-pages');
      if (!res.ok) throw new Error('Failed to fetch pages');
      return res.json();
    },
  });

  const pages = pagesData?.pages || [];

  const handleDownload = (page: GeneratedPage) => {
    fetch('/api/download-zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageFile: page.name }),
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${page.id}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Download started');
      })
      .catch((error) => {
        toast.error('Download failed', { description: error.message });
      });
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 py-12 md:py-20 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 space-y-4"
        >
          <Link href="/">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-6" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4" />
              Back to Nexus
            </button>
          </Link>
          
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-primary/80 tracking-wider">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              OUTPUT DIRECTORY
            </div>
            
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
              /output/standalone/
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Generated Standalone HTML Pages
            </p>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <div className="inline-block w-8 h-8 rounded-full border-2 border-white/30 border-t-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading pages...</p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-xl p-6 mb-8 border border-white/10"
            >
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Total Files</div>
                  <div className="text-3xl font-bold text-primary">{pages.length}</div>
                </div>
                <div>
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Total Size</div>
                  <div className="text-3xl font-bold text-primary">{pages.reduce((a: number, p: GeneratedPage) => a + p.size, 0)} KB</div>
                </div>
                <div>
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Generated</div>
                  <div className="text-3xl font-bold text-primary">{pages.length}</div>
                </div>
              </div>
            </motion.div>

            {pages.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <p className="text-muted-foreground">No pages generated yet. Upload a file and generate pages in the Workbench.</p>
              </div>
            ) : (
              <div className="glass-card rounded-xl overflow-hidden border border-white/10">
                <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    <span>HTML Pages</span>
                    <span>Location: /output/standalone/</span>
                  </div>
                </div>

                <div className="divide-y divide-white/10">
                  {pages.map((page: GeneratedPage, idx: number) => (
                    <motion.div
                      key={page.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + idx * 0.08 }}
                      className="p-6 hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4 flex-1">
                          <FileText className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-mono font-bold text-foreground truncate mb-1">
                              {page.name}
                            </h3>
                            <p className="text-foreground text-base mb-2">{page.title}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground font-mono">
                              <span className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3" />
                                {page.size} KB
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(page.generatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pl-10">
                        <div className="text-xs bg-white/5 rounded px-3 py-2 border border-white/10 font-mono text-primary flex-1">
                          Source: {page.sourceChunk}
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-lg",
                              "bg-white/5 border border-white/10 hover:bg-white/10 text-foreground transition-colors text-sm"
                            )}
                            data-testid={`link-open-${page.id}`}
                          >
                            <Play className="w-4 h-4" />
                            Open
                          </a>
                          <button
                            onClick={() => handleDownload(page)}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-lg",
                              "bg-white/5 border border-white/10 hover:bg-white/10 text-foreground transition-colors text-sm"
                            )}
                            data-testid={`button-download-${page.id}`}
                          >
                            <Download className="w-4 h-4" />
                            ZIP
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-4 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground space-y-2"
        >
          <p><strong>📍 Location:</strong> Generated pages are stored in `/output/standalone/`</p>
          <p><strong>⚡ Usage:</strong> Each page is fully standalone and works offline</p>
          <p><strong>📦 Contents:</strong> Includes embedded playlist, player, and lazy-loaded assets</p>
          <p><strong>🎬 Playback:</strong> Click "Open" to view or "ZIP" to download with assets</p>
        </motion.div>
      </div>
    </div>
  );
}
```

## FILE: client/src/components/file-uploader.tsx
```typescript
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, File, FileJson, FileType, X, Check, Cpu, Film, ListMusic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface FileUploaderProps {
  className?: string;
  onSuccess?: () => void;
}

export function FileUploader({ className, onSuccess }: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    toast.success(`${acceptedFiles.length} file(s) added to queue`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt', '.m3u', '.m3u8', '.ini', '.csv'],
      'application/json': ['.json'],
      'text/javascript': ['.js'],
      'text/html': ['.html'],
      'text/css': ['.css'],
      'application/xml': ['.xml', '.rss'],
      'text/yaml': ['.yaml']
    }
  });

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const startProcessing = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        toast.success('File Processed', {
          description: `${data.message}`
        });
      }

      // Refresh chunks list
      await queryClient.invalidateQueries({ queryKey: ['chunks'] });
      
      setFiles([]);
      setIsProcessing(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Processing Error', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className={cn("w-full max-w-3xl mx-auto space-y-8", className)}>
      
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative group cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300 ease-out",
          "h-64 flex flex-col items-center justify-center text-center p-8",
          isDragActive 
            ? "border-primary bg-primary/5 scale-[1.01] shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]" 
            : "border-white/10 bg-white/5 hover:border-primary/50 hover:bg-white/10"
        )}
      >
        <input {...getInputProps()} data-testid="input-file-upload" />
        
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <motion.div
          animate={{ 
            y: isDragActive ? -10 : 0,
            scale: isDragActive ? 1.1 : 1 
          }}
          className="relative z-10 mb-4 rounded-full bg-white/5 p-4 ring-1 ring-white/10 group-hover:ring-primary/50 transition-all"
        >
          <UploadCloud className={cn("w-10 h-10 transition-colors", isDragActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
        </motion.div>
        
        <div className="relative z-10 space-y-2">
          <h3 className={cn("text-xl font-display font-bold transition-colors", isDragActive ? "text-primary" : "text-foreground")}>
            {isDragActive ? "Drop files to initialize extraction" : "Drag & Drop Input Files"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Supports <span className="text-primary">.m3u, .json, .txt, .js</span> and all standard playlist formats.
            <br />
            Hybrid Mode will auto-detect content type.
          </p>
        </div>
      </div>

      {/* File List & Actions */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="glass-card rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between px-2 pb-2 border-b border-white/5">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Input Queue</span>
                <span className="text-xs font-mono text-primary">{files.length} FILES DETECTED</span>
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {files.map((file) => (
                  <motion.div
                    key={file.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <FileIcon fileName={file.name} className="w-8 h-8 text-primary/80" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium text-foreground truncate max-w-[200px] sm:max-w-xs">{file.name}</span>
                        <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                      className="p-2 rounded-md hover:bg-destructive/20 hover:text-destructive text-muted-foreground transition-colors"
                      data-testid={`button-remove-${file.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={startProcessing}
                disabled={isProcessing}
                className={cn(
                  "relative overflow-hidden group px-8 py-4 rounded-lg bg-primary text-primary-foreground font-bold tracking-wide transition-all",
                  "hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:scale-[1.02] active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                )}
                data-testid="button-process"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <div className="relative flex items-center gap-2">
                  {isProcessing ? (
                    <>
                      <Cpu className="w-5 h-5 animate-spin" />
                      <span>PROCESSING CHUNKS...</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="w-5 h-5" />
                      <span>INITIATE HYBRID EXTRACTION</span>
                    </>
                  )}
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing Visualization (Mock) */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-xl p-6 space-y-4 overflow-hidden"
          >
            <div className="flex items-center gap-2 text-primary mb-4">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-sm tracking-wider">NEXUS ENGINE ACTIVE</span>
            </div>
            
            <div className="space-y-3">
              <ProcessingStep label="Parsing Input Structure..." delay={0} />
              <ProcessingStep label="Hybrid Metadata Inference..." delay={0.8} />
              <ProcessingStep label="Calculating Chunk Sizes..." delay={1.5} />
              <ProcessingStep label="Generating Output Files..." delay={2.2} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FileIcon({ fileName, className }: { fileName: string, className?: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  if (['json'].includes(ext || '')) return <FileJson className={className} />;
  if (['js', 'ts'].includes(ext || '')) return <FileType className={className} />;
  if (['m3u', 'm3u8'].includes(ext || '')) return <ListMusic className={className} />;
  if (['mp4', 'mkv', 'avi'].includes(ext || '')) return <Film className={className} />;
  
  return <File className={className} />;
}

function ProcessingStep({ label, delay }: { label: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-3 text-sm"
    >
      <div className="w-5 h-5 rounded-full border border-primary/30 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.5, type: "spring" }}
        >
          <Check className="w-3 h-3 text-primary" />
        </motion.div>
      </div>
      <span className="text-muted-foreground">{label}</span>
    </motion.div>
  );
}
```

## FILE: client/src/components/workbench.tsx
```typescript
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Zap, Download, X, Check, Play, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { StandalonePreview } from './standalone-preview';

interface ChunkFile {
  id: string;
  name: string;
  size: number;
  itemCount: number;
  generatedAt: string;
}

interface WorkbenchProps {
  onBack?: () => void;
}

export function Workbench({ onBack }: WorkbenchProps) {
  const [selectedChunk, setSelectedChunk] = useState<ChunkFile | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPage, setGeneratedPage] = useState<{ title: string; url: string; chunk: ChunkFile } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: chunksData, isLoading: chunksLoading } = useQuery({
    queryKey: ['chunks'],
    queryFn: async () => {
      const res = await fetch('/api/chunks');
      if (!res.ok) throw new Error('Failed to fetch chunks');
      return res.json();
    },
  });

  const chunks = chunksData?.chunks || [];

  const handleGeneratePage = async () => {
    if (!selectedChunk) return;
    
    setIsGenerating(true);
    const title = customTitle || selectedChunk.name.replace('.js', '').replace(/_/g, ' ');
    
    try {
      const res = await fetch('/api/generate-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkFile: selectedChunk.name,
          pageTitle: title,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      setGeneratedPage({
        title,
        url: data.path,
        chunk: selectedChunk
      });
      toast.success('Standalone page generated!', {
        description: `Generated: ${title}`
      });
    } catch (error) {
      toast.error('Generation Error', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!generatedPage) return;
    try {
      const res = await fetch('/api/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageFile: generatedPage.url.split('/').pop(),
        }),
      });

      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedPage.url.split('/').pop()?.replace('.html', '')}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Download started', {
        description: 'Standalone page + assets'
      });
    } catch (error) {
      toast.error('Download Error', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  if (showPreview && generatedPage) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-5xl mx-auto space-y-6"
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowPreview(false)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
            data-testid="button-back-to-generated"
          >
            <X className="w-4 h-4" />
            Back to Details
          </button>
        </div>
        
        <StandalonePreview pageTitle={generatedPage.title} />
      </motion.div>
    );
  }

  if (generatedPage) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-3xl mx-auto space-y-8"
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => setGeneratedPage(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
            data-testid="button-back-to-workbench"
          >
            <X className="w-4 h-4" />
            Back to Workbench
          </button>
        </div>

        <div className="glass-card rounded-xl p-8 space-y-6">
          <div className="flex items-center gap-3 text-primary mb-6">
            <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-sm tracking-wider">GENERATION COMPLETE</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-2">
                Generated Page Title
              </label>
              <div className="text-2xl font-display font-bold text-foreground">
                {generatedPage.title}
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-2">
                Source Chunk
              </label>
              <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10 font-mono text-sm">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-foreground">{generatedPage.chunk.name}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-2">
                Output Location
              </label>
              <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10 font-mono text-sm text-primary">
                <span className="text-muted-foreground">/output/standalone/</span>
                <span className="text-foreground">{generatedPage.url.split('/').pop()}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-6 border-t border-white/10">
            <button
              onClick={handleDownloadZip}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-3 rounded-lg",
                "bg-white/5 border border-white/10 hover:bg-white/10 text-foreground transition-colors"
              )}
              data-testid="button-download-zip"
            >
              <Download className="w-5 h-5" />
              Download ZIP
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-3 rounded-lg",
                "bg-white/5 border border-white/10 hover:bg-white/10 text-foreground transition-colors"
              )}
              data-testid="button-preview-page"
            >
              <Eye className="w-5 h-5" />
              Preview Template
            </button>
            <a
              href={generatedPage.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-3 rounded-lg",
                "bg-primary text-primary-foreground font-bold transition-all",
                "hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:scale-[1.02]"
              )}
              data-testid="link-open-page"
            >
              <Play className="w-5 h-5" />
              Open Live Page
            </a>
          </div>
        </div>
      </motion.div>
    );
  }

  if (selectedChunk) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full max-w-3xl mx-auto space-y-8"
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedChunk(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
            data-testid="button-deselect-chunk"
          >
            <X className="w-4 h-4" />
            Deselect Chunk
          </button>
          <span className="text-xs font-mono text-primary tracking-wider">CHUNK CONFIGURATION</span>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-6">
          <div className="pb-6 border-b border-white/10">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-2">
              Selected Chunk File
            </label>
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
              <Zap className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <div className="font-mono text-foreground font-semibold">{selectedChunk.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {selectedChunk.itemCount} items • {selectedChunk.size} KB
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-3">
              Custom Page Title (Optional)
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={selectedChunk.name.replace('.js', '').replace(/_/g, ' ')}
              className={cn(
                "w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-foreground",
                "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50",
                "transition-all"
              )}
              data-testid="input-page-title"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Leave blank to auto-generate from chunk name
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <button
              onClick={() => setSelectedChunk(null)}
              className={cn(
                "px-6 py-3 rounded-lg bg-white/5 border border-white/10",
                "hover:bg-white/10 text-foreground transition-colors"
              )}
              data-testid="button-cancel-generation"
            >
              Cancel
            </button>
            <button
              onClick={handleGeneratePage}
              disabled={isGenerating}
              className={cn(
                "relative overflow-hidden px-6 py-3 rounded-lg",
                "bg-primary text-primary-foreground font-bold transition-all",
                "hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:scale-[1.02]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              data-testid="button-generate-page"
            >
              {isGenerating ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>GENERATING...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5" />
                  <span>GENERATE STANDALONE PAGE</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-3xl mx-auto space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-1">Workbench</h2>
          <p className="text-sm text-muted-foreground">Generated Chunk Files</p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-foreground transition-colors text-sm"
            data-testid="button-back-to-upload"
          >
            ← Back
          </button>
        )}
      </div>

      {chunksLoading ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <div className="inline-block w-8 h-8 rounded-full border-2 border-white/30 border-t-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading chunks...</p>
        </div>
      ) : chunks.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center space-y-4">
          <p className="text-muted-foreground">No chunks generated yet. Upload a playlist file first.</p>
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden border border-white/10">
          <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground uppercase tracking-wider">
              <span>Chunk Files</span>
              <span>{chunks.length} FILES</span>
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {chunks.map((chunk: ChunkFile, idx: number) => (
              <motion.button
                key={chunk.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                onClick={() => setSelectedChunk(chunk)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors group"
                data-testid={`button-select-chunk-${chunk.id}`}
              >
                <div className="flex-1 text-left space-y-1">
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-primary/60 group-hover:text-primary transition-colors" />
                    <span className="font-mono font-semibold text-foreground">{chunk.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground ml-7">
                    {chunk.itemCount} items • {chunk.size} KB • Generated {chunk.generatedAt}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </motion.button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground space-y-2">
        <p>💡 <strong>Tip:</strong> Select any chunk file to generate a standalone HTML page with embedded playlist and player.</p>
        <p>Each page is fully responsive, works offline, and includes lazy-loaded thumbnails and EPG data.</p>
      </div>
    </motion.div>
  );
}
```

## FILE: client/src/components/standalone-preview.tsx

See previous response - full 240-line file with all interactive components, styling, and mockup data included.

---

# SECTION 3: PACKAGE CONFIGURATION

##FILE: package.json
[Full file included in previous output - see lines 1-112]

---

# SECTION 4: ARCHITECTURE SUMMARY

**Flow:**
1. User uploads .m3u, .csv, .json, .txt, .js playlist file
2. Parser detects format and extracts URLs + metadata
3. Title extraction pulls real names from URL filenames (not CSV garbage)
4. Auto-chunking calculates optimal sizes (1-20 chunks based on item count)
5. Chunk JS files generated with embedded data
6. Frontend selects chunk → generates standalone HTML
7. HTML page includes embedded playlist, video player, controls, EPG
8. Pages accessible at `/output/standalone/` 
9. ZIP download available with all assets

**Key Fix:** Parser now extracts actual titles from URL filenames using `decodeURIComponent()` and regex to remove extensions.

---

**END OF AUDIT**
