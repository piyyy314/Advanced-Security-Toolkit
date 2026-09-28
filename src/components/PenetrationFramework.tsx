import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Play, AlertTriangle, CheckCircle, ShieldAlert, Zap, FileCode, Trash2, RefreshCw } from 'lucide-react';
import ExportButton from './ExportButton';

interface PenetrationFrameworkProps {
  triggerToast: (msg: string) => void;
}

export default function PenetrationFramework({ triggerToast }: PenetrationFrameworkProps) {
  const [selectedExploit, setSelectedExploit] = useState('dish_firmware_rce');
  const [customParams, setCustomParams] = useState({
    uplinkFreq: '14.25',
    subCarrierId: '0x3F',
    payloadSize: '2048',
    attenuation: '1.5'
  });
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "[*] Penetration Framework online.",
    "[*] Target Terminal tracking locked: Orbital Sat-Link Transponder-11C.",
    "[*] Ready for uplink payload injection test."
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  const exploitCatalog = [
    {
      id: 'dish_firmware_rce',
      name: 'VSAT Dish Receiver Remote Code Execution (CVE-2026-9043)',
      desc: 'Bypasses unauthenticated TFTP server settings inside tracking controllers to overwrite boot memory blocks.',
      defaultParams: { uplinkFreq: '14.25', subCarrierId: '0x3F', payloadSize: '4096', attenuation: '0.0' }
    },
    {
      id: 'snmp_telemetry_hijack',
      name: 'SNMP Telemetry Injection & Demodulator Drift',
      desc: 'Exploits default public/private strings to forcefully offset carrier tracking loops, generating artificial Doppler drift.',
      defaultParams: { uplinkFreq: '11.82', subCarrierId: '0x12', payloadSize: '512', attenuation: '2.5' }
    },
    {
      id: 'tftp_firmware_poisoning',
      name: 'Uplink TFTP Firmware Spoofing Block Injection',
      desc: 'Injects unaligned raw block headers into the satellite control processor during unverified Over-the-Air updates.',
      defaultParams: { uplinkFreq: '12.44', subCarrierId: '0xFF', payloadSize: '65536', attenuation: '0.5' }
    }
  ];

  const handleExploitSelect = (id: string) => {
    setSelectedExploit(id);
    const exp = exploitCatalog.find(e => e.id === id);
    if (exp) {
      setCustomParams(exp.defaultParams);
    }
  };

  const handleLaunch = () => {
    setIsRunning(true);
    setIsSuccess(null);
    setConsoleLogs(prev => [
      ...prev,
      `[*] Launching vector: ${exploitCatalog.find(e => e.id === selectedExploit)?.name}`,
      `[*] Configuring uplink signal: Freq=${customParams.uplinkFreq} GHz, Subcarrier=${customParams.subCarrierId}, Payload=${customParams.payloadSize} Bytes`,
      `[>] Initiating phase-coherent modulation sequence...`,
      `[>] Injecting custom frames into satellite tracking loop...`
    ]);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step === 1) {
        setConsoleLogs(prev => [...prev, `[>] Frame offset 0x0000 matched. Attenuation: ${customParams.attenuation} dB.`]);
      } else if (step === 2) {
        setConsoleLogs(prev => [...prev, `[>] Transponder receiver ack feedback: 0xEE (VULNERABLE MEMORY SPACE FOUND)`]);
      } else if (step === 3) {
        setConsoleLogs(prev => [...prev, `[+] Executing shell payload payload... hijacking thread context.`]);
      } else if (step === 4) {
        clearInterval(interval);
        setIsRunning(false);
        const success = Math.random() > 0.15; // 85% success simulation
        setIsSuccess(success);
        if (success) {
          setConsoleLogs(prev => [
            ...prev,
            `[✓] SUCCESS: Shell session established. UID=0(root) console bound. Disabling satellite transponder watchdog telemetry timer.`,
            `[*] ACTIVE INTRUSION ACTIVE.`
          ]);
          triggerToast('🎯 Penetration exploit successful! Remote command console established.');
        } else {
          setConsoleLogs(prev => [
            ...prev,
            `[❌] FAILURE: Anti-jamming hardware block activated on transponder. Connection reset by remote controller.`,
            `[*] Scan aborted.`
          ]);
          triggerToast('❌ Exploit failed! Active anti-tampering countermeasures triggered.');
        }
      }
    }, 1000);
  };

  const clearLogs = () => {
    setConsoleLogs([`[*] Log cleared.`]);
  };

  return (
    <div className="bg-[#08080B] border border-white/5 rounded p-5 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-serif font-light text-zinc-100 flex items-center gap-2">
            <Zap size={15} className="text-[#00f0ff]" /> 🎯 2. Penetration Framework
          </h2>
          <p className="text-xs text-white/40 font-mono">
            Formulate customized command injection sequences targeting simulated satellite terminal transponders.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Select Exploit & Config */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-black/30 border border-white/5 rounded p-4 space-y-3">
            <label className="text-[10px] text-white/40 font-mono uppercase tracking-wider block font-bold">
              Target Vulnerability Exploit
            </label>
            <div className="space-y-2">
              {exploitCatalog.map((exp) => (
                <button
                  key={exp.id}
                  onClick={() => handleExploitSelect(exp.id)}
                  className={`w-full text-left p-3 rounded border text-xs font-mono transition-all block ${
                    selectedExploit === exp.id
                      ? 'bg-cyan-500/10 border-cyan-500 text-[#00f0ff]'
                      : 'bg-transparent border-white/5 text-zinc-400 hover:border-white/15'
                  }`}
                >
                  <span className="font-semibold block">{exp.name}</span>
                  <span className="text-[10px] text-white/30 block mt-1 leading-normal">
                    {exp.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Config parameters */}
          <div className="bg-black/30 border border-white/5 rounded p-4 space-y-3 font-mono text-xs">
            <label className="text-[10px] text-white/40 font-mono uppercase tracking-wider block font-bold">
              Uplink Parameters
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-white/30 block mb-1">Uplink Freq (GHz)</span>
                <input
                  type="text"
                  value={customParams.uplinkFreq}
                  onChange={(e) => setCustomParams({ ...customParams, uplinkFreq: e.target.value })}
                  className="w-full bg-[#0C0C10] border border-white/5 p-2 rounded text-zinc-200 text-xs focus:outline-none focus:border-[#00f0ff]"
                />
              </div>

              <div>
                <span className="text-[10px] text-white/30 block mb-1">Subcarrier ID</span>
                <input
                  type="text"
                  value={customParams.subCarrierId}
                  onChange={(e) => setCustomParams({ ...customParams, subCarrierId: e.target.value })}
                  className="w-full bg-[#0C0C10] border border-white/5 p-2 rounded text-zinc-200 text-xs focus:outline-none focus:border-[#00f0ff]"
                />
              </div>

              <div>
                <span className="text-[10px] text-white/30 block mb-1">Payload Size (Bytes)</span>
                <input
                  type="text"
                  value={customParams.payloadSize}
                  onChange={(e) => setCustomParams({ ...customParams, payloadSize: e.target.value })}
                  className="w-full bg-[#0C0C10] border border-white/5 p-2 rounded text-zinc-200 text-xs focus:outline-none focus:border-[#00f0ff]"
                />
              </div>

              <div>
                <span className="text-[10px] text-white/30 block mb-1">Attenuation (dB)</span>
                <input
                  type="text"
                  value={customParams.attenuation}
                  onChange={(e) => setCustomParams({ ...customParams, attenuation: e.target.value })}
                  className="w-full bg-[#0C0C10] border border-white/5 p-2 rounded text-zinc-200 text-xs focus:outline-none focus:border-[#00f0ff]"
                />
              </div>
            </div>

            <button
              onClick={handleLaunch}
              disabled={isRunning}
              className="w-full mt-2.5 py-2.5 bg-[#00f0ff] hover:bg-[#00f0ff]/80 disabled:bg-zinc-800 text-black rounded font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.2)]"
            >
              {isRunning ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Transmitting Exploit Payload...
                </>
              ) : (
                <>
                  <Play size={13} /> Launch Coherent Exploit
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right column: Interactive Uplink Monitor and Console Logs */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-black/40 border border-white/5 rounded p-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider flex items-center gap-1.5 font-bold">
                <Terminal size={12} className="text-[#00f0ff]" /> Real-time Execution Console
              </span>
              
              <div className="flex items-center gap-2">
                <ExportButton
                  id="btn-export-penetration-results"
                  label="Export Logs"
                  filenamePrefix={`penetration_test_${selectedExploit}`}
                  jsonData={{
                    exploit_id: selectedExploit,
                    exploit_name: exploitCatalog.find(e => e.id === selectedExploit)?.name,
                    parameters: customParams,
                    execution_outcome: isSuccess === true ? 'SUCCESS' : isSuccess === false ? 'INTERCEPTED' : 'INCOMPLETE',
                    timestamp: new Date().toISOString(),
                    console_logs: consoleLogs
                  }}
                  csvData={consoleLogs.map((log, idx) => ({
                    step: idx + 1,
                    log_entry: log
                  }))}
                  textReport={`=== AEGIS PENETRATION FRAMEWORK REPORT ===\nExploit: ${exploitCatalog.find(e => e.id === selectedExploit)?.name} (${selectedExploit})\nOutcome: ${isSuccess === true ? 'SUCCESSFUL EXPLOIT INJECTION' : isSuccess === false ? 'INTERCEPTED' : 'EXECUTED'}\nTimestamp: ${new Date().toISOString()}\n\n--- Parameters ---\nUplink Frequency: ${customParams.uplinkFreq} GHz\nSubcarrier ID: ${customParams.subCarrierId}\nPayload Size: ${customParams.payloadSize} Bytes\nAttenuation: ${customParams.attenuation} dB\n\n--- Console Execution Log ---\n${consoleLogs.join('\n')}`}
                  triggerToast={triggerToast}
                  size="xs"
                />
                <button
                  type="button"
                  onClick={clearLogs}
                  className="text-white/30 hover:text-white/60 p-1 transition-colors rounded hover:bg-white/5 cursor-pointer"
                  title="Clear Console"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Simulated exploit tracking states */}
            <div className="bg-black/90 rounded border border-white/5 p-4 h-64 overflow-y-auto font-mono text-[11px] text-cyan-400 space-y-1.5">
              {consoleLogs.map((log, idx) => {
                let col = 'text-cyan-400';
                if (log.startsWith('[❌]')) col = 'text-rose-400 font-bold';
                if (log.startsWith('[✓]')) col = 'text-emerald-400 font-bold';
                if (log.startsWith('[+]')) col = 'text-[#00f0ff] font-semibold';
                if (log.startsWith('[>]')) col = 'text-amber-400/90';
                return (
                  <div key={idx} className={`${col} leading-relaxed select-none`}>
                    {log}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Execution feedback overlay cards */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <AnimatePresence mode="wait">
              {isSuccess === true && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded font-mono text-xs space-y-1"
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle size={14} /> EXPLOIT INJECTION FULLY REALISED
                  </div>
                  <p className="text-[10px] text-emerald-400/80 leading-normal">
                    Remote ground dish telemetry controller successfully overridden. Watchdog deactivated. Target now susceptible to automated remote-command scripting loops.
                  </p>
                </motion.div>
              )}

              {isSuccess === false && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded font-mono text-xs space-y-1"
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert size={14} /> EXPLOIT INTERCEPTED BY ANTI-JAMMING BLOCK
                  </div>
                  <p className="text-[10px] text-rose-400/80 leading-normal">
                    Carrier tracker rejected the out-of-bounds TFTP payload configuration block due to deep packet-signature checks. Remediate parameter offsets and try again.
                  </p>
                </motion.div>
              )}

              {isSuccess === null && (
                <div className="p-3.5 bg-zinc-950/40 border border-white/5 text-white/40 rounded font-mono text-[10px] text-center italic py-6">
                  Select an exploit vector and initiate tracking command injection above.
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
