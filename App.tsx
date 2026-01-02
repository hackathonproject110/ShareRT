import React, { useState, useRef, useEffect } from 'react';
import { AppState } from './types';
import { Button } from './components/Button';
import { StreamCanvas, StreamCanvasHandle } from './components/StreamCanvas';
import { askAboutScreen } from './services/geminiService';

// PeerJS is loaded via script tag in index.html, so we declare it here
declare const Peer: any;

// Unique prefix to avoid collision on the public PeerJS server
const APP_ID_PREFIX = "syncstream-v1-";

const generateShortCode = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Icons
const Icons = {
  Monitor: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>,
  Share: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>,
  Eye: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
  X: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  Sparkles: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z"></path></svg>,
  Send: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>,
  Camera: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>,
  Link: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectionCode, setConnectionCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // PeerJS refs
  const peerRef = useRef<any>(null);
  const connRef = useRef<any>(null); // For data connection if needed later
  
  // AI Interaction State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const streamCanvasRef = useRef<StreamCanvasHandle>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setStream(null);
  };

  const resetToHome = () => {
    cleanup();
    setAppState(AppState.IDLE);
    setConnectionCode("");
    setInputCode("");
    setIsAiModalOpen(false);
    setErrorMsg(null);
  };

  // --- SENDER FLOW ---

  const startSenderMode = async () => {
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen sharing is not supported on this device/browser.");
      }

      // 1. Get Screen Stream
      const displayMedia = await navigator.mediaDevices.getDisplayMedia({
        video: {
            cursor: "always"
        } as any,
        audio: false 
      });

      // Handle user cancelling screen share via browser UI
      displayMedia.getVideoTracks()[0].onended = () => {
        resetToHome();
      };

      setStream(displayMedia);
      
      // 2. Initialize Peer
      const code = generateShortCode();
      setConnectionCode(code);
      setAppState(AppState.SENDER_WAITING);

      const peer = new Peer(APP_ID_PREFIX + code);
      peerRef.current = peer;

      peer.on('open', (id: string) => {
        console.log('Sender Peer ID:', id);
      });

      peer.on('call', (call: any) => {
        // Answer incoming call with our screen stream
        console.log("Receiving call from viewer");
        call.answer(displayMedia);
        setAppState(AppState.SENDER_SHARING);
      });

      peer.on('error', (err: any) => {
        console.error("Peer error:", err);
        setErrorMsg("Connection error. Please restart.");
      });

    } catch (err: any) {
      console.error("Sender Error:", err);
      if (err.name === 'NotAllowedError') {
        // User cancelled
      } else {
        setErrorMsg(err.message || "Failed to start sharing.");
      }
    }
  };

  // --- RECEIVER FLOW ---

  const startReceiverMode = () => {
    setAppState(AppState.RECEIVER_ENTERING_CODE);
  };

  const connectToSender = () => {
    if (inputCode.length !== 4) return;
    
    setAppState(AppState.RECEIVER_CONNECTING);
    setErrorMsg(null);

    // Create a temporary peer for the receiver (viewer)
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id: string) => {
      console.log("Receiver Peer ID:", id);
      const destId = APP_ID_PREFIX + inputCode;
      
      // Call the sender
      const call = peer.call(destId, new MediaStream()); // Send empty stream or just init call
      
      // Wait for stream
      call.on('stream', (remoteStream: MediaStream) => {
        console.log("Received remote stream");
        setStream(remoteStream);
        setAppState(AppState.RECEIVER_VIEWING);
      });

      call.on('close', () => {
        alert("Host ended the session");
        resetToHome();
      });
      
      // Timeout safety
      setTimeout(() => {
          if (appStateRef.current === AppState.RECEIVER_CONNECTING) {
              setErrorMsg("Connection timed out. Check code and try again.");
              setAppState(AppState.RECEIVER_ENTERING_CODE);
          }
      }, 10000);
    });

    peer.on('error', (err: any) => {
      console.error("Receiver Peer Error:", err);
      setErrorMsg("Could not connect. Is the code correct?");
      setAppState(AppState.RECEIVER_ENTERING_CODE);
    });
  };

  // Ref to track state in timeouts
  const appStateRef = useRef(appState);
  useEffect(() => { appStateRef.current = appState; }, [appState]);


  // --- AI LOGIC (Same as before) ---
  
  const openAiInterface = () => {
    if (streamCanvasRef.current) {
      const img = streamCanvasRef.current.captureFrame();
      if (img) {
        setSnapshot(img);
        setIsAiModalOpen(true);
        setQuestion("");
        setAnswer(null);
      }
    }
  };

  const closeAiInterface = () => {
    setIsAiModalOpen(false);
    setSnapshot(null);
    setAnswer(null);
  };

  const handleAskAi = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!question.trim() || !snapshot) return;

    setIsAnalyzing(true);
    const result = await askAboutScreen(snapshot, question);
    setAnswer(result);
    setIsAnalyzing(false);
  };

  // --- RENDER ---

  const isIdle = appState === AppState.IDLE;
  
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-white/20">
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={resetToHome}>
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
             <Icons.Monitor />
          </div>
          <span className="font-semibold text-lg tracking-tight">SyncStream</span>
        </div>
        
        <div className="flex items-center gap-4">
           {(appState === AppState.SENDER_SHARING || appState === AppState.RECEIVER_VIEWING) && (
               <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                   <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                   <span className="text-xs font-medium text-green-400 uppercase tracking-wider">Connected</span>
               </div>
           )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 pt-24 pb-12 px-4 md:px-6 flex flex-col items-center justify-center min-h-screen relative overflow-hidden">
        
        {/* Ambient Bg */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>

        {/* --- IDLE STATE: Selection Menu --- */}
        {isIdle && (
          <div className="relative z-10 max-w-4xl w-full animate-in fade-in zoom-in duration-500 flex flex-col items-center text-center space-y-12">
            
            <div className="space-y-4 max-w-2xl">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tighter bg-gradient-to-br from-white via-white to-zinc-500 bg-clip-text text-transparent">
                Cross-Device Sync.
              </h1>
              <p className="text-zinc-400 text-lg leading-relaxed">
                Share your phone screen to your laptop, or vice versa. <br className="hidden md:block"/>
                Analyze any app, design, or error with Gemini AI on the big screen.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
               
               {/* Option 1: Share (Sender) */}
               <button 
                 onClick={startSenderMode}
                 className="group relative p-8 rounded-3xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-900 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 text-left flex flex-col h-64 justify-between overflow-hidden"
               >
                  <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 rounded-full blur-[60px] group-hover:bg-indigo-500/20 transition-all"></div>
                  <div className="relative z-10 p-3 bg-zinc-800 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icons.Share />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-2xl font-semibold mb-2 group-hover:text-indigo-400 transition-colors">Share Screen</h3>
                    <p className="text-zinc-500 text-sm">Broadcast this device's screen. Perfect for showing mobile apps on desktop.</p>
                  </div>
               </button>

               {/* Option 2: View (Receiver) */}
               <button 
                 onClick={startReceiverMode}
                 className="group relative p-8 rounded-3xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-900 hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300 text-left flex flex-col h-64 justify-between overflow-hidden"
               >
                  <div className="absolute top-0 right-0 p-32 bg-purple-500/10 rounded-full blur-[60px] group-hover:bg-purple-500/20 transition-all"></div>
                  <div className="relative z-10 p-3 bg-zinc-800 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icons.Eye />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-2xl font-semibold mb-2 group-hover:text-purple-400 transition-colors">View Screen</h3>
                    <p className="text-zinc-500 text-sm">Watch a remote screen here. Use AI to analyze what you see.</p>
                  </div>
               </button>
            </div>

             {errorMsg && (
                <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-sm animate-in fade-in">
                    {errorMsg}
                </div>
            )}
          </div>
        )}

        {/* --- SENDER STATE: Waiting / Sharing --- */}
        {(appState === AppState.SENDER_WAITING || appState === AppState.SENDER_SHARING) && (
             <div className="w-full max-w-3xl flex flex-col items-center animate-in fade-in slide-in-from-bottom-8">
                
                {/* Local Preview */}
                <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5 mb-8">
                    <StreamCanvas 
                        stream={stream} 
                        className="w-full h-full object-contain opacity-50" 
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <div className="p-8 bg-black/60 backdrop-blur-xl rounded-3xl border border-white/10 text-center space-y-4">
                            <p className="text-zinc-400 text-sm uppercase tracking-widest font-medium">Connection Code</p>
                            <div className="text-6xl md:text-8xl font-mono font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500 select-all">
                                {connectionCode}
                            </div>
                            <p className="text-zinc-500 text-sm">
                                {appState === AppState.SENDER_WAITING ? "Enter this code on the other device." : "Device Connected & Sharing"}
                            </p>
                         </div>
                    </div>
                </div>

                <Button variant="danger" onClick={resetToHome}>Stop Sharing</Button>
             </div>
        )}

        {/* --- RECEIVER STATE: Enter Code --- */}
        {(appState === AppState.RECEIVER_ENTERING_CODE || appState === AppState.RECEIVER_CONNECTING) && (
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8">
                <div className="bg-zinc-900 rounded-3xl p-8 border border-white/10 shadow-2xl space-y-6">
                    <div className="text-center space-y-2">
                        <div className="w-12 h-12 bg-zinc-800 rounded-xl mx-auto flex items-center justify-center mb-4">
                            <Icons.Link />
                        </div>
                        <h2 className="text-2xl font-bold">Connect to Device</h2>
                        <p className="text-zinc-400 text-sm">Enter the 4-digit code displayed on the sharing device.</p>
                    </div>

                    <div className="flex justify-center gap-2">
                         <input 
                            type="text" 
                            maxLength={4}
                            value={inputCode}
                            onChange={(e) => setInputCode(e.target.value.replace(/\D/g,''))}
                            placeholder="0000"
                            className="w-full text-center bg-zinc-950 border border-zinc-800 rounded-2xl py-4 text-4xl font-mono tracking-[0.5em] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-800"
                            autoFocus
                         />
                    </div>

                    {errorMsg && <p className="text-red-400 text-xs text-center">{errorMsg}</p>}

                    <div className="flex gap-3">
                         <Button variant="ghost" onClick={resetToHome} className="flex-1">Cancel</Button>
                         <Button 
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white border-0" 
                            disabled={inputCode.length !== 4 || appState === AppState.RECEIVER_CONNECTING}
                            onClick={connectToSender}
                         >
                            {appState === AppState.RECEIVER_CONNECTING ? "Connecting..." : "Connect"}
                         </Button>
                    </div>
                </div>
            </div>
        )}

        {/* --- RECEIVER STATE: Viewing Stream (With AI) --- */}
        {appState === AppState.RECEIVER_VIEWING && (
            <div className="w-full h-full flex flex-col items-center justify-center relative max-w-6xl mx-auto animate-in fade-in">
                 
                 <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5">
                    <StreamCanvas 
                        ref={streamCanvasRef}
                        stream={stream} 
                        className="w-full h-full object-contain"
                    />
                 </div>

                 {/* Control Bar */}
                 <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-zinc-900/90 backdrop-blur-lg border border-white/10 rounded-full shadow-2xl z-50">
                    <Button 
                        variant="ghost" 
                        onClick={openAiInterface} 
                        className="w-12 h-12 p-0 rounded-full hover:bg-indigo-500/20 hover:text-indigo-400 transition-all duration-300 relative group"
                        title="Snapshot & Ask AI"
                    >
                        <Icons.Camera />
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            Ask AI
                        </span>
                    </Button>
                    
                    <div className="w-[1px] h-6 bg-zinc-700 mx-1"></div>

                    <Button 
                        variant="danger" 
                        onClick={resetToHome}
                        className="pl-4 pr-6"
                    >
                        <span className="mr-2"><Icons.X /></span>
                        Disconnect
                    </Button>
                </div>

                {/* AI Modal (Same as before) */}
                {isAiModalOpen && snapshot && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
                        
                        <div className="w-full md:w-2/3 bg-black relative flex items-center justify-center p-4 border-b md:border-b-0 md:border-r border-white/10">
                            <img src={snapshot} alt="Screen capture" className="max-w-full max-h-[40vh] md:max-h-full object-contain rounded-lg shadow-lg" />
                            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur text-xs px-2 py-1 rounded text-white/70">
                                Remote Screen Snapshot
                            </div>
                        </div>

                        <div className="w-full md:w-1/3 flex flex-col bg-zinc-900">
                            <div className="p-4 border-b border-white/5 flex justify-between items-center">
                                <div className="flex items-center gap-2 text-indigo-400">
                                    <Icons.Sparkles />
                                    <span className="font-semibold text-sm tracking-wide uppercase">Ask AI</span>
                                </div>
                                <button onClick={closeAiInterface} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 transition-colors">
                                    <Icons.X />
                                </button>
                            </div>

                            <div className="flex-1 p-4 overflow-y-auto min-h-[200px] md:min-h-0 space-y-4">
                                {answer ? (
                                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                        <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed">{answer}</p>
                                        <div className="mt-4 flex justify-end">
                                             <button 
                                                onClick={() => setAnswer(null)} 
                                                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                             >
                                                Ask another question
                                             </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm text-center p-4">
                                        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-3">
                                            <Icons.Camera />
                                        </div>
                                        <p>I'm ready to analyze this screen.</p>
                                        <p className="mt-1 text-xs opacity-60">"Analyze this app design"<br/>"What is this error?"</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-zinc-950/50 border-t border-white/5">
                                <form onSubmit={handleAskAi} className="relative">
                                    <input
                                        type="text"
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                        placeholder="Ask about this screen..."
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-zinc-600"
                                        autoFocus
                                        disabled={isAnalyzing}
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!question.trim() || isAnalyzing}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:bg-transparent transition-all"
                                    >
                                        {isAnalyzing ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <Icons.Send />
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
        )}
      </main>
    </div>
  );
};

export default App;