import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Network, Key, Shield, AlertTriangle, FileText, 
  Terminal, Search, Radio, Compass, RefreshCw, 
  Trash2, Play, CheckCircle, Download, FileJson, Cpu
} from 'lucide-react';
import ExportButton from './ExportButton';

interface NetworkAnalysisProps {
  triggerToast: (msg: string) => void;
}

export default function NetworkAnalysis({ triggerToast }: NetworkAnalysisProps) {
  const [activeTab, setActiveTab] = useState<'network' | 'pwd' | 'social' | 'sandbox' | 'forensics' | 'reports' | 'jamming' | 'ids' | 'compliance'>('network');

  // 3. Network Analysis states
  const [hostIp, setHostIp] = useState('192.168.1.55');
  const [scanOutput, setScanOutput] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // 5. Password Cracking states
  const [targetHash, setTargetHash] = useState('b8a9d12e84c2f1ea09de312f2ea');
  const [crackOutput, setCrackOutput] = useState<string[]>([]);
  const [isCracking, setIsCracking] = useState(false);

  // 6. Social Eng. states
  const [templateType, setTemplateType] = useState('cisa_alert');
  const [senderField, setSenderField] = useState('cisa-response@satellite-cisa.gov');
  const [campaignOutput, setCampaignOutput] = useState<string[]>([]);
  const [isSimulatingCampaign, setIsSimulatingCampaign] = useState(false);

  // 7. Malware Sandbox states
  const [sandboxFile, setSandboxFile] = useState('svchost_patched.exe');
  const [sandboxOutput, setSandboxOutput] = useState<string[]>([]);
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);

  // 8. Incident Response / Forensics states
  const [caseId, setCaseId] = useState('CASE-2026-09A');
  const [forensicsLog, setForensicsLog] = useState<string[]>([
    "[*] Case file established: CASE-2026-09A.",
    "[*] Target host: Satellite Terminal Uplink Ground Controller."
  ]);
  const [isAnalyzingForensics, setIsAnalyzingForensics] = useState(false);

  // 9. Automated Reports Engine states
  const [selectedReportType, setSelectedReportType] = useState('pci_dss');
  const [compiledReport, setCompiledReport] = useState<string>('');
  const [isCompilingReport, setIsCompilingReport] = useState(false);

  // 10. RF Jamming states
  const [jammingFreq, setJammingFreq] = useState('14.25');
  const [jammingOutput, setJammingOutput] = useState<string[]>([]);
  const [isJamming, setIsJamming] = useState(false);

  // 11. IDS Rules states
  const [idsTriggerCount, setIdsTriggerCount] = useState(0);
  const [idsRules, setIdsRules] = useState<string>(
    `# Suricata / Snort Ruleset for VSAT Defense\n` +
    `alert tcp any any -> $HOME_NET 8080 (msg:"Suspicious unauthenticated TCP terminal request"; content:"setuid"; sid:1000001; rev:1;)\n` +
    `alert udp any any -> $HOME_NET 161 (msg:"Vulnerable SNMPv1 command query"; content:"public"; sid:1000002; rev:1;)`
  );

  // 12. NSA Compliance / Hardening
  const [hardeningScore, setHardeningScore] = useState(82);

  // Executing 3. Network Analysis Scan
  const handleNetworkScan = () => {
    setIsScanning(true);
    setScanOutput([`[*] Initializing scanning engine targeting: ${hostIp}...`, `[>] Mapping routing tables & UDP gateway parameters...`]);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step === 1) {
        setScanOutput(prev => [...prev, `[+] Port 22/tcp (SSH) - OPEN (OpenSSH 8.9p1)`]);
      } else if (step === 2) {
        setScanOutput(prev => [...prev, `[+] Port 161/udp (SNMP) - OPEN (Vulnerable SNMPv1 Enabled!)`]);
      } else if (step === 3) {
        setScanOutput(prev => [...prev, `[+] Port 8080/tcp (HTTP) - OPEN (Unauthenticated Satellite Dashboard)`]);
      } else if (step === 4) {
        clearInterval(interval);
        setIsScanning(false);
        setScanOutput(prev => [...prev, `[✓] SCAN COMPLETE. SNMPv1 plain credentials pose critical threat vulnerability.`]);
        triggerToast('🔍 Network scan complete! Ground segment topology fully mapped.');
      }
    }, 800);
  };

  // Executing 5. Password Cracking
  const handlePasswordCracking = () => {
    setIsCracking(true);
    setCrackOutput([`[*] Launching parallel multi-threaded GPU brute force kernels over SHA256 targets...`, `[>] Target hash: ${targetHash}`]);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step === 1) {
        setCrackOutput(prev => [...prev, `[>] Sweeping standard dictionary arrays (0 / 10,000 matches)`]);
      } else if (step === 2) {
        setCrackOutput(prev => [...prev, `[>] Exhausting space permutations... matching offset failure.`]);
      } else if (step === 3) {
        clearInterval(interval);
        setIsCracking(false);
        setCrackOutput(prev => [...prev, `[✓] KEY CRACKED: "Aegis_Orbit_Admin_2026!"`, `[*] Crack time: 2.4 seconds`]);
        triggerToast('🔑 Key recovered successfully!');
      }
    }, 1000);
  };

  // Executing 6. Social Eng. Simulation
  const handleSocialSim = () => {
    setIsSimulatingCampaign(true);
    setCampaignOutput([`[*] Formatting campaign payload template: ${templateType}...`, `[*] Sender alias: ${senderField}`]);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step === 1) {
        setCampaignOutput(prev => [...prev, `[>] Formatting digital signature header blocks...`]);
      } else if (step === 2) {
        setCampaignOutput(prev => [...prev, `[>] Dispatching simulated target email list...`]);
      } else if (step === 3) {
        clearInterval(interval);
        setIsSimulatingCampaign(false);
        setCampaignOutput(prev => [...prev, `[✓] CAMPAIGN FINALISED. Over 42% clickthrough simulated, proving lack of credential-entry guardrails.`]);
        triggerToast('🎣 Phishing simulation finished!');
      }
    }, 800);
  };

  // Executing 7. Malware Sandbox
  const handleMalwareSandbox = () => {
    setIsSandboxRunning(true);
    setSandboxOutput([`[*] Spinning up sandboxed virtual container...`, `[*] Injecting threat analyzer hooks into: ${sandboxFile}`]);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step === 1) {
        setSandboxOutput(prev => [...prev, `[>] Monitoring kernel system calls (eBPF Telemetry Hook Enabled)`]);
      } else if (step === 2) {
        setSandboxOutput(prev => [...prev, `[⚠️] WARNING: Executable attempted unaligned thread injection (VirtualAlloc)`]);
      } else if (step === 3) {
        setSandboxOutput(prev => [...prev, `[⚠️] WARNING: Attempted to fetch remote payloads from unvetted HTTP endpoint`]);
      } else if (step === 4) {
        clearInterval(interval);
        setIsSandboxRunning(false);
        setSandboxOutput(prev => [...prev, `[✓] SANDBOX EXECUTION HALTED. Threat index: 8.8/10 (Ransomware Backdoor)`]);
        triggerToast('☣️ Sandbox threat behavior analyzed!');
      }
    }, 900);
  };

  // Executing 8. Incident Forensics
  const handleIncidentForensics = () => {
    setIsAnalyzingForensics(true);
    setForensicsLog([`[*] Case file established: ${caseId}.`, `[*] Running eBPF log integrity checks...`]);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step === 1) {
        setForensicsLog(prev => [...prev, `[>] Correlating timestamps from satellite tracking anomalies...`]);
      } else if (step === 2) {
        setForensicsLog(prev => [...prev, `[+] Match found: Root setuid execution on backdoor_payload aligned with SNR drop.`]);
      } else if (step === 3) {
        clearInterval(interval);
        setIsAnalyzingForensics(false);
        setForensicsLog(prev => [...prev, `[✓] INCIDENT RESPONSE ANALYSIS COMPLETE. Root compromised through unauthenticated TCP console.`]);
        triggerToast('📋 Case forensics correlation complete!');
      }
    }, 1000);
  };

  // Executing 9. Automated Reports
  const handleAutomatedReport = () => {
    setIsCompilingReport(true);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step === 2) {
        clearInterval(interval);
        setIsCompilingReport(false);
        const reportText = 
          `================================================================================\n` +
          `Aegis Intelligence Automated Cyber-Range Report\n` +
          `Report Standard: ${selectedReportType.toUpperCase()}\n` +
          `Compiled Timestamp UTC: 2026-07-17T23:22:59Z\n` +
          `Generated For: baalbek.313@gmail.com\n` +
          `================================================================================\n\n` +
          `1. INCIDENT CORRELATION STATISTICS\n` +
          `- Active Telemetry Audit Jitter: 11 ms\n` +
          `- Satellite Doppler Offset: +4.1 Hz\n` +
          `- Identified Vulnerabilities: Plaintext SNMPv1 enabled, Unauthenticated Port 8080.\n\n` +
          `2. SECURITY REMEDIATION REQUIREMENTS\n` +
          `- [MANDATORY] Enforce HTTPS/TLS and block Port 80 dynamic redirects.\n` +
          `- [MANDATORY] Restructure credentials from vulnerable SNMPv1 to SNMPv3 cryptographic signing.\n` +
          `- [MANDATORY] Implement Suricata/Snort alert rulesets to block unvetted setuid(0) triggers.\n\n` +
          `3. DISPOSITION\n` +
          `Target satisfies 100% NSA Ground-Station Security Hardening Standards upon applying toggled controls.`;
        setCompiledReport(reportText);
        triggerToast('📋 Automated report successfully generated!');
      }
    }, 800);
  };

  // Executing 10. RF Jamming Simulation
  const handleRFJamming = () => {
    setIsJamming(true);
    setJammingOutput([`[*] Injecting high-power white Gaussian noise loop...`, `[*] Target uplink frequency: ${jammingFreq} GHz`]);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step === 1) {
        setJammingOutput(prev => [...prev, `[>] Transmitting intermodulation carriers into L-band receiver...`]);
      } else if (step === 2) {
        setJammingOutput(prev => [...prev, `[⚠️] Carrier SNR collapsing to < 6.2 dB (LOCK LOST)`]);
      } else if (step === 3) {
        clearInterval(interval);
        setIsJamming(false);
        setJammingOutput(prev => [...prev, `[✓] RF Spectrum fully congested. Target satellite communication transponder completely disconnected.`]);
        triggerToast('📡 High-power Jamming active! Communication loop severed.');
      }
    }, 900);
  };

  return (
    <div className="space-y-6">
      {/* Element Nav Row */}
      <div className="bg-slate-950/40 border border-white/5 p-2 rounded flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveTab('network')}
          className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
            activeTab === 'network' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          🌐 3. Network Analysis
        </button>

        <button
          onClick={() => setActiveTab('pwd')}
          className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
            activeTab === 'pwd' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          🔑 5. Password Cracker
        </button>

        <button
          onClick={() => setActiveTab('social')}
          className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
            activeTab === 'social' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          🎣 6. Social Eng. Sim
        </button>

        <button
          onClick={() => setActiveTab('sandbox')}
          className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
            activeTab === 'sandbox' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          ☣️ 7. Malware Sandbox
        </button>

        <button
          onClick={() => setActiveTab('forensics')}
          className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
            activeTab === 'forensics' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          📋 8. Incident Forensics
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
            activeTab === 'reports' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          📥 9. Reports Engine
        </button>

        <button
          onClick={() => setActiveTab('jamming')}
          className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
            activeTab === 'jamming' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          📡 10. RF Jamming
        </button>

        <button
          onClick={() => setActiveTab('ids')}
          className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
            activeTab === 'ids' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          🛡️ 11. IDS Rules
        </button>

        <button
          onClick={() => setActiveTab('compliance')}
          className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
            activeTab === 'compliance' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/20' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          🔒 NSA Compliance
        </button>
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="bg-[#08080B] border border-white/5 rounded p-5 space-y-4"
        >
          {/* 3. Network Analysis */}
          {activeTab === 'network' && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xs text-white uppercase tracking-wider font-mono font-semibold">
                    🌐 Network Analysis & Ground Segment Scanner
                  </h3>
                  <p className="text-[10px] text-white/40 font-mono">
                    Map local networking pathways, active transponder gateways, and vulnerable service protocols.
                  </p>
                </div>
                {scanOutput.length > 0 && (
                  <ExportButton
                    id="btn-export-network-scan"
                    label="Export Scan"
                    filenamePrefix={`network_scan_${hostIp.replace(/\./g, '_')}`}
                    jsonData={{ target_ip: hostIp, timestamp: new Date().toISOString(), scan_logs: scanOutput }}
                    csvData={scanOutput.map((l, i) => ({ step: i + 1, output: l }))}
                    textReport={`=== NETWORK GATEWAY SCAN REPORT ===\nTarget IP: ${hostIp}\nDate: ${new Date().toISOString()}\n\n${scanOutput.join('\n')}`}
                    triggerToast={triggerToast}
                    size="xs"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                <div className="md:col-span-4 space-y-3 font-mono text-xs">
                  <div className="bg-black/30 border border-white/5 p-4 rounded space-y-2">
                    <label className="text-[9px] text-white/30 uppercase block font-bold">Target IP / Gateway</label>
                    <input
                      type="text"
                      value={hostIp}
                      onChange={(e) => setHostIp(e.target.value)}
                      className="w-full bg-[#0C0C10] border border-white/5 p-2 rounded text-zinc-200 focus:outline-none focus:border-[#00f0ff]"
                    />
                    
                    <button
                      onClick={handleNetworkScan}
                      disabled={isScanning}
                      className="w-full mt-2.5 py-2 bg-[#00f0ff] text-black font-bold uppercase rounded hover:bg-[#00f0ff]/80 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px]"
                    >
                      {isScanning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} Run Gateway Scan
                    </button>
                  </div>
                </div>

                <div className="md:col-span-8 bg-black/40 border border-white/5 p-4 rounded h-64 overflow-y-auto font-mono text-[11px] text-cyan-400 space-y-1">
                  {scanOutput.length === 0 ? (
                    <span className="text-white/20 italic">Initialize Gateway scanning parameters above to begin.</span>
                  ) : (
                    scanOutput.map((l, i) => <div key={i}>{l}</div>)
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 5. Password Cracker */}
          {activeTab === 'pwd' && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xs text-white uppercase tracking-wider font-mono font-semibold">
                    🔑 Password Cracking & Recovery Tool
                  </h3>
                  <p className="text-[10px] text-white/40 font-mono">
                    Simulate GPU cracking dictionary sweeps over un-parameterized terminal database secrets.
                  </p>
                </div>
                {crackOutput.length > 0 && (
                  <ExportButton
                    id="btn-export-password-recovery"
                    label="Export Results"
                    filenamePrefix="password_recovery_result"
                    jsonData={{ target_hash: targetHash, timestamp: new Date().toISOString(), crack_logs: crackOutput }}
                    csvData={crackOutput.map((l, i) => ({ step: i + 1, output: l }))}
                    textReport={`=== PASSWORD CRACKING AUDIT REPORT ===\nTarget Hash: ${targetHash}\nTimestamp: ${new Date().toISOString()}\n\n${crackOutput.join('\n')}`}
                    triggerToast={triggerToast}
                    size="xs"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                <div className="md:col-span-4 space-y-3 font-mono text-xs">
                  <div className="bg-black/30 border border-white/5 p-4 rounded space-y-2">
                    <label className="text-[9px] text-white/30 uppercase block font-bold">SHA-256 target hash</label>
                    <input
                      type="text"
                      value={targetHash}
                      onChange={(e) => setTargetHash(e.target.value)}
                      className="w-full bg-[#0C0C10] border border-white/5 p-2 rounded text-zinc-200 focus:outline-none focus:border-[#00f0ff]"
                    />
                    
                    <button
                      onClick={handlePasswordCracking}
                      disabled={isCracking}
                      className="w-full mt-2.5 py-2 bg-[#00f0ff] text-black font-bold uppercase rounded hover:bg-[#00f0ff]/80 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px]"
                    >
                      {isCracking ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} Recover Key
                    </button>
                  </div>
                </div>

                <div className="md:col-span-8 bg-black/40 border border-white/5 p-4 rounded h-64 overflow-y-auto font-mono text-[11px] text-cyan-400 space-y-1">
                  {crackOutput.length === 0 ? (
                    <span className="text-white/20 italic">Load target cryptographic hashes above to run dictionary permutation sweeps.</span>
                  ) : (
                    crackOutput.map((l, i) => <div key={i}>{l}</div>)
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 6. Social Engineering */}
          {activeTab === 'social' && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xs text-white uppercase tracking-wider font-mono font-semibold">
                    🎣 Social Engineering Campaign Simulator
                  </h3>
                  <p className="text-[10px] text-white/40 font-mono">
                    Simulate un-parameterized client credential-entry scenarios to test human compliance factors.
                  </p>
                </div>
                {campaignOutput.length > 0 && (
                  <ExportButton
                    id="btn-export-social-campaign"
                    label="Export Campaign"
                    filenamePrefix={`social_engineering_${templateType}`}
                    jsonData={{ template: templateType, sender: senderField, timestamp: new Date().toISOString(), campaign_output: campaignOutput }}
                    csvData={campaignOutput.map((l, i) => ({ step: i + 1, output: l }))}
                    textReport={`=== SOCIAL ENGINEERING SIMULATION AUDIT ===\nTemplate: ${templateType}\nSender: ${senderField}\nTimestamp: ${new Date().toISOString()}\n\n${campaignOutput.join('\n')}`}
                    triggerToast={triggerToast}
                    size="xs"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                <div className="md:col-span-4 space-y-3 font-mono text-xs">
                  <div className="bg-black/30 border border-white/5 p-4 rounded space-y-3">
                    <div>
                      <label className="text-[9px] text-white/30 uppercase block font-bold mb-1">Campaign Template</label>
                      <select
                        value={templateType}
                        onChange={(e) => setTemplateType(e.target.value)}
                        className="w-full bg-[#0C0C10] border border-white/5 p-2 rounded text-zinc-300 focus:outline-none"
                      >
                        <option value="cisa_alert">CISA Satellite Urgency Alert</option>
                        <option value="firmware_update">Firmware Block Patch Required</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] text-white/30 uppercase block font-bold mb-1">Sender Mask ID</label>
                      <input
                        type="text"
                        value={senderField}
                        onChange={(e) => setSenderField(e.target.value)}
                        className="w-full bg-[#0C0C10] border border-white/5 p-2 rounded text-zinc-300 focus:outline-none"
                      />
                    </div>
                    
                    <button
                      onClick={handleSocialSim}
                      disabled={isSimulatingCampaign}
                      className="w-full py-2 bg-[#00f0ff] text-black font-bold uppercase rounded hover:bg-[#00f0ff]/80 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px]"
                    >
                      {isSimulatingCampaign ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} Launch Phishing Sim
                    </button>
                  </div>
                </div>

                <div className="md:col-span-8 bg-black/40 border border-white/5 p-4 rounded h-64 overflow-y-auto font-mono text-[11px] text-cyan-400 space-y-1">
                  {campaignOutput.length === 0 ? (
                    <span className="text-white/20 italic">Select template blocks above to execute simulated vector loops.</span>
                  ) : (
                    campaignOutput.map((l, i) => <div key={i}>{l}</div>)
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 7. Malware Sandbox */}
          {activeTab === 'sandbox' && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xs text-white uppercase tracking-wider font-mono font-semibold">
                    ☣️ Malware Sandbox & Code Execution Monitor
                  </h3>
                  <p className="text-[10px] text-white/40 font-mono">
                    Safely test anomalous firmware code in closed sandboxed environments with active syscall diagnostics.
                  </p>
                </div>
                {sandboxOutput.length > 0 && (
                  <ExportButton
                    id="btn-export-sandbox-telemetry"
                    label="Export Sandbox"
                    filenamePrefix={`sandbox_analysis_${sandboxFile.replace(/\./g, '_')}`}
                    jsonData={{ target_file: sandboxFile, timestamp: new Date().toISOString(), telemetry_log: sandboxOutput }}
                    csvData={sandboxOutput.map((l, i) => ({ step: i + 1, output: l }))}
                    textReport={`=== MALWARE SANDBOX BEHAVIORAL REPORT ===\nTarget File: ${sandboxFile}\nTimestamp: ${new Date().toISOString()}\n\n${sandboxOutput.join('\n')}`}
                    triggerToast={triggerToast}
                    size="xs"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                <div className="md:col-span-4 space-y-3 font-mono text-xs">
                  <div className="bg-black/30 border border-white/5 p-4 rounded space-y-2">
                    <label className="text-[9px] text-white/30 uppercase block font-bold">Target File Name</label>
                    <input
                      type="text"
                      value={sandboxFile}
                      onChange={(e) => setSandboxFile(e.target.value)}
                      className="w-full bg-[#0C0C10] border border-white/5 p-2 rounded text-zinc-200 focus:outline-none focus:border-[#00f0ff]"
                    />
                    
                    <button
                      onClick={handleMalwareSandbox}
                      disabled={isSandboxRunning}
                      className="w-full mt-2.5 py-2 bg-[#00f0ff] text-black font-bold uppercase rounded hover:bg-[#00f0ff]/80 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px]"
                    >
                      {isSandboxRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} Execute in Sandbox
                    </button>
                  </div>
                </div>

                <div className="md:col-span-8 bg-black/40 border border-white/5 p-4 rounded h-64 overflow-y-auto font-mono text-[11px] text-cyan-400 space-y-1">
                  {sandboxOutput.length === 0 ? (
                    <span className="text-white/20 italic">Submit suspicious binary targets above to safely trigger behavioral scanning.</span>
                  ) : (
                    sandboxOutput.map((l, i) => <div key={i}>{l}</div>)
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 8. Incident Forensics */}
          {activeTab === 'forensics' && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xs text-white uppercase tracking-wider font-mono font-semibold">
                    📋 Incident Response, Forensics & Correlation
                  </h3>
                  <p className="text-[10px] text-white/40 font-mono">
                    Track and document anomalous signal transitions to reconstruct root infiltration parameters.
                  </p>
                </div>
                {forensicsLog.length > 0 && (
                  <ExportButton
                    id="btn-export-incident-forensics"
                    label="Export Forensics"
                    filenamePrefix={`forensics_${caseId.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                    jsonData={{ case_id: caseId, timestamp: new Date().toISOString(), forensics_log: forensicsLog }}
                    csvData={forensicsLog.map((l, i) => ({ step: i + 1, log: l }))}
                    textReport={`=== INCIDENT RESPONSE FORENSICS DOSSIER ===\nCase ID: ${caseId}\nTimestamp: ${new Date().toISOString()}\n\n${forensicsLog.join('\n')}`}
                    triggerToast={triggerToast}
                    size="xs"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                <div className="md:col-span-4 space-y-3 font-mono text-xs">
                  <div className="bg-black/30 border border-white/5 p-4 rounded space-y-2">
                    <label className="text-[9px] text-white/30 uppercase block font-bold">Incident Case ID</label>
                    <input
                      type="text"
                      value={caseId}
                      onChange={(e) => setCaseId(e.target.value)}
                      className="w-full bg-[#0C0C10] border border-white/5 p-2 rounded text-zinc-200 focus:outline-none focus:border-[#00f0ff]"
                    />
                    
                    <button
                      onClick={handleIncidentForensics}
                      disabled={isAnalyzingForensics}
                      className="w-full mt-2.5 py-2 bg-[#00f0ff] text-black font-bold uppercase rounded hover:bg-[#00f0ff]/80 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px]"
                    >
                      {isAnalyzingForensics ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} Correlate Logs
                    </button>
                  </div>
                </div>

                <div className="md:col-span-8 bg-black/40 border border-white/5 p-4 rounded h-64 overflow-y-auto font-mono text-[11px] text-cyan-400 space-y-1">
                  {forensicsLog.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            </div>
          )}

          {/* 9. Automated Reports Engine */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xs text-white uppercase tracking-wider font-mono font-semibold">
                    📥 Automated Cyber-Range Reports Engine
                  </h3>
                  <p className="text-[10px] text-white/40 font-mono">
                    Instantly compile ground station compliance audits, technical telemetry metrics, and vulnerability logs.
                  </p>
                </div>
                {compiledReport && (
                  <ExportButton
                    id="btn-export-automated-report"
                    label="Export Report"
                    filenamePrefix={`cyber_range_report_${selectedReportType}`}
                    jsonData={{ report_type: selectedReportType, timestamp: new Date().toISOString(), report_content: compiledReport }}
                    textReport={compiledReport}
                    triggerToast={triggerToast}
                    size="xs"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                <div className="md:col-span-4 space-y-3 font-mono text-xs">
                  <div className="bg-black/30 border border-white/5 p-4 rounded space-y-3">
                    <div>
                      <label className="text-[9px] text-white/30 uppercase block font-bold mb-1">Audit Template</label>
                      <select
                        value={selectedReportType}
                        onChange={(e) => setSelectedReportType(e.target.value)}
                        className="w-full bg-[#0C0C10] border border-white/5 p-2 rounded text-zinc-300 focus:outline-none"
                      >
                        <option value="pci_dss">PCI-DSS compliance</option>
                        <option value="nist_800">NIST SP 800-53 Ground Segment</option>
                        <option value="mitre_attck">MITRE ATT&CK Matrix Space</option>
                      </select>
                    </div>
                    
                    <button
                      onClick={handleAutomatedReport}
                      disabled={isCompilingReport}
                      className="w-full py-2 bg-[#00f0ff] text-black font-bold uppercase rounded hover:bg-[#00f0ff]/80 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px]"
                    >
                      {isCompilingReport ? <RefreshCw size={12} className="animate-spin" /> : <FileText size={12} />} Compile PDF/JSON Report
                    </button>
                  </div>
                </div>

                <div className="md:col-span-8 bg-black/40 border border-white/5 p-4 rounded h-64 overflow-y-auto font-mono text-[11px] text-cyan-400 whitespace-pre">
                  {isCompilingReport ? (
                    <div className="text-white/20 italic animate-pulse">Running document collation parameters... compiling reports.</div>
                  ) : compiledReport ? (
                    compiledReport
                  ) : (
                    <span className="text-white/20 italic">Select report standard templates above to compile.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 10. RF Jamming */}
          {activeTab === 'jamming' && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xs text-white uppercase tracking-wider font-mono font-semibold">
                    📡 10. RF Jamming & Spectrum Jammer
                  </h3>
                  <p className="text-[10px] text-white/40 font-mono">
                    Transmit broad-spectrum noise profiles into satellite telemetry loops to model environmental interference.
                  </p>
                </div>
                {jammingOutput.length > 0 && (
                  <ExportButton
                    id="btn-export-rf-jamming"
                    label="Export Jamming Logs"
                    filenamePrefix={`rf_jamming_${jammingFreq.replace(/\./g, '_')}ghz`}
                    jsonData={{ target_freq_ghz: jammingFreq, timestamp: new Date().toISOString(), logs: jammingOutput }}
                    csvData={jammingOutput.map((l, i) => ({ step: i + 1, log: l }))}
                    textReport={`=== RF JAMMING SPECTRUM DIAGNOSTICS ===\nTarget Uplink Frequency: ${jammingFreq} GHz\nTimestamp: ${new Date().toISOString()}\n\n${jammingOutput.join('\n')}`}
                    triggerToast={triggerToast}
                    size="xs"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                <div className="md:col-span-4 space-y-3 font-mono text-xs">
                  <div className="bg-black/30 border border-white/5 p-4 rounded space-y-2">
                    <label className="text-[9px] text-white/30 uppercase block font-bold">Jamming Target Freq (GHz)</label>
                    <input
                      type="text"
                      value={jammingFreq}
                      onChange={(e) => setJammingFreq(e.target.value)}
                      className="w-full bg-[#0C0C10] border border-white/5 p-2 rounded text-zinc-200 focus:outline-none focus:border-[#00f0ff]"
                    />
                    
                    <button
                      onClick={handleRFJamming}
                      disabled={isJamming}
                      className="w-full mt-2.5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold uppercase rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px]"
                    >
                      {isJamming ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} Inject Jamming Carrier
                    </button>
                  </div>
                </div>

                <div className="md:col-span-8 bg-black/40 border border-white/5 p-4 rounded h-64 overflow-y-auto font-mono text-[11px] text-cyan-400 space-y-1">
                  {jammingOutput.length === 0 ? (
                    <span className="text-white/20 italic">Provide L-band tracking frequency targets to initiate jamming.</span>
                  ) : (
                    jammingOutput.map((l, i) => <div key={i}>{l}</div>)
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 11. IDS Rules */}
          {activeTab === 'ids' && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xs text-white uppercase tracking-wider font-mono font-semibold">
                    🛡️ 11. IDS Rules & Correlation Engine
                  </h3>
                  <p className="text-[10px] text-white/40 font-mono">
                    Modify Snort/Suricata rules to block malicious system calls, SNMP probes, or out-of-bounds TFTP patches.
                  </p>
                </div>
                <ExportButton
                  id="btn-export-ids-rules"
                  label="Export Rules"
                  filenamePrefix="suricata_snort_ids_rules"
                  jsonData={{ engine: 'Suricata/Snort', timestamp: new Date().toISOString(), rules: idsRules }}
                  textReport={idsRules}
                  triggerToast={triggerToast}
                  size="xs"
                />
              </div>

              <div className="space-y-3 pt-2 font-mono text-xs">
                <div className="bg-black/30 border border-white/5 p-4 rounded space-y-2">
                  <label className="text-[9px] text-white/30 uppercase block font-bold">Suricata ruleset configuration</label>
                  <textarea
                    value={idsRules}
                    onChange={(e) => setIdsRules(e.target.value)}
                    rows={4}
                    className="w-full bg-[#0C0C10] border border-white/5 p-2.5 rounded text-zinc-300 font-mono text-[11px] focus:outline-none focus:border-[#00f0ff] resize-none"
                  />
                  
                  <button
                    onClick={() => {
                      triggerToast('🛡️ Suricata IDS rules updated successfully.');
                    }}
                    className="px-4 py-2 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/30 text-[#00f0ff] font-bold uppercase rounded transition-all cursor-pointer text-[10px]"
                  >
                    Apply Rules to Ground Receiver
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 12. NSA Compliance */}
          {activeTab === 'compliance' && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xs text-white uppercase tracking-wider font-mono font-semibold">
                    🔒 NSA Ground-Station Security Compliance & Hardening Check
                  </h3>
                  <p className="text-[10px] text-white/40 font-mono">
                    Verifies configuration bounds matching real-world space telemetry transport frameworks.
                  </p>
                </div>
                <ExportButton
                  id="btn-export-nsa-compliance"
                  label="Export Audit"
                  filenamePrefix="nsa_hardening_compliance_audit"
                  jsonData={{
                    standard: "NSA Ground-Station Hardening",
                    overall_score: 100,
                    status: "100% SECURE",
                    timestamp: new Date().toISOString(),
                    controls: [
                      { code: "NSA-HARDENING-01", name: "SNMPv3 Access Controls", status: "COMPLIANT (100%)" },
                      { code: "NSA-HARDENING-02", name: "Secure HTTPS Enforcer Loop", status: "COMPLIANT (100%)" },
                      { code: "NSA-HARDENING-03", name: "VLAN Segmentation Gateway", status: "COMPLIANT (100%)" },
                      { code: "NSA-HARDENING-04", name: "Firmware Block Signature Checks", status: "COMPLIANT (100%)" }
                    ]
                  }}
                  csvData={[
                    { code: "NSA-HARDENING-01", name: "SNMPv3 Access Controls", status: "COMPLIANT (100%)" },
                    { code: "NSA-HARDENING-02", name: "Secure HTTPS Enforcer Loop", status: "COMPLIANT (100%)" },
                    { code: "NSA-HARDENING-03", name: "VLAN Segmentation Gateway", status: "COMPLIANT (100%)" },
                    { code: "NSA-HARDENING-04", name: "Firmware Block Signature Checks", status: "COMPLIANT (100%)" }
                  ]}
                  textReport={`=== NSA GROUND-STATION HARDENING AUDIT ===\nStandard: NSA Aerospace Ground Control Directive\nAudit Score: 100% Compliant\nTimestamp: ${new Date().toISOString()}\n\nControls Checklist:\n[✓] NSA-HARDENING-01: SNMPv3 Access Controls - COMPLIANT (100%)\n[✓] NSA-HARDENING-02: Secure HTTPS Enforcer Loop - COMPLIANT (100%)\n[✓] NSA-HARDENING-03: VLAN Segmentation Gateway - COMPLIANT (100%)\n[✓] NSA-HARDENING-04: Firmware Block Signature Checks - COMPLIANT (100%)\n\nDISPOSITION: APPROVED FOR ORBITAL GROUND UPLINK TELEMETRY`}
                  triggerToast={triggerToast}
                  size="xs"
                />
              </div>

              <div className="bg-black/30 border border-white/5 p-4 rounded space-y-4 font-mono text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-[10px] text-white/40 uppercase font-bold">Audit Param</span>
                  <span className="text-[10px] text-white/40 uppercase font-bold">Fidelity State</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">NSA-HARDENING-01 (SNMPv3 Access Controls)</span>
                    <span className="text-emerald-400 font-bold">COMPLIANT (100%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">NSA-HARDENING-02 (Secure HTTPS Enforcer Loop)</span>
                    <span className="text-emerald-400 font-bold">COMPLIANT (100%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">NSA-HARDENING-03 (VLAN Segmentation Gateway)</span>
                    <span className="text-emerald-400 font-bold">COMPLIANT (100%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">NSA-HARDENING-04 (Firmware Block Signature Checks)</span>
                    <span className="text-emerald-400 font-bold">COMPLIANT (100%)</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                  <span className="text-[10px] text-[#00f0ff] font-bold">TOTAL SUITE COMPLIANCE:</span>
                  <span className="text-emerald-400 font-bold text-sm">100% SECURE</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
