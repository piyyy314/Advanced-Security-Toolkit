import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import {
  Wifi,
  Radio,
  ShieldAlert,
  RefreshCw,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import ExportButton from './ExportButton';

interface WirelessNode {
  id: string;
  ssid: string;
  bssid: string;
  band: '2.4GHz' | '5GHz' | 'Ku-Band';
  channel: number;
  rssi: number;
  encryption: 'WPA3-ENT' | 'WPA2-PSK' | 'WEP' | 'OPEN';
  status: 'trusted' | 'rogue' | 'deauth-flood';
  deauthRate: number;
}

interface WirelessSpectrumAuditorProps {
  triggerToast?: (msg: string) => void;
}

const INITIAL_NODES: WirelessNode[] = [
  {
    id: 'ap-01',
    ssid: 'AEGIS-GROUND-CTRL',
    bssid: '00:1A:2B:44:8F:10',
    band: '5GHz',
    channel: 36,
    rssi: -46,
    encryption: 'WPA3-ENT',
    status: 'trusted',
    deauthRate: 0
  },
  {
    id: 'ap-02',
    ssid: 'VSAT-TELEMETRY-BACKHAUL',
    bssid: '00:1A:2B:44:8F:12',
    band: 'Ku-Band',
    channel: 11,
    rssi: -52,
    encryption: 'WPA3-ENT',
    status: 'trusted',
    deauthRate: 1
  },
  {
    id: 'ap-03',
    ssid: 'AEGIS-GROUND-CTRL',
    bssid: 'DE:AD:BE:EF:13:37',
    band: '2.4GHz',
    channel: 6,
    rssi: -39,
    encryption: 'OPEN',
    status: 'rogue',
    deauthRate: 18
  },
  {
    id: 'ap-04',
    ssid: 'OPS-MAINTENANCE-WLAN',
    bssid: '4C:9E:FF:21:08:A4',
    band: '2.4GHz',
    channel: 1,
    rssi: -67,
    encryption: 'WEP',
    status: 'trusted',
    deauthRate: 3
  }
];

function useChartContainerSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ width: Math.floor(r.width), height: Math.floor(r.height) });
    };
    measure();
    const obs = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      setSize({
        width: Math.floor(entries[0].contentRect.width),
        height: Math.floor(entries[0].contentRect.height)
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return [ref, size] as const;
}

export default function WirelessSpectrumAuditor({ triggerToast }: WirelessSpectrumAuditorProps) {
  const [nodes, setNodes] = useState<WirelessNode[]>(INITIAL_NODES);
  const [isolatedBssids, setIsolatedBssids] = useState<string[]>([]);
  const [deauthSimulated, setDeauthSimulated] = useState(false);
  const [chartRef, chartSize] = useChartContainerSize();

  const channelTelemetry = [
    { ch: 'CH 1', snr: 28, interference: deauthSimulated ? 45 : 14 },
    { ch: 'CH 6', snr: deauthSimulated ? 11 : 19, interference: deauthSimulated ? 82 : 41 },
    { ch: 'CH 11', snr: 34, interference: 12 },
    { ch: 'CH 36', snr: 41, interference: 6 },
    { ch: 'CH 149', snr: 38, interference: 9 }
  ];

  const handleSweep = () => {
    setDeauthSimulated(false);
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        rssi: Math.max(-85, Math.min(-32, n.rssi + Math.floor(Math.random() * 5 - 2))),
        deauthRate: n.status === 'rogue' ? 14 + Math.floor(Math.random() * 8) : Math.floor(Math.random() * 2)
      }))
    );
    if (triggerToast) triggerToast('RF spectrum sweep completed across 2.4GHz, 5GHz, and Ku-Band channels.');
  };

  const handleSimulateDeauth = () => {
    setDeauthSimulated(true);
    setNodes((prev) =>
      prev.map((n) =>
        n.channel === 6
          ? { ...n, status: 'deauth-flood', deauthRate: 142 }
          : n
      )
    );
    if (triggerToast) triggerToast('Alert: 802.11 Deauthentication flood detected on Channel 6 (142 frames/s).');
  };

  const handleIsolate = (node: WirelessNode) => {
    if (isolatedBssids.includes(node.bssid)) return;
    setIsolatedBssids((prev) => [...prev, node.bssid]);
    if (triggerToast) triggerToast(`Containment policy applied: BSSID ${node.bssid} blocked at RF gateway.`);
  };

  return (
    <div className="bg-[#0A0A0C]/90 border border-white/5 rounded-lg shadow-[0_4px_30px_rgba(0,0,0,0.4)] overflow-hidden font-mono text-[11px]">
      <div className="border-b border-white/5 bg-gradient-to-r from-black/80 to-[#101014] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 border border-[#00f0ff]/35 bg-[#00f0ff]/5 text-[#00f0ff] rounded-md">
            <Wifi size={15} />
          </div>
          <div>
            <span className="text-[9px] tracking-widest text-[#00f0ff]/80 uppercase font-bold block">
              802.11 / RF SPECTRUM SECURITY
            </span>
            <h3 className="text-sm font-serif font-light text-zinc-100">
              Wireless &amp; RF Spectrum Auditor
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSweep}
            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] uppercase font-bold text-zinc-200 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={10} className="text-[#00f0ff]" /> Sweep Spectrum
          </button>
          <button
            type="button"
            onClick={handleSimulateDeauth}
            className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded text-[9px] uppercase font-bold text-rose-300 flex items-center gap-1 cursor-pointer"
          >
            <Radio size={10} /> Simulate Deauth Burst
          </button>
          <ExportButton
            id="btn-export-wireless-audit"
            label="Export RF Audit"
            filenamePrefix="aegis_wireless_spectrum_audit"
            jsonData={{
              module: 'Wireless & RF Spectrum Auditor',
              timestamp: new Date().toISOString(),
              nodes,
              isolated_bssids: isolatedBssids,
              channel_telemetry: channelTelemetry
            }}
            csvData={nodes.map((n) => ({
              ssid: n.ssid,
              bssid: n.bssid,
              band: n.band,
              channel: n.channel,
              rssi_dbm: n.rssi,
              encryption: n.encryption,
              status: n.status,
              deauth_fps: n.deauthRate,
              contained: isolatedBssids.includes(n.bssid)
            }))}
            textReport={`=== AEGIS WIRELESS SPECTRUM AUDIT ===\nTimestamp: ${new Date().toISOString()}\nObserved Nodes (${nodes.length}):\n${nodes.map((n) => `- ${n.ssid} [${n.bssid}] CH ${n.channel} (${n.band}) ${n.encryption} | ${n.status.toUpperCase()} | Deauth: ${n.deauthRate}/s`).join('\n')}`}
            triggerToast={triggerToast}
            size="xs"
          />
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Channel SNR vs Interference Chart */}
        <div className="border border-white/5 bg-black/35 rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/50 uppercase tracking-wider">
              Channel SNR vs Interference Floor (dB / Index)
            </span>
            <span className="text-[9px] text-zinc-400 tabular-nums">
              Rogue / Deauth Alerts:{' '}
              <strong className="text-rose-400">
                {nodes.filter((n) => n.status !== 'trusted' || n.encryption === 'WEP' || n.encryption === 'OPEN').length}
              </strong>
            </span>
          </div>

          <div ref={chartRef} className="w-full h-44 min-w-0" style={{ minHeight: '176px' }}>
            {chartSize.width > 0 && chartSize.height > 0 && (
              <BarChart
                width={chartSize.width}
                height={chartSize.height}
                data={channelTelemetry}
                margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="ch"
                  stroke="rgba(255,255,255,0.25)"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'monospace' }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.25)"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'monospace' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A0A0D',
                    border: '1px solid rgba(0,240,255,0.25)',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="snr" name="Carrier SNR (dB)" fill="#00f0ff" radius={[2, 2, 0, 0]} />
                <Bar dataKey="interference" name="Interference Index" radius={[2, 2, 0, 0]}>
                  {channelTelemetry.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.interference >= 50 ? '#f43f5e' : '#f59e0b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </div>
        </div>

        {/* Observed RF Access Points Ledger */}
        <div className="border border-white/5 bg-black/35 rounded overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/5 text-[9.5px] uppercase tracking-wider text-white/45 flex justify-between">
            <span>Detected Transceivers &amp; Evil-Twin Audit</span>
            <span className="tabular-nums">{nodes.length} Active Beacons</span>
          </div>
          <div className="divide-y divide-white/5">
            {nodes.map((node) => {
              const isContained = isolatedBssids.includes(node.bssid);
              const isWeakCrypto = node.encryption === 'WEP' || node.encryption === 'OPEN';
              const isThreat = node.status !== 'trusted' || isWeakCrypto;
              return (
                <div
                  key={node.id}
                  className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-white/[0.02]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-zinc-100">{node.ssid}</span>
                      <span className="text-[9px] text-white/45 tabular-nums">{node.bssid}</span>
                      {node.status === 'rogue' && (
                        <span className="text-[9px] text-rose-400 font-bold uppercase flex items-center gap-1">
                          <ShieldAlert size={10} /> Evil Twin Rogue AP
                        </span>
                      )}
                      {node.status === 'deauth-flood' && (
                        <span className="text-[9px] text-rose-400 font-bold uppercase flex items-center gap-1">
                          <AlertTriangle size={10} /> Deauth Flood
                        </span>
                      )}
                      {node.status === 'trusted' && !isWeakCrypto && (
                        <span className="text-[9px] text-emerald-400 uppercase flex items-center gap-1">
                          <CheckCircle size={10} /> Verified
                        </span>
                      )}
                    </div>
                    <div className="text-[9.5px] text-white/40 tabular-nums">
                      Band: {node.band} · CH {node.channel} · RSSI: {node.rssi} dBm · Crypto:{' '}
                      <span className={isWeakCrypto ? 'text-amber-300 font-bold' : 'text-zinc-300'}>
                        {node.encryption}
                      </span>{' '}
                      · Deauth Rate: {node.deauthRate}/s
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isContained ? (
                      <span className="px-2.5 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[9px] uppercase font-bold">
                        Contained
                      </span>
                    ) : isThreat ? (
                      <button
                        type="button"
                        onClick={() => handleIsolate(node)}
                        className="px-3 py-1.5 rounded border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-[9px] font-bold uppercase cursor-pointer transition-colors"
                      >
                        Contain BSSID
                      </button>
                    ) : (
                      <span className="text-[9px] text-white/30 uppercase">Nominal</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
