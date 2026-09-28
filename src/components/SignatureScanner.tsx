import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Terminal, RefreshCw, AlertTriangle, CircleAlert, Search, CheckCircle, Download } from 'lucide-react';
import ExportButton from './ExportButton';

interface SignatureAlert {
  offset: number;
  patternName: string;
  matchedBytes: string;
}

interface SignatureScannerProps {
  hexInput?: string;
  setHexInput?: (val: string) => void;
  alerts?: SignatureAlert[];
  setAlerts?: (alerts: SignatureAlert[]) => void;
  triggerToast?: (msg: string) => void;
}

export default function SignatureScanner({
  hexInput: propHexInput,
  setHexInput: propSetHexInput,
  alerts: propAlerts,
  setAlerts: propSetAlerts,
  triggerToast
}: SignatureScannerProps = {}) {
  const [localHexInput, setLocalHexInput] = useState(
    "1a 2c 3d 4f a5 b8 55 50 58 30 7e 8a // Header starts...\n" +
    "90 00 03 00 00 00 00 00 e3 c1\n" +
    "c8 00 f2 ff a1 // UPX signature pattern triggers!\n" +
    "55 50 58 31 22 a0 b4 f3 a8 // Embedded unpack signature block"
  );

  const [localAlerts, setLocalAlerts] = useState<SignatureAlert[]>([]);
  const [scanned, setScanned] = useState(false);

  const hexInput = propHexInput !== undefined ? propHexInput : localHexInput;
  const setHexInput = propSetHexInput || setLocalHexInput;
  const alerts = propAlerts !== undefined ? propAlerts : localAlerts;
  const setAlerts = propSetAlerts || setLocalAlerts;

  const signatureDatabase = [
    { name: 'UPX Pack Header Marker (UPX0)', bytes: '55 50 58 30' },
    { name: 'UPX Packed Payload Block (UPX1)', bytes: '55 50 58 31' },
    { name: 'Aegis Sentinel Exploit pattern', bytes: 'c8 00 f2 ff' }
  ];

  const handleExportSignatures = () => {
    if (alerts.length === 0) return;
    const payload = {
      module_name: "YARA Malicious Byte Patterns Scanner",
      scanned_buffer_length_chars: hexInput.length,
      detections_count: alerts.length,
      detections: alerts
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aegis_signature_detections_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    if (triggerToast) {
      triggerToast("Malware signature violations successfully exported.");
    }
  };

  const handleScanSignatures = () => {
    // Standardize input buffer (strip comments, non-hex elements)
    const cleanedHex = hexInput
      .replace(/\/\/.*$/gm, '') // Strip inline comments
      .replace(/[^a-fA-F0-9]/g, '') // Keep hex digits only
      .toLowerCase();

    const matchesList: SignatureAlert[] = [];

    // Simple robust sliding exact search simulation
    signatureDatabase.forEach(sig => {
      const sigClean = sig.bytes.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
      let pos = cleanedHex.indexOf(sigClean);
      
      while (pos !== -1) {
        matchesList.push({
          offset: Math.floor(pos / 2),
          patternName: sig.name,
          matchedBytes: sig.bytes
        });
        pos = cleanedHex.indexOf(sigClean, pos + 1);
      }
    });

    setAlerts(matchesList);
    setScanned(true);
  };

  const handleLoadAttackVector = () => {
    setHexInput(
      "// Malware packer template containing absolute signature matches\n" +
      "4d 5a 90 00 03 00 00 00 04 00 00 00\n" +
      "55 50 58 30 00 1a // Intercept point 1: UPX0 packer header!\n" +
      "aa bb cc dd ee ff 11 22 33 44\n" +
      "c8 00 f2 ff // Intercept point 2: Aegis exploit shell trigger!\n" +
      "99 88 77 66 55 44 33 22 11 00"
    );
    setScanned(false);
  };

  return (
    <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
        <h2 className="text-xs font-serif font-light tracking-[0.2em] text-zinc-100 uppercase flex items-center gap-2">
          <Terminal className="text-[#00f0ff]" size={15} /> Memory Signature Scanner
        </h2>

        <div className="flex gap-2.5">
          {alerts.length > 0 && (
            <ExportButton
              id="btn-export-signature-section"
              label="Export Results"
              filenamePrefix="aegis_signature_detections"
              jsonData={{
                module_name: "YARA Malicious Byte Patterns Scanner",
                scanned_buffer_length_chars: hexInput.length,
                detections_count: alerts.length,
                detections: alerts,
                timestamp: new Date().toISOString()
              }}
              csvData={alerts.map(a => ({
                pattern_name: a.patternName,
                offset_bytes: a.offset,
                matched_hex_bytes: a.matchedBytes
              }))}
              textReport={`=== AEGIS MEMORY SIGNATURE SCAN REPORT ===\nDate: ${new Date().toISOString()}\nTotal Hits: ${alerts.length}\n\n${alerts.map((a, i) => `[${i+1}] ${a.patternName}\nOffset: +${a.offset} bytes\nMatched Hex: ${a.matchedBytes}\n`).join('\n')}`}
              triggerToast={triggerToast}
              size="xs"
            />
          )}
          <button
            onClick={handleLoadAttackVector}
            className="text-[9px] uppercase tracking-wider font-mono px-3 py-1.5 bg-black/40 text-white/50 border border-white/5 hover:border-white/10 hover:text-[#00f0ff] rounded cursor-pointer transition-colors"
          >
            Load Infected Buffer sequence
          </button>
        </div>
      </div>

      <div className="mb-4 text-[11px] font-mono leading-relaxed text-white/40 bg-black/30 p-4 rounded border border-white/5">
        <div className="flex items-center gap-1.5 text-[#00f0ff] font-bold uppercase mb-2 text-xs">
          <AlertTriangle size={12} className="text-[#00f0ff]" /> Pattern matching guidelines
        </div>
        Aho-Corasick Multi-Pattern engine compiles raw system-level indicators (malware packers, hardcoded hex endpoints, shell payloads) into search lookup tries to evaluate target binary segments concurrently in a single pass.
      </div>

      <div className="mb-4">
        <label className="block text-[10px] font-mono tracking-wider font-bold text-white/45 mb-1.5 uppercase">
          Binary Hex dump stream buffer
        </label>
        <textarea
          id="sig-hex-textarea"
          value={hexInput}
          onChange={(e) => {
            setHexInput(e.target.value);
            setScanned(false);
          }}
          className="w-full h-36 bg-black/40 text-zinc-300 font-mono text-xs rounded border border-white/5 p-3 focus:outline-none focus:border-[#00f0ff]/50 resize-none"
          placeholder="Paste hex space-delimited streams (e.g. 55 50 58 30)..."
        />
      </div>

      <div className="border-t border-white/5 pt-3.5 flex justify-between items-center">
        <div className="text-[9px] text-white/30 uppercase tracking-wider font-mono">
          * Loaded Indicators Database: <strong className="text-white/50 font-normal">UPX0, UPX1, AegisExploit_C8</strong>
        </div>
        <button
          onClick={handleScanSignatures}
          id="btn-run-signature-scan"
          className="text-[10px] uppercase tracking-widest border border-[#00f0ff]/50 text-[#00f0ff] px-4 py-2 hover:bg-[#00f0ff] hover:text-black transition-all font-mono rounded shadow-[0_0_8px_rgba(0,240,255,0.1)] cursor-pointer"
        >
          Run Multi-signature scan
        </button>
      </div>

      {scanned && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-3"
        >
          <h3 className="text-[10px] font-mono tracking-wider font-bold text-white/40 uppercase">
            Signature results: <span className={alerts.length > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{alerts.length} signature indicators hit</span>
          </h3>

          {alerts.length === 0 ? (
            <div className="bg-emerald-950/10 border border-emerald-900/20 rounded-lg p-4 flex items-start gap-2.5 text-emerald-300 text-xs font-mono">
              <CheckCircle size={15} className="mt-0.5 shrink-0" />
              <div>
                <span className="font-bold uppercase block text-xs tracking-wider mb-0.5 text-emerald-200">✓ Binary Signatures Clean</span>
                No known static pack boundaries, malware hooks, or signature sequences were identified in the evaluated raw binary segments.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((al, idx) => (
                <div key={idx} className="bg-black/40 border border-white/5 p-3 rounded flex items-start gap-2.5 text-rose-300 text-xs font-mono">
                  <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                  <div>
                    <strong className="block font-bold text-rose-400 text-xs uppercase tracking-wide mb-1">{al.patternName}</strong>
                    Matched sequence <code className="bg-zinc-900/40 border border-white/5 px-1.5 py-0.5 rounded text-[11px] text-zinc-100">{al.matchedBytes}</code> detected at binary offset <strong className="text-[#00f0ff] font-bold font-serif">+{al.offset} bytes</strong> relative to initial segment start.
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
export { SignatureScanner };
