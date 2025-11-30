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
