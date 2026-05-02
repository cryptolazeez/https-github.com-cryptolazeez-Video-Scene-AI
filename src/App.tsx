/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { 
  Video, 
  Languages, 
  Sparkles, 
  Upload, 
  Loader2, 
  FileText, 
  Image as ImageIcon,
  Music,
  Download,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Initialize states
export default function App() {
  const [showApp, setShowApp] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [language, setLanguage] = useState('English');
  const [translationLanguage, setTranslationLanguage] = useState('English');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtractingAudio, setIsExtractingAudio] = useState(false);
  const [audioFormat, setAudioFormat] = useState('wav');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
        setVideoFile(file);
        if (file.type.startsWith('video/')) {
          setVideoPreview(URL.createObjectURL(file));
          setAudioPreview(null);
        } else {
          setAudioPreview(URL.createObjectURL(file));
          setVideoPreview(null);
        }
        setError(null);
        setResult(null);
      } else {
        setError('Please select a valid video or audio file.');
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('video/') || file.type.startsWith('audio/'))) {
      setVideoFile(file);
      if (file.type.startsWith('video/')) {
        setVideoPreview(URL.createObjectURL(file));
        setAudioPreview(null);
      } else {
        setAudioPreview(URL.createObjectURL(file));
        setVideoPreview(null);
      }
      setError(null);
      setResult(null);
    } else {
      setError('Please drop a valid video or audio file.');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const processVideo = async () => {
    if (!videoFile) return;

    if (videoFile.size > 50 * 1024 * 1024) {
      setError("File is too large for AI analysis (max 50MB). Please upload a smaller clip or use a lower-resolution version.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const base64Media = await fileToBase64(videoFile);
      const isAudio = videoFile.type.startsWith('audio/');
      
      const model = "gemini-3-flash-preview";
      const prompt = isAudio ? `
        Listen to this audio carefully. 
        1. Provide a full transcription in ${language}.
        2. Provide a summary of the audio content.
        3. Provide a natural translation of the summary into ${translationLanguage}.
        
        Format as Markdown:
        # Transcription (${language})
        [Text]
        
        # Audio Summary
        [Summary]
        
        # Translation (${translationLanguage})
        [Translated Summary]
      ` : `
        Watch this video carefully. 
        1. Provide a full transcription in ${language}.
        2. For every distinct scene, provide a highly detailed Image Prompt (English) for DALL-E/Midjourney.
        3. For every distinct scene, provide a cinematic Image-to-Video Prompt (English) for SORA/Runway.
        4. Provide a natural translation of the scene descriptions into ${translationLanguage}.
        
        Format as Markdown:
        # Transcription (${language})
        [Text]
        
        # Scene Analysis
        ## Scene [X]: [Description]
        - **Image Prompt:** ...
        - **Video Prompt:** ...
        - **Translation:** ...
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: videoFile.type || (isAudio ? 'audio/mp3' : 'video/mp4'),
                data: base64Media,
              },
            },
          ],
        },
      });

      const text = response.text;
      if (text) {
        setResult(text);
      } else {
        throw new Error("No response from AI model.");
      }
    } catch (err: any) {
      console.error("Processing error:", err);
      setError(err.message || "An error occurred while processing the video.");
    } finally {
      setIsProcessing(false);
    }
  };

  const languages = [
    'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 
    'Korean', 'Arabic', 'Portuguese', 'Russian', 'Hindi', 'Italian'
  ];

  const extractAudio = async () => {
    if (!videoFile) return;
    setIsExtractingAudio(true);
    setError(null);

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await videoFile.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const wavBlob = await audioBufferToWav(audioBuffer);
      const url = URL.createObjectURL(wavBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${videoFile.name.split('.')[0]}.${audioFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Audio extraction error:", err);
      setError("Failed to extract audio. The video format might not be supported for direct extraction.");
    } finally {
      setIsExtractingAudio(false);
    }
  };

  const audioBufferToWav = (buffer: AudioBuffer): Promise<Blob> => {
    return new Promise((resolve) => {
      const numOfChan = buffer.numberOfChannels;
      const length = buffer.length * numOfChan * 2 + 44;
      const bufferArr = new ArrayBuffer(length);
      const view = new DataView(bufferArr);
      const channels = [];
      let i;
      let sample;
      let offset = 0;
      let pos = 0;

      const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
      const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

      setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
      setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
      setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
      setUint16(numOfChan * 2); setUint16(16);
      setUint32(0x61746164); setUint32(length - pos - 4);

      for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
      while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
          sample = Math.max(-1, Math.min(1, channels[i][offset]));
          sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
          view.setInt16(pos, sample, true); pos += 2;
        }
        offset++;
      }
      resolve(new Blob([bufferArr], { type: "audio/wav" }));
    });
  };

  if (!showApp) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[#030303] flex flex-col items-center">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-zinc-500/10 blur-[120px] rounded-full" />
        </div>

        <header className="w-full max-w-7xl mx-auto px-6 h-24 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center font-serif italic text-xl font-black transition-transform group-hover:rotate-12">C</div>
            <span className="text-xl font-semibold tracking-tight text-white">CineScript AI</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#" className="hover:text-white transition-colors">Vision</a>
            <a href="#" className="hover:text-white transition-colors">API</a>
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
          </nav>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-6 flex flex-col items-center relative z-10 py-20">
          {/* Hero Section */}
          <section className="text-center space-y-8 max-w-4xl mb-32 pt-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] gradient-text text-balance">
                UNLOCK THE SILENT <span className="font-serif italic font-normal">Narrative</span> OF FILM
              </h1>
            </motion.div>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
            >
              CineScript AI is a professional-grade suite for cinematic transcription, scene-by-scene analysis, and AI prompt engineering. Convert moving images into high-fidelity structured intelligence.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
            >
              <button 
                onClick={() => setShowApp(true)}
                className="px-8 py-4 bg-white text-black rounded-full font-bold hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
              >
                Launch Studio <Sparkles className="w-5 h-5 fill-black" />
              </button>
              <button className="px-8 py-4 bg-zinc-900 text-white rounded-full font-bold border border-white/5 hover:bg-zinc-800 transition-all">
                Explore Documentation
              </button>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em] pt-4"
            >
              Powered by <a href="https://imagineverse.studio" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-emerald-500 transition-colors">imagineverse.studio</a>
            </motion.p>
          </section>

          {/* Features Grid */}
          <section className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-32">
            {[
              {
                title: "Cinematic Transcription",
                desc: "Powered by Gemini 1.5 Pro, extract every word from your media with frame-accurate context in 100+ languages.",
                icon: <Music className="w-6 h-6" />
              },
              {
                title: "Scene Vision Matrix",
                desc: "Identify key cinematic shifts automatically. Our AI identifies lighting, composition, and emotional beats per scene.",
                icon: <Video className="w-6 h-6" />
              },
              {
                title: "Prompt Engineering",
                desc: "Generate production-ready image and video prompts for DALL-E, Midjourney, SORA, and Runway Gen-3.",
                icon: <Sparkles className="w-6 h-6" />
              }
            ].map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="glass-card p-10 rounded-[2.5rem] border border-white/5 space-y-4 hover:border-emerald-500/20 transition-colors"
              >
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-emerald-500">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold">{f.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </section>

          {/* How it Works / AEO Section */}
          <section className="w-full max-w-4xl mx-auto space-y-16 mb-32">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-black tracking-tight font-serif italic">Operational Workflow</h2>
              <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">End-to-End Intelligence Pipeline</p>
            </div>

            <div className="space-y-12">
              {[
                { step: "01", title: "Asset Ingestion", text: "Upload video or audio files up to 50MB. Our system supports high-resolution MP4 clips and lossless WAV signal buffers." },
                { step: "02", title: "Neural Decoding", text: "Gemini 1.5 Pro analyzes the media stream, performing multilingual transcription and visual vector mapping simultaneously." },
                { step: "03", title: "Prompt Synthesis", text: "Receive structured Markdown output including full dialog, cinematic scene prompts, and localized translations ready for production." }
              ].map((s, i) => (
                <div key={i} className="flex gap-8 group">
                  <div className="font-serif italic text-6xl text-zinc-900 group-hover:text-emerald-500/20 transition-colors duration-500 select-none">{s.step}</div>
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xl font-bold">{s.title}</h4>
                    <p className="text-zinc-500 leading-relaxed text-sm">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ / AEO Context */}
          <section className="w-full max-w-4xl mx-auto glass-card p-12 rounded-[3rem] border border-white/5 space-y-12">
            <h2 className="text-2xl font-bold border-b border-white/5 pb-6">Frequently Asked Questions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-2">
                <h4 className="font-bold text-sm uppercase tracking-wider text-emerald-500/80">What is CineScript AI?</h4>
                <p className="text-xs text-zinc-500 leading-loose">CineScript AI is a specialized tool for creators, researchers, and prompt engineers to analyze video content, extract scripts, and generate high-fidelity AI prompts for image and video synthesis.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-sm uppercase tracking-wider text-emerald-500/80">Support AI Models?</h4>
                <p className="text-xs text-zinc-500 leading-loose">We optimize outputs specifically for DALL-E 3, Midjourney v6, SORA, Runway Gen-3, and Luma Dream Machine.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-sm uppercase tracking-wider text-emerald-500/80">Is it free to use?</h4>
                <p className="text-xs text-zinc-500 leading-loose">CineScript AI currently operates as a free creative suite powered by the Gemini 1.5 API for professional development.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-sm uppercase tracking-wider text-emerald-500/80">Maximum File Limits?</h4>
                <p className="text-xs text-zinc-500 leading-loose">Current limits allow for assets up to 50MB, perfectly suited for high-quality cinematic shorts and audio sequences.</p>
              </div>
            </div>
          </section>
        </main>

        <footer className="w-full py-10 border-t border-white/5 relative z-10">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest">© 2024 CineScript Industries. All Rights Reserved.</p>
              <p className="text-[10px] font-mono text-zinc-800 uppercase tracking-[0.2em]">Powered by <a href="https://imagineverse.studio" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500 transition-colors">imagineverse.studio</a></p>
            </div>
            <div className="flex gap-8">
              <ImageIcon className="w-5 h-5 text-zinc-600" />
              <Video className="w-5 h-5 text-zinc-600" />
              <Music className="w-5 h-5 text-zinc-600" />
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 font-sans selection:bg-emerald-500/30">
      <header className="border-b border-white/5 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-50 overflow-hidden">
        {/* Subtle top light bar */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowApp(false)}
              className="w-10 h-10 bg-zinc-900 border border-white/10 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-all font-serif italic text-lg"
            >
              C
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">CineScript AI</h1>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Creative Intelligence Studio</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-zinc-900/50 border border-white/5 rounded-full text-[10px] font-mono text-zinc-400">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              SYSTEM LOAD: ULTRA
            </div>
            <button className="p-2 hover:bg-zinc-900 rounded-full transition-colors">
              <Upload className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-10">
            {/* Step 1 */}
            <section className="space-y-6">
              <div className="flex items-end gap-3 px-2">
                <span className="font-serif italic text-4xl leading-none font-black text-white/20">01</span>
                <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-[0.2em] mb-1">Source Acquisition</h2>
              </div>
              
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative group cursor-pointer border border-dashed rounded-[2rem] p-10 transition-all duration-500 overflow-hidden
                  ${videoFile 
                    ? 'border-emerald-500/30 bg-emerald-500/[0.02]' 
                    : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/20 hover:bg-zinc-900/40'}
                `}
              >
                {/* Decorative corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-zinc-700/50 group-hover:border-emerald-500/50 transition-colors" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-zinc-700/50 group-hover:border-emerald-500/50 transition-colors" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-zinc-700/50 group-hover:border-emerald-500/50 transition-colors" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-zinc-700/50 group-hover:border-emerald-500/50 transition-colors" />

                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*,audio/*" className="hidden" />
                
                <div className="flex flex-col items-center justify-center gap-6 text-center">
                  <AnimatePresence mode="wait">
                    {videoFile ? (
                      <motion.div 
                        key="active"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-4"
                      >
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto ring-1 ring-emerald-500/20">
                          {videoFile.type.startsWith('video/') ? (
                            <Video className="w-10 h-10 text-emerald-500" />
                          ) : (
                            <Music className="w-10 h-10 text-emerald-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-lg text-white">{videoFile.name}</p>
                          <p className="text-xs font-mono text-zinc-500 mt-2">SIZE: {(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="empty"
                        className="space-y-4"
                      >
                        <div className="w-20 h-20 bg-zinc-900 border border-white/5 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500">
                          <Upload className="w-8 h-8 text-zinc-500 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-200">Ingest Media Assets</p>
                          <p className="text-[10px] font-mono text-zinc-600 mt-2 uppercase tracking-widest leading-loose">MP4, MOV, MP3, WAV<br/>MAXIMUM LOAD: 50.00 MB</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </section>

            {/* Step 2 */}
            <section className="space-y-6">
              <div className="flex items-end gap-3 px-2">
                <span className="font-serif italic text-4xl leading-none font-black text-white/20">02</span>
                <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-[0.2em] mb-1">Intelligence Mapping</h2>
              </div>
              <div className="space-y-6 glass-card p-8 rounded-[2rem] border border-white/5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Base Dialect</label>
                    <select 
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer hover:bg-zinc-900"
                    >
                      {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Target Translation</label>
                    <select 
                      value={translationLanguage}
                      onChange={(e) => setTranslationLanguage(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer hover:bg-zinc-900"
                    >
                      {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                  </div>
                </div>
                
                <button
                  onClick={processVideo}
                  disabled={!videoFile || isProcessing}
                  className={`
                    w-full py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all duration-500 relative overflow-hidden group
                    ${!videoFile || isProcessing 
                      ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed opacity-50' 
                      : 'bg-emerald-500 text-black hover:bg-emerald-400 emerald-glow'}
                  `}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-mono uppercase tracking-widest text-xs">ANALYZING BUFFER...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span className="font-mono uppercase tracking-widest text-xs">INITIALIZE PROCESSING</span>
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Previews / Secondary Tools */}
            <AnimatePresence>
              {audioPreview && (
                <motion.section 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="flex items-end gap-3 px-2">
                    <span className="font-serif italic text-4xl leading-none font-black text-white/20">0*</span>
                    <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-[0.2em] mb-1">Acoustic Signal</h2>
                  </div>
                  <div className="glass-card p-6 rounded-[2rem]">
                    <audio src={audioPreview} controls className="w-full invert opacity-80" />
                  </div>
                </motion.section>
              )}

              {videoFile?.type.startsWith('video/') && (
                <motion.section 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-6 overflow-hidden"
                >
                  <div className="flex items-end gap-3 px-2">
                    <span className="font-serif italic text-4xl leading-none font-black text-white/20">03</span>
                    <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-[0.2em] mb-1">Vector Extraction</h2>
                  </div>
                  <div className="glass-card p-8 rounded-[2rem]">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Encoding Format</label>
                        <select 
                          value={audioFormat}
                          onChange={(e) => setAudioFormat(e.target.value)}
                          className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none appearance-none"
                        >
                          <option value="wav">WAV lossless</option>
                          <option value="mp3" disabled>MP3 (Legacy)</option>
                        </select>
                      </div>
                      
                      <button
                        onClick={extractAudio}
                        disabled={!videoFile || isExtractingAudio}
                        className="w-full py-5 border border-white/10 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white hover:text-black transition-all group"
                      >
                        {isExtractingAudio ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Download className="w-5 h-5 transition-transform group-hover:-translate-y-1" />
                        )}
                        <span className="font-mono uppercase tracking-widest text-xs">Rip Archive</span>
                      </button>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl space-y-4">
                <div className="flex items-start gap-4 text-red-500 text-xs font-mono uppercase tracking-widest leading-loose">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </div>
                <div className="pl-9 text-[10px] text-zinc-600 font-mono space-y-2 uppercase leading-relaxed">
                  <p>• DURATION LIMIT: &lt;90S</p>
                  <p>• VOLUMETRIC LIMIT: &lt;50MB</p>
                  <p>• RESOLUTION OPTIMAL: 720P / 480P</p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column: Intelligence Output */}
          <div className="lg:col-span-7">
            <div className="sticky top-28 space-y-6">
              <div className="flex items-end justify-between px-2">
                <div className="flex items-end gap-3">
                   <span className="font-serif italic text-4xl leading-none font-black text-white/20">04</span>
                   <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-[0.2em] mb-1">Generated Output</h2>
                </div>
                {result && (
                  <button 
                    onClick={() => { navigator.clipboard.writeText(result); }}
                    className="text-[10px] font-mono text-zinc-500 hover:text-emerald-500 transition-colors uppercase tracking-[0.2em]"
                  >
                    Copy Intelligence
                  </button>
                )}
              </div>
              
              <div className="min-h-[700px] glass-card rounded-[2.5rem] border border-white/5 overflow-hidden flex flex-col shadow-2xl relative shadow-black/50">
                {/* Decorative scanning line animation */}
                {isProcessing && (
                  <motion.div 
                    initial={{ top: "-100%" }}
                    animate={{ top: "200%" }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent z-10 pointer-events-none"
                  />
                )}

                <div className="flex-1 p-10 overflow-y-auto custom-scrollbar relative z-0">
                  <AnimatePresence mode="wait">
                    {isProcessing ? (
                      <motion.div 
                        key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="h-full flex flex-col items-center justify-center text-center gap-10"
                      >
                        <div className="relative">
                          <div className="w-32 h-32 border border-white/5 rounded-full animate-[spin_8s_linear_infinite]" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                          </div>
                        </div>
                        <div className="max-w-xs space-y-4">
                          <h3 className="text-sm font-mono text-white uppercase tracking-[0.3em] font-black">Decrypting Signals</h3>
                          <p className="text-[10px] text-zinc-500 font-mono leading-loose uppercase tracking-widest">
                            {videoFile?.type.startsWith('audio/') 
                              ? 'Linguistic extraction in progress... Syncing semantic nodes.' 
                              : 'Photogrammetric sequencing active... Mapping cinematic vectors.'}
                          </p>
                        </div>
                      </motion.div>
                    ) : result ? (
                      <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="pb-10">
                        <div className="prose prose-invert prose-emerald max-w-none prose-headings:font-serif prose-headings:italic prose-headings:font-black prose-headings:text-3xl prose-headings:mb-6 prose-p:text-zinc-400 prose-p:leading-relaxed prose-strong:text-white prose-code:text-emerald-400">
                          <ReactMarkdown>{result}</ReactMarkdown>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-center gap-8">
                        <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center border border-white/5 shadow-inner">
                          <Sparkles className="w-8 h-8 text-zinc-700" />
                        </div>
                        <div className="space-y-2">
                           <p className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-700">Awaiting Signal</p>
                           <p className="text-[10px] font-mono text-zinc-800 uppercase tracking-[0.2em]">CineScript Intelligence Engine v2.1</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 mt-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white text-black rounded-full flex items-center justify-center font-serif italic text-xs font-black">C</div>
              <span className="text-sm font-bold tracking-tight text-white">CineScript AI</span>
            </div>
            <p className="text-[10px] font-mono text-zinc-700 uppercase tracking-[0.2em]">Powered by <a href="https://imagineverse.studio" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500 transition-colors">imagineverse.studio</a></p>
          </div>
          <p className="text-zinc-600 text-[10px] font-mono uppercase tracking-[0.2em]">Experimental Neural Engine • v2.1.0-STABLE</p>
          <div className="flex gap-6">
            <a href="#" className="text-zinc-500 hover:text-white transition-colors text-[10px] font-mono uppercase tracking-widest">Privacy</a>
            <a href="#" className="text-zinc-500 hover:text-white transition-colors text-[10px] font-mono uppercase tracking-widest">Terms</a>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
        .prose h1 { 
          font-family: var(--font-serif);
          font-style: italic;
          font-weight: 900;
          font-size: 2.5rem;
          margin-top: 4rem;
          margin-bottom: 2rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 1rem;
        }
        .prose h1:first-child { margin-top: 0; }
        .prose h2 { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.75rem; color: #71717a; margin-top: 3rem; }
        .prose ul { list-style-type: none; padding-left: 0; }
        .prose li { display: block; margin-bottom: 1rem; border-left: 1px solid rgba(16,185,129,0.2); padding-left: 1.5rem; }
      `}} />
    </div>
  );
}
