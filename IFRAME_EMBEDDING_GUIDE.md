# Nexus TV Player - Iframe Embedding Guide

## Overview
Nexus TV Player output pages are fully embeddable in Wix, Weebly, and other website builders using standard HTML iframes with full compatibility and no page conflicts.

## Key Features for Embedding

### 1. **Automatic Iframe Detection**
- Player automatically detects if running inside an iframe
- Applies iframe-optimized CSS and JavaScript
- No configuration needed - works out of the box

### 2. **Scroll Control**
- Embedded pages allow full page scrolling within the iframe
- Parent page (Wix/Weebly) maintains independent scroll control
- No conflicts between player and host site scrolling

### 3. **Fixed Positioning Handling**
- In standalone mode: Uses `position: fixed` for banners
- In iframe mode: Uses `position: sticky` and `position: absolute`
- Ensures banners stay visible without breaking parent page layout

### 4. **PostMessage API**
- Two-way communication between player and parent page
- Parent can control playback from page scripts
- Player sends events to parent page

## Embedding Code

### For Wix
1. Go to Add → Custom Code
2. Choose "Embed Code"
3. Paste the code below and set height/width as desired:

```html
<iframe 
  src="path-to-your-generated-player.html" 
  width="100%" 
  height="600px"
  frameborder="0"
  allow="autoplay"
  style="border: none; border-radius: 8px;">
</iframe>
```

### For Weebly
1. Go to Build → Embed Code
2. Paste the code below:

```html
<div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden;">
  <iframe 
    src="path-to-your-generated-player.html" 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    frameborder="0"
    allow="autoplay">
  </iframe>
</div>
```

### For Other Website Builders
Use the standard responsive iframe approach:

```html
<iframe 
  src="path-to-your-generated-player.html" 
  width="100%" 
  height="600px"
  frameborder="0"
  allow="autoplay"
  style="border: none;">
</iframe>
```

## PostMessage API

### Events Sent by Player to Parent

```javascript
// Player is ready
{
  source: 'nexus-tv-player',
  event: 'player-ready',
  data: { 
    mode: 'iframe' | 'standalone',
    playlistLength: number,
    title: string 
  }
}

// Track ended
{
  source: 'nexus-tv-player',
  event: 'track-ended',
  data: { index: number, title: string }
}

// Playback ready
{
  source: 'nexus-tv-player',
  event: 'playback-ready',
  data: { index: number, title: string }
}

// Now playing
{
  source: 'nexus-tv-player',
  event: 'playing',
  data: { index: number }
}

// Buffering
{
  source: 'nexus-tv-player',
  event: 'buffering',
  data: { index: number }
}

// Player play/pause
{
  source: 'nexus-tv-player',
  event: 'player-play',
  data: {}
}

{
  source: 'nexus-tv-player',
  event: 'player-pause',
  data: {}
}
```

### Commands You Can Send to Player

```javascript
const iframe = document.querySelector('iframe');

// Next track
iframe.contentWindow.postMessage({
  target: 'nexus-tv-player',
  command: 'next'
}, '*');

// Previous track
iframe.contentWindow.postMessage({
  target: 'nexus-tv-player',
  command: 'prev'
}, '*');

// Play
iframe.contentWindow.postMessage({
  target: 'nexus-tv-player',
  command: 'play'
}, '*');

// Pause
iframe.contentWindow.postMessage({
  target: 'nexus-tv-player',
  command: 'pause'
}, '*');

// Jump to track (by index)
iframe.contentWindow.postMessage({
  target: 'nexus-tv-player',
  command: 'jumpTo',
  index: 5
}, '*');
```

## Example: Parent Page Integration

```html
<div id="player-container">
  <iframe 
    id="nexus-player"
    src="player.html" 
    width="100%" 
    height="600px"
    frameborder="0"
    allow="autoplay"
    style="border: none;">
  </iframe>
</div>

<div id="controls">
  <button onclick="sendCommand('prev')">← Previous</button>
  <button onclick="sendCommand('play')">Play</button>
  <button onclick="sendCommand('pause')">Pause</button>
  <button onclick="sendCommand('next')">Next →</button>
</div>

<script>
const iframe = document.getElementById('nexus-player');

function sendCommand(command) {
  iframe.contentWindow.postMessage({
    target: 'nexus-tv-player',
    command: command
  }, '*');
}

// Listen for events from player
window.addEventListener('message', (e) => {
  if (e.data && e.data.source === 'nexus-tv-player') {
    console.log('Player event:', e.data.event, e.data.data);
    
    if (e.data.event === 'player-ready') {
      console.log('Player is ready with', e.data.data.playlistLength, 'videos');
    }
    if (e.data.event === 'track-ended') {
      console.log('Now playing:', e.data.data.title);
    }
  }
}, false);
</script>
```

## Browser Compatibility

- ✅ Chrome/Chromium (all versions)
- ✅ Firefox (all versions)
- ✅ Safari (all versions)
- ✅ Edge (all versions)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Important Notes

1. **CORS**: Players hosted on same domain work without restrictions
2. **Autoplay**: Add `allow="autoplay"` attribute to iframe for autoplay support
3. **Scrolling**: Parent page can scroll independently - no conflicts
4. **Performance**: Embedded player uses same optimizations as standalone
5. **Offline**: Still 100% local - no internet required

## Troubleshooting

### Player doesn't appear
- Check iframe `src` path is correct
- Ensure `allow="autoplay"` is set
- Check browser console for CORS errors

### Scroll conflicts
- Player automatically uses `sticky` positioning in iframe mode
- If issues persist, verify parent page doesn't have conflicting CSS

### PostMessage not working
- Ensure player is fully loaded before sending commands
- Check browser console for cross-origin errors
- For cross-origin embeds, parent/player same-origin policy applies

---

**Last Updated:** November 29, 2025
**Version:** Iframe-Ready 1.0
