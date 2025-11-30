import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaylistItem {
  id?: string;
  title: string;
  url: string;
  thumb?: string;
  epg?: string;
  group?: string;
}

interface TopBannerProps {
  currentItem: PlaylistItem | null;
  currentIndex: number;
  playlist: PlaylistItem[];
  onNavigate: (index: number) => void;
  isPlaying: boolean;
}

export function TopBanner({ currentItem, currentIndex, playlist, onNavigate, isPlaying }: TopBannerProps) {
  const [clock, setClock] = useState('00:00:00');
  const [progress, setProgress] = useState('0:00:00 played');
  const [nextProgram, setNextProgram] = useState<PlaylistItem | null>(null);

  // Clock updates
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update next program
  useEffect(() => {
    if (playlist.length > 0 && currentIndex < playlist.length) {
      const nextIdx = (currentIndex + 1) % playlist.length;
      setNextProgram(playlist[nextIdx]);
    }
  }, [currentIndex, playlist]);

  // Virtualized guide strip - only show ~1% of items
  const LAZY_WINDOW = Math.max(1, Math.floor(playlist.length * 0.01));
  const visibleStart = Math.max(0, currentIndex - Math.floor(LAZY_WINDOW / 2));
  const visibleEnd = Math.min(playlist.length, visibleStart + LAZY_WINDOW);
  const visibleItems = playlist.slice(visibleStart, visibleEnd);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/40 backdrop-blur-md border-b border-cyan-400/20 sticky top-0 z-50"
      data-testid="top-banner"
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Main Banner Content */}
        <div className="grid grid-cols-3 gap-4 items-center mb-3">
          {/* Left: Channel Info */}
          <div className="space-y-1">
            <div className="text-sm font-mono text-cyan-400/70">NOW PLAYING</div>
            <div className="text-lg font-bold text-cyan-400" data-testid="banner-now-playing">
              {currentItem?.title || 'Standby'}
            </div>
            <div className="text-xs text-white/50 font-mono" data-testid="banner-progress">
              {progress}
            </div>
          </div>

          {/* Center: Guide Strip (Virtualized) */}
          <div className="flex justify-center">
            <div className="overflow-x-auto flex gap-2 px-2 py-1 scrollbar-hide" data-testid="guide-strip">
              {visibleItems.map((item, idx) => {
                const actualIdx = visibleStart + idx;
                const isActive = actualIdx === currentIndex;
                return (
                  <motion.button
                    key={actualIdx}
                    onClick={() => onNavigate(actualIdx)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'px-3 py-1 rounded-md whitespace-nowrap text-xs font-mono transition-all',
                      isActive
                        ? 'bg-lime-400/30 border border-lime-400 text-lime-400'
                        : 'bg-cyan-400/10 border border-cyan-400/30 text-cyan-400/70 hover:bg-cyan-400/20'
                    )}
                    data-testid={`guide-item-${actualIdx}`}
                  >
                    #{actualIdx + 1}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Right: Clock & Next */}
          <div className="text-right space-y-1">
            <div className="text-2xl font-mono font-black text-cyan-400 text-shadow" data-testid="banner-clock">
              {clock}
            </div>
            <div className="text-xs text-cyan-400/60 font-mono">
              UP NEXT: <span className="text-cyan-400/90" data-testid="banner-next-title">{nextProgram?.title || 'End'}</span>
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="p-1 hover:bg-cyan-400/10 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="button-banner-prev"
          >
            <ChevronLeft className="w-4 h-4 text-cyan-400" />
          </button>

          <div className="text-xs text-cyan-400/50 font-mono">
            {currentIndex + 1} / {playlist.length}
          </div>

          <button
            onClick={() => onNavigate(Math.min(playlist.length - 1, currentIndex + 1))}
            disabled={currentIndex === playlist.length - 1}
            className="p-1 hover:bg-cyan-400/10 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="button-banner-next"
          >
            <ChevronRight className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
