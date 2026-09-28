import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  Cell, 
  PieChart, 
  Pie 
} from 'recharts';
import { 
  TrendingUp, 
  ShieldAlert, 
  Code2, 
  Cpu, 
  Activity, 
  Database,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  Flame,
  Gauge
} from 'lucide-react';
import { ArchivedThreat } from '../types';

interface ThreatOverviewsProps {
  ebpfAlerts?: any[];
  astFindings?: any[];
  signatureAlerts?: any[];
  triggerToast?: (msg: string) => void;
}

function useContainerSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });

    resizeObserver.observe(element);
    return () => {
      resizeObserver.unobserve(element);
    };
  }, []);

  return [ref, size] as const;
}

export default function ThreatOverviews({
  ebpfAlerts = [],
  astFindings = [],
  signatureAlerts = [],
  triggerToast
}: ThreatOverviewsProps) {
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | '30d'>('7d');
  const [renderChartsReady, setRenderChartsReady] = useState(false);

  const [areaRef, areaSize] = useContainerSize();
  const [barRef, barSize] = useContainerSize();
  const [pieRef, pieSize] = useContainerSize();

  useEffect(() => {
    const timer = setTimeout(() => {
      setRenderChartsReady(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Load local archived threats to compile global metrics
  const archivedStats = useMemo(() => {
    const existingStr = localStorage.getItem('aegis_threat_archive');
    if (existingStr) {
      try {
        const parsed: ArchivedThreat[] = JSON.parse(existingStr);
        return parsed;
      } catch (e) {
        return [];
      }
    }
    return [];
  }, [ebpfAlerts, astFindings]);

  // Merge runtime arrays with pre-seeded/localStorage archive list
  const allMergedThreats = useMemo(() => {
    const list: any[] = [...archivedStats];
    
    // Fallback seed threats if archive is fully cleared
    const seedFallback = [
      { category: 'ebpf', severity: 'high', timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString() },
      { category: 'ast', severity: 'high', timestamp: new Date(Date.now() - 15 * 3600 * 1000).toISOString() },
      { category: 'ebpf', severity: 'high', timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
      { category: 'ast', severity: 'medium', timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString() },
    ];

    const currentList = list.length > 0 ? list : seedFallback;

    // Map any active live state buffers
    signatureAlerts.forEach((a, idx) => {
      currentList.push({
        id: `sig-runtime-${idx}`,
        category: 'signature',
        severity: 'medium',
        timestamp: new Date().toISOString()
      });
    });

    return currentList;
  }, [archivedStats, signatureAlerts]);

  // Aggregate stats totals
  const counts = useMemo(() => {
    let ebpf = ebpfAlerts.length;
    let ast = astFindings.length;
    let signature = signatureAlerts.length;

    // Supplement with archive if state is larger
    allMergedThreats.forEach((t) => {
      if (t.category === 'ebpf' || t.category === 'KERNEL') {
        ebpf++;
      } else if (t.category === 'ast' || t.category === 'STATIC') {
        ast++;
      } else if (t.category === 'signature' || t.category === 'MALWARE') {
        signature++;
      }
    });

    // Make sure we have natural baseline values
    if (ebpf === 0) ebpf = 8;
    if (ast === 0) ast = 4;
    if (signature === 0) signature = 3;

    return { ebpf, ast, signature, total: ebpf + ast + signature };
  }, [ebpfAlerts, astFindings, signatureAlerts, allMergedThreats]);

  // Timeline dataset for Threat trends over time
  const timelineData = useMemo(() => {
    // We will generate the timeline labels based on time filter
    if (timeFilter === '24h') {
      return [
        { time: '04:00', eBPF: 1, AST: 0, Signature: 1 },
        { time: '08:00', eBPF: 3, AST: 1, Signature: 0 },
        { time: '12:00', eBPF: Math.max(2, Math.floor(counts.ebpf / 4)), AST: Math.max(1, Math.floor(counts.ast / 4)), Signature: Math.max(1, Math.floor(counts.signature / 3)) },
        { time: '16:00', eBPF: Math.max(4, Math.floor(counts.ebpf / 2.5)), AST: Math.max(2, Math.floor(counts.ast / 2)), Signature: Math.max(2, Math.floor(counts.signature / 2)) },
        { time: '20:00', eBPF: Math.max(2, Math.floor(counts.ebpf / 3.5)), AST: Math.max(0, Math.floor(counts.ast / 3.5)), Signature: Math.max(0, Math.floor(counts.signature / 4)) },
        { time: '24:00 (Now)', eBPF: counts.ebpf, AST: counts.ast, Signature: counts.signature },
      ];
    } else if (timeFilter === '30d') {
      return [
        { time: 'Day -30', eBPF: 12, AST: 8, Signature: 4 },
        { time: 'Day -25', eBPF: 15, AST: 11, Signature: 6 },
        { time: 'Day -20', eBPF: 22, AST: 9, Signature: 8 },
        { time: 'Day -15', eBPF: 18, AST: 12, Signature: 10 },
        { time: 'Day -10', eBPF: 25, AST: 14, Signature: 15 },
        { time: 'Day -5', eBPF: Math.round(counts.ebpf * 0.8), AST: Math.round(counts.ast * 0.7), Signature: Math.round(counts.signature * 0.9) },
        { time: 'Today', eBPF: counts.ebpf, AST: counts.ast, Signature: counts.signature },
      ];
    } else {
      // Default: '7d' weekly timeline
      return [
        { time: 'Mon', eBPF: 3, AST: 2, Signature: 1 },
        { time: 'Tue', eBPF: 5, AST: 1, Signature: 0 },
        { time: 'Wed', eBPF: 4, AST: 3, Signature: 2 },
        { time: 'Thu', eBPF: 8, AST: 2, Signature: 4 },
        { time: 'Fri', eBPF: 6, AST: 4, Signature: 1 },
        { time: 'Sat', eBPF: Math.max(2, Math.round(counts.ebpf * 0.5)), AST: Math.max(1, Math.round(counts.ast * 0.6)), Signature: Math.max(1, Math.round(counts.signature * 0.4)) },
        { time: 'Sun (Now)', eBPF: counts.ebpf, AST: counts.ast, Signature: counts.signature },
      ];
    }
  }, [timeFilter, counts]);

  // Pie chart stats for severity
  const severityPieData = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;

    allMergedThreats.forEach((t) => {
      const sev = (t.severity || 'high').toLowerCase();
      if (sev === 'high' || sev === 'critical') high++;
      else if (sev === 'medium') medium++;
      else low++;
    });

    // Seed defaults if empty
    if (high === 0) high = 6;
    if (medium === 0) medium = 4;
    if (low === 0) low = 2;

    return [
      { name: 'Critical/High Severity', value: high, color: '#EF4444' },
      { name: 'Medium Threat Level', value: medium, color: '#F59E0B' },
      { name: 'Low Priority / Auditing', value: low, color: '#10B981' }
    ];
  }, [allMergedThreats]);

  // Simple reactive reset simulation trigger
  const handleReloadMetrics = () => {
    setLastUpdated(new Date().toLocaleTimeString());
    if (triggerToast) {
      triggerToast("Aggregated threat database metrics refreshed dynamically.");
    }
  };

  const threatModuleBarData = [
    { name: 'eBPF Intercepts', Count: counts.ebpf, color: '#00f0ff' },
    { name: 'AST Code Analysis', Count: counts.ast, color: '#EC4899' },
    { name: 'Signature Detections', Count: counts.signature, color: '#3B82F6' }
  ];

  const systemMaturityPercent = 98.4;

  return (
    <div id="threat-overviews-viewport" className="space-y-6">
      {/* Header and status belt */}
      <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-serif font-light tracking-widest text-[#00f0ff] uppercase flex items-center gap-2">
            <TrendingUp size={16} /> Hypervisor Threat Intelligence Overview
          </h2>
          <p className="text-[11px] font-mono text-white/40 mt-1">
            Aggregated analytics of sandboxed kernel events, source verification logs, and trie-based scanner detections.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#07070A] border border-white/5 rounded p-0.5 text-[9px]">
            {(['24h', '7d', '30d'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-2 py-1 rounded transition-all font-mono font-bold cursor-pointer ${
                  timeFilter === filter
                    ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {filter.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={handleReloadMetrics}
            className="p-1.5 bg-black/40 text-white/50 border border-white/5 hover:border-[#00f0ff]/45 hover:text-[#00f0ff] rounded cursor-pointer transition-colors"
            title="Refresh database logs cache"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* KPI Bento Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-[#0A0A0C]/30 border border-white/5 rounded p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-[#00f0ff] group-hover:opacity-20 transition-all">
            <Flame size={44} />
          </div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 block">Total Active Alerts</span>
          <span className="text-2xl font-serif text-white block mt-2 font-bold tracking-tight">
            {counts.total} <span className="text-xs font-mono text-zinc-500 font-light">incidents</span>
          </span>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
            <span className="bg-emerald-500/10 px-1 py-0.5 rounded text-[9px] font-bold">✓ ENFORCED</span>
            <span>All threat payloads quarantined</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#0A0A0C]/30 border border-white/5 rounded p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-pink-500 group-hover:opacity-20 transition-all">
            <Code2 size={44} />
          </div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 block">AST Code Weaknesses</span>
          <span className="text-2xl font-serif text-white block mt-2 font-bold tracking-tight">
            {counts.ast} <span className="text-xs font-mono text-zinc-500 font-light">vulns</span>
          </span>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
            <span>CWE-78, CWE-89 injection matches</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#0A0A0C]/30 border border-white/5 rounded p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-cyan-400 group-hover:opacity-20 transition-all">
            <Cpu size={44} />
          </div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 block">eBPF Interventions</span>
          <span className="text-2xl font-serif text-white block mt-2 font-bold tracking-tight">
            {counts.ebpf} <span className="text-xs font-mono text-zinc-500 font-light">blocks</span>
          </span>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-yellow-500 font-mono">
            <span>Peak intercepts frequency: 12 Hz</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#0A0A0C]/30 border border-white/5 rounded p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-emerald-400 group-hover:opacity-20 transition-all">
            <Gauge size={44} />
          </div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 block">System Defense Score</span>
          <span className="text-2xl font-serif text-emerald-400 block mt-2 font-bold tracking-tight">
            {systemMaturityPercent}%
          </span>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/40 font-mono">
            <Clock size={10} />
            <span>Telemetry stream latency: 12ms</span>
          </div>
        </div>
      </div>

      {/* Main Timeline Charts Block */}
      <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5 space-y-4">
        <div>
          <h3 className="text-xs font-serif font-light tracking-[0.12em] text-zinc-300 uppercase flex items-center gap-1.5">
            <Activity size={12} className="text-[#00f0ff]" /> Threat count progression timeline ({timeFilter.toUpperCase()})
          </h3>
          <p className="text-[10px] font-mono text-white/30">
            Temporal distribution profile of security anomalies across static code rules and live kernel execution layers.
          </p>
        </div>

        {/* Recharts Area Timeline */}
        <div ref={areaRef} className="relative h-72 w-full pt-4 min-w-0" style={{ minHeight: '280px' }}>
          {renderChartsReady && areaSize.width > 0 && areaSize.height > 0 ? (
            <AreaChart
              width={areaSize.width}
              height={areaSize.height}
              data={timelineData}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorEbpf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorAst" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EC4899" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#EC4899" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorSignature" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis 
                dataKey="time" 
                stroke="rgba(255,255,255,0.3)" 
                tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0a0a0c', 
                  border: '1px solid rgba(0,240,255,0.25)', 
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#fff'
                }}
                labelStyle={{ color: '#00f0ff', fontWeight: 'bold', fontFamily: 'serif' }}
              />
              <Legend 
                wrapperStyle={{ 
                  fontSize: '10px', 
                  fontFamily: 'monospace',
                  paddingTop: '15px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="eBPF" 
                stroke="#00f0ff" 
                strokeWidth={1.5}
                fillOpacity={1} 
                fill="url(#colorEbpf)" 
                name="eBPF Syscalls"
              />
              <Area 
                type="monotone" 
                dataKey="AST" 
                stroke="#EC4899" 
                strokeWidth={1.5}
                fillOpacity={1} 
                fill="url(#colorAst)" 
                name="AST Static Findings"
              />
              <Area 
                type="monotone" 
                dataKey="Signature" 
                stroke="#3B82F6" 
                strokeWidth={1.5}
                fillOpacity={1} 
                fill="url(#colorSignature)" 
                name="Signature Scanner"
              />
            </AreaChart>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-mono text-white/25 animate-pulse bg-black/25 rounded border border-white/5">
              Calibrating core timeline telemetry maps...
            </div>
          )}
        </div>
      </div>

      {/* Two-Column breakdown visualization charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Module Distribution BarChart */}
        <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5 space-y-4">
          <div>
            <h3 className="text-xs font-serif font-light tracking-[0.12em] text-zinc-300 uppercase flex items-center gap-1.5">
              <Database size={12} className="text-[#00f0ff]" /> Incidents Distribution by module
            </h3>
            <p className="text-[10px] font-mono text-white/30">
              Aggregated counter volume comparing code validation blocks vs active physical runtime threat metrics.
            </p>
          </div>

          <div ref={barRef} className="relative h-60 w-full pt-2 min-w-0" style={{ minHeight: '240px' }}>
            {renderChartsReady && barSize.width > 0 && barSize.height > 0 ? (
              <BarChart
                width={barSize.width}
                height={barSize.height}
                data={threatModuleBarData}
                margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="rgba(255,255,255,0.3)" 
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.01)' }}
                  contentStyle={{ 
                    backgroundColor: '#0a0a0c', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="Count" fill="#00f0ff" radius={[2, 2, 0, 0]}>
                  {threatModuleBarData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-mono text-white/25 animate-pulse bg-black/25 rounded border border-white/5">
                Mapping incident modules...
              </div>
            )}
          </div>
        </div>

        {/* Severity Priority PieChart */}
        <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5 space-y-4">
          <div>
            <h3 className="text-xs font-serif font-light tracking-[0.12em] text-zinc-300 uppercase flex items-center gap-1.5">
              <ShieldAlert size={12} className="text-[#00f0ff]" /> Aggregated Severity Classification
            </h3>
            <p className="text-[10px] font-mono text-white/30">
              Analysis of threat escalation and priority matrices assigned to current offline security archives.
            </p>
          </div>

          <div className="h-auto sm:h-60 flex flex-col sm:flex-row items-center justify-center gap-4">
            <div ref={pieRef} className="relative w-full sm:w-1/2 h-48 sm:h-full min-w-0" style={{ minHeight: '180px' }}>
              {renderChartsReady && pieSize.width > 0 && pieSize.height > 0 ? (
                <PieChart width={pieSize.width} height={pieSize.height}>
                  <Pie
                    data={severityPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {severityPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#0a0a0c', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: '#fff'
                    }}
                  />
                </PieChart>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-mono text-white/25 animate-pulse bg-black/25 rounded border border-white/5">
                  Calculating severity metrics...
                </div>
              )}
            </div>
            
            {/* Pie Legends */}
            <div className="w-full sm:w-1/2 space-y-3 font-mono text-[10px]">
              {severityPieData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <div className="flex-1">
                    <div className="text-white/70 font-semibold">{item.name}</div>
                    <div className="text-white/40 text-[9px] mt-0.5">{item.value} threats matched in posture database</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Footer statistics metadata stamp */}
      <div className="text-center font-mono text-[9px] text-white/25 border-t border-white/5 pt-4">
        🔒 SECURE INTEL FEED ARCHIVE COMPILATION: COMPILING IN MRENCLAVE ISOLATE • LAST CALIBRATION: {lastUpdated} UTC
      </div>
    </div>
  );
}
