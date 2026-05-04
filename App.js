```react
import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Wand2, 
  Copy, 
  RotateCcw, 
  Check, 
  AlertCircle, 
  ChevronRight, 
  Code2, 
  Cpu, 
  Layout,
  History,
  Info,
  X
} from 'lucide-react';

const apiKey = ""; // Environment provided key

// --- Helper: Gemini API Client ---
async function callGemini(prompt, systemPrompt, imageData = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        ...(imageData ? [{ inlineData: { mimeType: "image/png", data: imageData.split(',')[1] } }] : [])
      ]
    }],
    systemInstruction: { parts: [{ text: systemPrompt }] }
  };

  let delay = 1000;
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text;
      }
    } catch (e) {
      if (i === 4) throw e;
    }
    await new Promise(r => setTimeout(r, delay));
    delay *= 2;
  }
  throw new Error("Failed to communicate with AI.");
}

const Button = ({ children, onClick, variant = 'primary', loading = false, disabled = false, icon: Icon, className = "" }) => {
  const base = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-md",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    outline: "border-2 border-blue-600 text-blue-600 hover:bg-blue-50",
    danger: "bg-red-500 text-white hover:bg-red-600"
  };
  
  return (
    <button onClick={onClick} disabled={loading || disabled} className={`${base} ${variants[variant]} ${className}`}>
      {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const App = () => {
  const [step, setStep] = useState('input');
  const [code, setCode] = useState('');
  const [instructions, setInstructions] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setError(null);
    setIsCameraActive(true);
    
    // Short timeout to ensure video element is rendered
    setTimeout(async () => {
      try {
        const constraints = { 
          video: { 
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Crucial for mobile browsers
          videoRef.current.setAttribute("playsinline", true); 
          videoRef.current.setAttribute("muted", true);
          await videoRef.current.play();
        }
      } catch (err) {
        console.error("Camera Error:", err);
        setError("Unable to access camera. Please ensure permissions are granted and you are on HTTPS.");
        setIsCameraActive(false);
      }
    }, 100);
  };

  const captureImage = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    
    stopCamera();
    setLoading(true);
    
    try {
      const ocrPrompt = "Extract the ABAP code from this image. Fix any OCR typos (like '|' for 'I' or '0' for 'O' in keywords) and return only the corrected ABAP source code.";
      const systemPrompt = "You are a specialized ABAP OCR assistant. Your output must be purely ABAP code, no markdown wrappers, no explanations.";
      const extracted = await callGemini(ocrPrompt, systemPrompt, dataUrl);
      if (extracted) setCode(extracted.trim());
    } catch (err) {
      setError("Failed to extract code from image. Please try again or paste manually.");
    } finally {
      setLoading(false);
    }
  };

  const handleModernize = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setStep('processing');

    const systemPrompt = `You are a Senior SAP Technical Architect.
    Modernize the legacy ABAP code to 7.40+ standards.
    - Use inline DATA/FIELD-SYMBOL declarations.
    - Use modern SELECT syntax (commas, @host_vars).
    - Use VALUE, CORRESPONDING, COND, SWITCH.
    - Optimize internal table operations.
    Return JSON: { "modernizedCode": "...", "explanations": ["..."], "performanceGain": "..." }`;

    try {
      const prompt = `Modernize this code: ${code}\n\nUser Instructions: ${instructions}`;
      const responseText = await callGemini(prompt, systemPrompt);
      const cleanJson = responseText.replace(/```json|```/g, '').trim();
      setResult(JSON.parse(cleanJson));
      setStep('result');
    } catch (err) {
      setError("Transformation failed. Please check the code structure.");
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
            <Code2 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">ABAP Modernizer</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">S/4HANA AI Engine</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-8">
        {step === 'input' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <span className="flex items-center gap-2 font-semibold text-gray-700">
                  <Layout size={18} className="text-blue-600" />
                  Source Code
                </span>
                {!isCameraActive && (
                  <Button variant="secondary" onClick={startCamera} icon={Camera}>Scanner</Button>
                )}
              </div>

              {isCameraActive ? (
                <div className="relative aspect-video bg-black flex flex-col items-center justify-center">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 border-[3px] border-dashed border-blue-400/40 m-12 rounded-lg pointer-events-none" />
                  <div className="absolute bottom-6 flex gap-4">
                    <Button variant="primary" onClick={captureImage} icon={Check} className="px-8 py-3 rounded-full shadow-2xl">Capture</Button>
                    <button onClick={stopCamera} className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white transition-all">
                      <X size={24} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Paste legacy ABAP code here or scan a screenshot..."
                    className="w-full h-96 p-6 font-mono text-sm bg-white focus:outline-none resize-none leading-relaxed transition-all"
                    spellCheck="false"
                  />
                  {loading && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center">
                      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="text-sm font-bold text-gray-600">AI OCR Correction Processing...</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
              <div className="flex items-center gap-2 font-semibold text-gray-700">
                <Wand2 size={18} className="text-purple-600" />
                Special Instructions
              </div>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Optional: 'Rename variables to CamelCase', 'Add check for empty tables'..."
                className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                rows="2"
              />
              <div className="flex justify-end pt-2">
                <Button variant="primary" onClick={handleModernize} disabled={!code.trim() || loading} icon={Wand2} className="px-10 py-3">
                  Optimize ABAP
                </Button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3 text-red-700 animate-in shake duration-300">
                <AlertCircle className="shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in duration-700">
            <div className="relative">
              <div className="w-24 h-24 border-[6px] border-blue-50 rounded-full" />
              <div className="w-24 h-24 border-[6px] border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0" />
              <Cpu className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600 animate-pulse" size={32} />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black text-gray-900">Modernizing Architecture</h2>
              <p className="text-gray-400 font-medium">Refactoring legacy patterns to 7.40+ expressions...</p>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-8 animate-in zoom-in-95 duration-500">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
               <div className="flex items-center gap-3">
                 <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                   {result.performanceGain} Optimization
                 </div>
               </div>
               <div className="flex gap-2">
                 <Button variant="secondary" onClick={() => { setCode(result.modernizedCode); setStep('input'); }} icon={RotateCcw}>Iterate</Button>
                 <Button variant="primary" onClick={() => {
                   const t = document.createElement('textarea'); t.value = result.modernizedCode; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
                 }} icon={Copy}>Copy Code</Button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Original Context</label>
                <div className="bg-slate-900 rounded-2xl p-6 overflow-x-auto border border-slate-800 h-[500px]">
                  <pre className="text-slate-500 font-mono text-xs leading-6 select-none opacity-60">
                    {code.split('\n').map((l, i) => <div key={i}>{l}</div>)}
                  </pre>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2">Modernized Logic</label>
                <div className="bg-slate-900 rounded-2xl p-6 overflow-x-auto border-2 border-blue-500/20 h-[500px] shadow-2xl">
                  <pre className="text-blue-50 font-mono text-xs leading-6">
                    {result.modernizedCode.split('\n').map((line, i) => {
                      const isComment = line.trim().startsWith('"') || line.trim().startsWith('*');
                      return <div key={i} className={isComment ? 'text-green-400 italic' : ''}>{line}</div>;
                    })}
                  </pre>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
                  <Info size={24} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Optimization Report</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Technical Upgrades</h4>
                  {result.explanations.map((item, idx) => (
                    <div key={idx} className="flex gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                      <div className="mt-1 shrink-0 w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold">{idx + 1}</div>
                      <p className="text-sm text-gray-700 leading-relaxed font-medium">{item}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                   <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <span className="text-sm font-bold text-slate-500">ABAP Flavor</span>
                         <span className="text-xs font-black bg-slate-200 px-2 py-1 rounded">7.40+ / 7.50+</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-sm font-bold text-slate-500">Inline Declarations</span>
                         <span className="text-xs font-black text-green-600">ENABLED</span>
                      </div>
                      <div className="h-px bg-slate-200" />
                      <p className="text-xs text-slate-400 font-medium leading-relaxed italic">
                        The modernization engine has successfully replaced static declarations with dynamic inline types and constructor expressions to minimize memory overhead.
                      </p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </main>
    </div>
  );
};

export default App;

```
                
