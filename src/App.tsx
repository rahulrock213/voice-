import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Play, Square, Loader2, AlertCircle, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { AudioPlayer } from './utils/audio';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const EMOTIONS = [
  { label: 'Warm', value: 'warmly, with a soothing, empathetic, and highly expressive human tone' },
  { label: 'CGP Grey Style', value: 'like the YouTuber CGP Grey: speaking quickly but extremely clearly, highly articulate, analytical, slightly cynical but very engaging, using precise enunciation and a matter-of-fact explanatory tone' },
  { label: 'Cheerful', value: 'cheerfully, with bright energy, excitement, and a big smile in your voice' },
  { label: 'Empathetic', value: 'with deep empathy, softness, understanding, and emotional resonance' },
  { label: 'Dramatic', value: 'dramatically, with theatrical pauses, intense emotion, and dynamic range' },
  { label: 'Calm', value: 'very calmly, peacefully, slowly, and with a relaxing human presence' },
];

const VOICES = [
  { label: 'Aoede (Warm)', value: 'Aoede' },
  { label: 'Zephyr (Energetic)', value: 'Zephyr' },
  { label: 'Charon (Deep)', value: 'Charon' },
  { label: 'Puck (Bright)', value: 'Puck' },
  { label: 'Kore (Clear)', value: 'Kore' },
  { label: 'Fenrir (Strong)', value: 'Fenrir' },
];

function chunkText(text: string, maxLength: number = 800): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  // Split by sentences, keeping punctuation
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

export default function App() {
  const [text, setText] = useState('');
  const [emotion, setEmotion] = useState(EMOTIONS[0].value);
  const [voice, setVoice] = useState(VOICES[0].value);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const playerRef = useRef<AudioPlayer | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    playerRef.current = new AudioPlayer((speaking) => {
      setIsSpeaking(speaking);
    });
    return () => {
      playerRef.current?.close();
    };
  }, []);

  const handleRead = async () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    setError(null);
    cancelRef.current = false;
    
    try {
      // Stop any currently playing audio
      playerRef.current?.stop();

      const chunks = chunkText(text, 800);

      for (let i = 0; i < chunks.length; i++) {
        if (cancelRef.current) break;

        // Wait if we have more than 15 seconds of audio buffered
        while (playerRef.current && playerRef.current.bufferedDuration > 15) {
          if (cancelRef.current) break;
          await new Promise(r => setTimeout(r, 500));
        }

        if (cancelRef.current) break;

        // Instruct the TTS model to read the text with the selected emotion
        const prompt = `Read the following text ${emotion}. Add natural pauses, breaths, and emotional inflection to make it sound like a real human speaking. Text: "${chunks[i]}"`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: prompt,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
          },
        });

        if (cancelRef.current) break;

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        
        if (base64Audio && playerRef.current) {
          await playerRef.current.playBase64Pcm(base64Audio);
        } else {
          throw new Error("No audio was generated. Please try again.");
        }
      }
    } catch (err: any) {
      if (!cancelRef.current) {
        console.error(err);
        setError(err.message || "Failed to generate audio");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const stopReading = () => {
    cancelRef.current = true;
    playerRef.current?.stop();
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-black text-[#f5f5f7] font-sans pb-32 selection:bg-white/30">
      {/* Ambient Background like Apple Music */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            opacity: isSpeaking ? 0.4 : 0.1,
            scale: isSpeaking ? 1.1 : 1,
          }}
          transition={{ duration: 4, repeat: Infinity, repeatType: "reverse" }}
          className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-600/30 blur-[120px]"
        />
        <motion.div
          animate={{
            opacity: isSpeaking ? 0.3 : 0.05,
            scale: isSpeaking ? 1.2 : 1,
          }}
          transition={{ duration: 5, repeat: Infinity, repeatType: "reverse", delay: 1 }}
          className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-600/20 blur-[120px]"
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-12">
        <header className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">
            Aura.
          </h1>
          <p className="text-xl md:text-2xl text-[#86868b] font-medium tracking-tight">
            Hear your words come alive.
          </p>
        </header>

        <div className="space-y-12">
          {/* Text Input */}
          <div className="relative group">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste your text here..."
              className="w-full h-64 bg-[#1c1c1e]/80 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 text-2xl md:text-3xl font-medium leading-relaxed focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none placeholder:text-[#424245] shadow-2xl"
              maxLength={30000}
            />
          </div>

          {/* Controls */}
          <div className="grid md:grid-cols-2 gap-12">
            {/* Voice Selection */}
            <div>
              <h2 className="text-xs uppercase tracking-widest text-[#86868b] font-bold mb-4 ml-2">Voice</h2>
              <div className="flex flex-wrap gap-2">
                {VOICES.map((v) => (
                  <button
                    key={v.label}
                    onClick={() => setVoice(v.value)}
                    className={`px-5 py-3 rounded-full text-sm font-semibold transition-all duration-300 ${
                      voice === v.value
                        ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                        : 'bg-[#1c1c1e] text-[#a1a1a6] hover:bg-[#2c2c2e] hover:text-white border border-white/5'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Style Selection */}
            <div>
              <h2 className="text-xs uppercase tracking-widest text-[#86868b] font-bold mb-4 ml-2">Style</h2>
              <div className="flex flex-wrap gap-2">
                {EMOTIONS.map((emo) => (
                  <button
                    key={emo.label}
                    onClick={() => setEmotion(emo.value)}
                    className={`px-5 py-3 rounded-full text-sm font-semibold transition-all duration-300 ${
                      emotion === emo.value
                        ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                        : 'bg-[#1c1c1e] text-[#a1a1a6] hover:bg-[#2c2c2e] hover:text-white border border-white/5'
                    }`}
                  >
                    {emo.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/20 text-red-500 px-6 py-3 rounded-full backdrop-blur-xl flex items-center gap-2 z-50 shadow-2xl"
        >
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </motion.div>
      )}

      {/* Apple Music Style Bottom Player */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-[#1c1c1e]/80 backdrop-blur-3xl border-t border-white/10 z-50 flex items-center justify-between px-6 md:px-12">
        {/* Left: Now Playing Info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-700 ${isSpeaking ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-purple-500/30' : 'bg-[#2c2c2e]'}`}>
            <Volume2 className={`w-6 h-6 ${isSpeaking ? 'text-white' : 'text-[#86868b]'}`} />
          </div>
          <div className="flex-1 min-w-0 hidden md:block">
            <p className="text-sm font-semibold text-white truncate">
              {text.trim() ? text.split('\n')[0] : 'Not Playing'}
            </p>
            <p className="text-xs text-[#86868b] truncate mt-0.5">
              {VOICES.find(v => v.value === voice)?.label} • {EMOTIONS.find(e => e.value === emotion)?.label}
            </p>
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center justify-center flex-1">
          {isGenerating && !isSpeaking ? (
            <div className="w-14 h-14 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            </div>
          ) : isSpeaking || isGenerating ? (
            <button
              onClick={stopReading}
              className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleRead}
              disabled={!text.trim()}
              className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <Play className="w-6 h-6 fill-current ml-1" />
            </button>
          )}
        </div>

        {/* Right: Extra / Volume (Visualizer) */}
        <div className="flex items-center justify-end flex-1 gap-1">
          {/* Fake waveform visualizer */}
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: isSpeaking ? [12, 24, 12] : 4,
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeInOut"
              }}
              className={`w-1.5 rounded-full ${isSpeaking ? 'bg-white' : 'bg-[#424245]'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}