import { useState } from 'react';
import { motion } from 'motion/react';
import { FileCode2, Binary, Info, ShieldAlert, Cpu, Download } from 'lucide-react';
import { PeFileMetadata, PeSection } from '../types';
import ExportButton from './ExportButton';

interface PeInspectorProps {
  selectedKey?: string;
  setSelectedKey?: (key: string) => void;
  triggerToast?: (msg: string) => void;
}

export default function PeInspector({
  selectedKey: propSelectedKey,
  setSelectedKey: propSetSelectedKey,
  triggerToast
}: PeInspectorProps = {}) {
  // Demo executables data
  const sampleBinaries: Record<string, PeFileMetadata> = {
    'svchost.exe': {
      fileName: 'svchost.exe',
      fileSize: 45056,
      magic: 'MZ (executable)',
      machine: 'x86_64 (AMD64)',
      numberOfSections: 4,
      timeDateStamp: '2026-05-18 14:32:01 UTC',
      entryPoint: '0x00018a30',
      subsystem: 'GUI / Windows Console',
      sections: [
        { name: '.text', virtualSize: 24576, virtualAddress: '0x00001000', rawSize: 24576, rawAddress: '0x00000400', entropy: 5.82, characteristics: ['EXECUTABLE', 'READONLY'], anomalous: false },
        { name: '.rdata', virtualSize: 8192, virtualAddress: '0x00007000', rawSize: 8192, rawAddress: '0x00006400', entropy: 4.15, characteristics: ['READONLY'], anomalous: false },
        { name: '.data', virtualSize: 4096, virtualAddress: '0x00009000', rawSize: 2048, rawAddress: '0x00008400', entropy: 2.30, characteristics: ['WRITEABLE', 'READWRITE'], anomalous: false },
        { name: '.reloc', virtualSize: 4096, virtualAddress: '0x0000B000', rawSize: 4096, rawAddress: '0x00008C00', entropy: 3.12, characteristics: ['DISCARDABLE', 'READONLY'], anomalous: false }
      ],
      imports: ['ntdll.dll!RtlInitUnicodeString', 'kernel32.dll!RegisterServiceCtrlHandlerW', 'kernel32.dll!SetServiceStatus', 'advapi32.dll!RegOpenKeyExW', 'msvcrt.dll!memset']
    },
    'crypt_packer.exe': {
      fileName: 'crypt_untrusted_loader.exe',
      fileSize: 154820,
      magic: 'MZ (executable)',
      machine: 'I386 (Intel 386)',
      numberOfSections: 3,
      timeDateStamp: '2026-06-05 02:11:45 UTC',
      entryPoint: '0x000F4010',
      subsystem: 'GUI / Windows Console',
      sections: [
        { name: 'UPX0', virtualSize: 81920, virtualAddress: '0x00001000', rawSize: 0, rawAddress: '0x00000000', entropy: 0.00, characteristics: ['WRITEABLE', 'READWRITE', 'EXECUTABLE'], anomalous: true },
        { name: 'UPX1', virtualSize: 45056, virtualAddress: '0x00015000', rawSize: 45056, rawAddress: '0x00000400', entropy: 7.95, characteristics: ['WRITEABLE', 'READWRITE', 'EXECUTABLE'], anomalous: true },
        { name: '.rsrc', virtualSize: 4096, virtualAddress: '0x00020000', rawSize: 4096, rawAddress: '0x0000B400', entropy: 6.20, characteristics: ['READONLY'], anomalous: false }
      ],
      imports: ['kernel32.dll!LoadLibraryA', 'kernel32.dll!GetProcAddress', 'kernel32.dll!VirtualAlloc', 'kernel32.dll!VirtualFree']
    },
    'unknown_temp_sample.bin': {
      fileName: 'untrusted_dropper.bin',
      fileSize: 92830,
      magic: 'MZ (executable)',
      machine: 'x86_64 (AMD64)',
      numberOfSections: 5,
      timeDateStamp: '2026-06-07 09:22:12 UTC',
      entryPoint: '0x0002F440',
      subsystem: 'GUI / Windows Console',
      sections: [
        { name: '.text', virtualSize: 32768, virtualAddress: '0x00001000', rawSize: 32768, rawAddress: '0x00000400', entropy: 5.92, characteristics: ['EXECUTABLE', 'READONLY'], anomalous: false },
        { name: '.rdata', virtualSize: 12288, virtualAddress: '0x00009000', rawSize: 12288, rawAddress: '0x00008400', entropy: 4.88, characteristics: ['READONLY'], anomalous: false },
        { name: '.data', virtualSize: 4096, virtualAddress: '0x0000C000', rawSize: 4096, rawAddress: '0x0000B400', entropy: 7.78, characteristics: ['WRITEABLE', 'READWRITE'], anomalous: true },
        { name: '.reloc', virtualSize: 4096, virtualAddress: '0x0000E000', rawSize: 4096, rawAddress: '0x0000C400', entropy: 2.11, characteristics: ['DISCARDABLE'], anomalous: false },
        { name: '.hidden', virtualSize: 24576, virtualAddress: '0x00010000', rawSize: 24576, rawAddress: '0x0000D400', entropy: 7.91, characteristics: ['WRITEABLE', 'READWRITE', 'EXECUTABLE'], anomalous: true }
      ],
      imports: ['kernel32.dll!VirtualAllocEx', 'kernel32.dll!WriteProcessMemory', 'kernel32.dll!CreateRemoteThread', 'user32.dll!MessageBoxA']
    }
  };

  const [localSelectedKey, setLocalSelectedKey] = useState<string>('svchost.exe');
  const selectedKey = propSelectedKey !== undefined ? propSelectedKey : localSelectedKey;
  const setSelectedKey = propSetSelectedKey || setLocalSelectedKey;

  const metadata = sampleBinaries[selectedKey];

  const handleExportPeHeader = () => {
    if (!metadata) return;
    const payload = {
      module_name: "PE Static Header Analyzer",
      file_name: metadata.fileName,
      file_size_bytes: metadata.fileSize,
      target_machine: metadata.machine,
      entry_point_pointer: metadata.entryPoint,
      pe_sections: metadata.sections,
      pe_imports: metadata.imports
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aegis_pe_analyzer_${metadata.fileName.replace(/\./g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    if (triggerToast) {
      triggerToast(`Headers analysis for ${metadata.fileName} successfully exported.`);
    }
  };

  return (
    <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Binary className="text-[#00f0ff] animate-pulse" size={15} />
          <h2 className="text-xs font-serif font-light tracking-[0.2em] text-zinc-100 uppercase">
            Portable Executable (PE) Analyzer
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {metadata && (
            <ExportButton
              id="btn-export-pe-section"
              label="Export Headers"
              filenamePrefix={`aegis_pe_analyzer_${metadata.fileName.replace(/\./g, '_')}`}
              jsonData={{
                module_name: "PE Static Header Analyzer",
                file_name: metadata.fileName,
                file_size_bytes: metadata.fileSize,
                target_machine: metadata.machine,
                entry_point_pointer: metadata.entryPoint,
                pe_sections: metadata.sections,
                pe_imports: metadata.imports,
                timestamp: new Date().toISOString()
              }}
              csvData={metadata.sections.map(s => ({
                section_name: s.name,
                virtual_size: s.virtualSize,
                virtual_address: s.virtualAddress,
                raw_size: s.rawSize,
                raw_address: s.rawAddress,
                entropy: s.entropy,
                characteristics: s.characteristics.join('; '),
                anomalous: s.anomalous
              }))}
              textReport={`=== AEGIS PE STATIC HEADER ANALYSIS ===\nFile: ${metadata.fileName}\nSize: ${(metadata.fileSize / 1024).toFixed(1)} KB\nMachine: ${metadata.machine}\nDOS Magic: ${metadata.magic}\nEntryPoint: ${metadata.entryPoint}\nTimestamp: ${metadata.timeDateStamp}\n\nSections:\n${metadata.sections.map(s => `[${s.name}] VSize: ${s.virtualSize} | RawSize: ${s.rawSize} | Entropy: ${s.entropy} | Chars: ${s.characteristics.join(', ')} | Flagged: ${s.anomalous ? 'YES' : 'NO'}`).join('\n')}\n\nImported Symbol APIs:\n${metadata.imports.join('\n')}`}
              triggerToast={triggerToast}
              size="xs"
            />
          )}
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="bg-black border border-white/5 text-[11px] font-mono rounded p-2 text-zinc-300 focus:outline-none focus:border-[#00f0ff] cursor-pointer"
          >
            <option value="svchost.exe">svchost.exe (System Binary)</option>
            <option value="crypt_packer.exe">crypt_untrusted_loader.exe (Packed Tool)</option>
            <option value="unknown_temp_sample.bin">dropper_sandbox_artifact.bin (Injected)</option>
          </select>
        </div>
      </div>

      <div className="mb-4 text-[11px] font-mono leading-relaxed text-white/40 bg-black/30 p-4 rounded border border-white/5">
        <div className="flex items-center gap-1.5 text-[#00f0ff] font-bold uppercase mb-2 text-xs">
          <Info size={12} className="text-[#00f0ff]" /> Header Diagnostics Definition
        </div>
        Parses compiled system executable layouts, searching for structural compromises (like anomalous section names or writeable-and-executable segments) and checking imports for system-critical capabilities (like process hollowers or API network downloaders).
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Headers info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="border border-white/5 p-4 rounded bg-black/40">
            <h3 className="text-xs font-serif font-light tracking-[0.1em] text-zinc-200 uppercase border-b border-white/5 pb-2 mb-3.5">
              Image File Headers
            </h3>

            <div className="space-y-2.5 font-mono text-[11px]">
              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                <span className="text-white/30">FILE NAME:</span>
                <span className="text-zinc-300 font-semibold">{metadata.fileName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                <span className="text-white/30">FILE SIZE:</span>
                <span className="text-zinc-300">{(metadata.fileSize / 1024).toFixed(1)} KB</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                <span className="text-white/30">DOS MAGIC:</span>
                <span className="text-[#00f0ff] font-extrabold">{metadata.magic}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                <span className="text-white/30">MACHINE TYPE:</span>
                <span className="text-zinc-300">{metadata.machine}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                <span className="text-white/30">SECTIONS COUNT:</span>
                <span className="text-zinc-300">{metadata.numberOfSections} headers</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                <span className="text-white/30">ENTRYPOINT OF CODE:</span>
                <span className="text-[#00f0ff] font-bold font-serif">{metadata.entryPoint}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                <span className="text-white/30">SUBSYSTEM TYPE:</span>
                <span className="text-zinc-300 truncate max-w-[124px]" title={metadata.subsystem}>
                  {metadata.subsystem}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 pt-1">
                <span className="text-white/35 text-[10px]">NT TIMESTAMP:</span>
                <span className="text-zinc-400 font-semibold">{metadata.timeDateStamp}</span>
              </div>
            </div>
          </div>

          <div className="border border-white/5 p-4 rounded bg-black/40">
            <h3 className="text-xs font-serif font-light tracking-[0.1em] text-[#E0E0E0] uppercase border-b border-white/5 pb-2 mb-3.5 flex items-center justify-between">
              <span>DLL APIs IMPORT TABLE</span>
              <span className="text-[9px] text-[#00f0ff] font-mono">({metadata.imports.length} APIs)</span>
            </h3>
            <div className="space-y-1.5 font-mono text-[10px] max-h-40 overflow-y-auto">
              {metadata.imports.map((imp, idx) => {
                const parts = imp.split('!');
                const isSensitive = /VirtualAlloc|WriteProcess|Thread/i.test(parts[1] || '');
                return (
                  <div key={idx} className="flex justify-between items-center border-b border-white/5 pb-1">
                    <span className="text-white/30 truncate max-w-[110px]">{parts[0]}</span>
                    <span className={`font-bold font-mono truncate max-w-[150px] ${isSensitive ? 'text-rose-400' : 'text-zinc-300'}`} title={parts[1]}>
                      {parts[1]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Sections tables with anomalous alerts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border border-white/5 p-4 rounded bg-black/40">
            <h3 className="text-xs font-serif font-light tracking-[0.1em] text-zinc-200 uppercase border-b border-white/5 pb-2 mb-3.5">
              Image Section Table & Memory Entropies
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full font-mono text-[10px] text-left border-collapse select-none">
                <thead>
                  <tr className="border-b border-white/5 text-white/30">
                    <th className="pb-2 text-[9px] tracking-wider uppercase">NAME</th>
                    <th className="pb-2 text-right text-[9px] tracking-wider uppercase">V.SIZE</th>
                    <th className="pb-2 text-right text-[9px] tracking-wider uppercase">V.ADDR</th>
                    <th className="pb-2 text-right text-[9px] tracking-wider uppercase">RAW.SZ</th>
                    <th className="pb-2 text-right text-[9px] tracking-wider uppercase">ENTROPY</th>
                    <th className="pb-2 text-right text-[9px] tracking-wider uppercase">FLAGS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {metadata.sections.map((sec, idx) => (
                    <tr 
                      key={idx}
                      className={sec.anomalous ? 'bg-rose-950/15 text-rose-300' : 'text-zinc-300 hover:bg-white/[0.01] hover:text-white transition-colors'}
                    >
                      <td className="py-2.5 font-bold uppercase">{sec.name}</td>
                      <td className="py-2.5 text-right font-semibold">{sec.virtualSize}</td>
                      <td className="py-2.5 text-right">{sec.virtualAddress}</td>
                      <td className="py-2.5 text-right">{sec.rawSize}</td>
                      <td className={`py-2.5 text-right font-bold ${sec.entropy > 7.0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {sec.entropy.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex gap-1 justify-end">
                          {sec.characteristics.map((char, ii) => (
                            <span 
                              key={ii}
                              className={`px-1 py-0.5 rounded text-[8px] font-black tracking-wide ${
                                char === 'EXECUTABLE' 
                                  ? 'bg-rose-950/20 text-rose-300 border border-rose-900/30' 
                                  : char === 'WRITEABLE' 
                                    ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20' 
                                    : 'bg-white/5 text-white/40'
                              }`}
                            >
                              {char[0]}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Core static detection alarms box */}
          <div className="border border-white/5 p-4 rounded bg-black/40">
            <h3 className="text-xs font-serif font-light tracking-[0.1em] text-rose-400 uppercase border-b border-white/5 pb-2 mb-3 flex items-center gap-1.5">
              <ShieldAlert size={14} /> HEURISTIC COMPROMISE ASSESMENT
            </h3>

            <div className="space-y-2.5 font-mono text-[11px] leading-relaxed">
              {metadata.fileName.includes('untrusted') || metadata.fileName.includes('packer') ? (
                <>
                  <div className="bg-rose-950/15 border border-rose-900/30 p-3.5 rounded text-rose-300 flex items-start gap-2.5">
                    <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <strong className="block font-bold text-xs uppercase mb-1">⚠️ COMPROMISE SUSPECTED: High-Entropy Packing</strong>
                      Multiple writable-and-executable (W^X violation) memory sections flagged. Standard executable segments (e.g. UPX1) possess severe entropy (<strong className="text-rose-400 font-bold">7.95 bits</strong>) while having zero-byte physical alignment offsets. Highly indicative of encrypted malware packing payloads or payload dropping structures.
                    </div>
                  </div>
                  <div className="bg-[#00f0ff]/5 border border-[#00f0ff]/15 p-3.5 rounded text-white/70 flex items-start gap-2.5">
                    <Info size={16} className="mt-0.5 shrink-0 text-[#00f0ff]" />
                    <div>
                      <strong className="block font-bold text-xs text-[#00f0ff] uppercase mb-1">⚠️ Suspicious Windows API Import Hooks</strong>
                      File import list imports low-level handle manipulators: <strong className="text-white font-bold">LoadLibraryA</strong> and <strong className="text-white font-bold">GetProcAddress</strong>. Allows on-the-fly resolution of hidden system APIs to evade anti-virus logs.
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-emerald-950/10 border border-emerald-900/20 p-3.5 rounded text-emerald-300 flex items-start gap-2.5">
                  <ShieldAlert size={15} className="text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <strong className="block font-bold text-xs uppercase mb-1">✓ HEURISTIC SCORE CLEAN</strong>
                    All memory segment partitions are structured correctly inside standard NT parameters. Section permissions enforce absolute <strong className="text-emerald-400 font-bold">W^X strict separation</strong> (no sections are simultaneously writable and executable). High-entropy keys patterns or packing symbols was not identified.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
