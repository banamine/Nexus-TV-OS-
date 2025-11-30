import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Zap, Download, X, Check, Play, Eye, Trash2 } from 'lucide-react';
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
  const queryClient = useQueryClient();
  const [selectedChunk, setSelectedChunk] = useState<ChunkFile | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [generatedPage, setGeneratedPage] = useState<{ title: string; url: string; chunk: ChunkFile } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: chunksData, isLoading: chunksLoading, refetch: refetchChunks } = useQuery({
    queryKey: ['chunks'],
    queryFn: async () => {
      const res = await fetch('/api/chunks');
      if (!res.ok) throw new Error('Failed to fetch chunks');
      return res.json();
    },
  });

  const chunks = chunksData?.chunks || [];

  const handleMergeAll = async () => {
    setIsMerging(true);
    try {
      const res = await fetch('/api/merge-all-chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Merge failed');
      }

      toast.success('Shows merged!', {
        description: `${data.totalItems} items combined and randomized`
      });
      
      await refetchChunks();
    } catch (error) {
      toast.error('Merge Error', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsMerging(false);
    }
  };

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const res = await fetch('/api/cleanup-workbench', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Cleanup failed');
      }

      toast.success('Workbench cleaned', {
        description: 'All chunk files cleared'
      });
      
      setSelectedChunk(null);
      setGeneratedPage(null);
      await refetchChunks();
    } catch (error) {
      toast.error('Cleanup Error', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

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
        <div className="flex items-center gap-2">
          {chunks.length > 1 && (
            <button
              onClick={handleMergeAll}
              disabled={isMerging}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary/20 border border-primary/40 hover:bg-primary/30",
                "text-foreground transition-colors text-sm",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              data-testid="button-merge-all-shows"
            >
              <Zap className="w-4 h-4" />
              {isMerging ? 'Merging...' : 'Merge All Shows'}
            </button>
          )}
          {chunks.length > 0 && (
            <button
              onClick={handleCleanup}
              disabled={isCleaningUp}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30",
                "text-foreground transition-colors text-sm",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              data-testid="button-cleanup-workbench"
            >
              <Trash2 className="w-4 h-4" />
              {isCleaningUp ? 'Cleaning...' : 'Cleanup'}
            </button>
          )}
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
