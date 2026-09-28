import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Terminal, 
  ShieldAlert, 
  Cpu, 
  Code2, 
  Clock, 
  Server, 
  AlertTriangle, 
  Zap, 
  CheckCircle, 
  Copy, 
  ExternalLink,
  ShieldCheck,
  FileCode2,
  Lock
} from 'lucide-react';
import { SysCallAlert } from '../types';
import ExportButton from './ExportButton';

interface ASTFinding {
  line: number;
  type: string;
  desc: string;
  codeSnippet: string;
}

interface ThreatDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ebpfAlert?: SysCallAlert | null;
  astFinding?: ASTFinding | null;
}

export default function ThreatDetailModal({ isOpen, onClose, ebpfAlert, astFinding }: ThreatDetailModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || (!ebpfAlert && !astFinding)) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract variables depending on which type of threat we are inspecting
  const isEbpf = !!ebpfAlert;
  const severity = isEbpf ? ebpfAlert.severity : 'high';
  const timestamp = isEbpf ? `${ebpfAlert.timestamp} UTC` : 'N/A (Static Code Scan)';

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'high':
        return (
          <span className="px-2.5 py-0.5 rounded text-[9px] bg-rose-950/20 text-rose-400 border border-rose-900/30 font-bold tracking-wider uppercase font-mono flex items-center gap-1">
            <ShieldAlert size={10} className="animate-pulse" /> CRITICAL DEFENSE ALERT
          </span>
        );
      case 'medium':
        return (
          <span className="px-2.5 py-0.5 rounded text-[9px] bg-amber-950/20 text-amber-300 border border-amber-900/30 font-bold tracking-wider uppercase font-mono flex items-center gap-1">
            <AlertTriangle size={10} /> SUSPICIOUS TELEMETRY
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded text-[9px] bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 font-bold tracking-wider uppercase font-mono flex items-center gap-1">
            <CheckCircle size={10} /> RECON AUDIT LOG
          </span>
        );
    }
  };

  // Suggested mitigation step calculator
  const getMitigativeSteps = () => {
    if (isEbpf && ebpfAlert) {
      const comm = ebpfAlert.comm.toLowerCase();
      if (comm === 'nc' || comm === 'netcat') {
        return {
          remediationCode: "sudo kill -9 " + ebpfAlert.pid + "\nsudo iptables -A INPUT -p tcp --dport 4444 -j DROP\nsudo systemctl restart sshd",
          guidance: "A reverse shell spawn was detected via 'nc'. This suggests active command and control (C2) intrusion.",
          actions: [
            "Terminate active PID " + ebpfAlert.pid + " and inspect parent process tree.",
            "Verify network configurations. Restrict access on suspicious outbound ports.",
            "Evict the unauthorized user session and audit the user keys from /home/ and /root/.ssh/authorized_keys."
          ]
        };
      }
      if (comm === 'curl' || comm === 'wget') {
        return {
          remediationCode: "sudo kill -9 " + ebpfAlert.pid + "\nsudo tcpdump -lnni any -c 100 host malcious-domain.com",
          guidance: "A remote content fetch script was flagged downloading malicious scripts for pipe execution ('| sh').",
          actions: [
            "Evict PID " + ebpfAlert.pid + " and verify source network integrity.",
            "Verify proxy filtration rules and firewalls blocking 'malcious-domain.com'.",
            "Collect forensic disk caches for temporary files written inside /tmp/ or /dev/shm."
          ]
        };
      }
      if (ebpfAlert.syscall === 'setuid') {
        return {
          remediationCode: "sudo kill -l\ncat /etc/security/limits.conf | grep setuid\nsudo systemctl status auditd",
          guidance: "Unauthorized process requested elevation of privilege via setuid system call (Root escalation attempt).",
          actions: [
            "Verify code path authenticity for binary '" + ebpfAlert.comm + "'.",
            "Ensure parent PPID configuration does not delegate SUID permissions globally.",
            "Deploy stricter eBPF defensive intercept bounds to deny unauthorized setuid state changes."
          ]
        };
      }
      return {
        remediationCode: "# Evacuate running thread\nkill -15 " + ebpfAlert.pid + "\n# Interrogate with lsof\nsudo lsof -p " + ebpfAlert.pid,
        guidance: "System telemetry hook captured unusual syscall invocation under current defensive rules.",
        actions: [
          "Cross-reference execution parameters with application-level trace logs.",
          "Restrict the program's runtime boundaries with Linux AppArmor standard configurations.",
          "Acknowledge or blacklist parameters if unauthorized arguments are detected."
        ]
      };
    } else if (astFinding) {
      const type = astFinding.type.toLowerCase();
      if (type.includes('os.system') || type.includes('command execution')) {
        return {
          remediationCode: `# REMEDIATED REMOTELY VIA COMPREHENSIVE SUBPROCESS:\nimport subprocess\n\ndef backup_firmware_safe(user_supplied_dir):\n    # Bypasses default shell processing entirely, isolating token arguments:\n    subprocess.run(["tar", "-czf", "site_bak.tar", user_supplied_dir], shell=False)`,
          guidance: "Direct system execution delegates command validation to a shell intermediary, creating Remote Code Execution (RCE) bugs.",
          actions: [
            "De-couple execution parameters by passing input vectors strictly as separate list arguments inside 'subprocess.run'.",
            "Explicitly configure 'shell=False' (default behavior but highly recommended to state explicitly) inside all invokes.",
            "Perform rigorous server-side boundary checks on the arguments before launching tasks."
          ]
        };
      }
      if (type.includes('shell=true') || type.includes('subprocess shell')) {
        return {
          remediationCode: `# DISENGAGE INTERMEDIARY SYSTEM SHELL EXPLICITLY:\nimport subprocess\n\ndef ping_server_safe(addr):\n    # Shell configured to False to ensure clean process allocation:\n    proc = subprocess.Popen(["ping", "-c", "1", addr], shell=False, stdout=subprocess.PIPE)\n    return proc.communicate()`,
          guidance: "Setting shell=True allows operators to construct chained commands using shell punctuation signs like ';' or '&&'.",
          actions: [
            "Always pass argument arrays to avoid spawning shell binary intermediaries ('/bin/sh' or 'cmd.exe').",
            "Implement typed filters (regexp strings) strictly evaluating input domain syntax structures.",
            "Ensure the running daemon does not run under root permissions."
          ]
        };
      }
      if (type.includes('sql')) {
        return {
          remediationCode: `# SECURE PARAMETERIZED DATABASE BINDINGS:\nimport sqlite3\n\ndef load_user_profile_safe(user_id):\n    conn = sqlite3.connect('local.db')\n    # Always bind variables dynamically using query template tokens:\n    conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))`,
          guidance: "Injecting variables into SQL command statements allows hackers to escape logical string syntax boundaries.",
          actions: [
            "Enforce parameterized SQL bindings strictly. Replace all string interpolation queries.",
            "Configure role-based db access credentials restricting drop or update permissions on critical resources.",
            "Deploy a Web Application Firewall (WAF) or run automated regression static tools continuously."
          ]
        };
      }
    }
    return {
      remediationCode: "Fix pattern: verify argument constraints strictly.",
      guidance: "Evaluate custom signature context against developer security guidelines.",
      actions: ["Refactor target code snippet.", "Conduct deep-dive security review."]
    };
  };

  const mitigation = getMitigativeSteps();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/85 backdrop-blur-[6px] cursor-pointer"
        />

        {/* Modal Structure */}
        <motion.div
          id="threat-modal-container"
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="relative w-full max-w-3xl bg-[#08080A] border border-white/10 rounded-lg shadow-[0_0_50px_rgba(0,240,255,0.1)] overflow-hidden z-10 font-mono text-[11px]"
        >
          {/* Diagnostic Scanning Header */}
          <div className="relative border-b border-white/5 p-4 bg-gradient-to-r from-black/80 to-[#0F0F12] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded border ${isEbpf ? 'border-rose-900/30 bg-rose-950/10 text-rose-400' : 'border-[#00f0ff]/35 bg-[#00f0ff]/5 text-[#00f0ff]'}`}>
                {isEbpf ? <Cpu size={16} className="animate-spin-slow" /> : <Code2 size={16} />}
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] tracking-widest text-[#00f0ff] uppercase font-bold flex items-center gap-1">
                  AEGIS INCIDENT RESPONSE CENTER <Lock size={9} />
                </span>
                <h3 className="text-sm font-serif font-light text-zinc-100 flex items-center gap-1.5 leading-tight">
                  {isEbpf ? `Intercepted PID: ${ebpfAlert?.pid}` : `Static Finding: L${astFinding?.line}`}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ExportButton
                id="btn-export-threat-detail"
                label="Export Finding"
                filenamePrefix={isEbpf ? `threat_ebpf_pid_${ebpfAlert?.pid}` : `threat_ast_line_${astFinding?.line}`}
                jsonData={{
                  incident_type: isEbpf ? "eBPF Kernel Telemetry Alert" : "AST Static Scan Finding",
                  severity: severity,
                  timestamp: timestamp,
                  ebpf_payload: ebpfAlert || null,
                  ast_finding: astFinding || null,
                  mitigation_guidance: mitigation.guidance,
                  mitigation_remediation_code: mitigation.remediationCode,
                  mitigation_actions: mitigation.actions,
                  export_timestamp: new Date().toISOString()
                }}
                textReport={`=== AEGIS INCIDENT FINDING REPORT ===\nType: ${isEbpf ? "eBPF Kernel Telemetry" : "AST Static Scan"}\nSeverity: ${severity.toUpperCase()}\nTimestamp: ${timestamp}\n\nSummary:\n${isEbpf ? `Syscall ${ebpfAlert?.syscall} (PID ${ebpfAlert?.pid}, ${ebpfAlert?.comm}) -> ${ebpfAlert?.status}` : astFinding?.desc}\n\nRemediation Actions:\n${mitigation.actions.map(a => `- ${a}`).join('\n')}\n\nRecommended Fix:\n${mitigation.remediationCode}`}
                size="xs"
              />
              {getSeverityBadge(severity)}
              <button 
                onClick={onClose}
                className="p-1.5 rounded border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/15 text-white/50 hover:text-white transition-all cursor-pointer"
                title="Acknowledge Audit"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="p-6 max-h-[72vh] overflow-y-auto space-y-5">
            {/* Context/Summary Section */}
            <div className="bg-[#0D0D11] border border-white/5 p-4 rounded-md space-y-2">
              <div className="text-[9px] font-bold tracking-wider text-white/40 uppercase font-mono flex items-center gap-1">
                <Terminal size={11} className="text-[#00f0ff]" strokeWidth={2.5} /> Summary Narrative
              </div>
              <p className="text-white/80 text-xs font-mono leading-relaxed">
                {isEbpf ? `Syscall monitoring captured telemetry for program '${ebpfAlert?.comm}' which was ${ebpfAlert?.status === 'intercepted' ? 'forcibly terminated using custom-injected filter rules' : 'logged inside safety thresholds'}.` : astFinding?.desc}
              </p>
              <p className="text-[10px] text-[#00f0ff]/80 italic">
                {mitigation.guidance}
              </p>
            </div>

            {/* Core Metadata Indicators */}
            <div>
              <div className="text-[9px] font-bold tracking-wider text-white/40 uppercase mb-2 font-mono">
                System Context Metadata
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 font-mono text-[10px]">
                {isEbpf && ebpfAlert ? (
                  <>
                    <div className="bg-black/35 border border-white/5 p-2 rounded">
                      <span className="block text-[8px] text-white/30 uppercase">Timestamp</span>
                      <strong className="text-zinc-200 flex items-center gap-1 mt-0.5"><Clock size={10} className="text-[#00f0ff]/75" /> {timestamp}</strong>
                    </div>
                    <div className="bg-black/35 border border-white/5 p-2 rounded">
                      <span className="block text-[8px] text-white/30 uppercase">Process ID (PID)</span>
                      <strong className="text-zinc-200 block mt-0.5">{ebpfAlert.pid}</strong>
                    </div>
                    <div className="bg-black/35 border border-white/5 p-2 rounded">
                      <span className="block text-[8px] text-white/30 uppercase">Parent PID (PPID)</span>
                      <strong className="text-[#00f0ff] block mt-0.5">{ebpfAlert.ppid}</strong>
                    </div>
                    <div className="bg-black/35 border border-white/5 p-2 rounded">
                      <span className="block text-[8px] text-white/30 uppercase">Sycall Type</span>
                      <strong className="text-rose-400 block mt-0.5 uppercase">{ebpfAlert.syscall}</strong>
                    </div>
                  </>
                ) : astFinding ? (
                  <>
                    <div className="bg-black/35 border border-white/5 p-2 rounded">
                      <span className="block text-[8px] text-white/30 uppercase">Source Sandbox</span>
                      <strong className="text-zinc-200 flex items-center gap-1 mt-0.5"><FileCode2 size={10} className="text-[#00f0ff]/75" /> static_ast.py</strong>
                    </div>
                    <div className="bg-black/35 border border-white/5 p-2 rounded">
                      <span className="block text-[8px] text-white/30 uppercase">Line Ref</span>
                      <strong className="text-zinc-200 block mt-0.5">Line {astFinding.line}</strong>
                    </div>
                    <div className="bg-black/35 border border-white/5 p-2 rounded">
                      <span className="block text-[8px] text-white/30 uppercase">Detection Rule</span>
                      <strong className="text-[#00f0ff] block mt-0.5 uppercase">Heuristic AST Tree</strong>
                    </div>
                    <div className="bg-black/35 border border-white/5 p-2 rounded">
                      <span className="block text-[8px] text-white/30 uppercase">Risk Level</span>
                      <strong className="text-rose-400 block mt-0.5 uppercase">CRITICAL SEV-1</strong>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* Raw Invoking Code / Command String */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-bold tracking-wider text-white/40 uppercase font-mono">
                  {isEbpf ? "Raw System Call Execution Context" : "Offending Code AST Fragment"}
                </span>
                <span className="text-[8px] text-white/30 italic">Target source contains un-sanitized vectors</span>
              </div>
              <div className="relative bg-black border border-white/5 rounded-md p-3 font-mono text-xs text-rose-300 leading-relaxed overflow-x-auto select-all max-h-24">
                <div className="absolute right-2 top-2">
                  <button 
                    onClick={() => handleCopy(isEbpf ? `${ebpfAlert?.comm} ${ebpfAlert?.args}` : astFinding?.codeSnippet || '')}
                    className="p-1 rounded bg-white/5 border border-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
                    title="Copy payload text"
                  >
                    <Copy size={11} />
                  </button>
                </div>
                <code>
                  {isEbpf && ebpfAlert ? (
                    <span>
                      <span className="text-[#00f0ff]">$</span> {ebpfAlert.comm} <span className="text-white/55">{ebpfAlert.args}</span>
                    </span>
                  ) : (
                    astFinding?.codeSnippet
                  )}
                </code>
              </div>
            </div>

            {/* Comprehensive Mitigation Strategy */}
            <div className="space-y-3.5 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-400 uppercase tracking-wider font-bold text-[10px]">
                  <ShieldCheck size={13} className="text-emerald-400" /> Remediation Blueprint & Suggested Fix
                </div>
                <button
                  onClick={() => handleCopy(mitigation.remediationCode)}
                  className="px-2 py-1 bg-emerald-950/20 hover:bg-emerald-900/40 border border-emerald-900/40 text-emerald-400 rounded text-[9px] hover:text-emerald-300 font-mono transition-all flex items-center gap-1 cursor-pointer"
                >
                  {copied ? "Copied Code!" : "Copy Code Fix"}
                </button>
              </div>

              {/* Remediated Code Container */}
              <div className="bg-black border border-emerald-950/30 rounded-md p-3.5 font-mono text-emerald-300 text-[11px] leading-relaxed max-h-36 overflow-y-auto whitespace-pre">
                <code>{mitigation.remediationCode}</code>
              </div>

              {/* Action Bullet List */}
              <div className="bg-[#0A0D0B] border border-emerald-950/20 p-3 rounded-md space-y-2">
                <div className="text-[9px] font-bold text-white/40 tracking-wider uppercase">
                  Incident Response Action Checklist
                </div>
                <ul className="space-y-1.5 pl-1">
                  {mitigation.actions.map((act, idx) => (
                    <li key={idx} className="text-white/65 text-[10px] leading-relaxed flex items-start gap-2 select-all">
                      <span className="text-emerald-400 font-bold shrink-0 mt-0.5 font-mono">[{idx + 1}]</span>
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="border-t border-white/5 bg-[#070709] p-4 flex gap-2.5 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-white/5 border border-white/10 text-white/70 text-[10px] uppercase font-bold tracking-wider hover:bg-white/10 hover:text-white transition-all cursor-pointer font-mono"
            >
              Acknowledge Audit Info
            </button>
            <button
              onClick={() => {
                handleCopy(JSON.stringify(isEbpf ? ebpfAlert : astFinding, null, 2));
                onClose();
              }}
              className="px-4 py-1.5 rounded bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-[10px] uppercase font-bold tracking-wider hover:bg-emerald-800/40 hover:text-emerald-300 transition-all cursor-pointer font-mono shadow-[0_0_8px_rgba(16,185,129,0.1)]"
            >
              Export JSON & Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
