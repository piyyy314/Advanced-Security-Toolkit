import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  Archive,
  Clock,
  RefreshCw,
  ShieldAlert,
  Cpu,
  ChevronRight
} from 'lucide-react';
import { ArchivedThreat } from '../types';

const THREAT_ARCHIVE_KEY = 'aegis_threat_archive';

interface ThreatFrequencyHeatmapProps {
  onNavigateToArchive?: () => void;
  onNavigateToEbpf?: () => void;
}

interface HourBucket {
  index: number;
  startMs: number;
  endMs: number;
  hourLabel: string;
  rangeLabel: string;
  isCurrentHour: boolean;
  threats: ArchivedThreat[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalCount: number;
}

type SeverityFilter = 'all' | 'high' | 'medium' | 'low';

function parseThreatTimestampMs(rawTimestamp: string | undefined, nowMs: number): number | null {
  if (!rawTimestamp) return null;
  const parsed = Date.parse(rawTimestamp);
  if (Number.isNaN(parsed)) return null;

  // Tolerate minor UTC vs local-time offset when live eBPF logs format HH:MM:SS with a 'Z' suffix
  if (parsed > nowMs && parsed - nowMs <= 12 * 60 * 60 * 1000) {
    return nowMs;
  }
  return parsed;
}

function getDensityCellClass(count: number, severityRow: SeverityFilter, isSelected: boolean): string {
  const ring = isSelected ? 'ring-1 ring-[#00f0ff] ring-offset-1 ring-offset-[#08080B]' : '';

  if (count === 0) {
    return `bg-white/[0.025] border-white/5 text-white/20 hover:border-white/15 ${ring}`;
  }

  if (severityRow === 'high') {
    if (count >= 4) return `bg-rose-500/45 border-rose-400/80 text-rose-100 font-bold ${ring}`;
    if (count >= 2) return `bg-rose-500/30 border-rose-400/60 text-rose-200 font-semibold ${ring}`;
    return `bg-rose-500/20 border-rose-500/45 text-rose-300 ${ring}`;
  }

  if (severityRow === 'medium') {
    if (count >= 4) return `bg-amber-500/45 border-amber-400/80 text-amber-100 font-bold ${ring}`;
    if (count >= 2) return `bg-amber-500/30 border-amber-400/60 text-amber-200 font-semibold ${ring}`;
    return `bg-amber-500/20 border-amber-500/45 text-amber-300 ${ring}`;
  }

  if (severityRow === 'low') {
    if (count >= 4) return `bg-emerald-500/40 border-emerald-400/75 text-emerald-100 font-bold ${ring}`;
    if (count >= 2) return `bg-emerald-500/25 border-emerald-400/55 text-emerald-200 font-semibold ${ring}`;
    return `bg-emerald-500/15 border-emerald-500/40 text-emerald-300 ${ring}`;
  }

  // Aggregate density scale ('all')
  if (count >= 6) return `bg-rose-500/35 border-rose-400/75 text-rose-100 font-bold ${ring}`;
  if (count >= 4) return `bg-amber-500/30 border-amber-400/65 text-amber-100 font-bold ${ring}`;
  if (count >= 2) return `bg-cyan-500/25 border-cyan-400/55 text-cyan-100 font-semibold ${ring}`;
  return `bg-emerald-500/20 border-emerald-500/45 text-emerald-200 ${ring}`;
}

export default function ThreatFrequencyHeatmap({
  onNavigateToArchive,
  onNavigateToEbpf
}: ThreatFrequencyHeatmapProps) {
  const [archivedThreats, setArchivedThreats] = useState<ArchivedThreat[]>([]);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [selectedHourIdx, setSelectedHourIdx] = useState<number>(23);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());

  const loadArchiveData = useCallback(() => {
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
    setLastRefreshed(new Date());
  }, []);

  useEffect(() => {
    loadArchiveData();

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === THREAT_ARCHIVE_KEY) {
        loadArchiveData();
      }
    };
    const handleArchiveUpdated = () => loadArchiveData();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('aegis-archive-updated', handleArchiveUpdated);

    const pollTimer = setInterval(loadArchiveData, 10000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('aegis-archive-updated', handleArchiveUpdated);
      clearInterval(pollTimer);
    };
  }, [loadArchiveData]);

  const { buckets, total24h, critical24h, olderCount, peakBucket } = useMemo(() => {
    const nowMs = lastRefreshed.getTime();
    const currentHourStart = new Date(nowMs);
    currentHourStart.setMinutes(0, 0, 0);
    const currentHourStartMs = currentHourStart.getTime();
    const windowStartMs = currentHourStartMs - 23 * 60 * 60 * 1000;
    const windowEndMs = currentHourStartMs + 60 * 60 * 1000;

    const hourBuckets: HourBucket[] = Array.from({ length: 24 }, (_, idx) => {
      const startMs = windowStartMs + idx * 60 * 60 * 1000;
      const endMs = startMs + 60 * 60 * 1000;
      const d = new Date(startMs);
      const hh = String(d.getHours()).padStart(2, '0');
      const nextH = String((d.getHours() + 1) % 24).padStart(2, '0');

      return {
        index: idx,
        startMs,
        endMs,
        hourLabel: `${hh}:00`,
        rangeLabel: `${hh}:00–${nextH}:00`,
        isCurrentHour: idx === 23,
        threats: [],
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        totalCount: 0
      };
    });

    let inWindowTotal = 0;
    let inWindowHigh = 0;
    let older = 0;

    archivedThreats.forEach((threat) => {
      const tsMs = parseThreatTimestampMs(threat.timestamp, nowMs);
      if (tsMs === null) return;

      if (tsMs < windowStartMs) {
        older += 1;
        return;
      }

      if (tsMs >= windowEndMs) return;

      const bucketIdx = Math.min(23, Math.max(0, Math.floor((tsMs - windowStartMs) / (60 * 60 * 1000))));
      const bucket = hourBuckets[bucketIdx];
      bucket.threats.push(threat);

      if (threat.severity === 'high') {
        bucket.highCount += 1;
        inWindowHigh += 1;
      } else if (threat.severity === 'medium') {
        bucket.mediumCount += 1;
      } else {
        bucket.lowCount += 1;
      }
      bucket.totalCount += 1;
      inWindowTotal += 1;
    });

    let peak: HourBucket | null = null;
    hourBuckets.forEach((b) => {
      const relevantCount =
        severityFilter === 'all'
          ? b.totalCount
          : severityFilter === 'high'
            ? b.highCount
            : severityFilter === 'medium'
              ? b.mediumCount
              : b.lowCount;

      const peakCount = peak
        ? severityFilter === 'all'
          ? peak.totalCount
          : severityFilter === 'high'
            ? peak.highCount
            : severityFilter === 'medium'
              ? peak.mediumCount
              : peak.lowCount
        : 0;

      if (relevantCount > peakCount) {
        peak = b;
      }
    });

    return {
      buckets: hourBuckets,
      total24h: inWindowTotal,
      critical24h: inWindowHigh,
      olderCount: older,
      peakBucket: peak as HourBucket | null
    };
  }, [archivedThreats, lastRefreshed, severityFilter]);

  // Snap selected hour to the latest hour containing alerts when data changes (if current selection is empty)
  useEffect(() => {
    const active = buckets[selectedHourIdx];
    if (active && active.totalCount > 0) return;
    const latestWithAlerts = [...buckets].reverse().find((b) => b.totalCount > 0);
    if (latestWithAlerts) {
      setSelectedHourIdx(latestWithAlerts.index);
    }
  }, [buckets, selectedHourIdx]);

  const selectedBucket = buckets[selectedHourIdx] || buckets[23];
  const visibleSelectedThreats = useMemo(() => {
    if (!selectedBucket) return [];
    if (severityFilter === 'all') return selectedBucket.threats;
    return selectedBucket.threats.filter((t) => t.severity === severityFilter);
  }, [selectedBucket, severityFilter]);

  const rows: Array<{ key: SeverityFilter; label: string; getValue: (b: HourBucket) => number }> = [
    { key: 'high', label: 'Critical', getValue: (b) => b.highCount },
    { key: 'medium', label: 'Medium', getValue: (b) => b.mediumCount },
    { key: 'low', label: 'Low', getValue: (b) => b.lowCount },
    { key: 'all', label: 'All (24h)', getValue: (b) => b.totalCount }
  ];

  const displayedRows = severityFilter === 'all' ? rows : rows.filter((r) => r.key === severityFilter);

  const peakCountDisplay = peakBucket
    ? severityFilter === 'all'
      ? peakBucket.totalCount
      : severityFilter === 'high'
        ? peakBucket.highCount
        : severityFilter === 'medium'
          ? peakBucket.mediumCount
          : peakBucket.lowCount
    : 0;

  return (
    <section
      aria-label="Threat Frequency Heatmap"
      className="bg-[#08080B] border border-white/5 rounded p-5 space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-[#00f0ff]" />
            <h3 className="text-sm font-serif font-light text-zinc-100 tracking-wide">
              Threat Frequency Heatmap
            </h3>
          </div>
          <p className="text-[10px] text-white/40 font-mono">
            Last 24 hours alert density · Source: Threat Archive · Updated{' '}
            <span className="tabular-nums text-zinc-300">
              {lastRefreshed.toTimeString().substring(0, 8)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Severity Filter Segmented Control */}
          <div
            role="group"
            aria-label="Filter heatmap by severity"
            className="flex bg-[#050507] border border-white/10 rounded p-0.5 font-mono text-[9px]"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'high', label: 'Critical' },
                { id: 'medium', label: 'Medium' },
                { id: 'low', label: 'Low' }
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSeverityFilter(opt.id)}
                className={`px-2.5 py-1 rounded uppercase tracking-wider transition-all cursor-pointer ${
                  severityFilter === opt.id
                    ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-bold'
                    : 'text-zinc-500 hover:text-zinc-200 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadArchiveData}
            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw size={10} className="text-[#00f0ff]" /> Sync Archive
          </button>

          {onNavigateToArchive && (
            <button
              type="button"
              onClick={onNavigateToArchive}
              className="px-2.5 py-1.5 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/30 rounded text-[9px] font-mono uppercase tracking-wider text-[#00f0ff] flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Archive size={10} /> Open Vault <ChevronRight size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Unboxed Summary Metadata Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1 border-b border-white/5 pb-3.5 font-mono">
        <div>
          <span className="text-[9px] text-white/35 uppercase tracking-wider block">24H Alert Volume</span>
          <span className="text-lg font-light text-zinc-100 tabular-nums mt-0.5 block">
            {total24h} <span className="text-[10px] text-white/40">incidents</span>
          </span>
        </div>

        <div>
          <span className="text-[9px] text-white/35 uppercase tracking-wider block">Peak Hourly Density</span>
          <span className="text-lg font-light text-[#00f0ff] tabular-nums mt-0.5 block">
            {peakBucket ? `${peakCountDisplay}/hr` : '0/hr'}{' '}
            <span className="text-[10px] text-white/40">
              {peakBucket ? `@ ${peakBucket.hourLabel}` : 'no spikes'}
            </span>
          </span>
        </div>

        <div>
          <span className="text-[9px] text-white/35 uppercase tracking-wider block">Critical Density (24h)</span>
          <span className={`text-lg font-light tabular-nums mt-0.5 block ${critical24h > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {critical24h} <span className="text-[10px] text-white/40">high-sev</span>
          </span>
        </div>

        <div>
          <span className="text-[9px] text-white/35 uppercase tracking-wider block">Archive Coverage</span>
          <span className="text-lg font-light text-zinc-200 tabular-nums mt-0.5 block">
            {archivedThreats.length}{' '}
            <span className="text-[10px] text-white/40">
              total{olderCount > 0 ? ` · ${olderCount} >24h` : ''}
            </span>
          </span>
        </div>
      </div>

      {/* Empty 24h helper notice when archive has 0 alerts in the last 24h */}
      {total24h === 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-2.5 bg-black/40 border border-white/5 rounded font-mono text-[10px] text-zinc-400">
          <div className="flex items-center gap-2">
            <ShieldAlert size={13} className="text-[#00f0ff] shrink-0" />
            <span>
              No Threat Archive alerts recorded within the rolling 24-hour window
              {olderCount > 0
                ? ` (${olderCount} historical archived incident${olderCount === 1 ? '' : 's'} older than 24h remain in the vault).`
                : '. Trigger an eBPF syscall audit, run an AST scan, or file a manual alert to populate live hourly density.'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToEbpf && (
              <button
                type="button"
                onClick={onNavigateToEbpf}
                className="px-2.5 py-1 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/30 rounded text-[9px] font-bold uppercase text-[#00f0ff] flex items-center gap-1 cursor-pointer"
              >
                <Cpu size={10} /> Run eBPF Audit
              </button>
            )}
          </div>
        </div>
      )}

      {/* 24-Hour Color-Coded Heatmap Grid */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[700px] space-y-1.5 font-mono">
          {/* Hourly Axis Labels */}
          <div className="grid grid-cols-[84px_repeat(24,minmax(0,1fr))] gap-1 items-end pb-1">
            <span className="text-[8.5px] text-white/30 uppercase tracking-wider">Severity / Hour</span>
            {buckets.map((b) => {
              const showTick = b.index === 0 || b.index % 3 === 0 || b.isCurrentHour;
              return (
                <button
                  key={`axis-${b.index}`}
                  type="button"
                  onClick={() => setSelectedHourIdx(b.index)}
                  className={`text-[8px] text-center tabular-nums leading-none cursor-pointer transition-colors ${
                    selectedHourIdx === b.index
                      ? 'text-[#00f0ff] font-bold'
                      : b.isCurrentHour
                        ? 'text-zinc-300'
                        : 'text-white/35 hover:text-zinc-300'
                  }`}
                  title={`Inspect ${b.rangeLabel} (${b.totalCount} alert${b.totalCount === 1 ? '' : 's'})`}
                >
                  {b.isCurrentHour ? 'NOW' : showTick ? b.hourLabel.slice(0, 2) : '·'}
                </button>
              );
            })}
          </div>

          {/* Heatmap Rows */}
          {displayedRows.map((row) => (
            <div
              key={row.key}
              className={`grid grid-cols-[84px_repeat(24,minmax(0,1fr))] gap-1 items-center ${
                row.key === 'all' && displayedRows.length > 1 ? 'pt-1.5 border-t border-white/5' : ''
              }`}
            >
              <span
                className={`text-[9.5px] uppercase tracking-wider truncate pr-1 ${
                  row.key === 'high'
                    ? 'text-rose-400/90'
                    : row.key === 'medium'
                      ? 'text-amber-300/90'
                      : row.key === 'low'
                        ? 'text-emerald-400/90'
                        : 'text-zinc-200 font-semibold'
                }`}
              >
                {row.label}
              </span>

              {buckets.map((bucket) => {
                const count = row.getValue(bucket);
                const isSelected = selectedHourIdx === bucket.index;
                return (
                  <button
                    key={`${row.key}-${bucket.index}`}
                    type="button"
                    onClick={() => setSelectedHourIdx(bucket.index)}
                    aria-label={`${bucket.rangeLabel} ${row.label}: ${count} alerts`}
                    title={`${bucket.rangeLabel} · ${row.label}: ${count} alert${count === 1 ? '' : 's'}`}
                    className={`h-7 rounded-[3px] border text-[9px] tabular-nums flex items-center justify-center transition-all cursor-pointer ${getDensityCellClass(
                      count,
                      row.key,
                      isSelected
                    )}`}
                  >
                    {count > 0 ? count : '·'}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Density Legend + Selected Hour Breakdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-white/5 font-mono text-[9px]">
        <div className="flex flex-wrap items-center gap-2 text-white/45">
          <span className="uppercase tracking-wider text-white/30">Density Scale:</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-[2px] bg-white/[0.025] border border-white/10 inline-block" /> 0
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-[2px] bg-emerald-500/20 border border-emerald-500/45 inline-block" /> 1
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-[2px] bg-cyan-500/25 border border-cyan-400/55 inline-block" /> 2–3
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-[2px] bg-amber-500/30 border border-amber-400/65 inline-block" /> 4–5
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-[2px] bg-rose-500/35 border border-rose-400/75 inline-block" /> 6+
          </span>
        </div>

        {selectedBucket && (
          <div className="text-white/50 flex items-center gap-2 tabular-nums">
            <Clock size={11} className="text-[#00f0ff]" />
            <span>
              Selected Window: <strong className="text-zinc-200">{selectedBucket.rangeLabel}</strong> ·{' '}
              {visibleSelectedThreats.length} matching alert{visibleSelectedThreats.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      {/* Selected Hour Incident Details Table */}
      {selectedBucket && visibleSelectedThreats.length > 0 && (
        <div className="border border-white/5 bg-black/35 rounded overflow-hidden font-mono text-[10px]">
          <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between text-[9px] text-white/45 uppercase tracking-wider">
            <span>Incidents in {selectedBucket.rangeLabel}</span>
            <span className="tabular-nums">
              Critical: {selectedBucket.highCount} · Medium: {selectedBucket.mediumCount} · Low: {selectedBucket.lowCount}
            </span>
          </div>
          <div className="divide-y divide-white/5 max-h-40 overflow-y-auto">
            {visibleSelectedThreats.map((threat) => (
              <div
                key={threat.id}
                className="px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <div className="text-zinc-200 font-medium truncate">{threat.name}</div>
                  <div className="text-[9px] text-white/35 truncate mt-0.5">
                    {threat.category.toUpperCase()} · {threat.status} · {threat.details}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 tabular-nums text-[9px]">
                  <span
                    className={`uppercase font-bold ${
                      threat.severity === 'high'
                        ? 'text-rose-400'
                        : threat.severity === 'medium'
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                    }`}
                  >
                    {threat.severity === 'high' ? 'CRITICAL' : threat.severity.toUpperCase()}
                  </span>
                  <span className="text-white/35">
                    {new Date(threat.timestamp).toTimeString().substring(0, 8)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
