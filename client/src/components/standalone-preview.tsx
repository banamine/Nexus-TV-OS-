import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock playlist data
const MOCK_PLAYLIST = [
  {
    id: "1",
    title: "Premium HD Channel",
    url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4",
    thumb: "https://images.unsplash.com/photo-1611339555312-e607c04352fa?w=300&h=200&fit=crop",
    epg: "Live Programming • 14:30 - 16:00",
    group: "Premium"
  },
  {
    id: "2",
    title: "Movie Night Collection",
    url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4",
    thumb: "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=300&h=200&fit=crop",
    epg: "Feature Film • 16:00 - 18:30",
    group: "Movies"
  },
  {
    id: "3",
    title: "Live Sports Center",
    url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerBlazes.mp4",
    thumb: "https://images.unsplash.com/photo-1516981104816-7db87efa2e38?w=300&h=200&fit=crop",
    epg: "Sports Update • 18:30 - 19:00",
    group: "Sports"
  },
  {
    id: "4",
    title: "Documentary Series",
    url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerEscapes.mp4",
    thumb: "https://images.unsplash.com/photo-1533050487297-31284e051bd1?w=300&h=200&fit=crop",
    epg: "Nature Documentary • 19:00 - 20:00",
    group: "Docs"
  },
  {
    id: "5",
    title: "Music Videos HD",
    url: "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerFun.mp4",
    thumb: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=200&fit=crop",
    epg: "Music Videos • 20:00 - 21:00",
    group: "Music"
  },
];

interface StandalonePreviewProps {
  pageTitle?: string;
  onClose?: () => void;
}

export function StandalonePreview({ pageTitle = "Standalone Player Preview", onClose }: StandalonePreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentItem = MOCK_PLAYLIST[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % MOCK_PLAYLIST.length);
    setBannerVisible(true);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + MOCK_PLAYLIST.length) % MOCK_PLAYLIST.length);
    setBannerVisible(true);
  };


  useEffect(() => {
    const timer = setTimeout(() => {
      if (bannerVisible) setBannerVisible(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [bannerVisible, currentIndex]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-display font-bold text-foreground">{pageTitle}</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            data-testid="button-close-preview"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Standalone Page Mock */}
      <div className="glass-card rounded-xl overflow-hidden border border-white/10 aspect-video bg-black relative group">
        
        {/* Video Player Area */}
        <video
          key={currentItem.id}
          className="w-full h-full object-cover"
          autoPlay
          controls
          onEnded={handleNext}
          data-testid="video-player"
        >
          <source src={currentItem.url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Banner Overlay */}
        <AnimatePresence>
          {bannerVisible && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-6 z-10"
              data-testid="banner-overlay"
            >
              <div className="flex gap-4">
                <img
                  src={currentItem.thumb}
                  alt={currentItem.title}
                  className="w-32 h-20 rounded-lg object-cover border border-white/20 flex-shrink-0"
                  data-testid="banner-thumbnail"
                />
                <div className="flex-1 text-white">
                  <div className="text-2xl font-bold mb-1">{currentItem.title}</div>
                  <div className="text-sm text-cyan-400">{currentItem.epg}</div>
                  <div className="text-xs text-white/60 mt-2">Group: {currentItem.group}</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
          <button
            onClick={handlePrev}
            className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
            data-testid="button-prev-channel"
          >
            <ChevronUp className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
            data-testid="button-next-channel"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>

        {/* Channel Counter */}
        <div className="absolute bottom-4 right-4 px-3 py-1 rounded bg-black/60 text-xs font-mono text-cyan-400 z-10">
          {currentIndex + 1} / {MOCK_PLAYLIST.length}
        </div>
      </div>

      {/* Playlist Navigation */}
      <div className="glass-card rounded-xl p-4 border border-white/10">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Playlist Queue</div>
        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
          {MOCK_PLAYLIST.map((item, idx) => (
            <motion.button
              key={item.id}
              onClick={() => {
                setCurrentIndex(idx);
                setBannerVisible(true);
              }}
              className={cn(
                "w-full flex gap-3 p-2 rounded-lg transition-all text-left",
                currentIndex === idx
                  ? "bg-primary/20 border border-primary/50"
                  : "hover:bg-white/5 border border-transparent"
              )}
              data-testid={`button-playlist-${idx}`}
            >
              <img
                src={item.thumb}
                alt={item.title}
                className="w-12 h-8 rounded object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "text-sm font-medium truncate",
                  currentIndex === idx ? "text-primary" : "text-foreground"
                )}>
                  {item.title}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {item.epg}
                </div>
              </div>
              {currentIndex === idx && (
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Code Snippet Preview */}
      <div className="glass-card rounded-xl p-4 border border-white/10 space-y-3">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Generated HTML Structure</div>
        <div className="bg-black/40 rounded p-3 font-mono text-xs text-green-400 overflow-x-auto max-h-32 overflow-y-auto custom-scrollbar">
          <pre>{`<!DOCTYPE html>
<html lang="en">
<head>
  <title>${pageTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;background:#000;color:#0ff">
  <div id="banner">
    <img id="thumb" src="thumbs/...">
    <div id="info">Channel Title</div>
  </div>
  <video id="player" autoplay controls></video>
  <script>
    window.CHUNK_DATA = [${MOCK_PLAYLIST.length} items]
    // Carousel logic...
  </script>
</body>
</html>`}</pre>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground space-y-2">
        <p><strong>✓ Standalone:</strong> No external dependencies, works offline</p>
        <p><strong>✓ Responsive:</strong> Desktop, tablet, mobile support</p>
        <p><strong>✓ Lazy-loaded:</strong> Thumbnails and video frames load on demand</p>
        <p><strong>✓ Auto-carousel:</strong> Plays through all channels sequentially</p>
      </div>
    </div>
  );
}
