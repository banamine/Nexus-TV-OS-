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
