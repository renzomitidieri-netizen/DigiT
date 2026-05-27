import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, FileImage, Copy, Check, Loader2, Download, Camera, Clock, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// @ts-ignore
const modelConfig = import.meta.env.VITE_GEMINI_MODEL || "gemini-3-flash-preview";


interface HistoryItem {
  id: string;
  timestamp: number;
  fileName: string;
  text: string;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('lenstotext_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading history", e);
      }
    }
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
  };

  const processFile = (selectedFile: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setError("Por favor, sube un archivo válido (JPEG, PNG, WEBP o PDF).");
      return;
    }
    // Limit to 20MB
    if (selectedFile.size > 20 * 1024 * 1024) {
       setError("El archivo es demasiado grande. El límite es de 20MB.");
       return;
    }
    setFile(selectedFile);
    setError("");
    setExtractedText("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Extraer la parte después de "base64,"
          const base64Data = reader.result.split(',')[1];
          resolve(base64Data);
        } else {
          reject(new Error("Error al leer el archivo."));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const extractData = async () => {
    if (!file) return;
    
    setIsExtracting(true);
    setError("");
    
    try {
      const base64Data = await fileToBase64(file);
      const mimeType = file.type;
      
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mimeType,
          base64Data,
          model: modelConfig,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al extraer el texto.");
      }

      if (data.text) {
        const text = data.text.trim();
        setExtractedText(text);
        
        const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        const newItem: HistoryItem = {
          id: newId,
          timestamp: Date.now(),
          fileName: file.name,
          text: text
        };
        const newHistory = [newItem, ...history].slice(0, 50);
        setHistory(newHistory);
        localStorage.setItem('lenstotext_history', JSON.stringify(newHistory));
      } else {
        setError("No se pudo extraer texto de este archivo.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Ocurrió un error en la extracción.");
    } finally {
      setIsExtracting(false);
    }
  };

  const copyToClipboard = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const downloadText = () => {
    if (!extractedText) return;
    const element = document.createElement("a");
    const fileBlob = new Blob([extractedText], {type: 'text/plain'});
    element.href = URL.createObjectURL(fileBlob);
    element.download = `extraido-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setExtractedText(item.text);
    setFile(new File([], item.fileName, { type: "text/plain" })); // Mock file para mostrar nombre
    setError("");
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('lenstotext_history');
  }

  return (
    <div className="min-h-screen h-screen bg-[#0F0F0F] text-[#E5E5E5] flex flex-col font-sans selection:bg-orange-400/30 selection:text-white">
      {/* Header Navigation */}
      <nav className="h-20 border-b border-white/10 flex items-center justify-between px-6 md:px-10 shrink-0">
        <div className="flex items-center gap-12">
          <span className="font-serif italic text-xl md:text-2xl tracking-tight text-white">LensToText.ai</span>
          <div className="hidden md:flex gap-8 text-xs uppercase tracking-[0.2em] font-medium opacity-60">
            <span>Digitalizar</span>
            <span>Documentación API</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-1.5 rounded-full border border-white/20 text-[10px] uppercase tracking-widest hidden sm:block">
            Motor: <span className="text-orange-400">{modelConfig}</span>
          </div>
        </div>
      </nav>

      {/* Main Workspace */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Pane: Input/Capture */}
        <section className="lg:col-span-4 lg:border-r border-white/10 p-6 md:p-10 flex flex-col h-full overflow-y-auto">
          <div className="mb-8 shrink-0">
            <h1 className="text-5xl md:text-7xl font-serif italic leading-none mb-4 text-white">Digitalizar.</h1>
            <p className="text-sm text-white/50 leading-relaxed uppercase tracking-wider">
              Transforma capturas de alta definición en texto plano usando inteligencia artificial.
            </p>
          </div>

          <div className="flex flex-col gap-6 shrink-0">
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center p-8 border border-white/20 rounded-2xl cursor-pointer transition-all duration-300 bg-white/5 overflow-hidden group min-h-[200px]
                ${isHovering ? 'border-orange-500/50 bg-white/10' : 'hover:bg-white/10'}`}
            >
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/jpeg,image/png,image/webp,application/pdf"
              />
              <input 
                type="file" 
                className="hidden" 
                ref={cameraInputRef} 
                onChange={handleFileChange} 
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
              />
              
              <AnimatePresence mode="wait">
                {!file ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col items-center text-center z-10 pointer-events-none"
                  >
                    <div className="w-12 h-12 rounded-full border border-white/40 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                      <UploadCloud size={24} className="opacity-70" strokeWidth={1.5} />
                    </div>
                    <span className="text-[10px] text-white uppercase tracking-widest font-semibold mb-2">Suelta tu archivo aquí</span>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider">PDF, PNG, JPG, WEBP (Hasta 20MB)</span>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="file"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col items-center text-center w-full z-10 pointer-events-none"
                  >
                    <div className="w-12 h-12 rounded-full border border-white/40 flex items-center justify-center mx-auto mb-4 bg-black/40 backdrop-blur-sm">
                      {file.type === 'application/pdf' ? (
                         <FileText size={24} className="opacity-70" strokeWidth={1.5} />
                      ) : (
                         <FileImage size={24} className="opacity-70" strokeWidth={1.5} />
                      )}
                    </div>
                    <span className="text-xs font-mono text-white/90 mb-2 truncate w-full px-4">{file.name || 'Archivo seleccionado'}</span>
                    {file.size > 0 ? (
                      <span className="text-[10px] uppercase tracking-widest text-orange-400/80 font-bold">{formatBytes(file.size)}</span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Desde el historial</span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              
              {!file && (
                 <div className="absolute inset-0 p-6 opacity-10 grayscale pointer-events-none">
                   <div className="w-full h-full border-2 border-dashed border-white/30 rounded-lg flex flex-col gap-4 p-4">
                     <div className="h-4 w-3/4 bg-white/20"></div>
                     <div className="h-4 w-1/2 bg-white/20"></div>
                     <div className="h-full w-full bg-white/10"></div>
                   </div>
                 </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => cameraInputRef.current?.click()}
                className="h-12 border border-white/20 text-white font-semibold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center justify-center gap-2 rounded-lg"
              >
                <Camera size={14} />
                Tomar Foto
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="h-12 border border-white/20 text-white font-semibold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center justify-center gap-2 rounded-lg"
              >
                <FileText size={14} />
                Subir Archivo
              </button>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-red-400 bg-red-500/10 p-4 rounded-lg text-[10px] sm:text-xs font-mono border border-red-500/20 uppercase tracking-wider"
              >
                {error}
              </motion.div>
            )}

            <button
              onClick={extractData}
              disabled={!file || file.size === 0 || isExtracting}
              className={`h-14 w-full flex items-center justify-center font-semibold text-xs uppercase tracking-widest transition-colors rounded-lg
                ${(!file || file.size === 0 || isExtracting) 
                  ? 'bg-white/10 text-white/30 cursor-not-allowed border border-white/10' 
                  : 'bg-white text-black hover:bg-orange-400'}`}
            >
              {isExtracting ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin" size={16} />
                  <span>Procesando...</span>
                </div>
              ) : (
                <span>Extraer Texto</span>
              )}
            </button>
          </div>

          <div className="mt-10 mb-2">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 flex items-center gap-2">
                <Clock size={12} />
                Historial Reciente
              </span>
              {history.length > 0 && (
                <button onClick={clearHistory} className="text-white/30 hover:text-red-400 transition-colors" title="Borrar Historial">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            {history.length > 0 ? (
              <div className="flex flex-col gap-2">
                {history.slice(0, 8).map(item => (
                  <button 
                    key={item.id} 
                    onClick={() => loadFromHistory(item)}
                    className="flex flex-col text-left p-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors group"
                  >
                    <span className="text-[11px] font-mono text-white/90 truncate w-full mb-1 group-hover:text-orange-300">
                      {item.fileName}
                    </span>
                    <span className="text-[9px] uppercase tracking-widest text-white/40">
                      {new Date(item.timestamp).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 border border-white/5 rounded-lg border-dashed">
                <span className="text-[10px] uppercase tracking-widest text-white/30">Sin historial cronológico</span>
              </div>
            )}
          </div>

        </section>

        {/* Right Pane: Output */}
        <section className="lg:col-span-8 bg-[#141414] p-6 md:p-10 flex flex-col h-full overflow-hidden border-t lg:border-t-0 border-white/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 md:mb-8 shrink-0">
            <div className="flex items-center gap-4">
              <span className={`w-2 h-2 rounded-full ${isExtracting ? 'bg-orange-500 animate-pulse' : extractedText ? 'bg-green-500' : 'bg-white/20'}`}></span>
              <h2 className="text-xs uppercase tracking-[0.3em] font-bold text-white">Texto Extraído</h2>
            </div>
            
            {extractedText && (
              <div className="flex items-center gap-4">
                <button 
                  onClick={downloadText}
                  className="text-[10px] uppercase tracking-widest font-bold text-white/70 border-b border-white/20 pb-1 hover:text-white hover:border-white transition-colors flex items-center gap-1.5"
                >
                  <Download size={12} /> Descargar .TXT
                </button>
                <button 
                  onClick={copyToClipboard}
                  className="text-[10px] uppercase tracking-widest font-bold text-orange-400 border-b border-orange-400/30 pb-1 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copiado' : 'Copiar Texto'}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl p-6 md:p-8 font-mono text-sm leading-relaxed text-white/80 relative overflow-hidden flex flex-col">
            {isExtracting && (
                <div className="absolute top-0 right-0 p-4">
                  <span className="text-[9px] text-orange-400/60 uppercase animate-pulse tracking-widest">Ejecutando Inferencia...</span>
                </div>
            )}
            {!isExtracting && extractedText && (
                <div className="absolute top-0 right-0 p-4">
                  <span className="text-[9px] text-green-500/60 uppercase tracking-widest">Extracción Completa</span>
                </div>
            )}
            
            {extractedText ? (
              <div className="flex-1 w-full h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <textarea 
                  value={extractedText}
                  readOnly
                  className="w-full h-full min-h-[200px] bg-transparent resize-none outline-none leading-relaxed text-white/90 font-mono" 
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-white/30 h-full">
                 <svg className="w-8 h-8 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                 <p className="text-[10px] uppercase tracking-widest max-w-[250px]">Sube un documento para ver el texto estructurado.</p>
              </div>
            )}
            
            {extractedText && (
               <div className="mt-8 pt-6 border-t border-white/10 shrink-0">
                 <div className="text-white/30 italic text-[11px]">
                   * Documento leído exitosamente con {modelConfig}. <br/>
                   Listo para usar.
                 </div>
               </div>
            )}
          </div>
        </section>
      </main>

      {/* Status Bar Footer */}
      <footer className="h-12 border-t border-white/10 px-6 md:px-10 flex items-center justify-between text-[10px] uppercase tracking-widest text-white/40 shrink-0 bg-[#0F0F0F]">
        <div className="flex gap-6 md:gap-10">
          <span className="hidden sm:inline">Estado: <span className="text-green-500">Operativo</span></span>
          <span className="hidden md:inline">Procesamiento: Local</span>
        </div>
        <div className="flex gap-6">
          <span className="hidden sm:inline">Política de Privacidad</span>
          <span>v1.0.0-Flash</span>
        </div>
      </footer>
    </div>
  );
}
