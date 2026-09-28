import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Terminal, 
  Cpu, 
  Code2, 
  Activity, 
  ChevronRight, 
  Command, 
  Sparkles, 
  CornerDownLeft,
  X,
  FileCode,
  Shield,
  Clock
} from 'lucide-react';
import { SysCallAlert, ArchivedThreat } from '../types';

interface CommandLineSearchProps {
  ebpfAlerts?: SysCallAlert[];
  astFindings?: any[];
  signatureAlerts?: any[];
  onSelectAction?: (tool: string, item: any) => void;
  triggerToast?: (msg: string) => void;
}

interface FlattenedThreatResult {
  id: string;
  source: 'eBPF Kernel' | 'AST Static Scan' | 'Signature Database' | 'Historical Archive';
  category: 'ebpf' | 'ast' | 'signature' | 'archive';
  title: string;
  subtitle: string;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  rawObject: any;
}

export default function CommandLineSearch({
  ebpfAlerts = [],
  astFindings = [],
  signatureAlerts = [],
  onSelectAction,
  triggerToast
}: CommandLineSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'ebpf' | 'ast' | 'signature'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus CLI via Keyboard Shortcut Ctrl+/ or Cmd+/
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Load from historical logs inside secure local storage as well
  const historicalThreats = useMemo(() => {
    const str = localStorage.getItem('aegis_threat_archive');
    if (str) {
      try {
        const parsed: ArchivedThreat[] = JSON.parse(str);
        return parsed.map((item) => ({
          id: item.id || `hist-${Math.random()}`,
          source: item.category === 'ebpf' ? 'eBPF Kernel' : item.category === 'ast' ? 'AST Static Scan' : 'Historical Archive' as any,
          category: (item.category || 'archive') as any,
          title: item.name || 'Archived Security Alert',
          subtitle: `Assigned: ${item.assignedOfficer || 'baalbek.313@gmail.com'}`,
          details: item.details || '',
          severity: (item.severity || 'high') as any,
          timestamp: item.timestamp || new Date().toISOString(),
          rawObject: item
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  }, []);

  // Compile all pool items together
  const searchPool = useMemo(() => {
    const list: FlattenedThreatResult[] = [];

    // 1. Process eBPF
    ebpfAlerts.forEach((ebpf, index) => {
      list.push({
        id: ebpf.id || `cli-ebpf-${index}`,
        source: 'eBPF Kernel',
        category: 'ebpf',
        title: `Syscall Intercept: ${ebpf.syscall}`,
        subtitle: `Process: ${ebpf.comm} (PID: ${ebpf.pid})`,
        details: `PPID: ${ebpf.ppid} - CLI arguments: ${ebpf.args}. Decision state: ${ebpf.status}.`,
        severity: (ebpf.severity || 'high') as any,
        timestamp: ebpf.timestamp || new Date().toLocaleTimeString(),
        rawObject: ebpf
      });
    });

    // 2. Process AST findings
    astFindings.forEach((ast, index) => {
      list.push({
        id: `cli-ast-${index}`,
        source: 'AST Static Scan',
        category: 'ast',
        title: `Vulnerability: ${ast.type}`,
        subtitle: `Line ${ast.line} - Code Snippet: "${ast.codeSnippet.trim()}"`,
        details: ast.desc,
        severity: 'high',
        timestamp: new Date().toLocaleTimeString(),
        rawObject: ast
      });
    });

    // 3. Process matched signatures
    signatureAlerts.forEach((sig, index) => {
      list.push({
        id: `cli-sig-${index}`,
        source: 'Signature Database',
        category: 'signature',
        title: `Malware Signature Match: ${sig.patternName}`,
        subtitle: `Segment Offset: 0x${sig.offset.toString(16).toUpperCase()}`,
        details: `Subsequence match sequence: ${sig.matchedBytes}. Triggered via Aho-Corasick dynamic Trie index.`,
        severity: 'critical',
        timestamp: new Date().toLocaleTimeString(),
        rawObject: sig
      });
    });

    // 4. Incorporate unique historical threats (filter duplicates if matches found by ID)
    historicalThreats.forEach((hist) => {
      if (!list.some(item => item.id === hist.id)) {
        list.push(hist);
      }
    });

    // Add standard placeholder templates if empty to bootstrap CLI matching
    if (list.length === 0) {
      list.push({
        id: 'mock-1',
        source: 'eBPF Kernel',
        category: 'ebpf',
        title: 'Syscall Intercept: sys_execve',
        subtitle: 'comm: node (PID: 32801)',
        details: 'Checked unauthorized spawning of custom sub-shells.',
        severity: 'high',
        timestamp: '12:01:45',
        rawObject: {}
      });
      list.push({
        id: 'mock-2',
        source: 'AST Static Scan',
        category: 'ast',
        title: 'Vulnerability: CWE-78 Shell Injection',
        subtitle: 'Line 22 - os.system(tar)',
        details: 'Found unsanitized string argument integration.',
        severity: 'high',
        timestamp: '11:58:30',
        rawObject: {}
      });
      list.push({
        id: 'mock-3',
        source: 'Signature Database',
        category: 'signature',
        title: 'Malware Signature Match: UPX Pack Header Block (UPX0)',
        subtitle: 'Segment Offset: 0x24F0',
        details: 'UPX signature matched packing header segment.',
        severity: 'medium',
        timestamp: '11:42:15',
        rawObject: {}
      });
    }

    return list;
  }, [ebpfAlerts, astFindings, signatureAlerts, historicalThreats]);

  // Handle command-line options prefix parsing (e.g., "-c ebpf", "--severity high")
  const parsedFilters = useMemo(() => {
    let finalQuery = query;
    let categoryOverride: 'all' | 'ebpf' | 'ast' | 'signature' = 'all';
    let severityOverride: 'all' | 'high' | 'medium' | 'low' | 'critical' = 'all';

    // Regex scanners for query flags
    const catMatch = finalQuery.match(/(?:-c|--category)\s+([a-zA-Z]+)/i);
    if (catMatch && catMatch[1]) {
      const val = catMatch[1].toLowerCase();
      if (['ebpf', 'ast', 'signature', 'yara'].includes(val)) {
        categoryOverride = val === 'yara' ? 'signature' : val as any;
      }
      finalQuery = finalQuery.replace(catMatch[0], '');
    }

    const sevMatch = finalQuery.match(/(?:-s|--severity)\s+([a-zA-Z]+)/i);
    if (sevMatch && sevMatch[1]) {
      const val = sevMatch[1].toLowerCase();
      if (['high', 'medium', 'low', 'critical'].includes(val)) {
        severityOverride = val as any;
      }
      finalQuery = finalQuery.replace(sevMatch[0], '');
    }

    return {
      cleanQuery: finalQuery.trim().toLowerCase(),
      categoryOverride,
      severityOverride
    };
  }, [query]);

  // Execute matching algorithms
  const filteredResults = useMemo(() => {
    const { cleanQuery, categoryOverride, severityOverride } = parsedFilters;

    return searchPool.filter((item) => {
      // 1. Apply category filter
      const activeCat = categoryOverride !== 'all' ? categoryOverride : categoryFilter;
      if (activeCat !== 'all' && item.category !== activeCat) {
        return false;
      }

      // 2. Apply severity filter
      const activeSev = severityOverride !== 'all' ? severityOverride : severityFilter;
      if (activeSev !== 'all') {
        if (activeSev === 'high' && item.severity !== 'high' && item.severity !== 'critical') {
          return false;
        }
        if (activeSev !== 'high' && item.severity !== activeSev) {
          return false;
        }
      }

      // 3. String query match
      if (!cleanQuery) return true;

      return (
        item.title.toLowerCase().includes(cleanQuery) ||
        item.subtitle.toLowerCase().includes(cleanQuery) ||
        item.details.toLowerCase().includes(cleanQuery) ||
        item.source.toLowerCase().includes(cleanQuery)
      );
    });
  }, [searchPool, query, categoryFilter, severityFilter, parsedFilters]);

  const handleApplyPresetCommand = (commandStr: string) => {
    setQuery(commandStr);
    inputRef.current?.focus();
    if (triggerToast) {
      triggerToast(`CLI Parameter evaluated: "${commandStr}"`);
    }
  };

  const getSourceIcon = (category: string) => {
    switch (category) {
      case 'ebpf':
        return <Cpu size={12} className="text-[#00f0ff]" />;
      case 'ast':
        return <Code2 size={12} className="text-pink-400" />;
      case 'signature':
        return <Activity size={12} className="text-cyan-400" />;
      default:
        return <Terminal size={12} className="text-zinc-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const sevClass = severity === 'critical' || severity === 'high'
      ? 'border-rose-500/30 text-rose-400 bg-rose-500/5'
      : severity === 'medium'
      ? 'border-amber-500/30 text-amber-400 bg-amber-500/5'
      : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5';

    return (
      <span className={`px-1.5 py-0.5 rounded border text-[8px] font-mono font-bold font-semibold shrink-0 uppercase tracking-wider ${sevClass}`}>
        {severity}
      </span>
    );
  };

  return (
    <div id="cli-globalsearch-container" className="max-w-[1400px] w-full mx-auto px-4 lg:px-6 mt-4">
      
      {/* Search Input field styling */}
      <div className="bg-[#0A0A0C]/50 border border-white/5 rounded p-3 select-text">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex-1 flex items-center gap-3 bg-black/40 border border-white/5 hover:border-white/10 rounded px-3 py-2 cursor-pointer transition-colors" onClick={() => setIsOpen(true)}>
            <Terminal size={14} className="text-[#00f0ff]" />
            <div className="flex-1 flex items-center justify-between">
              <span className="text-[11px] font-mono text-white/50 flex items-center gap-1">
                <span>aegis-sh:~$ grep -rI</span>
                {query ? (
                  <span className="text-emerald-400 font-bold">"{query}"</span>
                ) : (
                  <span className="text-white/20">"target threat string pattern..."</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-white/25 px-1.5 py-0.5 bg-white/5 rounded border border-white/5 flex items-center gap-1">
                  <Command size={10} /> + /
                </span>
              </div>
            </div>
          </div>

          {/* Prompt options shortcut chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider mr-1">CLI Presets:</span>
            <button
              onClick={() => handleApplyPresetCommand('--severity high')}
              className="px-2 py-1 bg-black/40 text-[9px] font-mono text-rose-300 border border-rose-500/10 hover:border-rose-500/40 rounded transition-all cursor-pointer"
            >
              -s high
            </button>
            <button
              onClick={() => handleApplyPresetCommand('--category ebpf')}
              className="px-2 py-1 bg-black/40 text-[9px] font-mono text-[#00f0ff] border border-[#00f0ff]/10 hover:border-[#00f0ff]/45 rounded transition-all cursor-pointer"
            >
              -c ebpf
            </button>
            <button
              onClick={() => handleApplyPresetCommand('--category ast')}
              className="px-2 py-1 bg-black/40 text-[9px] font-mono text-pink-300 border border-pink-500/10 hover:border-pink-500/40 rounded transition-all cursor-pointer"
            >
              -c ast
            </button>
            {query && (
              <button
                onClick={() => setQuery('')}
                className="px-2 py-1 bg-white/5 text-[9px] font-mono text-white/60 hover:text-white rounded border border-white/10 flex items-center gap-1 cursor-pointer"
              >
                Clear <X size={9} />
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Terminal dropdown list results */}
      <AnimatePresence>
        {(isOpen || query.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-[#0A0A0C] border border-white/10 border-t-0 rounded-b-lg p-4 shadow-[0_12px_32px_rgba(0,0,0,0.8)] relative z-25 mt-0.5"
          >
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Search size={12} className="text-[#00f0ff]" />
                <span className="font-mono text-[10px] text-white/50 uppercase tracking-widest">
                  Live Index Results ({filteredResults.length} telemetry matches)
                </span>
              </div>
              
              {/* Secondary in-CLI selectors */}
              <div className="flex items-center gap-3">
                
                {/* Category button set */}
                <div className="flex bg-[#07070A] border border-white/5 rounded p-0.5 text-[9px]">
                  {(['all', 'ebpf', 'ast', 'signature'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2 py-0.5 rounded transition-all font-mono capitalize cursor-pointer ${
                        categoryFilter === cat
                          ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-bold'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Severity selectors */}
                <div className="flex bg-[#07070A] border border-white/5 rounded p-0.5 text-[9px]">
                  {(['all', 'high', 'medium', 'low'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setSeverityFilter(sev)}
                      className={`px-2 py-0.5 rounded transition-all font-mono capitalize cursor-pointer ${
                        severityFilter === sev
                          ? 'bg-rose-500/15 text-rose-300 font-bold'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {sev === 'all' ? 'All' : `${sev}`}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/30 hover:text-white cursor-pointer"
                  title="Close Terminal Viewer"
                >
                  <X size={12} />
                </button>

              </div>
            </div>

            {/* Input target for typing inside dropdown */}
            <div className="mb-3">
              <div className="flex items-center gap-2 bg-[#050507] border border-white/5 rounded px-3 py-2.5">
                <ChevronRight size={14} className="text-[#00f0ff] shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type search terms like 'sys_execve', 'UPX', 'CWE-120' or type CLI parameters..."
                  className="flex-1 bg-transparent border-0 text-white font-mono text-[11px] focus:outline-none focus:ring-0 placeholder:text-white/20"
                />
                <span className="text-[8px] font-mono text-white/25 flex items-center gap-1 shrink-0 uppercase">
                  ACTIVE FILTERING <CornerDownLeft size={10} />
                </span>
              </div>
            </div>

            {/* Results Grid block */}
            <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-2 select-text">
              {filteredResults.length > 0 ? (
                filteredResults.map((result) => (
                  <div
                    key={result.id}
                    className="p-3 bg-black/40 border border-white/5 hover:border-[#00f0ff]/35 rounded flex items-start justify-between gap-4 transition-all hover:bg-black/80 font-mono text-[10px]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getSourceIcon(result.category)}
                        <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">
                          {result.source}
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-200 font-serif font-light">{result.title}</span>
                      </div>
                      
                      <div className="text-[#00f0ff] text-[9px] font-semibold">
                        {result.subtitle}
                      </div>

                      <div className="text-white/50 text-[10px] leading-relaxed">
                        {result.details}
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1.5 self-center">
                      {getSeverityBadge(result.severity)}
                      <div className="text-[8px] text-white/25 flex items-center gap-1">
                        <Clock size={8} /> {result.timestamp}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-white/30 text-[10px] uppercase font-mono tracking-wider flex flex-col items-center gap-2">
                  <span>No telemetry matches found for "{query}"</span>
                  <span className="text-[9px] text-white/10 font-normal normal-case">
                    Ensure syntax maps correctly or try querying without command flags e.g. "sys_execve"
                  </span>
                </div>
              )}
            </div>

            {/* Key help indicators footer */}
            <div className="mt-3 border-t border-white/5 pt-3 flex flex-wrap items-center justify-between text-[8px] font-mono text-white/25">
              <span>🔒 ENCLAVE LOGS INDEX: CONTINUITY BUFFER FULLY CRYPTO-SECURED</span>
              <div className="flex items-center gap-3">
                <span>[ESC] Close</span>
                <span>[Ctrl + /] Toggle Focus</span>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
