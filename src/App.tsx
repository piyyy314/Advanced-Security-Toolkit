import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ActiveTool } from './types';
import ConsoleHeader from './components/ConsoleHeader';
import EntropyVisualizer from './components/EntropyVisualizer';
import AstAnalyzer from './components/AstAnalyzer';
import EbpfTelemetry from './components/EbpfTelemetry';
import PeInspector from './components/PeInspector';
import CryptoEngine from './components/CryptoEngine';
import SignatureScanner from './components/SignatureScanner';
import ThreatDetailModal from './components/ThreatDetailModal';
import ConsoleStream from './components/ConsoleStream';
import ThreatArchive from './components/ThreatArchive';
import ThreatOverviews from './components/ThreatOverviews';
import AiCoprocessor from './components/AiCoprocessor';
import CommandLineSearch from './components/CommandLineSearch';
import YaraCompiler from './components/YaraCompiler';
import SmtConstantTimeVerifier from './components/SmtConstantTimeVerifier';
import GoogleDriveVault from './components/GoogleDriveVault';
import ErrorBoundary from './components/ErrorBoundary';

// Ground Station & Space Operations Components
import OperationalDashboard from './components/OperationalDashboard';
import VulnerabilityScanner from './components/VulnerabilityScanner';
import PenetrationFramework from './components/PenetrationFramework';
import NetworkAnalysis from './components/NetworkAnalysis';
import { 
  BarChart3, 
  TrendingUp,
  Code2, 
  Cpu, 
  Binary, 
  Key, 
  Terminal, 
  ShieldAlert, 
  HelpCircle, 
  AlertTriangle,
  Download,
  FileJson,
  Activity,
  Archive,
  CheckCircle,
  X,
  Sparkles,
  FileCode,
  Radio,
  Shield,
  Zap,
  Network,
  Scale,
  HardDrive,
  Save
} from 'lucide-react';

const FORENSIC_AUDIT_STORAGE_KEY = 'aegis_forensic_audit_state';

export default function App() {
  const [activeTool, setActiveTool] = useState<ActiveTool>('operational-dashboard');
  const [threatLevel, setThreatLevel] = useState<'low' | 'medium' | 'high'>('low');
  const [alertCount, setAlertCount] = useState<number>(0);

  // Threat detail modal tracking
  const [selectedEbpfAlert, setSelectedEbpfAlert] = useState<any>(null);
  const [selectedAstFinding, setSelectedAstFinding] = useState<any>(null);
  const [isThreatModalOpen, setIsThreatModalOpen] = useState(false);

  const handleEbpfAlertClick = (al: any) => {
    setSelectedEbpfAlert(al);
    setSelectedAstFinding(null);
    setIsThreatModalOpen(true);
  };

  const handleAstFindingClick = (f: any) => {
    setSelectedAstFinding(f);
    setSelectedEbpfAlert(null);
    setIsThreatModalOpen(true);
  };

  // Centralized forensic sandbox states
  const [ebpfAlerts, setEbpfAlerts] = useState<any[]>([]);
  const [astSourceCode, setAstSourceCode] = useState<string>(
    "import os\n" +
    "import subprocess\n" +
    "import sqlite3\n\n" +
    "def system_diagnostics(user_path):\n" +
    "    # AST FINDING 1: os.system Command Execution Vulnerability!\n" +
    "    os.system(\"tar -czf backup.tar.gz \" + user_path) \n\n" +
    "def verify_connection(host):\n" +
    "    # AST FINDING 2: Subprocess shell integration enabled (HIGH RISK OF INJECTION)\n" +
    "    subprocess.Popen(f\"ping -c 3 {host}\", shell=True)\n\n" +
    "def load_user_profile(user_id):\n" +
    "    conn = sqlite3.connect('local.db')\n" +
    "    # AST FINDING 3: SQL Injection via non-parameterized queries\n" +
    "    conn.execute(f\"SELECT * FROM users WHERE id = '{user_id}'\")\n"
  );
  const [astFindings, setAstFindings] = useState<any[]>([]);
  const [signatureHex, setSignatureHex] = useState<string>(
    "1a 2c 3d 4f a5 b8 55 50 58 30 7e 8a // Header starts...\n" +
    "90 00 03 00 00 00 00 00 e3 c1\n" +
    "c8 00 f2 ff a1 // UPX signature pattern triggers!\n" +
    "55 50 58 31 22 a0 b4 f3 a8 // Embedded unpack signature block"
  );
  const [signatureAlerts, setSignatureAlerts] = useState<any[]>([]);
  const [selectedPeKey, setSelectedPeKey] = useState<string>('svchost.exe');
  const [dhPrimeG, setDhPrimeG] = useState<string>('997');
  const [dhBaseP, setDhBaseP] = useState<string>('5');
  const [dhDerivedKey, setDhDerivedKey] = useState<string>('');
  const [entropyBytesLength, setEntropyBytesLength] = useState<number>(0);
  const [entropyGlobalScore, setEntropyGlobalScore] = useState<number>(0);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewFilename, setPreviewFilename] = useState<string>('');

  // Forensic Audit Auto-Save states (persists every 60s to LocalStorage)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'idle' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [saveCountdown, setSaveCountdown] = useState<number>(60);
  const isHydratedRef = useRef<boolean>(false);

  // Keep a reference to current forensic audit states to avoid stale closures in intervals
  const auditStateRef = useRef({
    threatLevel,
    activeTool,
    alertCount,
    ebpfAlerts,
    astSourceCode,
    astFindings,
    signatureHex,
    signatureAlerts,
    selectedPeKey,
    dhPrimeG,
    dhBaseP,
    dhDerivedKey,
    entropyBytesLength,
    entropyGlobalScore
  });

  useEffect(() => {
    auditStateRef.current = {
      threatLevel,
      activeTool,
      alertCount,
      ebpfAlerts,
      astSourceCode,
      astFindings,
      signatureHex,
      signatureAlerts,
      selectedPeKey,
      dhPrimeG,
      dhBaseP,
      dhDerivedKey,
      entropyBytesLength,
      entropyGlobalScore
    };
  }, [
    threatLevel,
    activeTool,
    alertCount,
    ebpfAlerts,
    astSourceCode,
    astFindings,
    signatureHex,
    signatureAlerts,
    selectedPeKey,
    dhPrimeG,
    dhBaseP,
    dhDerivedKey,
    entropyBytesLength,
    entropyGlobalScore
  ]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  // Perform forensic state serialization & save to LocalStorage
  const handleSaveAuditState = useCallback((isManual = false) => {
    setAutoSaveStatus('saving');
    try {
      const now = new Date();
      const current = auditStateRef.current;
      const snapshot = {
        ...current,
        savedAt: now.toISOString(),
        version: '2.5.0-Enterprise'
      };
      localStorage.setItem(FORENSIC_AUDIT_STORAGE_KEY, JSON.stringify(snapshot));
      setTimeout(() => {
        setLastSavedTime(now);
        setAutoSaveStatus('saved');
        setSaveCountdown(60);
        if (isManual) {
          triggerToast('Forensic audit state manually saved to LocalStorage.');
        }
      }, 200);
    } catch (err) {
      console.error('Failed to save forensic audit state to LocalStorage:', err);
      setAutoSaveStatus('error');
      if (isManual) {
        triggerToast('Failed to save forensic audit state to LocalStorage (quota exceeded).');
      }
    }
  }, []);

  // Hydrate forensic audit state from LocalStorage on mount
  useEffect(() => {
    if (isHydratedRef.current) return;
    isHydratedRef.current = true;

    try {
      const stored = localStorage.getItem(FORENSIC_AUDIT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.threatLevel && ['low', 'medium', 'high'].includes(parsed.threatLevel)) {
          setThreatLevel(parsed.threatLevel);
        }
        if (parsed.activeTool) {
          setActiveTool(parsed.activeTool);
        }
        if (typeof parsed.alertCount === 'number') {
          setAlertCount(parsed.alertCount);
        }
        if (Array.isArray(parsed.ebpfAlerts)) {
          setEbpfAlerts(parsed.ebpfAlerts);
        }
        if (typeof parsed.astSourceCode === 'string') {
          setAstSourceCode(parsed.astSourceCode);
        }
        if (Array.isArray(parsed.astFindings)) {
          setAstFindings(parsed.astFindings);
        }
        if (typeof parsed.signatureHex === 'string') {
          setSignatureHex(parsed.signatureHex);
        }
        if (Array.isArray(parsed.signatureAlerts)) {
          setSignatureAlerts(parsed.signatureAlerts);
        }
        if (typeof parsed.selectedPeKey === 'string') {
          setSelectedPeKey(parsed.selectedPeKey);
        }
        if (typeof parsed.dhPrimeG === 'string') {
          setDhPrimeG(parsed.dhPrimeG);
        }
        if (typeof parsed.dhBaseP === 'string') {
          setDhBaseP(parsed.dhBaseP);
        }
        if (typeof parsed.dhDerivedKey === 'string') {
          setDhDerivedKey(parsed.dhDerivedKey);
        }
        if (typeof parsed.entropyBytesLength === 'number') {
          setEntropyBytesLength(parsed.entropyBytesLength);
        }
        if (typeof parsed.entropyGlobalScore === 'number') {
          setEntropyGlobalScore(parsed.entropyGlobalScore);
        }
        if (parsed.savedAt) {
          setLastSavedTime(new Date(parsed.savedAt));
        } else {
          setLastSavedTime(new Date());
        }
        setAutoSaveStatus('saved');
      } else {
        // Initial baseline snapshot
        const now = new Date();
        const initialSnapshot = {
          ...auditStateRef.current,
          savedAt: now.toISOString(),
          version: '2.5.0-Enterprise'
        };
        localStorage.setItem(FORENSIC_AUDIT_STORAGE_KEY, JSON.stringify(initialSnapshot));
        setLastSavedTime(now);
        setAutoSaveStatus('saved');
      }
    } catch (e) {
      console.error('Error hydrating forensic audit state from LocalStorage:', e);
      setAutoSaveStatus('error');
    }
  }, []);

  // 60-second periodic auto-save ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setSaveCountdown(prev => {
        if (prev <= 1) {
          handleSaveAuditState(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleSaveAuditState]);

  // Sync alerts generated in eBPF Sandbox & AST Analyzer into the durable local Threat Archive
  useEffect(() => {
    if (ebpfAlerts.length === 0 && astFindings.length === 0) return;

    // Load current archive
    const existingStr = localStorage.getItem('aegis_threat_archive');
    let archiveList: any[] = [];
    if (existingStr) {
      try {
        archiveList = JSON.parse(existingStr);
      } catch (e) {
        archiveList = [];
      }
    }

    let modified = false;

    // 1. Process eBPF Alerts
    ebpfAlerts.forEach((alert) => {
      const alreadyExists = archiveList.some((t) => t.id === alert.id);
      if (!alreadyExists) {
        const archivedThreat = {
          id: alert.id,
          timestamp: alert.timestamp ? new Date().toISOString().split('T')[0] + 'T' + alert.timestamp + 'Z' : new Date().toISOString(),
          category: 'ebpf',
          name: `Kernel Intercept: ${alert.syscall} on ${alert.comm}`,
          severity: alert.severity,
          details: `Process '${alert.comm}' (PID ${alert.pid}, Parent PPID ${alert.ppid}) executed system call '${alert.syscall}' with args '${alert.args}'. The engine governed-status was '${alert.status}'.`,
          rawPayload: `syscall=${alert.syscall} ppid=${alert.ppid} pid=${alert.pid} comm=${alert.comm} args=${alert.args} status=${alert.status}`,
          status: 'Unresolved',
          notes: 'Automatically archived during live eBPF telemetry simulation.',
          assignedOfficer: 'baalbek.313@gmail.com',
          meta: {
            pid: alert.pid,
            ppid: alert.ppid,
            comm: alert.comm,
            syscall: alert.syscall,
            args: alert.args,
            status: alert.status
          }
        };
        archiveList.unshift(archivedThreat); // Add to beginning of database
        modified = true;
      }
    });

    // 2. Process AST Findings
    astFindings.forEach((finding) => {
      // Create a logical unique ID for the static finding to prevent duplicates
      const findingId = `ast-vuln-${finding.type}-${finding.line}`;
      const alreadyExists = archiveList.some((t) => t.id === findingId);
      if (!alreadyExists) {
        const archivedThreat = {
          id: findingId,
          timestamp: new Date().toISOString(),
          category: 'ast',
          name: `Static Threat: ${finding.type}`,
          severity: 'high',
          details: `Static source scan identified validation vulnerability in source. Line ${finding.line}: ${finding.desc}`,
          rawPayload: finding.codeSnippet,
          status: 'Unresolved',
          notes: 'Automatically archived during static code verification AST scan.',
          assignedOfficer: 'baalbek.313@gmail.com',
          meta: {
            line: finding.line,
            type: finding.type,
            desc: finding.desc
          }
        };
        archiveList.unshift(archivedThreat);
        modified = true;
      }
    });

    if (modified) {
      localStorage.setItem('aegis_threat_archive', JSON.stringify(archiveList));
    }
  }, [ebpfAlerts, astFindings]);

  const handleExportForensics = () => {
    if (exportFormat === 'json') {
      const payload = {
        meta: {
          suite: "Aegis Unified Security Suite",
          version: "v2.5.0-Enterprise",
          exported_by: "baalbek.313@gmail.com",
          compiled_timestamp_utc: "2026-06-07T11:01:47Z",
          system_time: new Date().toISOString(),
          threat_posture_configured: threatLevel.toUpperCase(),
          uncompromising_defense_active: threatLevel === 'high'
        },
        current_tool_viewing: activeTool,
        real_time_statistics: {
          active_mitigations_count: alertCount,
          shannon_entropy_bytes_scanned: entropyBytesLength,
          shannon_entropy_peak_score: entropyGlobalScore,
          active_binary_selection: selectedPeKey,
          diffie_hellman_handshake_prime: dhPrimeG,
          diffie_hellman_handshake_generator: dhBaseP,
          derived_ephemeral_key: dhDerivedKey || "NO_ACTIVE_NEGOTIATION"
        },
        ast_static_scan: {
          checked_source_module_length: astSourceCode ? astSourceCode.length : 0,
          ast_heuristics_vulnerability_matches: astFindings.map(f => ({
            line: f.line,
            vulnerability_type: f.type,
            description_remediation: f.desc,
            offending_signature: f.codeSnippet
          }))
        },
        signature_matching_ledger: {
          raw_hex_input_length_bytes: signatureHex ? (signatureHex.replace(/[^a-f]/gi, '').length / 2) : 0,
          untrusted_hex_dump: signatureHex || "",
          malicious_signature_detections: signatureAlerts.map(a => ({
            buffer_offset: a.offset,
            pattern_signature_catalog: a.patternName,
            matched_bytes_sequence: a.matchedBytes
          }))
        },
        ebpf_kernel_execution_logs: ebpfAlerts.map(al => ({
          event_id: al.id,
          timestamp_offset: al.timestamp,
          process_id: al.pid,
          parent_process_id: al.ppid,
          executable_name: al.comm,
          invoked_system_call: al.syscall,
          syscall_arguments: al.args,
          governing_sandbox_action: al.status,
          incident_severity_classification: al.severity
        }))
      };

      const jsonString = JSON.stringify(payload, null, 2);
      setPreviewContent(jsonString);
      setPreviewFilename(`aegis_forensics_dump_${new Date().toISOString().substring(0, 10)}.json`);
      setShowPreviewModal(true);
    } else {
      // CSV Format Generating
      const escapeCsvValue = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = ["Category/Module", "Incident_ID_or_Offset", "Timestamp_or_Line", "Severity", "Title_or_Call", "Narrative_Details", "Payload_or_Snippet"];
      const rows: string[][] = [];

      // 1. Process eBPF
      ebpfAlerts.forEach(al => {
        rows.push([
          "eBPF Kernel Telemetry",
          al.id || String(al.pid),
          al.timestamp || "N/A",
          al.severity || "high",
          al.syscall || "execve",
          `Process ${al.comm} (PID ${al.pid}, PPID ${al.ppid}) executed system call with sandbox result: ${al.status}`,
          al.args || ""
        ]);
      });

      // 2. Process AST static Scan
      astFindings.forEach(f => {
        rows.push([
          "AST Static Scan",
          `ast-vuln-${f.type}-${f.line}`,
          `Line ${f.line}`,
          "high",
          f.type,
          f.desc,
          f.codeSnippet || ""
        ]);
      });

      // 3. Process Malware code signatures matched
      signatureAlerts.forEach(a => {
        rows.push([
          "Malware Code Signatures",
          `Offset ${a.offset}`,
          "N/A",
          "medium",
          a.patternName,
          "Matched sequence of suspicious malware marker bytes",
          a.matchedBytes || ""
        ]);
      });

      // Generate the finished output text CSV blob
      let csvContent = "";
      // Add global metadata block as standard header comments
      csvContent += `# Code Audit Suite: Aegis Unified Security Suite\n`;
      csvContent += `# Exported by: baalbek.313@gmail.com\n`;
      csvContent += `# Posture Level: ${threatLevel.toUpperCase()}\n`;
      csvContent += `# Export Timestamp UTC: ${new Date().toISOString()}\n\n`;

      csvContent += headers.map(escapeCsvValue).join(",") + "\n";
      rows.forEach(r => {
        csvContent += r.map(escapeCsvValue).join(",") + "\n";
      });

      setPreviewContent(csvContent);
      setPreviewFilename(`aegis_forensics_dump_${new Date().toISOString().substring(0, 10)}.csv`);
      setShowPreviewModal(true);
    }
  };

  const renderToolContent = () => {
    switch (activeTool) {
      case 'operational-dashboard':
        return (
          <OperationalDashboard 
            setActiveTool={setActiveTool}
            triggerToast={triggerToast}
          />
        );
      case 'vuln-scanner':
        return (
          <VulnerabilityScanner 
            triggerToast={triggerToast}
          />
        );
      case 'penetration-framework':
        return (
          <PenetrationFramework 
            triggerToast={triggerToast}
          />
        );
      case 'network-analysis':
        return (
          <NetworkAnalysis 
            triggerToast={triggerToast}
          />
        );
      case 'entropy':
        return (
          <EntropyVisualizer 
            onMetricsComputed={(bytesLen, score) => {
              setEntropyBytesLength(bytesLen);
              setEntropyGlobalScore(score);
            }} 
            triggerToast={triggerToast}
          />
        );
      case 'ast':
        return (
          <AstAnalyzer 
            sourceCode={astSourceCode}
            setSourceCode={setAstSourceCode}
            findings={astFindings}
            setFindings={setAstFindings}
            onFindingClick={handleAstFindingClick}
            triggerToast={triggerToast}
          />
        );
      case 'ebpf':
        return (
          <EbpfTelemetry 
            threatLevel={threatLevel} 
            onAlertTriggered={setAlertCount}
            alerts={ebpfAlerts}
            setAlerts={setEbpfAlerts}
            onAlertClick={handleEbpfAlertClick}
            triggerToast={triggerToast}
          />
        );
      case 'pe':
        return (
          <PeInspector 
            selectedKey={selectedPeKey}
            setSelectedKey={setSelectedPeKey}
            triggerToast={triggerToast}
          />
        );
      case 'crypto':
        return (
          <CryptoEngine 
            primeG={dhPrimeG}
            setPrimeG={setDhPrimeG}
            baseP={dhBaseP}
            setBaseP={setDhBaseP}
            derivedKeyAlice={dhDerivedKey}
            setDerivedKeyAlice={setDhDerivedKey}
            triggerToast={triggerToast}
            onNavigateToSmt={() => setActiveTool('smt-verifier')}
          />
        );
      case 'smt-verifier':
        return (
          <SmtConstantTimeVerifier 
            triggerToast={triggerToast}
          />
        );
      case 'signature':
        return (
          <SignatureScanner 
            hexInput={signatureHex}
            setHexInput={setSignatureHex}
            alerts={signatureAlerts}
            setAlerts={setSignatureAlerts}
            triggerToast={triggerToast}
          />
        );
      case 'console':
        return <ConsoleStream />;
      case 'archive':
        return <ThreatArchive triggerToast={triggerToast} />;
      case 'overviews':
        return (
          <ThreatOverviews 
            ebpfAlerts={ebpfAlerts}
            astFindings={astFindings}
            signatureAlerts={signatureAlerts}
            triggerToast={triggerToast}
          />
        );
      case 'ai-coprocessor':
        return (
          <AiCoprocessor 
            triggerToast={triggerToast}
          />
        );
      case 'yara':
        return (
          <YaraCompiler 
            triggerToast={triggerToast}
          />
        );
      case 'google-drive':
        return (
          <GoogleDriveVault 
            triggerToast={triggerToast}
            onLoadIntoTool={(tool, payload) => {
              if (tool === 'ast') {
                setAstSourceCode(payload);
                setActiveTool('ast');
              } else if (tool === 'signature') {
                setSignatureHex(payload);
                setActiveTool('signature');
              } else {
                setActiveTool(tool);
              }
            }}
          />
        );
    }
  };

  const navItems = [
    { id: 'operational-dashboard' as const, label: 'Operational Dashboard', icon: Radio, desc: 'Assess Ground-Station RF & Hardening' },
    { id: 'vuln-scanner' as const, label: '1. Vulnerability Scanner', icon: Shield, desc: 'CISA KEV Satellite Active Auditor' },
    { id: 'penetration-framework' as const, label: '2. Penetration Framework', icon: Zap, desc: 'Custom Uplink Payload Injection' },
    { id: 'network-analysis' as const, label: '9-Element Tactical Suite', icon: Network, desc: 'Network, Pwd, Sandbox, Forensic, Jamming' },
    { id: 'console' as const, label: 'Console Stream', icon: Terminal, desc: 'Live kernel & hypervisor logs' },
    { id: 'overviews' as const, label: 'Threat Overviews', icon: TrendingUp, desc: 'Aggregated analytics charts' },
    { id: 'ai-coprocessor' as const, label: 'AI Threat Coprocessor', icon: Sparkles, desc: 'Heuristics & static forensics' },
    { id: 'archive' as const, label: 'Threat Archive', icon: Archive, desc: 'Durable offline alert vault' },
    { id: 'google-drive' as const, label: 'Google Drive Vault', icon: HardDrive, desc: 'OAuth cloud storage & evidence' },
    { id: 'yara' as const, label: 'YARA Rule Compiler', icon: FileCode, desc: 'Pattern matching compile engine' },
    { id: 'entropy' as const, label: 'Entropy Scan', icon: BarChart3, desc: 'Assess randomness profiles' },
    { id: 'ast' as const, label: 'AST Static Vulns', icon: Code2, desc: 'Heuristic script scanner' },
    { id: 'ebpf' as const, label: 'eBPF Live Audit', icon: Cpu, desc: 'Simulate kernel operations' },
    { id: 'pe' as const, label: 'PE Executable Walk', icon: Binary, desc: 'Binary format structure' },
    { id: 'crypto' as const, label: 'DH & HKDF Keygen', icon: Key, desc: 'Modular secrecy handshakes' },
    { id: 'smt-verifier' as const, label: 'SMT Constant-Time Prover', icon: Scale, desc: 'Z3/angr formal side-channel proof' },
    { id: 'signature' as const, label: 'Signature Scanner', icon: Activity, desc: 'Aho-Corasick trie-marker' },
  ];

  return (
    <div id="aegis-app-container" className="min-h-screen bg-transparent text-[#E2E8F0] flex flex-col font-sans select-none antialiased">
      <ConsoleHeader 
        threatLevel={threatLevel} 
        setThreatLevel={setThreatLevel} 
        activeInterceptsCount={alertCount}
        autoSaveStatus={autoSaveStatus}
        lastSavedTime={lastSavedTime}
        saveCountdown={saveCountdown}
        onManualSave={() => handleSaveAuditState(true)}
      />

      <CommandLineSearch 
        ebpfAlerts={ebpfAlerts}
        astFindings={astFindings}
        signatureAlerts={signatureAlerts}
        triggerToast={triggerToast}
        onSelectAction={(tool, item) => {
          if (tool === 'ebpf' || item?.category === 'ebpf') {
            setActiveTool('ebpf');
            if (item?.rawObject?.id) {
              handleEbpfAlertClick(item.rawObject);
            }
          } else if (tool === 'ast' || item?.category === 'ast') {
            setActiveTool('ast');
            if (item?.rawObject?.type) {
              handleAstFindingClick(item.rawObject);
            }
          } else if (tool === 'signature' || item?.category === 'signature') {
            setActiveTool('signature');
          }
        }}
      />

      <div className="flex-1 max-w-[1400px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-950/40 backdrop-blur-md border border-white/5 rounded p-5 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
            <h2 className="text-[10px] text-[#00f0ff]/80 font-serif italic uppercase tracking-[0.2em] mb-4">
              Intelligence Modules
            </h2>
            
            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isSelected = activeTool === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-btn-${item.id}`}
                    onClick={() => setActiveTool(item.id)}
                    className={`w-full text-left p-3.5 rounded border transition-all text-xs flex items-start gap-3.5 cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/10 text-white border-[#00f0ff]/40 shadow-[0_0_15px_rgba(0,240,255,0.08)] border-l-2 border-l-[#00f0ff]'
                        : 'bg-transparent text-white/40 border-transparent hover:border-white/5 hover:bg-white/[0.01] hover:text-white/80'
                    }`}
                  >
                    <Icon size={15} className={`shrink-0 mt-0.5 ${isSelected ? 'text-[#00f0ff]' : 'text-white/30'}`} />
                    <div className="flex flex-col">
                      <span className={`tracking-wider ${isSelected ? 'font-light text-white font-serif' : 'font-mono text-white/50'}`}>
                        {item.label}
                      </span>
                      <span className="text-[10px] text-white/30 font-mono tracking-wide mt-0.5 leading-tight lowercase">
                        {item.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick-stats system banner block */}
          <div className="bg-slate-950/40 backdrop-blur-md border border-white/5 rounded p-5 font-mono text-[11px] leading-relaxed text-white/50 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-1.5 text-white/80 font-serif italic mb-2 uppercase text-xs">
              <ShieldAlert size={13} className="text-[#00f0ff]" /> Core Threat Status
            </div>
            {threatLevel === 'high' ? (
              <p className="text-rose-300/90">
                ⚠️ <strong className="font-serif italic text-rose-200">MAXIMUM SHIELD ACTIVE</strong>. Anomalous probe signals elevated. All kernel intercept triggers configured to BLOCK violations instantly.
              </p>
            ) : threatLevel === 'medium' ? (
              <p className="text-amber-200/90 font-mono">
                ⚠️ <strong className="font-serif italic text-[#00f0ff]">ELEVATED AUDITING</strong>. Background AST static validation processing active. Multi-signature scanner buffers checked.
              </p>
            ) : (
              <p className="text-emerald-400/90 font-mono">
                ✓ <strong className="font-serif italic text-emerald-200">PASSIVE MONITORING</strong>. System integrity matches target MRENCLAVE. Enclave environment verified clean & stable.
              </p>
            )}
          </div>

          {/* Foresnics Export Area */}
          <div className="bg-slate-950/40 backdrop-blur-md border border-white/5 rounded p-5 font-mono text-[11px] leading-relaxed text-white/50 space-y-3.5 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-1.5 text-white/80 font-serif italic uppercase text-xs">
              <FileJson size={13} className="text-[#00f0ff]" /> Forensic Data Exporter
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed font-mono">
              Compile current active kernel syscall execution history, heuristic static AST vulnerability metrics, and matching malware signatures into a unified offline forensic audit document.
            </p>
            
            <div className="border border-white/5 bg-black/40 p-2.5 rounded text-[10px] space-y-1 bg-black/50">
              <div className="flex justify-between">
                <span className="text-white/30 font-mono">EBPF SYSCALLS:</span>
                <span className="text-zinc-300 font-bold">{ebpfAlerts.length} logged</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/30 font-mono">AST VULNS:</span>
                <span className="text-zinc-300 font-bold">{astFindings.length} found</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/30 font-mono">CODE SIGNATURES:</span>
                <span className="text-zinc-300 font-bold">{signatureAlerts.length} hits</span>
              </div>
            </div>

            {/* LocalStorage Auto-Save Status Strip */}
            <div className="border border-white/5 bg-black/40 p-2.5 rounded text-[10px] space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-white/40 font-mono text-[9px] uppercase">STORAGE PERSISTENCE:</span>
                <span className="text-emerald-400 font-mono text-[9px] font-bold flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${autoSaveStatus === 'saving' ? 'bg-[#00f0ff]' : autoSaveStatus === 'error' ? 'bg-rose-500' : 'bg-emerald-400'} animate-pulse`} />
                  {autoSaveStatus === 'saving' ? 'Saving...' : autoSaveStatus === 'error' ? 'Error' : 'LocalStorage (Active)'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[9px]">
                <span className="text-white/40 font-mono uppercase">AUTOSAVE CADENCE:</span>
                <span className="text-[#00f0ff] font-mono">60s (Next in {saveCountdown}s)</span>
              </div>
              <div className="flex justify-between items-center text-[9px]">
                <span className="text-white/40 font-mono uppercase">LAST SYNCED:</span>
                <span className="text-zinc-300 font-mono">
                  {lastSavedTime ? lastSavedTime.toTimeString().substring(0, 8) : 'Pending initial save'}
                </span>
              </div>
              <button
                type="button"
                id="sidebar-save-state-btn"
                onClick={() => handleSaveAuditState(true)}
                className="w-full mt-1 py-1 px-2 bg-white/5 hover:bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 hover:border-[#00f0ff] rounded text-[9px] font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Save size={10} /> Force Save State Now
              </button>
            </div>

            {/* Toggle format preset buttons */}
            <div className="flex items-center justify-between border-t border-white/5 pt-3.5">
              <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">File Format:</span>
              <div className="flex bg-[#07070A] border border-white/5 rounded p-0.5 text-[9px] gap-0.5">
                <button
                  type="button"
                  onClick={() => setExportFormat('json')}
                  className={`px-2.5 py-1 rounded transition-all font-mono font-bold cursor-pointer ${
                    exportFormat === 'json'
                      ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20 font-bold text-[9px]'
                      : 'text-zinc-500 hover:text-zinc-300 bg-transparent border border-transparent'
                  }`}
                >
                  JSON List
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('csv')}
                  className={`px-2.5 py-1 rounded transition-all font-mono font-bold cursor-pointer ${
                    exportFormat === 'csv'
                      ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20 font-bold text-[9px]'
                      : 'text-zinc-500 hover:text-zinc-300 bg-transparent border border-transparent'
                  }`}
                >
                  CSV Matrix
                </button>
              </div>
            </div>

            <button
              onClick={handleExportForensics}
              id="btn-export-forensics"
              className="w-full py-2 bg-transparent text-[#00f0ff] hover:text-black hover:bg-[#00f0ff] border border-[#00f0ff]/55 rounded font-mono text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_8px_rgba(0,240,255,0.06)]"
            >
              <Download size={12} /> Export Forensics {exportFormat.toUpperCase()}
            </button>
          </div>
        </div>

        {/* Dynamic Tool Playground area */}
        <div className="lg:col-span-3 space-y-6">
          <main className="min-w-0">
            <ErrorBoundary>
              {renderToolContent()}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      <ThreatDetailModal 
        isOpen={isThreatModalOpen}
        onClose={() => setIsThreatModalOpen(false)}
        ebpfAlert={selectedEbpfAlert}
        astFinding={selectedAstFinding}
      />

      {/* Forensic Export Preview Modal */}
      <AnimatePresence>
        {showPreviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0E0E12] border border-[#00f0ff]/30 rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col shadow-[0_0_30px_rgba(0,240,255,0.15)] text-zinc-100 font-mono text-[11px]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#0A0A0D]">
                <div className="flex items-center gap-2">
                  <FileJson className="text-[#00f0ff]" size={14} />
                  <div>
                    <h3 className="font-serif italic font-bold text-xs tracking-wider uppercase text-[#00f0ff]">
                      Forensics Report Export Preview
                    </h3>
                    <p className="text-[9px] text-white/30 font-mono mt-0.5">
                      Verify compiled security telemetry dataset before local system download
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="text-zinc-500 hover:text-white hover:bg-white/5 p-1 rounded-md transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Info strip */}
              <div className="px-5 py-2.5 bg-cyan-500/5 border-b border-cyan-500/10 text-[10px] text-[#00f0ff]/80 flex items-center gap-2 flex-wrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
                <span>Filename target: <strong className="text-zinc-300 font-normal">{previewFilename}</strong></span>
                <span className="text-white/20 hidden sm:inline">|</span>
                <span>Type: <strong className="text-zinc-300 uppercase font-normal">{previewFilename.endsWith('.json') ? 'JSON Object' : 'CSV Spreadsheet'}</strong></span>
                <span className="text-white/20 hidden sm:inline">|</span>
                <span>Size: <strong className="text-zinc-300 font-normal">{(previewContent.length / 1024).toFixed(2)} KB</strong></span>
              </div>

              {/* Preview Body */}
              <div className="p-5 flex-1 overflow-hidden flex flex-col gap-2">
                <div className="text-[10px] text-white/40 mb-1 flex justify-between items-center">
                  <span>UNIFIED DATA STREAM:</span>
                  <span className="text-[9px] text-zinc-500">Scroll to inspect entire log</span>
                </div>
                <div className="flex-1 bg-black/60 border border-white/5 rounded p-4 overflow-auto font-mono text-[10.5px] leading-relaxed text-zinc-300 max-h-[45vh] select-all">
                  <pre className="whitespace-pre-wrap break-all select-all font-mono">
                     {previewContent}
                  </pre>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="px-5 py-4 border-t border-white/5 bg-[#0A0A0D] flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-1.5 border border-white/10 hover:border-white/20 hover:bg-white/5 rounded text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer font-mono text-[10px] uppercase font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const type = previewFilename.endsWith('.json') ? 'application/json;charset=utf-8;' : 'text/csv;charset=utf-8;';
                    const blob = new Blob([previewContent], { type });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", previewFilename);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    setShowPreviewModal(false);
                    triggerToast(`Unified forensic audit successfully exported as ${previewFilename.endsWith('.json') ? 'JSON' : 'CSV'}.`);
                  }}
                  className="px-4 py-1.5 bg-[#00f0ff] hover:bg-[#00d0e0] text-black font-mono text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.2)]"
                >
                  <Download size={11} /> Confirm & Download
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern success toast notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="fixed top-6 right-6 z-50 bg-[#0E0E12] border border-[#00f0ff]/50 text-zinc-100 px-4 py-3 rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center gap-3 font-mono text-[11px] select-none max-w-sm border-l-4 border-l-[#00f0ff]"
          >
            <div className="p-1.5 bg-[#00f0ff]/10 rounded text-[#00f0ff]">
              <CheckCircle size={14} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-[9px] tracking-widest text-[#00f0ff] uppercase font-serif italic">Forensic Alert Channel</div>
              <div className="text-[10px] text-zinc-300 mt-0.5 leading-relaxed">{toastMessage}</div>
            </div>
            <button 
              onClick={() => setShowToast(false)} 
              className="text-zinc-500 hover:text-white transition-all p-1 cursor-pointer"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
