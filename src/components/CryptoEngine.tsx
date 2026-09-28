import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Key, 
  ShieldAlert, 
  Cpu, 
  Network, 
  CheckCircle, 
  Info, 
  RefreshCw, 
  Download,
  Lock,
  Unlock,
  Gauge,
  Terminal,
  Zap,
  BarChart3,
  Hourglass,
  Sparkles,
  Scale
} from 'lucide-react';
import ExportButton from './ExportButton';

interface CryptoEngineProps {
  primeG?: string;
  setPrimeG?: (val: string) => void;
  baseP?: string;
  setBaseP?: (val: string) => void;
  derivedKeyAlice?: string;
  setDerivedKeyAlice?: (val: string) => void;
  alicePrivate?: number;
  setAlicePrivate?: (val: number) => void;
  bobPrivate?: number;
  setBobPrivate?: (val: number) => void;
  triggerToast?: (msg: string) => void;
  onNavigateToSmt?: () => void;
}

export default function CryptoEngine({
  primeG: propPrimeG,
  setPrimeG: propSetPrimeG,
  baseP: propBaseP,
  setBaseP: propSetBaseP,
  derivedKeyAlice: propDerivedKeyAlice,
  setDerivedKeyAlice: propSetDerivedKeyAlice,
  alicePrivate: propAlicePrivate,
  setAlicePrivate: propSetAlicePrivate,
  bobPrivate: propBobPrivate,
  setBobPrivate: propSetBobPrivate,
  triggerToast,
  onNavigateToSmt
}: CryptoEngineProps = {}) {
  // Diffie-Hellman Handshake States
  const [localPrimeG, setLocalPrimeG] = useState<string>('997');
  const [localBaseP, setLocalBaseP] = useState<string>('5');
  const [localAlicePrivate, setLocalAlicePrivate] = useState<number>(14);
  const [localBobPrivate, setLocalBobPrivate] = useState<number>(23);
  const [localDerivedKeyAlice, setLocalDerivedKeyAlice] = useState<string>('');

  const primeG = propPrimeG !== undefined ? propPrimeG : localPrimeG;
  const setPrimeG = propSetPrimeG || setLocalPrimeG;
  const baseP = propBaseP !== undefined ? propBaseP : localBaseP;
  const setBaseP = propSetBaseP || setLocalBaseP;
  const alicePrivate = propAlicePrivate !== undefined ? propAlicePrivate : localAlicePrivate;
  const setAlicePrivate = propSetAlicePrivate || setLocalAlicePrivate;
  const bobPrivate = propBobPrivate !== undefined ? propBobPrivate : localBobPrivate;
  const setBobPrivate = propSetBobPrivate || setLocalBobPrivate;
  const derivedKeyAlice = propDerivedKeyAlice !== undefined ? propDerivedKeyAlice : localDerivedKeyAlice;
  const setDerivedKeyAlice = propSetDerivedKeyAlice || setLocalDerivedKeyAlice;

  const [alicePublic, setAlicePublic] = useState<number | null>(null);
  const [bobPublic, setBobPublic] = useState<number | null>(null);
  const [sharedSecretAlice, setSharedSecretAlice] = useState<number | null>(null);
  const [sharedSecretBob, setSharedSecretBob] = useState<number | null>(null);
  const [derivedKeyBob, setDerivedKeyBob] = useState<string>('');
  const [steps, setSteps] = useState<string[]>([]);

  // Cryptographic Strength Calculator States
  const [calcKey, setCalcKey] = useState<string>('HKDF_PRK_SHA256_3b4f9a2e');
  const [crackConsoleLog, setCrackConsoleLog] = useState<string[]>([]);
  const [crackProgress, setCrackProgress] = useState<number>(0);
  const [isCrackingSim, setIsCrackingSim] = useState<boolean>(false);

  // Modular Exponentiation Math helper: (base^exp) % mod
  const powerMod = (base: number, exp: number, mod: number): number => {
    let res = 1;
    let b = base % mod;
    let e = exp;
    while (e > 0) {
      if (e % 2 === 1) {
        res = (res * b) % mod;
      }
      e = Math.floor(e / 2);
      b = (b * b) % mod;
    }
    return res;
  };

  // Pseudo SHA-256 HKDF simulated string for display
  const simulateHkdfHash = (secret: number, salt: string): string => {
    const combinedStr = `${secret}:${salt}`;
    let hash = 0;
    for (let i = 0; i < combinedStr.length; i++) {
      hash = (hash << 5) - hash + combinedStr.charCodeAt(i);
      hash |= 0;
    }
    return 'HKDF_PRK_SHA256_' + Math.abs(hash).toString(16).padEnd(8, '4') + 'a8c7e9f2b1d30f4e';
  };

  const handleComputeDh = () => {
    const g = parseInt(primeG) || 997;
    const p = parseInt(baseP) || 5;
    const list: string[] = [];

    list.push(`[*] Initiating ephemeral cryptographic DH handshake using parameters: Prime G = ${g}, Generator P = ${p}.`);

    // Calculate Public Keys
    const pubA = powerMod(p, alicePrivate, g);
    setAlicePublic(pubA);
    list.push(`[+] Alice public key computed: A = P^a % G => ${p}^${alicePrivate} % ${g} = ${pubA}.`);

    const pubB = powerMod(p, bobPrivate, g);
    setBobPublic(pubB);
    list.push(`[+] Bob public key computed: B = P^b % G => ${p}^${bobPrivate} % ${g} = ${pubB}.`);

    // Swap and Compute Secrets
    const secretA = powerMod(pubB, alicePrivate, g);
    setSharedSecretAlice(secretA);
    list.push(`[+] Alice calculates Shared Secret: S_alice = B^a % G => ${pubB}^${alicePrivate} % ${g} = ${secretA}.`);

    const secretB = powerMod(pubA, bobPrivate, g);
    setSharedSecretBob(secretB);
    list.push(`[+] Bob calculates Shared Secret: S_bob = A^b % G => ${pubA}^${bobPrivate} % ${g} = ${secretB}.`);

    // HKDF salt expansion
    const salt = "HKDF_SALT_AEGIS_CRYPTO_SUITE";
    const keyA = simulateHkdfHash(secretA, salt);
    const keyB = simulateHkdfHash(secretB, salt);

    setDerivedKeyAlice(keyA);
    setDerivedKeyBob(keyB);
    list.push(`[*] Executing HKDF key expansion over shared secrets...`);
    list.push(`[✓] Symmetric key derived successfully: ${keyA}`);

    setSteps(list);
  };

  const loadSecurePrimes = () => {
    setPrimeG('3571'); // Safe prime
    setBaseP('11');   // Safe generator
    setAlicePrivate(127);
    setBobPrivate(211);
    setSteps([]);
    setAlicePublic(null);
    setBobPublic(null);
    setSharedSecretAlice(null);
    setSharedSecretBob(null);
    setDerivedKeyAlice('');
    setDerivedKeyBob('');
  };

  const handleExportDhSession = () => {
    const payload = {
      module_name: "Diffie-Hellman Key Exchange",
      modulus_prime_p: primeG,
      generator_base_g: baseP,
      alice_private_secret: alicePrivate,
      bob_private_secret: bobPrivate,
      alice_public_key: alicePublic,
      bob_public_key: bobPublic,
      shared_secret_alice: sharedSecretAlice,
      shared_secret_bob: sharedSecretBob,
      derived_key_alice: derivedKeyAlice,
      derived_key_bob: derivedKeyBob,
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aegis_crypto_dh_session_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    if (triggerToast) {
      triggerToast("DH cryptographic exchange logs successfully exported.");
    }
  };

  // Shannon Entropy Calculator
  const entropyValue = useMemo(() => {
    if (!calcKey) return 0;
    const len = calcKey.length;
    const freqs: Record<string, number> = {};
    for (let i = 0; i < len; i++) {
      const char = calcKey[i];
      freqs[char] = (freqs[char] || 0) + 1;
    }
    let ent = 0;
    for (const char in freqs) {
      const p = freqs[char] / len;
      ent -= p * Math.log2(p);
    }
    return parseFloat(ent.toFixed(3));
  }, [calcKey]);

  // Keyspace size and pool complexity calculation
  const keyDiversity = useMemo(() => {
    let pool = 0;
    let hasLower = false;
    let hasUpper = false;
    let hasNum = false;
    let hasSpecial = false;

    if (/[a-z]/.test(calcKey)) { pool += 26; hasLower = true; }
    if (/[A-Z]/.test(calcKey)) { pool += 26; hasUpper = true; }
    if (/[0-9]/.test(calcKey)) { pool += 10; hasNum = true; }
    if (/[^a-zA-Z0-9]/.test(calcKey)) { pool += 32; hasSpecial = true; }

    if (pool === 0) pool = 2; // minimum boundary

    const length = calcKey.length;
    // Bits depth = length * log2(pool size)
    const totalBits = Math.round(length * Math.log2(pool));

    return {
      poolSize: pool,
      totalBits,
      hasLower,
      hasUpper,
      hasNum,
      hasSpecial
    };
  }, [calcKey]);

  // Estimated brute-force cracking difficulty benchmarks
  const crackSimulations = useMemo(() => {
    const bits = keyDiversity.totalBits;
    if (bits === 0) return [];

    const durationToString = (totalSeconds: number): string => {
      if (totalSeconds < 1) return '< 1 millisecond';
      if (totalSeconds < 60) return `${totalSeconds.toFixed(2)} seconds`;
      const mins = totalSeconds / 60;
      if (mins < 60) return `${mins.toFixed(1)} minutes`;
      const hours = mins / 60;
      if (hours < 24) return `${hours.toFixed(1)} hours`;
      const days = hours / 24;
      if (days < 365) return `${days.toFixed(0)} days`;
      const years = days / 365;
      if (years < 1000) return `${years.toExponential(2)} years`;
      if (years < 1e9) return `${(years / 1e6).toFixed(1)} million years`;
      if (years < 1e12) return `${(years / 1e9).toFixed(2)} billion years`;
      return 'Infinity (Transcends age of known universe)';
    };

    // GPU Botnet hashrate: 100 Billion tries/sec (1e11)
    const gpuSec = Math.pow(2, Math.min(bits, 200)) / 1e11;
    // ASIC farm: 1 Quadrillion tries/sec (1e15)
    const asicSec = Math.pow(2, Math.min(bits, 200)) / 1e15;
    // Quantum Grover Coherence logic collapse (effective keyspace is sqrt of 2^bits => 2^(bits / 2) keys)
    const quantumSec = Math.pow(2, Math.min(bits / 2, 200)) / 1e10;

    return [
      {
        name: "RTX-4090 Botnet Array (8x Cluster)",
        hashrate: "100 GH/s / 10¹¹ hashes/s",
        time: durationToString(gpuSec),
        vulnerable: gpuSec < 3600 * 24 * 7, // warn if under 1 week
        color: "text-amber-400"
      },
      {
        name: "NSA Supercomputer (Distributed ASIC Cluster)",
        hashrate: "1 PH/s / 10¹⁵ hashes/s",
        time: durationToString(asicSec),
        vulnerable: asicSec < 3600 * 24 * 30, // warn if under 1 month
        color: "text-rose-400"
      },
      {
        name: "Quantum Shor/Grover Coprocessor Unit (Simulated)",
        hashrate: "Coherent Grover quadratic collapse: √2ⁿ",
        time: durationToString(quantumSec),
        vulnerable: quantumSec < 3600 * 24 * 365, // warn if under 1 year
        color: "text-purple-400"
      }
    ];
  }, [keyDiversity]);

  // Overall key score label metrics
  const keyGrade = useMemo(() => {
    const entropy = entropyValue;
    const bits = keyDiversity.totalBits;
    if (bits === 0) return { label: "EMPTY_BUFFER", level: "critical", color: "text-rose-500 border-rose-500/20 bg-rose-500/5", desc: "No key material specified" };
    
    // Total effective bits combines length and character-level entropy to prevent false negatives for high-security keys
    const effectiveBits = Math.min(bits, Math.round(calcKey.length * entropy));

    if (effectiveBits < 40) {
      return { label: "CRITICAL COLLAPSE VULNERABILITY", level: "critical", color: "text-rose-500 border-rose-500/20 bg-rose-500/5", desc: "Trivial dictionary brute force threat detected. Key exhibits low complexity patterns." };
    }
    if (effectiveBits < 80) {
      return { label: "MEDIUM EXPLOIT BOUNDARY", level: "warning", color: "text-amber-500 border-amber-500/20 bg-amber-500/5", desc: "Susceptible to specialized GPU cracking rigs within days. Strongly encourage longer key material or HKDF salt expansion." };
    }
    if (effectiveBits < 128) {
      return { label: "ROBUST SECURE POSTURE", level: "secure", color: "text-[#00f0ff] border-[#00f0ff]/20 bg-[#00f0ff]/5", desc: "Highly secure symmetrical entropy profile. Out of reach of present-day supercomputers." };
    }
    return { label: "QUANTUM AIRGAP CONFIDENTIALITY", level: "military", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5", desc: "Optimal cryptographic high-entropy configuration. Fully aligned with secure military-grade confidentiality templates." };
  }, [entropyValue, keyDiversity, calcKey]);

  // Interactive Bruteforce terminal simulation
  const handleCrackSimulationRun = () => {
    if (isCrackingSim) return;
    setIsCrackingSim(true);
    setCrackProgress(0);
    setCrackConsoleLog([]);

    const logs: string[] = [];
    logs.push(`[*] Initializing tactical cracking simulator over target key: "${calcKey.substring(0, 32)}..."`);
    logs.push(`[*] Key metrics evaluated: Shannon Entropy = ${entropyValue}, Bit depth = ${keyDiversity.totalBits} bits.`);
    logs.push(`[*] Initializing 4-bit prefix check matrix sweeps...`);
    setCrackConsoleLog([...logs]);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      const progressPercent = Math.min(step * 10, 100);
      setCrackProgress(progressPercent);

      if (step === 2) {
        logs.push(`[>] Sweeping standard dictionary attack vector lookup arrays (0 / 10,000 top patterns matched)`);
        setCrackConsoleLog([...logs]);
      } else if (step === 4) {
        logs.push(`[>] Launching parallel multi-threaded GPU brute force kernels at 100 GH/s hashrate...`);
        setCrackConsoleLog([...logs]);
      } else if (step === 6) {
        const hex = Math.random().toString(16).substring(2, 10);
        logs.push(`[>] Searching space permutation: 0x${hex}... matching offset failure.`);
        setCrackConsoleLog([...logs]);
      } else if (step === 8) {
        logs.push(`[>] Character diversity pool space size: ${keyDiversity.poolSize} options - Total calculated keyspace entropy bits: ${keyDiversity.totalBits} bits`);
        setCrackConsoleLog([...logs]);
      } else if (step === 10) {
        clearInterval(interval);
        setIsCrackingSim(false);
        
        const vulnerabilityText = keyGrade.level === 'critical' || keyGrade.level === 'warning'
          ? `[⚡] SIMULATION CONCLUDED: KEY VIOLATED/COMPROMISED. Recommended mitigation: Use larger, secure DH primes or trigger HKDF hash elongation.`
          : `[🛡️] SIMULATION CONCLUDED: KEY SECURE. Exhaustive brute force failure. Keyspace requires ${crackSimulations[0]?.time || 'Infinity'} to completely exhaust.`;
        
        logs.push(vulnerabilityText);
        setCrackConsoleLog([...logs]);
        if (triggerToast) {
          triggerToast("Cryptographic cracking benchmark sweep concluded.");
        }
      }
    }, 380);
  };

  const handleGenerateAESKey = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+{}[]';
    let result = '';
    const length = 32;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    setCalcKey(result);
    if (triggerToast) {
      triggerToast("Generated randomized high-entropy symmetric AES-256 equivalent parameter.");
    }
  };

  return (
    <div id="crypto-engine-viewport" className="space-y-6 select-text">
      
      {/* FORMAL VERIFICATION SMT BANNER */}
      <div className="bg-[#0A0A0C]/80 border border-[#00f0ff]/30 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-[0_0_15px_rgba(0,240,255,0.06)]">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#00f0ff]/10 border border-[#00f0ff]/30 rounded text-[#00f0ff] mt-0.5">
            <Scale size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-serif font-light tracking-[0.2em] text-zinc-100 uppercase">
                SMT Formal Verification & Constant-Time Engine
              </h3>
              <span className="text-[8px] font-mono bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.5 rounded uppercase font-bold">
                Z3 / angr Solver Active
              </span>
            </div>
            <p className="text-[11px] font-mono text-white/50 mt-1 leading-relaxed">
              Prove mathematically that branch decisions and memory array accesses are completely independent of secret inputs, preventing timing side-channel attacks.
            </p>
          </div>
        </div>

        {onNavigateToSmt && (
          <button
            onClick={onNavigateToSmt}
            className="px-3 py-2 bg-[#00f0ff]/15 hover:bg-[#00f0ff] hover:text-black text-[#00f0ff] border border-[#00f0ff]/40 rounded text-[10px] font-mono font-bold uppercase tracking-widest transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            Launch SMT Solver Prover →
          </button>
        )}
      </div>

      {/* PERFECT FORWARD SECRECY (DIFFIE-HELLMAN) PANEL */}
      <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Key className="text-[#00f0ff] animate-pulse" size={16} />
            <h2 className="text-xs font-serif font-light tracking-[0.2em] text-zinc-100 uppercase">
              Perfect Forward Secrecy Key Exchange (Diffie-Hellman & HKDF)
            </h2>
          </div>

          <div className="flex gap-2.5">
            {derivedKeyAlice && (
              <ExportButton
                id="btn-export-crypto-section"
                label="Export Key Exchange"
                filenamePrefix="diffie_hellman_handshake_keys"
                jsonData={{
                  parameters: {
                    prime_g: primeG,
                    base_p: baseP,
                    alice_private: alicePrivate,
                    bob_private: bobPrivate,
                    alice_public: alicePublic,
                    bob_public: bobPublic
                  },
                  shared_secret_computed: sharedSecretAlice,
                  derived_symmetric_keys: {
                    alice_hkdf: derivedKeyAlice,
                    bob_hkdf: derivedKeyBob
                  },
                  handshake_log: steps,
                  timestamp: new Date().toISOString()
                }}
                csvData={[
                  { party: "Alice", private_val: alicePrivate, public_val: alicePublic, shared_secret: sharedSecretAlice, derived_hkdf_key: derivedKeyAlice },
                  { party: "Bob", private_val: bobPrivate, public_val: bobPublic, shared_secret: sharedSecretBob, derived_hkdf_key: derivedKeyBob }
                ]}
                textReport={`=== AEGIS PERFECT FORWARD SECRECY EXCHANGE ===\nPrime G: ${primeG}, Base Generator P: ${baseP}\nAlice Public: ${alicePublic}, Bob Public: ${bobPublic}\nShared Secret: ${sharedSecretAlice}\nDerived HKDF Symmetric Key: ${derivedKeyAlice}\nTimestamp: ${new Date().toISOString()}\n\nHandshake Trace:\n${steps.join('\n')}`}
                triggerToast={triggerToast}
                size="xs"
              />
            )}
            <button
              onClick={loadSecurePrimes}
              className="text-[9px] uppercase tracking-wider font-mono px-3 py-1.5 bg-black/40 text-white/50 border border-white/5 hover:border-white/10 hover:text-[#00f0ff] rounded cursor-pointer transition-colors flex items-center gap-1"
            >
              <RefreshCw size={10} /> Load Complex Primes
            </button>
          </div>
        </div>

        <div className="mb-4 text-[11px] font-mono leading-relaxed text-white/40 bg-black/30 p-4 rounded border border-white/5">
          <div className="flex items-center gap-1.5 text-[#00f0ff] font-bold uppercase mb-2 text-xs">
            <Info size={12} className="text-[#00f0ff]" /> Ephemeral Handshake Parameter Definitions
          </div>
          Diffie-Hellman allows two host endpoints to dynamically negotiate secret key material over a monitored public channel. An HKDF (HMAC-based Key Derivation Function) then translates this shared secret into strong cryptographic symmetric keys.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="space-y-4">
            <div className="border border-white/5 p-4 rounded bg-black/40 space-y-3">
              <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider pb-1.5 border-b border-white/5">
                Prime handshake coordinates
              </h3>

              <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
                <div>
                  <label className="block text-[10px] text-white/40 uppercase mb-1">HANDSHAKE PRIME G</label>
                  <input
                    type="number"
                    value={primeG}
                    onChange={(e) => setPrimeG(e.target.value)}
                    className="w-full bg-[#121214]/60 border border-white/5 rounded p-2 text-zinc-300 focus:outline-none focus:border-[#00f0ff]/50 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-white/40 uppercase mb-1">GENERATOR P</label>
                  <input
                    type="number"
                    value={baseP}
                    onChange={(e) => setBaseP(e.target.value)}
                    className="w-full bg-[#121214]/60 border border-white/5 rounded p-2 text-zinc-300 focus:outline-none focus:border-[#00f0ff]/50 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="border border-white/5 p-4 rounded bg-black/40 space-y-3">
              <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider pb-1.5 border-b border-white/5">
                EPHEMERAL SECRET INGREDIENTS
              </h3>

              <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
                <div>
                  <label className="block text-[10px] text-white/40 uppercase mb-1">ALICE PRIVATE COGNOMEN</label>
                  <input
                    type="number"
                    value={alicePrivate}
                    onChange={(e) => setAlicePrivate(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#121214]/60 border border-white/5 rounded p-2 text-zinc-300 focus:outline-none focus:border-[#00f0ff]/50 text-xs font-mono"
                  />
                  <span className="text-[9px] text-white/30 block mt-1">(never shared publicly)</span>
                </div>

                <div>
                  <label className="block text-[10px] text-white/40 uppercase mb-1">BOB PRIVATE COGNOMEN</label>
                  <input
                    type="number"
                    value={bobPrivate}
                    onChange={(e) => setBobPrivate(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#121214]/60 border border-white/5 rounded p-2 text-zinc-300 focus:outline-none focus:border-[#00f0ff]/50 text-xs font-mono"
                  />
                  <span className="text-[9px] text-white/30 block mt-1">(never shared publicly)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Steps console ledger */}
          <div className="border border-white/5 p-4 rounded bg-black/40 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider border-b border-white/5 pb-1.5 mb-2.5">
                Live Negotiation Ledger Logs
              </h3>
              <div className="bg-black/35 h-36 font-mono text-[10px] text-zinc-400 overflow-y-auto space-y-1.5 rounded p-2 border border-white/5 leading-relaxed select-text">
                {steps.length === 0 ? (
                  <div className="text-white/20 italic text-center py-10 leading-normal">
                    [*] Tap 'Initiate handshake' to trace active modular key derivations...
                  </div>
                ) : (
                  steps.map((st, i) => (
                    <div key={i} className={st.startsWith('[✓]') ? 'text-emerald-400 font-bold' : st.startsWith('[+]') ? 'text-[#00f0ff]' : 'text-white/40'}>
                      {st}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex justify-end">
              <button
                onClick={handleComputeDh}
                id="btn-dh-handshake"
                className="text-[10px] uppercase tracking-widest border border-[#00f0ff]/50 text-[#00f0ff] px-4 py-2 hover:bg-[#00f0ff] hover:text-black transition-all font-mono rounded shadow-[0_0_8px_rgba(0,240,255,0.1)] cursor-pointer"
              >
                Initiate ephem Handshake
              </button>
            </div>
          </div>
        </div>

        {derivedKeyAlice === derivedKeyBob && derivedKeyAlice !== '' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-950/10 border border-emerald-900/20 text-emerald-300 rounded-lg p-4 font-mono text-xs leading-relaxed"
          >
            <div className="flex items-center gap-1.5 font-bold uppercase mb-1.5 text-xs text-emerald-200">
              <CheckCircle size={15} /> Ephemeral Agreement established perfectly!
            </div>
            Alice and Bob successfully computed identical shared symmetric keys independently, without disclosing their private parameters.
            <div className="bg-black/40 border border-white/5 p-2.5 text-[11px] text-[#00f0ff] font-bold rounded mt-2.5 truncate font-mono flex items-center justify-between">
              <span className="truncate">Derived symmetric key: {derivedKeyAlice}</span>
              <button
                onClick={() => {
                  setCalcKey(derivedKeyAlice);
                  if (triggerToast) triggerToast("Negotiated key cloned successfully into Cracking Benchmarks.");
                }}
                className="ml-2 px-2.5 py-1 bg-[#00f0ff]/15 text-[#00f0ff] hover:bg-[#00f0ff] hover:text-black border border-[#00f0ff]/35 rounded text-[9px] uppercase cursor-pointer transition-all shrink-0 font-mono font-semibold"
              >
                Simulate Entropy Crack
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* SHANNON ENTROPY & CRYPTOGRAPHIC STRENGTH SIMULATOR */}
      <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5 space-y-5">
        
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-[#00f0ff]" size={15} />
            <h3 className="text-xs font-serif font-light tracking-[0.2em] text-zinc-100 uppercase">
              Cryptographic Strength & Cracking Simulation Benchmarks
            </h3>
          </div>
          <span className="flex items-center gap-1 text-[9px] font-mono font-bold bg-[#00f0ff]/10 border border-[#00f0ff]/25 text-[#00f0ff] px-2 py-0.5 rounded uppercase">
            <Sparkles size={9} /> Shannon Entropy Engine
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Inputs, Entropy math and metadata column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-white/40 uppercase font-mono tracking-wider">
                  Target Secret Key under audit
                </label>
                {derivedKeyAlice && (
                  <button
                    onClick={() => {
                      setCalcKey(derivedKeyAlice);
                      if (triggerToast) triggerToast("Negotiated symmetric key cloned successfully.");
                    }}
                    className="text-[9px] font-mono text-[#00f0ff] hover:underline cursor-pointer"
                  >
                    Load DH Derived Key
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={calcKey}
                  onChange={(e) => setCalcKey(e.target.value)}
                  placeholder="Insert secret token, key parameter or output hex digits..."
                  className="flex-grow bg-[#0D0D10]/80 border border-white/5 rounded px-3 py-2 text-zinc-300 focus:outline-none focus:border-[#00f0ff]/50 text-xs font-mono"
                />
                <button
                  onClick={handleGenerateAESKey}
                  className="px-2.5 py-2 bg-black/40 text-[9px] font-mono uppercase border border-white/10 hover:border-[#00f0ff]/45 hover:text-[#00f0ff] rounded transition-colors shrink-0 cursor-pointer"
                  title="Generate safe high entropy 256-bit token"
                >
                  AES256 Gen
                </button>
              </div>
            </div>

            {/* Symmetrical telemetry indicators */}
            <div className="bg-black/30 border border-white/5 rounded p-4 space-y-3.5 font-mono text-[10px]">
              <span className="text-[9px] text-white/30 uppercase tracking-widest block border-b border-white/[0.03] pb-1">
                KEY ENTROPY METRICS REPORT
              </span>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <div className="text-white/40 mb-0.5 uppercase text-[9px]">Calculated bits depth</div>
                  <div className="text-xs text-white font-bold">{keyDiversity.totalBits} Bits</div>
                </div>
                <div>
                  <div className="text-white/40 mb-0.5 uppercase text-[9px]">Buffer Char count</div>
                  <div className="text-xs text-white font-bold">{calcKey.length} Chars</div>
                </div>
              </div>

              {/* Entropy visual indicator */}
              <div className="space-y-1.5 pt-1.5">
                <div className="flex justify-between text-[9px]">
                  <span className="text-white/40 uppercase">Shannon Entropy score</span>
                  <span className="text-[#00f0ff] font-bold">{entropyValue} / 8.000 (Bits/Char)</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-[#00f0ff] h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((entropyValue / 8) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[9px] text-white/30 leading-normal leading-relaxed">
                  Identifies character sequence uniqueness. A rating closer to 8.0 bits confirms ideal high-entropy symmetric safety keys.
                </p>
              </div>

              {/* Pool diversity markers */}
              <div className="space-y-1 pt-1">
                <span className="text-white/40 text-[9px] uppercase tracking-wider block mb-1.5">Pool diversity index:</span>
                <div className="flex flex-wrap gap-1.5 text-[8px] font-bold uppercase">
                  <span className={`px-2 py-0.5 border rounded ${keyDiversity.hasLower ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-zinc-500/10 text-zinc-500 bg-black/20'}`}>
                    Lowercase (a-z)
                  </span>
                  <span className={`px-2 py-0.5 border rounded ${keyDiversity.hasUpper ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-zinc-500/10 text-zinc-500 bg-black/20'}`}>
                    Uppercase (A-Z)
                  </span>
                  <span className={`px-2 py-0.5 border rounded ${keyDiversity.hasNum ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-zinc-500/10 text-zinc-500 bg-black/20'}`}>
                    Digits (0-9)
                  </span>
                  <span className={`px-2 py-0.5 border rounded ${keyDiversity.hasSpecial ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-zinc-500/10 text-zinc-500 bg-black/20'}`}>
                    Symbols
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Cracking simulations benchmarks block */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            
            {/* Table of different cracking hardware setups */}
            <div className="border border-white/5 p-4 rounded bg-black/40 space-y-3.5">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">
                  Cracking Difficulty Rigs Benchmarks
                </span>
                <div className="flex items-center gap-2">
                  {keyGrade && (
                    <span className={`px-2 py-0.5 border text-[9px] font-mono uppercase tracking-wider rounded ${keyGrade.color}`}>
                      {keyGrade.label}
                    </span>
                  )}
                  {calcKey && (
                    <ExportButton
                      id="btn-export-crypto-audit"
                      label="Export Audit"
                      filenamePrefix="crypto_entropy_strength_audit"
                      jsonData={{
                        key_sample_truncated: calcKey.substring(0, 16) + '...',
                        shannon_entropy: entropyValue,
                        bits_depth: keyDiversity.totalBits,
                        pool_size: keyDiversity.poolSize,
                        character_count: calcKey.length,
                        security_rating: keyGrade.label,
                        recommendation: keyGrade.desc,
                        hardware_benchmarks: crackSimulations,
                        timestamp: new Date().toISOString()
                      }}
                      csvData={crackSimulations.map(s => ({
                        hardware_rig: s.name,
                        hashrate: s.hashrate,
                        time_to_crack: s.time,
                        vulnerable_under_1yr: s.vulnerable
                      }))}
                      textReport={`=== CRYPTOGRAPHIC STRENGTH & ENTROPY AUDIT ===\nKey Evaluated: ${calcKey.substring(0, 16)}...\nShannon Entropy: ${entropyValue} / 8.000 bits/char\nKey Bit Depth: ${keyDiversity.totalBits} bits\nSecurity Grade: ${keyGrade.label}\n\nHardware Exhaustion Benchmarks:\n${crackSimulations.map(s => `- ${s.name} (${s.hashrate}): ${s.time}`).join('\n')}\n\nVerdict: ${keyGrade.desc}`}
                      triggerToast={triggerToast}
                      size="xs"
                    />
                  )}
                </div>
              </div>

              {/* Simulated benchmarks comparison */}
              <div className="space-y-2 font-mono text-[10px]">
                {crackSimulations.map((rig, idx) => (
                  <div key={idx} className="flex justify-between items-start border-b border-white/[0.02] pb-2 last:border-0 last:pb-0">
                    <div>
                      <span className="text-zinc-300 font-bold block">{rig.name}</span>
                      <span className="text-[9px] text-white/30 uppercase tracking-tight block mt-0.5">{rig.hashrate}</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold block text-xs ${rig.vulnerable ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {rig.time}
                      </span>
                      <span className="text-[9px] text-white/25">Brute Force Time</span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[9px] text-zinc-500 font-mono leading-relaxed pt-1.5 border-t border-white/[0.03]">
                {keyGrade.desc}
              </p>
            </div>

            {/* Interactive simulated bruteforce ledger terminal style */}
            <div className="border border-white/5 p-4 rounded bg-[#060608] space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-[#00f0ff] font-mono text-[10px] uppercase font-bold">
                  <Terminal size={12} /> Active permuted crack sweep console
                </div>
                {crackProgress > 0 && (
                  <span className="font-mono text-[9px] text-[#00f0ff]">{crackProgress}% permutation exhausted</span>
                )}
              </div>

              <div className="bg-black/85 h-28 font-mono text-[10px] text-emerald-400/95 overflow-y-auto space-y-1.5 rounded p-2.5 border border-white/5 select-text custom-scrollbar">
                {crackConsoleLog.length === 0 ? (
                  <div className="text-white/25 italic text-center py-8">
                    [-] Press "Execute Brute-Force Simulation" below to evaluate encryption thresholds...
                  </div>
                ) : (
                  crackConsoleLog.map((log, index) => (
                    <div key={index} className={log.startsWith('[⚡]') ? 'text-rose-400' : log.startsWith('[🛡️]') ? 'text-emerald-400 font-bold' : log.startsWith('[*]') ? 'text-zinc-400' : 'text-emerald-500/80'}>
                      {log}
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-between items-center gap-3 pt-1">
                <div className="flex-1 bg-white/5 h-1 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${crackProgress}%` }}
                  />
                </div>
                <button
                  onClick={handleCrackSimulationRun}
                  disabled={isCrackingSim || !calcKey}
                  className="px-4 py-2 bg-black/40 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-[9px] uppercase tracking-widest font-mono rounded cursor-pointer transition-colors disabled:opacity-45 shrink-0"
                >
                  {isCrackingSim ? 'Cracking...' : 'Execute brute-force Simulation'}
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
