import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, 
  ShieldCheck, 
  Activity, 
  Database, 
  Cpu, 
  Network, 
  Key, 
  Lock, 
  Wifi, 
  AlertTriangle, 
  Terminal, 
  CheckCircle, 
  Compass, 
  ChevronRight, 
  ArrowRight,
  Shield,
  FileCode,
  Zap,
  RefreshCw
} from 'lucide-react';
import ExportButton from './ExportButton';

interface OperationalDashboardProps {
  setActiveTool: (tool: any) => void;
  triggerToast: (msg: string) => void;
}

export default function OperationalDashboard({ setActiveTool, triggerToast }: OperationalDashboardProps) {
  // Hardening dashboard toggles
  const [secureCreds, setSecureCreds] = useState(true);
  const [enforceHttps, setEnforceHttps] = useState(true);
  const [vlanSeg, setVlanSeg] = useState(true);
  const [firmwareSigs, setFirmwareSigs] = useState(true);

  // Live RF metrics state
  const [isAnomalous, setIsAnomalous] = useState(false);
  const [metrics, setMetrics] = useState({
    snr: 14.2,
    doppler: 4.1,
    jitter: 11,
    freqOffset: 1.2
  });

  // Dynamic system stats
  const [utcTime, setUtcTime] = useState('2026-07-17 23:22:59 UTC');

  // Canvas drawing for RF signal
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const phaseRef = useRef(0);

  // Update UTC time in real time
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setUtcTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update metrics dynamically
  useEffect(() => {
    const timer = setInterval(() => {
      setMetrics(prev => {
        if (isAnomalous) {
          // Fluctuating anomalous metrics
          return {
            snr: parseFloat((6.4 + (Math.random() * 0.8 - 0.4)).toFixed(1)),
            doppler: parseFloat((342.8 + (Math.random() * 8.0 - 4.0)).toFixed(1)),
            jitter: Math.floor(182 + (Math.random() * 20 - 10)),
            freqOffset: parseFloat((-12.4 + (Math.random() * 0.6 - 0.3)).toFixed(1))
          };
        } else {
          // Fluctuating normal metrics
          return {
            snr: parseFloat((14.2 + (Math.random() * 0.4 - 0.2)).toFixed(1)),
            doppler: parseFloat((4.1 + (Math.random() * 0.3 - 0.15)).toFixed(1)),
            jitter: Math.floor(11 + (Math.random() * 2 - 1)),
            freqOffset: parseFloat((1.2 + (Math.random() * 0.1 - 0.05)).toFixed(1))
          };
        }
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [isAnomalous]);

  // RF signal drawing animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const w = canvas.width = canvas.parentElement?.clientWidth || 600;
      const h = canvas.height = 140;

      ctx.clearRect(0, 0, w, h);

      // Draw background noise grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      const gridSpacing = 20;
      for (let x = 0; x < w; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw baseline center line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Main signal carrier trace
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isAnomalous ? '#f43f5e' : '#00f0ff';
      
      const points: [number, number][] = [];
      const steps = w;
      
      phaseRef.current += isAnomalous ? 0.25 : 0.08;

      for (let i = 0; i < steps; i++) {
        const x = i;
        const normX = i / w;
        
        // Base sine wave
        let y = Math.sin(normX * Math.PI * 12 + phaseRef.current) * 20;
        
        // Add secondary frequency components (telemetry multiplexing)
        y += Math.sin(normX * Math.PI * 34 - phaseRef.current * 1.5) * 6;
        
        // If anomalous, introduce high-frequency jitter, severe carrier distortion, and noise floor spikes
        if (isAnomalous) {
          y += Math.sin(normX * Math.PI * 120 + phaseRef.current * 4) * 12; // Jammer intermodulation
          y += (Math.random() - 0.5) * 15; // Jitter / Noise
          y *= 1.4; // Amplification distortion
        } else {
          y += (Math.random() - 0.5) * 1.5; // Slight atmospheric thermal noise
        }

        // Center on vertical height
        const finalY = h / 2 + y;
        points.push([x, finalY]);
      }

      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.stroke();

      // Ambient fill under curve
      ctx.fillStyle = isAnomalous ? 'rgba(244, 63, 94, 0.03)' : 'rgba(0, 240, 255, 0.03)';
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Sweep line representing frequency scan
      const sweepX = (Date.now() / 4) % w;
      ctx.fillStyle = isAnomalous ? 'rgba(244, 63, 94, 0.4)' : 'rgba(0, 240, 255, 0.4)';
      ctx.fillRect(sweepX, 0, 2, h);

      // Draw carrier lock markers at edges
      ctx.fillStyle = isAnomalous ? '#f43f5e' : '#00f0ff';
      ctx.font = '9px monospace';
      ctx.fillText(isAnomalous ? '❌ CARRIER LOCK LOST' : '⚡ CARRIER LOCK ACTIVE', 12, 20);
      ctx.fillText(`${metrics.snr} dB SNR`, w - 85, 20);

      requestRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isAnomalous, metrics]);

  const handleInjectAnomaly = () => {
    setIsAnomalous(true);
    triggerToast('⚠️ Telemetry Warning: Ground Segment RF Intercept Anomaly Injected! SNR Dropped.');
  };

  const handleStabilize = () => {
    setIsAnomalous(false);
    triggerToast('✓ Signal Restored: Ground Station telemetry lock re-established and stabilized.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-950/70 border border-white/5 rounded p-5 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-xl pointer-events-none" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-mono tracking-[0.2em] text-[#00f0ff] uppercase font-bold">
              SAT-LINK BIND ACTIVE
            </span>
          </div>
          <p className="text-[10px] text-white/40 font-mono">
            UTC BIND TIME: <span className="text-zinc-300 font-semibold">{utcTime}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <ExportButton
            id="btn-export-ops-dashboard"
            label="Export Ops Posture"
            filenamePrefix="aegis_operational_posture"
            jsonData={{
              module: "VSAT Operational Dashboard & Telemetry Audit",
              utc_time: utcTime,
              rf_telemetry: {
                snr_db: metrics.snr,
                doppler_shift_hz: metrics.doppler,
                jitter_ms: metrics.jitter,
                freq_offset_khz: metrics.freqOffset,
                is_anomalous: isAnomalous
              },
              hardening_controls: {
                secure_credentials_management: secureCreds,
                enforce_https_tls: enforceHttps,
                vlan_traffic_isolation: vlanSeg,
                firmware_signature_verification: firmwareSigs
              },
              cisa_kev_matches: 2,
              telemetry_accuracy: "99.85%",
              nsa_compliance: "100%",
              timestamp: new Date().toISOString()
            }}
            textReport={`=== AEGIS VSAT OPERATIONAL DEFENSE AUDIT ===\nDate: ${utcTime}\n\nRF Telemetry Status:\n- Signal-to-Noise Ratio: ${metrics.snr} dB\n- Doppler Shift: ${metrics.doppler} Hz\n- Frame Jitter: ${metrics.jitter} ms\n- Frequency Offset: ${metrics.freqOffset} kHz\n- Anomaly Active: ${isAnomalous ? 'YES' : 'NO'}\n\nHardening Posture:\n- Secure Credentials: ${secureCreds ? 'ENFORCED' : 'DISABLED'}\n- HTTPS/TLS Only: ${enforceHttps ? 'ENFORCED' : 'DISABLED'}\n- VLAN Segmentation: ${vlanSeg ? 'ENFORCED' : 'DISABLED'}\n- Firmware Signatures: ${firmwareSigs ? 'ENFORCED' : 'DISABLED'}\n\nCompliance:\n- NSA CNSA Compliance: 100%\n- CISA KEV Tracked: 2 items`}
            triggerToast={triggerToast}
            size="xs"
          />
          <div className="md:max-w-md bg-black/40 border border-white/5 p-2 rounded font-mono text-[9px] text-white/50 leading-relaxed hidden sm:block">
            <span className="text-rose-400 font-bold uppercase">DISCLAIMER:</span> Interactive simulated ethical toolkit for space cyber resilience testing.
          </div>
        </div>
      </div>

      {/* Main Title Banner */}
      <div className="bg-gradient-to-r from-slate-950/80 via-slate-950/50 to-transparent border border-white/5 p-6 rounded relative">
        <div className="absolute top-1/2 -translate-y-1/2 right-6 flex items-center justify-center opacity-10 pointer-events-none">
          <Compass size={120} className="text-[#00f0ff] animate-spin-slow" style={{ animationDuration: '60s' }} />
        </div>
        
        <h2 className="text-xl md:text-2xl font-serif font-light text-zinc-100 tracking-wider">
          VSAT Unified Cyber-Range & Toolset
        </h2>
        <p className="text-xs text-white/50 font-mono max-w-4xl mt-2 leading-relaxed">
          An all-in-one system incorporating the complete list of 9 vital offensive and defensive modules outlined in the core guidelines, built for space operations resilience.
          <br />
          <span className="text-[10px] text-white/30 italic">Reference: A sophisticated ethical hacking too.txt</span>
        </p>
      </div>

      {/* Metadata Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CISA Matches */}
        <div className="bg-[#08080B] border border-white/5 rounded p-4 flex flex-col justify-between">
          <span className="text-[9px] text-white/40 font-mono uppercase tracking-wider">CISA KEV Matches</span>
          <div className="flex items-baseline gap-2.5 mt-2">
            <span className="text-2xl font-mono font-light text-rose-400">ACTIVE</span>
            <span className="text-3xl font-mono font-light text-rose-500">2</span>
          </div>
          <p className="text-[9px] text-white/30 font-mono mt-1.5 leading-tight">
            Satellite vulnerabilities flagged by CISA
          </p>
        </div>

        {/* Telemetry Accuracy */}
        <div className="bg-[#08080B] border border-white/5 rounded p-4 flex flex-col justify-between">
          <span className="text-[9px] text-white/40 font-mono uppercase tracking-wider">Telemetry Accuracy</span>
          <div className="flex items-baseline gap-2.5 mt-2">
            <span className="text-2xl font-mono font-light text-[#00f0ff]">STANDBY</span>
            <span className="text-3xl font-mono font-light text-[#00f0ff]">99.85%</span>
          </div>
          <p className="text-[9px] text-white/30 font-mono mt-1.5 leading-tight">
            Carrier tracking fidelity index
          </p>
        </div>

        {/* NSA Compliance */}
        <div className="bg-[#08080B] border border-white/5 rounded p-4 flex flex-col justify-between">
          <span className="text-[9px] text-white/40 font-mono uppercase tracking-wider">NSA Compliance</span>
          <div className="flex items-baseline gap-2.5 mt-2">
            <span className="text-2xl font-mono font-light text-emerald-400">SECURE</span>
            <span className="text-3xl font-mono font-light text-emerald-400">100%</span>
          </div>
          <p className="text-[9px] text-white/30 font-mono mt-1.5 leading-tight">
            Ground station security standards aligned
          </p>
        </div>

        {/* Suite Level */}
        <div className="bg-[#08080B] border border-white/5 rounded p-4 flex flex-col justify-between">
          <span className="text-[9px] text-white/40 font-mono uppercase tracking-wider">Suite Level</span>
          <div className="flex items-baseline gap-2.5 mt-2">
            <span className="text-2xl font-mono font-light text-amber-400">ELEVATED</span>
            <span className="text-sm font-mono font-light text-amber-500">DEFCON 3</span>
          </div>
          <p className="text-[9px] text-white/30 font-mono mt-1.5 leading-tight">
            Based on local Threat Feed indices
          </p>
        </div>
      </div>

      {/* Ground Station Hardening Dashboard & RF Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Quick Hardening Dashboard */}
        <div className="lg:col-span-5 bg-slate-950/40 backdrop-blur-md border border-white/5 rounded p-5 space-y-4">
          <div className="space-y-1">
            <h3 className="text-xs text-white uppercase tracking-wider font-mono font-semibold flex items-center gap-2">
              <ShieldCheck size={14} className="text-[#00f0ff]" /> 🛡️ Quick Ground Station Hardening Dashboard
            </h3>
            <p className="text-[10px] text-white/40 font-mono leading-relaxed">
              Toggle remediations here to instantly inject secure controls into the tactical simulation engine (Port 80/443, SNMPv3, VLANs, Firmware Checks).
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {/* Toggle 1: Secure Credentials */}
            <div className="flex items-center justify-between p-2.5 rounded border border-white/5 bg-black/20 hover:bg-black/40 transition-all">
              <div className="flex flex-col">
                <span className="text-[11px] text-zinc-200 font-mono font-medium flex items-center gap-1.5">
                  🔑 Secure Credentials
                </span>
                <span className={`text-[9px] font-mono mt-0.5 ${secureCreds ? 'text-[#00f0ff]' : 'text-rose-400'}`}>
                  {secureCreds ? 'Secured (SNMPv3)' : 'Vulnerable (Plaintext SNMPv1)'}
                </span>
              </div>
              <button
                onClick={() => {
                  setSecureCreds(!secureCreds);
                  triggerToast(`Hardening Target: Secure Credentials toggled to ${!secureCreds ? 'SNMPv3 Secure' : 'SNMPv1 Public'}`);
                }}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${secureCreds ? 'bg-cyan-500' : 'bg-zinc-800'}`}
              >
                <div className={`bg-black w-4 h-4 rounded-full shadow-md transform duration-200 ${secureCreds ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Toggle 2: Enforce HTTPS */}
            <div className="flex items-center justify-between p-2.5 rounded border border-white/5 bg-black/20 hover:bg-black/40 transition-all">
              <div className="flex flex-col">
                <span className="text-[11px] text-zinc-200 font-mono font-medium flex items-center gap-1.5">
                  🔒 Enforce HTTPS
                </span>
                <span className={`text-[9px] font-mono mt-0.5 ${enforceHttps ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
                  {enforceHttps ? 'Enforced (HTTPS/TLS)' : 'Unsecured (HTTP Port 80)'}
                </span>
              </div>
              <button
                onClick={() => {
                  setEnforceHttps(!enforceHttps);
                  triggerToast(`Hardening Target: HTTPS Enforcer ${!enforceHttps ? 'Active' : 'Bypassed'}`);
                }}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${enforceHttps ? 'bg-emerald-500' : 'bg-zinc-800'}`}
              >
                <div className={`bg-black w-4 h-4 rounded-full shadow-md transform duration-200 ${enforceHttps ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Toggle 3: VLAN Segmentation */}
            <div className="flex items-center justify-between p-2.5 rounded border border-white/5 bg-black/20 hover:bg-black/40 transition-all">
              <div className="flex flex-col">
                <span className="text-[11px] text-zinc-200 font-mono font-medium flex items-center gap-1.5">
                  🌐 VLAN Segmentation
                </span>
                <span className={`text-[9px] font-mono mt-0.5 ${vlanSeg ? 'text-cyan-400' : 'text-zinc-500'}`}>
                  {vlanSeg ? 'Segregated (VLAN)' : 'Flat-Network (No VLAN)'}
                </span>
              </div>
              <button
                onClick={() => {
                  setVlanSeg(!vlanSeg);
                  triggerToast(`Hardening Target: VLAN Segmenter ${!vlanSeg ? 'Segregated' : 'Flat-Host'}`);
                }}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${vlanSeg ? 'bg-cyan-500' : 'bg-zinc-800'}`}
              >
                <div className={`bg-black w-4 h-4 rounded-full shadow-md transform duration-200 ${vlanSeg ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Toggle 4: Firmware Signatures */}
            <div className="flex items-center justify-between p-2.5 rounded border border-white/5 bg-black/20 hover:bg-black/40 transition-all">
              <div className="flex flex-col">
                <span className="text-[11px] text-zinc-200 font-mono font-medium flex items-center gap-1.5">
                  ☣️ Firmware Signatures
                </span>
                <span className={`text-[9px] font-mono mt-0.5 ${firmwareSigs ? 'text-[#00f0ff]' : 'text-amber-500'}`}>
                  {firmwareSigs ? 'Active (Cryptographic)' : 'Passive (No Signature)'}
                </span>
              </div>
              <button
                onClick={() => {
                  setFirmwareSigs(!firmwareSigs);
                  triggerToast(`Hardening Target: Crypto Firmware Signatures ${!firmwareSigs ? 'Enabled' : 'Bypassed'}`);
                }}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${firmwareSigs ? 'bg-cyan-500' : 'bg-zinc-800'}`}
              >
                <div className={`bg-black w-4 h-4 rounded-full shadow-md transform duration-200 ${firmwareSigs ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Live RF Monitor */}
        <div className="lg:col-span-7 bg-[#08080B] border border-white/5 rounded p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-xs text-white uppercase tracking-wider font-mono font-semibold flex items-center gap-2">
                  <Radio size={14} className={isAnomalous ? 'text-rose-400 animate-pulse' : 'text-[#00f0ff]'} /> 📡 Live RF Signal & Telemetry Monitor
                </h3>
                <p className="text-[10px] text-white/40 font-mono leading-relaxed">
                  Simulating live signal metrics matching real-time VSAT transit conditions.
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleInjectAnomaly}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded text-[9px] font-bold text-rose-400 font-mono uppercase tracking-wider transition-all cursor-pointer"
                >
                  Inject Signal Anomaly
                </button>
                <button
                  onClick={handleStabilize}
                  className="px-3 py-1.5 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/30 rounded text-[9px] font-bold text-[#00f0ff] font-mono uppercase tracking-wider transition-all cursor-pointer"
                >
                  Re-Stabilize Waveforms
                </button>
              </div>
            </div>

            {/* Dynamic Signal Canvas */}
            <div className="mt-4 border border-white/5 bg-black/40 rounded overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-[140px] block" />
            </div>
          </div>

          {/* Core metrics readouts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-4 pt-4 border-t border-white/5">
            <div className="bg-black/20 p-2.5 rounded border border-white/5">
              <span className="text-[8px] text-white/30 font-mono uppercase">Carrier SNR</span>
              <p className={`text-sm font-mono font-light mt-0.5 ${isAnomalous ? 'text-rose-400 font-semibold' : 'text-zinc-200'}`}>
                {metrics.snr} dB
              </p>
            </div>
            
            <div className="bg-black/20 p-2.5 rounded border border-white/5">
              <span className="text-[8px] text-white/30 font-mono uppercase">Doppler Offset</span>
              <p className={`text-sm font-mono font-light mt-0.5 ${isAnomalous ? 'text-rose-400 font-semibold' : 'text-zinc-200'}`}>
                {metrics.doppler >= 100 ? '+' : '+'}{metrics.doppler} Hz
              </p>
            </div>

            <div className="bg-black/20 p-2.5 rounded border border-white/5">
              <span className="text-[8px] text-white/30 font-mono uppercase">Network Jitter</span>
              <p className={`text-sm font-mono font-light mt-0.5 ${isAnomalous ? 'text-rose-400 font-semibold' : 'text-zinc-200'}`}>
                {metrics.jitter} ms
              </p>
            </div>

            <div className="bg-black/20 p-2.5 rounded border border-white/5">
              <span className="text-[8px] text-white/30 font-mono uppercase">Frequency Offset</span>
              <p className={`text-sm font-mono font-light mt-0.5 ${isAnomalous ? 'text-rose-400 font-semibold' : 'text-zinc-200'}`}>
                {isAnomalous ? `${metrics.freqOffset} kHz` : `+${metrics.freqOffset} kHz`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Integrated Suite Section */}
      <div className="bg-[#08080B] border border-white/5 rounded p-6 space-y-6">
        <div className="space-y-1">
          <h3 className="text-sm font-serif font-light text-zinc-100 flex items-center gap-2">
            <Zap size={15} className="text-[#00f0ff]" /> 🛠️ Integrated Suite Dashboard
          </h3>
          <p className="text-xs text-white/40 font-mono leading-relaxed">
            We have combined every aspect of space ground segment vulnerability research, from command payload formulation to automated reporting, down into an automated client simulation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="bg-black/20 border border-white/5 p-4 rounded space-y-2">
            <div className="text-xs font-mono font-bold text-zinc-200 flex items-center gap-2">
              <span className="text-xl">📡</span> Scanning & Testing
            </div>
            <p className="text-[11px] text-white/40 leading-normal font-mono">
              Audit active terminals, run exploit playbooks, and construct custom payloads.
            </p>
          </div>

          <div className="bg-black/20 border border-white/5 p-4 rounded space-y-2">
            <div className="text-xs font-mono font-bold text-zinc-200 flex items-center gap-2">
              <span className="text-xl">🔍</span> Defense & Forensics
            </div>
            <p className="text-[11px] text-white/40 leading-normal font-mono">
              Analyze syslog streams using YARA rules matching CISA KEV criteria.
            </p>
          </div>

          <div className="bg-black/20 border border-white/5 p-4 rounded space-y-2">
            <div className="text-xs font-mono font-bold text-zinc-200 flex items-center gap-2">
              <span className="text-xl">📋</span> Automated Reports
            </div>
            <p className="text-[11px] text-white/40 leading-normal font-mono">
              Compile comprehensive documentation of vulnerability findings instantly.
            </p>
          </div>
        </div>

        {/* Suite Quick Links */}
        <div className="border-t border-white/5 pt-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-wider text-white/30 uppercase block font-bold">
              ⚙️ Suite Quick Links
            </span>
            <p className="text-[10px] text-white/40 font-mono">
              Initialize scans or monitor simulated RF signal behaviors across the space telemetry plane.
            </p>
          </div>
          
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => setActiveTool('vuln-scanner')}
              className="px-4 py-2 bg-transparent hover:bg-white/5 border border-white/10 rounded text-[10px] font-bold text-zinc-300 font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
            >
              🔍 Launch Vuln Scanner (Step 1) <ArrowRight size={12} className="text-[#00f0ff]" />
            </button>
            <button
              onClick={() => setActiveTool('penetration-framework')}
              className="px-4 py-2 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/30 rounded text-[10px] font-bold text-[#00f0ff] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
            >
              🎯 Open Penetration Frame (Step 2) <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Build Info */}
      <div className="text-center font-mono text-[9px] text-white/20 tracking-widest pt-4">
        VSAT-TOOL-V5 BUILD: 2026.06.04-ULTRA
      </div>
    </div>
  );
}
