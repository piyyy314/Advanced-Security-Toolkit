import { useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, AlertCircle, FileDigit, HelpCircle } from 'lucide-react';

interface EntropyCalculatorProps {
  onAnalyzeFinished: (bytes: Uint8Array, entropyResults: { offset: number; value: number }[], globalEntropy: number) => void;
}

export default function EntropyCalculator({ onAnalyzeFinished }: EntropyCalculatorProps) {
  const [inputText, setInputText] = useState(
    "// Type or paste any binary hex stream, assembly instructions, or plain text to run absolute Shannon entropy analysis on segments.\n" +
    "const key = '0x8f3c7e1a902b4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e'; // High randomness hex block\n" +
    "console.log('Validating system integrity keys...');\n" +
    "const repetitiveBuffer = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // Highly predictable redundance\n" +
    "// Watch the real-time sliding window entropy fluctuation identify cipher strings versus repetitive structures."
  );
  const [inputMode, setInputMode] = useState<'text' | 'hex'>('text');
  const [windowSize, setWindowSize] = useState<number>(32);
  const [analyzed, setAnalyzed] = useState(false);
  const [errorStr, setErrorStr] = useState<string | null>(null);

  const calculateShannonEntropy = (data: Uint8Array): number => {
    if (data.length === 0) return 0;
    const freqs = new Map<number, number>();
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      freqs.set(byte, (freqs.get(byte) || 0) + 1);
    }
    let entropy = 0;
    const len = data.length;
    freqs.forEach((count) => {
      const p = count / len;
      entropy -= p * Math.log2(p);
    });
    return entropy;
  };

  const handleAnalyze = () => {
    setErrorStr(null);
    let bytes: Uint8Array;

    if (inputMode === 'hex') {
      // Clean hex input from spaces, comments, non-hex chars
      const cleanedHex = inputText.replace(/[^a-fA-F0-9]/g, '');
      if (cleanedHex.length === 0) {
        setErrorStr("Null input sequence: No hex characters detected.");
        return;
      }
      if (cleanedHex.length % 2 !== 0) {
        setErrorStr("Byte misalignment alert: Odd number of hex characters parsed.");
        return;
      }
      bytes = new Uint8Array(cleanedHex.length / 2);
      for (let i = 0; i < cleanedHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanedHex.substring(i, i + 2), 16);
      }
    } else {
      const encoder = new TextEncoder();
      bytes = encoder.encode(inputText);
    }

    if (bytes.length === 0) {
      setErrorStr("Empty input buffer block.");
      return;
    }

    const size = Math.max(8, Math.min(256, windowSize));
    const results: { offset: number; value: number }[] = [];

    if (bytes.length <= size) {
      // If smaller than the window, take the overall entropy directly
      const ent = calculateShannonEntropy(bytes);
      results.push({ offset: 0, value: ent });
    } else {
      // Sliding window scan
      const step = 1;
      for (let offset = 0; offset <= bytes.length - size; offset += step) {
        const sub = bytes.slice(offset, offset + size);
        const value = calculateShannonEntropy(sub);
        results.push({ offset, value });
      }
    }

    const overallEntropy = calculateShannonEntropy(bytes);
    onAnalyzeFinished(bytes, results, overallEntropy);
    setAnalyzed(true);
  };

  const handleLoadSample = (type: 'redundant' | 'high_entropy' | 'mixed') => {
    setErrorStr(null);
    if (type === 'redundant') {
      setInputText("A".repeat(500));
      setInputMode('text');
    } else if (type === 'high_entropy') {
      // Simulate real pseudorandom/private key binary
      let hex = '';
      const chars = '0123456789abcdef';
      for (let i = 0; i < 512; i++) {
        hex += chars[Math.floor(Math.random() * 16)];
      }
      setInputText(hex);
      setInputMode('hex');
    } else {
      // Mixed structure
      const lorem = "System diagnostics loading... VERIFYING INTEGRITY SIGNATURES\n\n";
      let keyHex = '';
      const chars = '0123456789abcdef';
      for (let i = 0; i < 64; i++) {
        keyHex += chars[Math.floor(Math.random() * 16)];
      }
      const endMarker = "\n\nConnection established securely. Diagnostic status: COMPLETED.";
      setInputText(lorem + "CIPHER_BLOCK: " + keyHex + endMarker);
      setInputMode('text');
    }
    setAnalyzed(false);
  };

  return (
    <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5 w-full">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-[#00f0ff]" size={16} />
          <h2 className="text-xs font-serif font-light tracking-[0.2em] text-zinc-100 uppercase">
            Shannon Entropy Analyzer
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setInputMode('text')}
            className={`text-[10px] tracking-wider uppercase px-2.5 py-1 font-mono rounded cursor-pointer border transition-colors ${inputMode === 'text' ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30' : 'text-white/40 border-transparent hover:text-white/80'}`}
          >
            ASCII Plain text
          </button>
          <button
            onClick={() => setInputMode('hex')}
            className={`text-[10px] tracking-wider uppercase px-2.5 py-1 font-mono rounded cursor-pointer border transition-colors ${inputMode === 'hex' ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30' : 'text-white/40 border-transparent hover:text-white/80'}`}
          >
            Hex stream data
          </button>
        </div>
      </div>

      {errorStr && (
        <div className="mb-4 bg-rose-950/20 border border-rose-900/45 rounded p-3 flex items-start gap-2 text-rose-300 text-xs font-mono">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>{errorStr}</div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-[10px] font-mono tracking-wider font-bold text-white/40 mb-1.5 uppercase">
          Binary Buffer Stream Input Location
        </label>
        <textarea
          id="entropy-input-textarea"
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            setAnalyzed(false);
          }}
          className="w-full h-36 bg-black/40 text-zinc-300 font-mono text-xs rounded border border-white/5 p-3 focus:border-[#00f0ff]/50 focus:outline-none resize-none"
          placeholder={inputMode === 'hex' ? 'e.g. 4d 5a 90 00 03 00 00 00 or raw 4d5a9000...' : 'Enter plaintext, raw source code, or payload rules...'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-[10px] font-mono tracking-wider font-bold text-white/40 mb-1.5 uppercase">
            Sliding Window Scan Frame Size: <span className="text-[#00f0ff] font-bold">{windowSize} bytes</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={8}
              max={128}
              step={4}
              value={windowSize}
              onChange={(e) => {
                setWindowSize(parseInt(e.target.value));
                setAnalyzed(false);
              }}
              className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
            />
          </div>
          <span className="text-[10px] text-white/30 font-mono block mt-1 tracking-wide leading-relaxed">
            Smaller values isolate high-entropy keys; larger sizes smoothen noise curves.
          </span>
        </div>

        <div>
          <label className="block text-[10px] font-mono tracking-wider font-bold text-white/40 mb-1.5 uppercase">
            Dynamic Test Vector Templates
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleLoadSample('redundant')}
              className="flex-1 text-[10px] bg-black/30 hover:bg-black/50 text-white/50 hover:text-[#00f0ff] border border-white/5 px-2.5 py-1.5 font-mono rounded cursor-pointer text-left transition-colors"
            >
              • Redundant predictable
            </button>
            <button
              onClick={() => handleLoadSample('high_entropy')}
              className="flex-1 text-[10px] bg-black/30 hover:bg-black/50 text-white/50 hover:text-[#00f0ff] border border-white/5 px-2.5 py-1.5 font-mono rounded cursor-pointer text-left transition-colors"
            >
              • Crypt signature keys
            </button>
            <button
              onClick={() => handleLoadSample('mixed')}
              className="flex-1 text-[10px] bg-black/30 hover:bg-black/50 text-white/50 hover:text-[#00f0ff] border border-white/5 px-2.5 py-1.5 font-mono rounded cursor-pointer text-left transition-colors"
            >
              • Mixed payload bounds
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-3 border-t border-white/5">
        <button
          onClick={handleAnalyze}
          id="btn-run-entropy-scan"
          className="text-[10px] uppercase tracking-widest border border-[#00f0ff]/50 text-[#00f0ff] px-4 py-2 hover:bg-[#00f0ff] hover:text-black transition-all font-mono rounded shadow-[0_0_8px_rgba(0,240,255,0.1)] cursor-pointer"
        >
          Compute Shannon Metrics
        </button>
      </div>

      <div className="mt-4 bg-black/30 p-4 rounded border border-white/5 font-mono text-[11px] leading-relaxed text-white/40">
        <div className="flex items-center gap-1.5 text-white/70 font-bold mb-1.5 uppercase text-xs">
          <HelpCircle size={13} className="text-[#00f0ff]" /> Metric Definition
        </div>
        Shannon entropy measures raw information randomness in a sliding buffer from <strong className="text-rose-400">0.0 (predictably structured repetition)</strong> to <strong className="text-emerald-400 font-bold">8.0 (highest randomness)</strong>. High-entropy spots are indicators of encrypted code segments, secret credentials, or malware payload packing bypass structures.
      </div>
    </div>
  );
}
