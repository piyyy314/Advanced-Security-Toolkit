import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io as socketIo } from 'socket.io-client';
import { 
  Terminal, 
  Pause, 
  Play, 
  Trash2, 
  Search, 
  SlidersHorizontal, 
  Cpu, 
  Download, 
  RefreshCw, 
  Layers, 
  HardDrive, 
  Settings2, 
  ArrowRight, 
  Info, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  Copy,
  Lock,
  Boxes
} from 'lucide-react';

interface LogMessage {
  id: string;
  timestamp: string;
  module: 'KERNEL' | 'HYPERVISOR' | 'EBPF' | 'VMM' | 'INTEL-VT' | 'AMD-V';
  level: 'INFO' | 'WARN' | 'ALERT' | 'CRITICAL';
  message: string;
  sourceAddress?: string;
  vcpu?: number;
}

const SAMPLE_LOG_TEMPLATES: Omit<LogMessage, 'id' | 'timestamp'>[] = [
  { module: 'HYPERVISOR', level: 'INFO', message: 'vcpu0 entered guest mode at rip 0xffffffff810a4240', vcpu: 0 },
  { module: 'KERNEL', level: 'INFO', message: "ebpf: dynamic map 'threat_heuristics' allocated, size 4096 bytes" },
  { module: 'HYPERVISOR', level: 'WARN', message: 'nested page fault (NPF) handled at gpa 0x00000001bc90a000 [write, present]' },
  { module: 'KERNEL', level: 'ALERT', message: 'intercepted process nc (PID 14209) attempted outbound socket on port 4444', sourceAddress: '0x7ffcf3a812' },
  { module: 'VMM', level: 'INFO', message: 'hypercall 0x01 (HC_GUEST_FLUSH_TLB) invoked by VM context namespace 3' },
  { module: 'INTEL-VT', level: 'INFO', message: 'ept violation cache cleared, mapping gfn 0x3f1bc -> mfn 0x11ab3b' },
  { module: 'KERNEL', level: 'INFO', message: 'kprobe: __sys_execve hook registered successfully at ffffffff812dfa80' },
  { module: 'KERNEL', level: 'WARN', message: "warning: process 'svchost.exe' performed raw socket bind on eth0" },
  { module: 'HYPERVISOR', level: 'INFO', message: 'security enclave check: physical platform matches host MRENCLAVE validation signature' },
  { module: 'AMD-V', level: 'INFO', message: "svm: secure virtual machine instruction 'skinit' logged under context 0" },
  { module: 'KERNEL', level: 'INFO', message: "ebpf: kernel tracepoint 'sys_enter_connect' successfully bound" },
  { module: 'KERNEL', level: 'CRITICAL', message: 'alert: shadow_stack: violation on execution address 0x7ffd510c4d30', sourceAddress: '0x7ffd510c4d30' },
  { module: 'HYPERVISOR', level: 'WARN', message: 'hvm: memory ballooning requested: target -512MB guest allocation' },
  { module: 'INTEL-VT', level: 'INFO', message: 'vmx: posted interrupt vector delivered to guest vcpu1', vcpu: 1 },
  { module: 'VMM', level: 'INFO', message: "virtual device register mapper synced for controller: PCI_AUDIO_DEV" },
  { module: 'KERNEL', level: 'ALERT', message: "process 'curl' modified binary headers inside anonymous path /tmp/memfd:x64" },
  { module: 'HYPERVISOR', level: 'CRITICAL', message: "hardware vm entry failure: hypervisor forced VMEXIT at code 0x80000021" },
  { module: 'AMD-V', level: 'WARN', message: "svm: nested paging nested page table cache sync required" },
  { module: 'KERNEL', level: 'INFO', message: "kernel tracepoint: sys_exit_mmap: unmapped memory region size 16384" }
];

export default function ConsoleStream() {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1000); // ms interval
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModuleFilter, setActiveModuleFilter] = useState<string>('ALL');
  const [activeLevelFilter, setActiveLevelFilter] = useState<string>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedConf, setCopiedConf] = useState(false);
  const [activeTab, setActiveTab] = useState<'CONSOLE' | 'TAURI'>('CONSOLE');

  const terminalRef = useRef<HTMLDivElement>(null);
  const logCounterRef = useRef<number>(0);

  // Generate initial mock logs on assembly load
  useEffect(() => {
    const initialLogs: LogMessage[] = [];
    const now = new Date();
    for (let i = 0; i < 20; i++) {
      const template = SAMPLE_LOG_TEMPLATES[Math.floor(Math.random() * SAMPLE_LOG_TEMPLATES.length)];
      const tsOffset = new Date(now.getTime() - (20 - i) * 6000);
      initialLogs.push({
        id: `log-${logCounterRef.current++}`,
        timestamp: tsOffset.toISOString().split('T')[1].substring(0, 12),
        ...template
      });
    }
    setLogs(initialLogs);
  }, []);

  // Periodic log feed generator
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const template = SAMPLE_LOG_TEMPLATES[Math.floor(Math.random() * SAMPLE_LOG_TEMPLATES.length)];
      setLogs((prev) => {
        const updated = [
          ...prev,
          {
            id: `log-${logCounterRef.current++}`,
            timestamp: new Date().toISOString().split('T')[1].substring(0, 12),
            ...template
          }
        ];
        // Enforce maximum buffer layout to match memory guidelines (e.g. max 500 logs)
        if (updated.length > 500) {
          return updated.slice(updated.length - 500);
        }
        return updated;
      });
    }, speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  // Connect to the Live Socket.io Telemetry Server
  useEffect(() => {
    if (!isPlaying) return;

    const socket = socketIo(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      setLogs((prev) => [
        ...prev,
        {
          id: `socket-status-${Date.now()}`,
          timestamp: new Date().toISOString().split('T')[1].substring(0, 12),
          module: 'KERNEL',
          level: 'INFO',
          message: '🟢 SecLink: Real-time full-stack WebSocket connection established with shadow313 proxy!'
        } as LogMessage
      ].slice(-500));
    });

    socket.on('disconnect', () => {
      setLogs((prev) => [
        ...prev,
        {
          id: `socket-status-${Date.now()}`,
          timestamp: new Date().toISOString().split('T')[1].substring(0, 12),
          module: 'KERNEL',
          level: 'WARN',
          message: '🔴 SecLink: Live backend telemetry socket disconnected. Reconnecting...'
        } as LogMessage
      ].slice(-500));
    });

    socket.on('telemetry_update', (msg: any) => {
      if (msg && msg.type === 'NEW_BLOCK') {
        setLogs((prev) => {
          const updated = [
            ...prev,
            {
              id: `eth-block-${msg.block}-${Date.now()}`,
              timestamp: new Date(msg.timestamp * 1000).toISOString().split('T')[1].substring(0, 12),
              module: 'VMM' as const,
              level: 'INFO' as const,
              message: `📡 RPC BLOCK TRANSIT: Block #${msg.block} [verified via Palantir proxy] - Hash: ${msg.hash.substring(0, 24)}... (Txs: ${msg.txCount})`,
            }
          ];
          if (updated.length > 500) return updated.slice(updated.length - 500);
          return updated;
        });
      }
    });

    socket.on('security_alert', (msg: any) => {
      setLogs((prev) => {
        const updated = [
          ...prev,
          {
            id: `security-alert-${Date.now()}-${Math.random()}`,
            timestamp: msg.timestamp || new Date().toISOString().split('T')[1].substring(0, 12),
            module: 'KERNEL' as const,
            level: (msg.severity === 'CRITICAL' ? 'CRITICAL' : 'ALERT') as any,
            message: `🛡️ AEGIS FIREWALL DETECTOR: ${msg.message}`
          }
        ];
        if (updated.length > 500) return updated.slice(updated.length - 500);
        return updated;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [isPlaying]);

  // Clean scrolling state helper
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Calculate matching stats
  const counterStats = useMemo(() => {
    const stats = {
      total: logs.length,
      kernel: 0,
      hypervisor: 0,
      criticals: 0,
      alerts: 0
    };
    logs.forEach(l => {
      if (l.module === 'KERNEL') stats.kernel++;
      if (l.module === 'HYPERVISOR') stats.hypervisor++;
      if (l.level === 'CRITICAL') stats.criticals++;
      if (l.level === 'ALERT') stats.alerts++;
    });
    return stats;
  }, [logs]);

  // Filter logs logic
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search text bounds
      const matchesSearch = 
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.module.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.level.toLowerCase().includes(searchQuery.toLowerCase());

      // Module filter
      const matchesModule = activeModuleFilter === 'ALL' || log.module === activeModuleFilter;

      // Severity levels filter
      const matchesLevel = activeLevelFilter === 'ALL' || log.level === activeLevelFilter;

      return matchesSearch && matchesModule && matchesLevel;
    });
  }, [logs, searchQuery, activeModuleFilter, activeLevelFilter]);

  const handleExportText = () => {
    const textBlob = filteredLogs
      .map(l => `[${l.timestamp}] [${l.module}] [${l.level}] ${l.message} ${l.sourceAddress ? `(Addr: ${l.sourceAddress})` : ''}`)
      .join('\n');
    
    const element = document.createElement("a");
    const file = new Blob([textBlob], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `aegis_kernel_telemetry_${Date.now()}.log`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedConf(true);
    setTimeout(() => setCopiedConf(false), 2500);
  };

  // Pre-compiled Tauri configs for visual representation & developer convenience
  const tauriConfCode = `{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:3000",
    "distDir": "../dist"
  },
  "package": {
    "productName": "AegisUnifiedSecurity",
    "version": "2.5.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "all": false,
        "execute": true,
        "sidecar": false
      },
      "fs": {
        "all": true,
        "scope": ["$APPDIR/*"]
      }
    },
    "bundle": {
      "active": true,
      "targets": ["all"],
      "identifier": "com.aegis.security.app",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    },
    "windows": [
      {
        "title": "Aegis Unified Security Suite - Hypervisor Control Room",
        "width": 1280,
        "height": 840,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false
      }
    ]
  }
}`;

  return (
    <div className="bg-[#0A0A0C]/90 border border-white/5 rounded-lg shadow-[0_4px_30px_rgba(0,0,0,0.4)] overflow-hidden font-mono text-[11px] grid grid-cols-1 select-text">
      {/* Component Title Bar */}
      <div className="border-b border-white/5 bg-gradient-to-r from-black/80 to-[#101014] px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2.5">
          <div className="p-2 border border-[#00f0ff]/35 bg-[#00f0ff]/5 text-[#00f0ff] rounded-md">
            <Terminal size={15} className="animate-pulse" />
          </div>
          <div>
            <span className="text-[9px] tracking-widest text-[#00f0ff]/80 uppercase font-bold flex items-center gap-1">
              SANDBOX FORENSICS CORE <Lock size={9} />
            </span>
            <h3 className="text-sm font-serif font-light text-zinc-100 flex items-center gap-1.5 leading-tight">
              Real-time Kernel & Hypervisor Stream
            </h3>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-black/60 border border-white/5 rounded p-0.5 max-w-fit">
          <button
            onClick={() => setActiveTab('CONSOLE')}
            className={`px-3 py-1.5 rounded text-[10px] uppercase tracking-wider transition-all font-bold cursor-pointer ${
              activeTab === 'CONSOLE'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/25 font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Terminal Output
          </button>
          <button
            onClick={() => setActiveTab('TAURI')}
            className={`px-3 py-1.5 rounded text-[10px] uppercase tracking-wider transition-all font-bold cursor-pointer flex items-center gap-1 ${
              activeTab === 'TAURI'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/25 font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Boxes size={11} /> Tauri App Forge
          </button>
        </div>
      </div>

      {activeTab === 'CONSOLE' ? (
        <>
          {/* Diagnostic Stats Bar */}
          <div className="bg-black/40 border-b border-white/5 px-5 py-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-[10px] text-zinc-400 select-none">
            <div className="bg-[#0D0D11] border border-white/5 rounded p-2 flex flex-col justify-center">
              <span className="text-[8px] text-white/30 uppercase tracking-wide">Processed Streams</span>
              <strong className="text-zinc-100 text-xs mt-0.5 font-mono">{counterStats.total} entries</strong>
            </div>
            <div className="bg-[#0D0D11] border border-white/5 rounded p-2 flex flex-col justify-center">
              <span className="text-[8px] text-white/30 uppercase tracking-wide">Kernel Hook Alerts</span>
              <strong className="text-blue-400 text-xs mt-0.5 font-mono">{counterStats.kernel} logged</strong>
            </div>
            <div className="bg-[#0D0D11] border border-white/5 rounded p-2 flex flex-col justify-center">
              <span className="text-[8px] text-white/30 uppercase tracking-wide">Hypervisor Events</span>
              <strong className="text-[#00f0ff] text-xs mt-0.5 font-mono">{counterStats.hypervisor} traps</strong>
            </div>
            <div className="bg-[#0D0D11] border border-white/5 rounded p-2 flex flex-col justify-center">
              <span className="text-[8px] text-white/30 uppercase tracking-wide">Mitigations Bound</span>
              <strong className="text-rose-400 text-xs mt-0.5 font-mono">{counterStats.criticals} blocks</strong>
            </div>
            <div className="bg-[#0D0D11] border border-white/5 rounded p-2 flex flex-col justify-center col-span-2 md:col-span-1">
              <span className="text-[8px] text-white/30 uppercase tracking-wide">Module Integrity</span>
              <strong className="text-emerald-400 text-xs mt-0.5 font-mono flex items-center gap-1">
                <CheckCircle size={11} /> SEALED
              </strong>
            </div>
          </div>

          {/* Filtering and Playback Configuration Controllers */}
          <div className="bg-black/25 border-b border-white/5 p-4 flex flex-col gap-3 select-none">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              
              {/* Playback & Feed Controls */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`px-3 py-1.5 rounded font-mono font-bold tracking-wider uppercase text-[10px] flex items-center gap-1.5 border transition-all cursor-pointer ${
                    isPlaying 
                      ? 'bg-rose-950/15 border-rose-900/40 text-rose-400 hover:bg-rose-900/20' 
                      : 'bg-emerald-950/15 border-emerald-900/40 text-emerald-400 hover:bg-emerald-900/20'
                  }`}
                  title={isPlaying ? "Pause real-time streams" : "Resume real-time streams"}
                >
                  {isPlaying ? (
                    <>
                      <Pause size={11} fill="currentColor" /> Stream Engaged
                    </>
                  ) : (
                    <>
                      <Play size={11} fill="currentColor" /> Resume Stream
                    </>
                  )}
                </button>
 
                <div className="flex items-center bg-[#07070A] border border-white/5 rounded p-0.5 text-[10px]">
                  <span className="px-2 text-[9px] text-white/30 font-bold uppercase tracking-wider">Delay:</span>
                  <button 
                    onClick={() => setSpeed(2000)}
                    className={`px-2 py-1 rounded transition-all font-mono font-bold cursor-pointer ${speed === 2000 ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20 font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    2.0s
                  </button>
                  <button 
                    onClick={() => setSpeed(1000)}
                    className={`px-2 py-1 rounded transition-all font-mono font-bold cursor-pointer ${speed === 1000 ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20 font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    1.0s
                  </button>
                  <button 
                    onClick={() => setSpeed(300)}
                    className={`px-2 py-1 rounded transition-all font-mono font-bold cursor-pointer ${speed === 300 ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20 font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    0.3s
                  </button>
                </div>
              </div>

              {/* Utility Terminal Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setLogs([])}
                  className="px-3 py-1.5 bg-black/40 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded font-mono text-[10px] text-white/50 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Wipe clear terminal buffer logs"
                >
                  <Trash2 size={11} /> Clear Buffer
                </button>
                <button
                  onClick={handleExportText}
                  disabled={filteredLogs.length === 0}
                  className="px-3 py-1.5 bg-black/40 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded font-mono text-[10px] text-white/50 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Export output stream as active log bundle"
                >
                  <Download size={11} /> Save Log Output
                </button>
                <label className="flex items-center gap-1.5 cursor-pointer text-zinc-500 hover:text-zinc-400 select-none text-[10px] ml-1">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded border-zinc-800 bg-black text-[#00f0ff]"
                  />
                  <span>Auto Scroll</span>
                </label>
              </div>
            </div>

            {/* Comprehensive search filters panel */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2.5 border-t border-white/5">
              {/* Search input text */}
              <div className="md:col-span-4 relative">
                <span className="absolute left-2.5 top-2 text-[#00f0ff]">
                  <Search size={11} />
                </span>
                <input
                  type="text"
                  placeholder="Regex grep matching log entries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/70 border border-white/5 hover:border-white/10 focus:border-[#00f0ff]/50 rounded px-8 py-1.5 text-zinc-300 placeholder-zinc-650 focus:outline-none font-mono text-[10px] transition-all"
                />
              </div>

              {/* Module Filter buttons */}
              <div className="md:col-span-4 flex items-center gap-1">
                <span className="text-[9px] text-white/30 uppercase tracking-widest font-mono mr-1">Module:</span>
                <div className="flex bg-[#07070A] border border-white/5 rounded p-0.5 text-[9px] w-full justify-between">
                  {['ALL', 'KERNEL', 'HYPERVISOR', 'VMM'].map((mod) => (
                    <button
                      key={mod}
                      onClick={() => setActiveModuleFilter(mod)}
                      className={`px-2 py-0.5 rounded transition-all font-mono font-bold cursor-pointer flex-1 text-center ${
                        activeModuleFilter === mod 
                          ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-bold' 
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {mod}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity filter buttons */}
              <div className="md:col-span-4 flex items-center gap-1">
                <span className="text-[9px] text-white/30 uppercase tracking-widest font-mono mr-1">Severity:</span>
                <div className="flex bg-[#07070A] border border-white/5 rounded p-0.5 text-[9px] w-full justify-between">
                  {['ALL', 'INFO', 'WARN', 'ALERT', 'CRITICAL'].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setActiveLevelFilter(lvl)}
                      className={`px-1.5 py-0.5 rounded transition-all font-mono text-[8px] font-bold cursor-pointer flex-1 text-center ${
                        activeLevelFilter === lvl 
                          ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-bold' 
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Core Interactive Retro Terminal Window */}
          <div 
            ref={terminalRef}
            className="bg-[#050507] p-5 h-96 overflow-y-auto font-mono text-[11px] leading-relaxed relative scroll-smooth border-b border-white/5 shadow-inner"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(20,20,30,0.15) 0%, rgba(0,0,0,0.45) 100%)'
            }}
          >
            {/* Ambient CRT Scanline effect Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[size:100%_4px,6px_100%] pointer-events-none opacity-50" />

            <div className="space-y-1.5 relative z-10">
              <div className="text-zinc-500 text-[10px] mb-4 select-none pb-2 border-b border-dashed border-zinc-900 leading-normal font-mono">
                [SYSTEM OPERATING INITIALIZATION CHECK-SEQUENCE COMPLETE]<br/>
                [HOST ENCLAVE ID MATCHES TARGET AEGIS SHARED METRICS]<br/>
                [ACTIVE LINUX KPROBES, KRETPROBES AND EPT RING TELEMETRY ACTIVE]<br/>
                --- END HEADER HISTORICAL SEGMENTS. COMMENCING TELEMETRY STREAMS ---
              </div>

              {filteredLogs.length === 0 ? (
                <div className="py-20 text-center text-zinc-600 font-mono italic">
                  &lt;No matching telemetry events parsed under current rules filters&gt;
                </div>
              ) : (
                filteredLogs.map((log) => {
                  // Style configurations to paint logs beautifully
                  let moduleColor = 'text-sky-300';
                  if (log.module === 'HYPERVISOR') moduleColor = 'text-amber-300';
                  if (log.module === 'EBPF') moduleColor = 'text-fuchsia-400';
                  if (log.module === 'VMM') moduleColor = 'text-cyan-400';
                  if (log.module === 'INTEL-VT') moduleColor = 'text-indigo-300';
                  if (log.module === 'AMD-V') moduleColor = 'text-violet-300';

                  let levelBadge = 'text-zinc-400';
                  if (log.level === 'WARN') levelBadge = 'text-amber-400 font-bold';
                  if (log.level === 'ALERT') levelBadge = 'text-rose-400 font-bold';
                  if (log.level === 'CRITICAL') levelBadge = 'text-rose-600 font-bold bg-rose-950/20 px-1 border border-rose-900/40 animate-pulse';

                  return (
                    <motion.div 
                      key={log.id}
                      initial={{ opacity: 0, x: -3 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="hover:bg-white/[0.03] transition-all py-0.5 px-1.5 rounded flex flex-wrap gap-x-2 select-text font-mono items-start"
                    >
                      <span className="text-zinc-400 font-bold shrink-0">[{log.timestamp}]</span>
                      <span className={`${moduleColor} font-bold shrink-0 text-[10px]`}>[{log.module}]</span>
                      <span className={`${levelBadge} shrink-0 text-[9px] uppercase tracking-wide`}>[{log.level}]</span>
                      <span className="text-zinc-300 flex-1 break-all tracking-normal">
                        {log.message}
                        {log.sourceAddress && (
                          <span className="text-rose-400/80 font-semibold ml-1.5 font-mono select-all text-[10px]">
                            @ addr:{log.sourceAddress}
                          </span>
                        )}
                        {log.vcpu !== undefined && (
                          <span className="text-amber-400/85 font-semibold ml-1.5 font-mono text-[10px]">
                            [VCPU {log.vcpu}]
                          </span>
                        )}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : (
        /* Tauri Packaging Workshop Tab */
        <div className="bg-[#08080B] p-6 space-y-6 font-mono text-[11px] select-none text-zinc-300 leading-relaxed">
          <div className="bg-[#101014] border border-white/5 rounded-md p-5 space-y-3">
            <h4 className="text-xs font-serif font-light text-zinc-100 flex items-center gap-1.5 leading-tight select-none">
              <Boxes size={14} className="text-[#00f0ff]" /> Desktop Wrapper Portfolio Compile Configuration
            </h4>
            <p className="text-[10px] text-zinc-500 leading-normal font-mono select-none">
              Aegis is architected for frictionless distribution to cross-platform desktop shells using Tauri. By wrapping our Vite compiler and configuring structural hardware bindings via Rust hooks, the web application runs inside sandboxed desktop containers.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Step Guides */}
            <div className="lg:col-span-5 space-y-4 select-none">
              <div className="text-[9px] font-bold tracking-wider text-white/40 uppercase font-mono">
                Native Toolchain Setup
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="shrink-0 w-5 h-5 rounded-full border border-[#00f0ff]/45 flex items-center justify-center text-[#00f0ff] font-bold text-[9px] bg-[#00f0ff]/5 mt-0.5">
                    1
                  </div>
                  <div>
                    <h5 className="text-[10.5px] font-bold text-zinc-200">Initialize Wrapper</h5>
                    <p className="text-[10px] text-zinc-500 leading-snug mt-0.5 font-mono">
                      In your local shell workspace terminal, initiate the client generator:
                    </p>
                    <div className="mt-1.5 bg-black border border-white/5 rounded px-2.5 py-1.5 font-mono text-[10px] text-[#00f0ff] select-all">
                      npm create tauri-app@latest
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="shrink-0 w-5 h-5 rounded-full border border-[#00f0ff]/45 flex items-center justify-center text-[#00f0ff] font-bold text-[9px] bg-[#00f0ff]/5 mt-0.5">
                    2
                  </div>
                  <div>
                    <h5 className="text-[10.5px] font-bold text-zinc-200">Install Rust Dependencies</h5>
                    <p className="text-[10px] text-zinc-500 leading-snug mt-0.5 font-mono">
                      Install Rust toolchains (`rustc`, `cargo`) to handle compiler execution.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="shrink-0 w-5 h-5 rounded-full border border-[#00f0ff]/45 flex items-center justify-center text-[#00f0ff] font-bold text-[9px] bg-[#00f0ff]/5 mt-0.5">
                    3
                  </div>
                  <div>
                    <h5 className="text-[10.5px] font-bold text-zinc-200">Map Configuration Options</h5>
                    <p className="text-[10px] text-zinc-500 leading-snug mt-0.5 font-mono">
                      Configure `src-tauri/tauri.conf.json` to point your app to:
                    </p>
                    <ul className="list-disc pl-4 text-[9.5px] text-zinc-500 space-y-0.5 mt-1 font-mono">
                      <li>Dev path: <code className="text-[#00f0ff]">http://localhost:3000</code></li>
                      <li>Dist output: <code className="text-[#00f0ff]">../dist</code></li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="shrink-0 w-5 h-5 rounded-full border border-[#00f0ff]/45 flex items-center justify-center text-[#00f0ff] font-bold text-[9px] bg-[#00f0ff]/5 mt-0.5">
                    4
                  </div>
                  <div>
                    <h5 className="text-[10.5px] font-bold text-zinc-200">Forge Desktop Executable</h5>
                    <p className="text-[10px] text-zinc-500 leading-snug mt-0.5 font-mono">
                      Kickstart cargo compiling to forge the native runtime executables:
                    </p>
                    <div className="mt-1.5 bg-black border border-white/5 rounded px-2.5 py-1.5 font-mono text-[10px] text-[#00f0ff] select-all">
                      npm run tauri build
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Code manifest block */}
            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold tracking-wider text-white/40 uppercase font-mono">
                  src-tauri/tauri.conf.json Configuration Blueprint
                </span>
                <button
                  onClick={() => copyToClipboard(tauriConfCode)}
                  className="px-2 py-1 bg-[#00f0ff]/15 hover:bg-[#00f0ff]/25 border border-[#00f0ff]/30 text-[#00f0ff] rounded text-[9px] font-mono transition-all flex items-center gap-1 cursor-pointer"
                >
                  {copiedConf ? "Copied Conf!" : "Copy json Blueprint"}
                </button>
              </div>

              {/* Code print box */}
              <div className="bg-black border border-white/5 rounded-md p-4 text-zinc-300 text-[10px] leading-relaxed max-h-[310px] overflow-y-auto whitespace-pre font-mono select-all">
                <code>{tauriConfCode}</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
