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
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function App() {
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

    // Increase limit to 50MB. Note: Base64 encoding adds overhead, so very large files may still fail due to request size limits.
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

      const response = await genAI.models.generateContent({
        model: model,
        contents: [
          {
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
        ],
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

  // Helper to convert AudioBuffer to WAV blob
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

      // write WAVE header
      setUint32(0x46464952);                         // "RIFF"
      setUint32(length - 8);                         // file length - 8
      setUint32(0x45564157);                         // "WAVE"

      setUint32(0x20746d66);                         // "fmt " chunk
      setUint32(16);                                 // length = 16
      setUint16(1);                                  // PCM (uncompressed)
      setUint16(numOfChan);
      setUint32(buffer.sampleRate);
      setUint32(buffer.sampleRate * 2 * numOfChan);  // avg. bytes/sec
      setUint16(numOfChan * 2);                      // block-align
      setUint16(16);                                 // 16-bit (hardcoded)

      setUint32(0x61746164);                         // "data" - chunk
      setUint32(length - pos - 4);                   // chunk length

      // write interleaved data
      for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

      while (pos < length) {
        for (i = 0; i < numOfChan; i++) {             // interleave channels
          sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
          sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0; // scale to 16-bit signed int
          view.setInt16(pos, sample, true);          // write 16-bit sample
          pos += 2;
        }
        offset++;                                     // next source sample
      }

      resolve(new Blob([bufferArr], { type: "audio/wav" }));

      function setUint16(data: number) {
        view.setUint16(pos, data, true);
        pos += 2;
      }

      function setUint32(data: number) {
        view.setUint32(pos, data, true);
        pos += 4;
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Video className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Video Scene AI</h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 uppercase tracking-widest">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            System Online
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Controls & Preview */}
          <div className="lg:col-span-5 space-y-8">
            <section className="space-y-4">
              <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Upload className="w-4 h-4" /> 01. Upload Source
              </h2>
              
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 transition-all duration-300
                  ${videoFile 
                    ? 'border-emerald-500/50 bg-emerald-500/5' 
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-900'}
                `}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="video/*,audio/*"
                  className="hidden"
                />
                
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                  {videoFile ? (
                    <>
                      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                        {videoFile.type.startsWith('video/') ? (
                          <Video className="w-8 h-8 text-emerald-500" />
                        ) : (
                          <Music className="w-8 h-8 text-emerald-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-emerald-400">{videoFile.name}</p>
                        <p className="text-xs text-zinc-500 mt-1">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Upload className="w-8 h-8 text-zinc-400" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-300">Drop video/audio or click to browse</p>
                        <p className="text-xs text-zinc-500 mt-1">Supports MP4, MP3, WAV (Max 50MB)</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Languages className="w-4 h-4" /> 02. Configuration
              </h2>
              <div className="space-y-4 bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Transcription Language</label>
                    <select 
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    >
                      {languages.map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Scene Translation</label>
                    <select 
                      value={translationLanguage}
                      onChange={(e) => setTranslationLanguage(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    >
                      {languages.map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <button
                  onClick={processVideo}
                  disabled={!videoFile || isProcessing}
                  className={`
                    w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-300
                    ${!videoFile || isProcessing 
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                      : 'bg-emerald-500 text-black hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/20'}
                  `}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing Video...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Process {videoFile?.type.startsWith('audio/') ? 'Audio' : 'Video'}
                    </>
                  )}
                </button>
              </div>
            </section>

            {audioPreview && (
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <Music className="w-4 h-4" /> Audio Preview
                </h2>
                <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
                  <audio src={audioPreview} controls className="w-full" />
                </div>
              </motion.section>
            )}

            {videoFile?.type.startsWith('video/') && (
              <section className="space-y-4">
                <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <Music className="w-4 h-4" /> 03. Voice Extraction
                </h2>
              <div className="space-y-4 bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">Audio Format</label>
                  <select 
                    value={audioFormat}
                    onChange={(e) => setAudioFormat(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  >
                    <option value="wav">WAV (High Quality)</option>
                    <option value="mp3" disabled>MP3 (Coming Soon)</option>
                  </select>
                </div>
                
                <button
                  onClick={extractAudio}
                  disabled={!videoFile || isExtractingAudio}
                  className={`
                    w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-300
                    ${!videoFile || isExtractingAudio 
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                      : 'bg-zinc-100 text-black hover:bg-white hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-white/10'}
                  `}
                >
                  {isExtractingAudio ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Extracting Audio...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Download Audio
                    </>
                  )}
                </button>
              </div>
            </section>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2"
              >
                <div className="flex items-start gap-3 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </div>
                <div className="pl-8 text-xs text-zinc-500 space-y-1">
                  <p>• Try a shorter clip (under 90s)</p>
                  <p>• Ensure the format is MP4, MOV, MP3, or WAV</p>
                  <p>• Keep file size under 50MB</p>
                  <p>• Reduce video resolution to 720p or 480p</p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <div className="sticky top-24 space-y-4">
              <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4" /> 04. AI Output
              </h2>
              
              <div className="min-h-[600px] bg-zinc-900/30 rounded-3xl border border-zinc-800/50 backdrop-blur-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-zinc-800/50 bg-zinc-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-full text-[10px] font-mono text-zinc-400">
                      <FileText className="w-3 h-3" /> TRANSCRIPTION
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-full text-[10px] font-mono text-zinc-400">
                      <ImageIcon className="w-3 h-3" /> SCENE ANALYSIS
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-full text-[10px] font-mono text-zinc-400">
                      <Sparkles className="w-3 h-3" /> VIDEO PROMPTS
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                  <AnimatePresence mode="wait">
                    {isProcessing ? (
                      <motion.div 
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full flex flex-col items-center justify-center text-center gap-6"
                      >
                        <div className="relative">
                          <div className="w-20 h-20 border-4 border-emerald-500/20 rounded-full animate-pulse" />
                          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-medium text-zinc-200">Processing {videoFile?.type.startsWith('audio/') ? 'Audio' : 'Video'}</h3>
                          <p className="text-sm text-zinc-500 max-w-xs">
                            {videoFile?.type.startsWith('audio/') 
                              ? 'Our AI is listening to your audio and transcribing dialogue...' 
                              : 'Our AI is watching your video, transcribing dialogue, and identifying key scenes...'}
                          </p>
                        </div>
                      </motion.div>
                    ) : result ? (
                      <motion.div 
                        key="result"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="prose prose-invert prose-emerald max-w-none prose-headings:font-mono prose-headings:uppercase prose-headings:tracking-widest prose-headings:text-sm prose-headings:text-zinc-500"
                      >
                        <ReactMarkdown>{result}</ReactMarkdown>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full flex flex-col items-center justify-center text-center gap-4 text-zinc-600"
                      >
                        <Sparkles className="w-12 h-12 opacity-20" />
                        <p className="text-sm font-mono uppercase tracking-widest">Waiting for input...</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
        
        .prose h1 { margin-top: 2rem; border-bottom: 1px solid #27272a; padding-bottom: 0.5rem; }
        .prose h1:first-child { margin-top: 0; }
        .prose p { color: #d4d4d8; line-height: 1.7; }
        .prose strong { color: #10b981; }
      `}} />
    </div>
  );
}
