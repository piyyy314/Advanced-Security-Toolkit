import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  Cpu,
  Code2,
  AlertTriangle,
  BarChart2,
  Activity
} from 'lucide-react';
import { ArchivedThreat } from '../types';

const THREAT_ARCHIVE_KEY = 'aegis_threat_archive';

interface AlertFrequencyMiniChartProps {
  ebpfAlerts?: any[];
  astFindings?: any[];
  onNavigateToEbpf?: () => void;
  onNavigateToAst?: () => void;
}

interface HourlyPoint {
  index: number;
  label: string;
  shortLabel: string;
  ebpf: number;
  ast: number;
  total: number;
}

function useContainerSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height))
      });
    };

    update();
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setSize({
        width: Math.max(0, Math.floor(width)),
        height: Math.max(0, Math.floor(height))
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

function parseAlertTimestampMs(rawTimestamp: string | undefined, nowMs: number): number | null {
  if (!rawTimestamp) return nowMs;
  const parsed = Date.parse(rawTimestamp);
  if (!Number.isNaN(parsed)) {
    if (parsed > nowMs && parsed - nowMs <= 12 * 60 * 60 * 1000) {
      return nowMs;
    }
    return parsed;
  }

  // Handle HH:MM:SS live eBPF timestamps
  if (/^\d{2}:\d{2}:\d{2}/.test(rawTimestamp)) {
    const todayIso = new Date(nowMs).toISOString().split('T')[0];
    const candidate = Date.parse(`${todayIso}T${rawTimestamp.substring(0, 8)}Z`);
    if (!Number.isNaN(candidate)) {
      if (candidate > nowMs && candidate - nowMs <= 12 * 60 * 60 * 1000) {
        return nowMs;
      }
      return candidate;
    }
  }
  return null;
}

export default function AlertFrequencyMiniChart({
  ebpfAlerts = [],
  astFindings = [],
  onNavigateToEbpf,
  onNavigateToAst
}: AlertFrequencyMiniChartProps) {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [seriesMode, setSeriesMode] = useState<'both' | 'ebpf' | 'ast'>('both');
  const [archivedThreats, setArchivedThreats] = useState<ArchivedThreat[]>([]);
  const [refreshTick, setRefreshTick] = useState<number>(() => Date.now());
  const [chartRef, chartSize] = useContainerSize();

  const loadArchive = useCallback(() => {
    try {
      const raw = localStorage.getItem(THREAT_ARCHIVE_KEY);
      if (!raw) {
        setArchivedThreats([]);
      } else {
        const parsed = JSON.parse(raw);
        setArchivedThreats(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      setArchivedThreats([]);
    }
    setRefreshTick(Date.now());
  }, []);

  useEffect(() => {
    loadArchive();

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === THREAT_ARCHIVE_KEY) {
        loadArchive();
      }
    };
    const onArchiveUpdated = () => loadArchive();

    window.addEventListener('storage', onStorage);
    window.addEventListener('aegis-archive-updated', onArchiveUpdated);
    const interval = setInterval(loadArchive, 15000);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('aegis-archive-updated', onArchiveUpdated);
      clearInterval(interval);
    };
  }, [loadArchive, ebpfAlerts.length, astFindings.length]);

  const { hourlyData, ebpf24h, ast24h, peakPoint, spikeThreshold, isSpikeDetected } = useMemo(() => {
    const nowMs = refreshTick;
    const currentHourStart = new Date(nowMs);
    currentHourStart.setMinutes(0, 0, 0);
    const currentHourStartMs = currentHourStart.getTime();
    const windowStartMs = currentHourStartMs - 23 * 60 * 60 * 1000;
    const windowEndMs = currentHourStartMs + 60 * 60 * 1000;

    const points: HourlyPoint[] = Array.from({ length: 24 }, (_, idx) => {
      const startMs = windowStartMs + idx * 60 * 60 * 1000;
      const d = new Date(startMs);
      const hh = String(d.getHours()).padStart(2, '0');
      return {
        index: idx,
        label: idx === 23 ? 'Now' : `${hh}:00`,
        shortLabel: idx === 23 ? 'Now' : hh,
        ebpf: 0,
        ast: 0,
        total: 0
      };
    });

    const seenIds = new Set<string>();

    const recordAlert = (id: string, category: 'ebpf' | 'ast', timestampStr?: string) => {
      if (seenIds.has(id)) return;
      seenIds.add(id);

      const tsMs = parseAlertTimestampMs(timestampStr, nowMs);
      if (tsMs === null || tsMs < windowStartMs || tsMs >= windowEndMs) return;

      const idx = Math.min(23, Math.max(0, Math.floor((tsMs - windowStartMs) / (60 * 60 * 1000))));
      if (category === 'ebpf') {
        points[idx].ebpf += 1;
      } else {
        points[idx].ast += 1;
      }
      points[idx].total = points[idx].ebpf + points[idx].ast;
    };

    // 1. Archive entries
    archivedThreats.forEach((item) => {
      recordAlert(item.id, item.category, item.timestamp);
    });

    // 2. Live session eBPF alerts (deduplicated against archive)
    ebpfAlerts.forEach((al, idx) => {
      const id = al.id || `live-ebpf-${idx}-${al.timestamp || ''}`;
      recordAlert(id, 'ebpf', al.timestamp);
    });

    // 3. Live session AST findings (deduplicated against archive)
    astFindings.forEach((f) => {
      const id = `ast-vuln-${f.type}-${f.line}`;
      recordAlert(id, 'ast', new Date(nowMs).toISOString());
    });

    const ebpfCount = points.reduce((acc, p) => acc + p.ebpf, 0);
    const astCount = points.reduce((acc, p) => acc + p.ast, 0);

    const totals = points.map((p) =>
      seriesMode === 'both' ? p.total : seriesMode === 'ebpf' ? p.ebpf : p.ast
    );
    const sum = totals.reduce((a, b) => a + b, 0);
    const mean = sum / 24;
    const variance = totals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / 24;
    const stdDev = Math.sqrt(variance);
    const threshold = sum > 0 ? Math.max(2, Math.ceil(mean + stdDev * 1.25)) : 2;

    let peak: HourlyPoint | null = null;
    let peakVal = 0;
    points.forEach((p, idx) => {
      const val = totals[idx];
      if (val > peakVal) {
        peakVal = val;
        peak = p;
      }
    });

    return {
      hourlyData: points,
      ebpf24h: ebpfCount,
      ast24h: astCount,
      peakPoint: peak as HourlyPoint | null,
      spikeThreshold: threshold,
      isSpikeDetected: peakVal >= threshold && peakVal > 0
    };
  }, [archivedThreats, ebpfAlerts, astFindings, refreshTick, seriesMode]);

  return (
    <section
      aria-label="24-Hour eBPF and AST Alert Frequency"
      className="bg-[#08080B] border border-white/5 rounded p-5 flex flex-col justify-between space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <TrendingUp size={14} className="text-[#00f0ff]" />
            <h3 className="text-xs text-white uppercase tracking-wider font-mono font-semibold">
              eBPF &amp; AST Alert Frequency (24h)
            </h3>
            <span
              className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                isSpikeDetected
                  ? 'text-rose-300 bg-rose-500/15 border-rose-500/35 font-bold'
                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
              }`}
            >
              {isSpikeDetected ? 'Spike Detected' : 'Nominal'}
            </span>
          </div>
          <p className="text-[10px] text-white/40 font-mono">
            Hourly kernel &amp; static scan detections · Spike threshold:{' '}
            <span className="text-zinc-300 tabular-nums">{spikeThreshold}/hr</span>
          </p>
        </div>

        {/* Chart Mode & Series Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Alert series filter"
            className="flex bg-[#050507] border border-white/10 rounded p-0.5 font-mono text-[9px]"
          >
            {(
              [
                { id: 'both', label: 'Both' },
                { id: 'ebpf', label: 'eBPF' },
                { id: 'ast', label: 'AST' }
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSeriesMode(opt.id)}
                className={`px-2 py-1 rounded uppercase transition-all cursor-pointer ${
                  seriesMode === opt.id
                    ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-bold'
                    : 'text-zinc-500 hover:text-zinc-200 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Chart visualization style"
            className="flex bg-[#050507] border border-white/10 rounded p-0.5 font-mono text-[9px]"
          >
            <button
              type="button"
              onClick={() => setChartType('area')}
              title="Area spike curve"
              className={`px-2 py-1 rounded flex items-center gap-1 uppercase cursor-pointer ${
                chartType === 'area'
                  ? 'bg-white/10 text-zinc-100 font-bold'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <Activity size={10} /> Area
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              title="Hourly bar density"
              className={`px-2 py-1 rounded flex items-center gap-1 uppercase cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-white/10 text-zinc-100 font-bold'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <BarChart2 size={10} /> Bars
            </button>
          </div>
        </div>
      </div>

      {/* Unboxed KPI Summary Strip */}
      <div className="grid grid-cols-3 gap-3 font-mono border-b border-white/5 pb-3">
        <div>
          <span className="text-[8.5px] text-white/35 uppercase block">eBPF Kernel (24h)</span>
          <span className="text-base font-light text-[#00f0ff] tabular-nums">{ebpf24h}</span>
        </div>
        <div>
          <span className="text-[8.5px] text-white/35 uppercase block">AST Static (24h)</span>
          <span className="text-base font-light text-pink-400 tabular-nums">{ast24h}</span>
        </div>
        <div>
          <span className="text-[8.5px] text-white/35 uppercase block">Peak Velocity</span>
          <span className="text-base font-light text-zinc-100 tabular-nums">
            {peakPoint
              ? `${
                  seriesMode === 'both'
                    ? peakPoint.total
                    : seriesMode === 'ebpf'
                      ? peakPoint.ebpf
                      : peakPoint.ast
                }/hr`
              : '0/hr'}
            {peakPoint && (
              <span className="text-[9px] text-white/40 ml-1">@ {peakPoint.label}</span>
            )}
          </span>
        </div>
      </div>

      {/* Recharts Mini-Chart Viewport */}
      <div ref={chartRef} className="w-full h-[185px] min-w-0 relative" style={{ minHeight: '185px' }}>
        {chartSize.width > 0 && chartSize.height > 0 ? (
          chartType === 'area' ? (
            <AreaChart
              width={chartSize.width}
              height={chartSize.height}
              data={hourlyData}
              margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
            >
              <defs>
                <linearGradient id="opsGradEbpf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="opsGradAst" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="label"
                interval={3}
                stroke="rgba(255,255,255,0.2)"
                tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              />
              <YAxis
                allowDecimals={false}
                stroke="rgba(255,255,255,0.2)"
                tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0A0A0D',
                  border: '1px solid rgba(0,240,255,0.28)',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: '#e4e4e7'
                }}
                labelStyle={{ color: '#00f0ff', fontWeight: 'bold', marginBottom: '2px' }}
              />
              {(ebpf24h > 0 || ast24h > 0) && (
                <ReferenceLine
                  y={spikeThreshold}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />
              )}
              {(seriesMode === 'both' || seriesMode === 'ebpf') && (
                <Area
                  type="monotone"
                  dataKey="ebpf"
                  name="eBPF Syscalls"
                  stroke="#00f0ff"
                  strokeWidth={1.75}
                  fill="url(#opsGradEbpf)"
                  activeDot={{ r: 3.5, fill: '#00f0ff' }}
                />
              )}
              {(seriesMode === 'both' || seriesMode === 'ast') && (
                <Area
                  type="monotone"
                  dataKey="ast"
                  name="AST Static Findings"
                  stroke="#f43f5e"
                  strokeWidth={1.75}
                  fill="url(#opsGradAst)"
                  activeDot={{ r: 3.5, fill: '#f43f5e' }}
                />
              )}
            </AreaChart>
          ) : (
            <BarChart
              width={chartSize.width}
              height={chartSize.height}
              data={hourlyData}
              margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="label"
                interval={3}
                stroke="rgba(255,255,255,0.2)"
                tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              />
              <YAxis
                allowDecimals={false}
                stroke="rgba(255,255,255,0.2)"
                tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{
                  backgroundColor: '#0A0A0D',
                  border: '1px solid rgba(0,240,255,0.28)',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: '#e4e4e7'
                }}
                labelStyle={{ color: '#00f0ff', fontWeight: 'bold', marginBottom: '2px' }}
              />
              {(ebpf24h > 0 || ast24h > 0) && (
                <ReferenceLine
                  y={spikeThreshold}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />
              )}
              {(seriesMode === 'both' || seriesMode === 'ebpf') && (
                <Bar dataKey="ebpf" name="eBPF Syscalls" stackId="a" fill="#00f0ff" radius={[1, 1, 0, 0]} />
              )}
              {(seriesMode === 'both' || seriesMode === 'ast') && (
                <Bar dataKey="ast" name="AST Static Findings" stackId="a" fill="#f43f5e" radius={[1, 1, 0, 0]} />
              )}
            </BarChart>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-white/30 bg-black/25 rounded border border-white/5">
            Initializing 24h telemetry chart...
          </div>
        )}
      </div>

      {/* Legend & Quick Investigation Links */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 font-mono text-[9px]">
        <div className="flex items-center gap-3 text-white/50">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#00f0ff] inline-block" /> eBPF Kernel
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-rose-500 inline-block" /> AST Static
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 border-t border-dashed border-amber-400 inline-block" /> Spike Threshold
          </span>
        </div>

        <div className="flex items-center gap-2">
          {ebpf24h === 0 && ast24h === 0 && (
            <span className="text-white/35 flex items-center gap-1 mr-1">
              <AlertTriangle size={10} className="text-amber-400/70" /> Baseline quiet
            </span>
          )}
          {onNavigateToEbpf && (
            <button
              type="button"
              onClick={onNavigateToEbpf}
              className="px-2 py-1 bg-white/5 hover:bg-[#00f0ff]/15 border border-white/10 hover:border-[#00f0ff]/35 rounded text-zinc-300 hover:text-[#00f0ff] flex items-center gap-1 transition-colors cursor-pointer uppercase"
            >
              <Cpu size={10} /> eBPF Audit
            </button>
          )}
          {onNavigateToAst && (
            <button
              type="button"
              onClick={onNavigateToAst}
              className="px-2 py-1 bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/35 rounded text-zinc-300 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer uppercase"
            >
              <Code2 size={10} /> AST Scan
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
