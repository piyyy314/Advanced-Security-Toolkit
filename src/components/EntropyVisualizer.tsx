import { useState } from 'react';
import EntropyCalculator from './EntropyCalculator';
import { motion } from 'motion/react';
import { Network, FileDigit, ShieldAlert, Cpu, Download } from 'lucide-react';
import ExportButton from './ExportButton';

interface EntropyVisualizerProps {
  onMetricsComputed?: (bytesLen: number, score: number) => void;
  triggerToast?: (msg: string) => void;
}

export default function EntropyVisualizer({ onMetricsComputed, triggerToast }: EntropyVisualizerProps = {}) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [entropyResults, setEntropyResults] = useState<{ offset: number; value: number }[]>([]);
  const [globalEntropy, setGlobalEntropy] = useState<number>(0);
  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null);

  const handleExportEntropyProfile = () => {
    if (!bytes || entropyResults.length === 0) return;
    const payload = {
      overall_bytes: bytes.length,
      aggregate_global_entropy: globalEntropy,
      entropy_results: entropyResults
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aegis_entropy_profile_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    if (triggerToast) {
      triggerToast("Entropy scan results successfully exported.");
    }
  };

  const handleAnalyzeFinished = (
    newBytes: Uint8Array,
    newResults: { offset: number; value: number }[],
    newGlobal: number
  ) => {
    setBytes(newBytes);
    setEntropyResults(newResults);
    setGlobalEntropy(newGlobal);
    if (onMetricsComputed) {
      onMetricsComputed(newBytes.length, newGlobal);
    }
  };

  const getSuggAlert = () => {
    if (globalEntropy > 7.4) {
      return {
        title: "CRITICAL: Pure Random Payload Block",
        desc: "The overall Shannon entropy exceeds 7.4. This strongly suggests cryptographically secure files, compressed archives, or packed payloads designed to bypass static signature heuristic scanners.",
        color: "text-rose-400 bg-rose-950/15 border-rose-900/30",
      };
    } else if (globalEntropy > 5.5) {
      return {
        title: "WARNING: High Diversity Plaintext / Compiled Modules",
        desc: "Entropy lands in the moderate-to-high zone. Frequently maps to rich binary assemblies (DLLs, executables) or source files combining long structured symbols and raw string tables.",
        color: "text-[#00f0ff] bg-[#00f0ff]/5 border-[#00f0ff]/15",
      };
    } else {
      return {
        title: "SAFE: Homogeneous Low-Entropy Format",
        desc: "Low randomness matches human plain text, structural repetitive patterns, padding elements or basic scripts. Unlikely to shield hidden cryptographic key material or raw executable structures.",
        color: "text-emerald-400 bg-emerald-950/10 border-emerald-900/20",
      };
    }
  };

  // SVG dimensions for custom robust line chart
  const hasResults = entropyResults.length > 0;
  const paddingX = 40;
  const paddingY = 20;
  const chartHeight = 140;
  const chartWidth = 600;

  let pointsStr = '';
  if (hasResults) {
    const maxX = Math.max(1, entropyResults.length - 1);
    pointsStr = entropyResults
      .map((res, i) => {
        const x = paddingX + (i / maxX) * (chartWidth - paddingX * 2);
        const y = paddingY + (1 - res.value / 8) * (chartHeight - paddingY * 2);
        return `${x},${y}`;
      })
      .join(' ');
  }

  return (
    <div className="space-y-6">
      <EntropyCalculator onAnalyzeFinished={handleAnalyzeFinished} />

      {bytes && hasResults && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5 block"
        >
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
            <div className="flex items-center gap-2.5">
              <Network className="text-[#00f0ff] animate-pulse" size={16} />
              <h3 className="text-xs font-serif font-light tracking-[0.2em] text-zinc-200 uppercase">
                Sliding Entropy Waveform Map
              </h3>
            </div>
            <ExportButton
              id="btn-export-entropy-section"
              label="Export Entropy Results"
              filenamePrefix="aegis_entropy_profile"
              jsonData={{
                module_name: "Shannon Entropy Profile Analysis",
                overall_bytes: bytes.length,
                aggregate_global_entropy: globalEntropy,
                entropy_results_count: entropyResults.length,
                entropy_results: entropyResults,
                timestamp: new Date().toISOString()
              }}
              csvData={entropyResults.map(r => ({
                byte_offset: r.offset,
                shannon_entropy: r.value.toFixed(4)
              }))}
              textReport={`=== AEGIS SHANNON ENTROPY PROFILE REPORT ===\nDate: ${new Date().toISOString()}\nTotal Buffer Size: ${bytes.length} bytes\nGlobal Aggregate Entropy: ${globalEntropy.toFixed(4)} / 8.0000 bits/char\nData Points: ${entropyResults.length}\nVerdict: ${getSuggAlert().title} - ${getSuggAlert().desc}\n\nOffset Data Sample:\n${entropyResults.slice(0, 100).map(r => `Offset +${r.offset}: ${r.value.toFixed(4)} bits/char`).join('\n')}${entropyResults.length > 100 ? `\n... and ${entropyResults.length - 100} more offsets` : ''}`}
              triggerToast={triggerToast}
              size="xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="border border-white/5 bg-black/40 p-4 rounded">
              <span className="text-[9px] tracking-wider text-white/30 font-mono uppercase block mb-1">Overall Buffer Bytes</span>
              <span className="text-xl font-serif font-light text-[#00f0ff]">{bytes.length} bytes</span>
            </div>
            <div className="border border-white/5 bg-black/40 p-4 rounded">
              <span className="text-[9px] tracking-wider text-white/30 font-mono uppercase block mb-1">Aggregate Global Entropy</span>
              <span className="text-xl font-serif font-light text-white">{globalEntropy.toFixed(4)} bits</span>
            </div>
            <div className="border border-white/5 bg-black/40 p-4 rounded">
              <span className="text-[9px] tracking-wider text-white/30 font-mono uppercase block mb-1">Entropy Threshold Alert</span>
              <span className={`text-[11px] font-mono font-medium ${globalEntropy > 6.8 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {globalEntropy > 6.8 ? '⚠️ High obfuscation potential' : '✓ Unobfuscated bounds'}
              </span>
            </div>
            <div className="border border-white/5 bg-black/40 p-4 rounded">
              <span className="text-[9px] tracking-wider text-white/30 font-mono uppercase block mb-1">Interactive Probe Cursor</span>
              <span className="text-[11px] font-mono text-[#00f0ff]">
                {hoveredOffset !== null 
                  ? `Offset ${hoveredOffset}: ${(entropyResults[hoveredOffset]?.value || 0).toFixed(2)} bits`
                  : 'Hover waveform'}
              </span>
            </div>
          </div>

          {/* SVG Waveform Graph */}
          <div className="bg-black/35 rounded border border-white/5 p-4 relative overflow-hidden">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              className="w-full h-44 overflow-visible"
              onMouseLeave={() => setHoveredOffset(null)}
            >
              {/* Grid Lines */}
              {[0, 2, 4, 6, 8].map((val) => {
                const y = paddingY + (1 - val / 8) * (chartHeight - paddingY * 2);
                return (
                  <g key={val}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={chartWidth - paddingX}
                      y2={y}
                      className="stroke-white/5"
                      strokeWidth={1}
                      strokeDasharray="4,2"
                    />
                    <text
                      x={paddingX - 10}
                      y={y + 3}
                      className="fill-white/30 text-[9px] font-mono"
                      textAnchor="end"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Threshold indicator */}
              <line
                x1={paddingX}
                y1={paddingY + (1 - 7.2 / 8) * (chartHeight - paddingY * 2)}
                x2={chartWidth - paddingX}
                y2={paddingY + (1 - 7.2 / 8) * (chartHeight - paddingY * 2)}
                className="stroke-rose-500/20"
                strokeWidth={1.5}
              />
              <text
                x={chartWidth - paddingX - 4}
                y={paddingY + (1 - 7.2 / 8) * (chartHeight - paddingY * 2) - 4}
                className="fill-rose-400/60 text-[8px] font-mono tracking-wider font-bold"
                textAnchor="end"
              >
                CRITICAL OBS THRESHOLD (7.2 bits)
              </text>

              {/* Active Area Fill */}
              {entropyResults.length > 1 && (
                <polygon
                  points={`${paddingX},${chartHeight - paddingY} ${pointsStr} ${chartWidth - paddingX},${chartHeight - paddingY}`}
                  className="fill-[#00f0ff]/5"
                />
              )}

              {/* Entropy Line */}
              {entropyResults.length > 1 && (
                <polyline
                  fill="none"
                  className="stroke-[#00f0ff]"
                  strokeWidth={1.5}
                  points={pointsStr}
                />
              )}

              {/* Interactive Ruler Markers */}
              {entropyResults.map((res, i) => {
                const maxX = Math.max(1, entropyResults.length - 1);
                const x = paddingX + (i / maxX) * (chartWidth - paddingX * 2);
                const y = paddingY + (1 - res.value / 8) * (chartHeight - paddingY * 2);

                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={hoveredOffset === i ? 4.5 : 2.5}
                    className={`cursor-pointer transition-all ${
                      hoveredOffset === i 
                        ? 'fill-[#00f0ff] stroke-white stroke-2' 
                        : res.value > 7.1 
                          ? 'fill-rose-500' 
                          : 'fill-[#00f0ff]/65'
                    }`}
                    onMouseEnter={() => setHoveredOffset(i)}
                  />
                );
              })}
            </svg>
          </div>

          {/* Forensic Deep Dive Advice */}
          <div className={`mt-5 border p-4 rounded flex gap-3 ${getSuggAlert().color}`}>
            <ShieldAlert size={18} className="shrink-0 mt-0.5" />
            <div className="font-mono text-[11px] leading-relaxed font-normal">
              <h4 className="font-bold uppercase text-xs tracking-wider mb-1 font-serif italic text-white/90">{getSuggAlert().title}</h4>
              <p className="text-white/70">{getSuggAlert().desc}</p>
            </div>
          </div>

          {/* Hex Dump Visualization block */}
          <div className="mt-5">
            <h4 className="text-[10px] font-mono tracking-wider font-bold text-white/40 uppercase mb-2.5 flex items-center gap-1.5">
              <FileDigit size={13} className="text-white/30" /> Frame Byte Allocation Mapping (Top 192 Bytes Only)
            </h4>
            <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-16 gap-1 font-mono text-[11px] bg-black/45 p-3.5 rounded border border-white/5">
              {Array.from(bytes.slice(0, 192)).map((byte, idx) => {
                // Find associated sliding window index
                const resVal = entropyResults[idx]?.value || 0;
                let bgHex = 'bg-black/20 border-white/5';
                let textHex = 'text-white/40';
                if (resVal > 7.1) {
                  bgHex = 'bg-rose-950/20 border-rose-900/30';
                  textHex = 'text-rose-400 font-bold';
                } else if (resVal > 5.4) {
                  bgHex = 'bg-[#00f0ff]/5 border-[#00f0ff]/15';
                  textHex = 'text-[#00f0ff]';
                }

                const hexVal = Number(byte).toString(16).padStart(2, '0').toUpperCase();

                return (
                  <div
                    key={idx}
                    title={`Offset: ${idx} | Byte value: 0x${hexVal} (dec: ${byte}) | Window Entropy: ${resVal.toFixed(2)}`}
                    className={`p-1.5 border text-center rounded transition-all select-none hover:scale-105 hover:bg-[#00f0ff]/10 hover:border-[#00f0ff]/30 ${bgHex} ${textHex}`}
                  >
                    {hexVal}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
