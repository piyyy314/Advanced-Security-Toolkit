import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Code2, 
  Terminal, 
  Binary, 
  Play, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  FileCode, 
  RotateCcw, 
  Cpu,
  Bookmark,
  Shield,
  HelpCircle,
  Copy
} from 'lucide-react';
import ExportButton from './ExportButton';

interface YaraCompilerProps {
  triggerToast?: (msg: string) => void;
}

// Predefined high-fidelity templates
const TEMPLATES = [
  {
    id: 'webshell',
    title: 'PHP Web Shell Backdoor',
    description: 'Detects stealth web shells featuring interactive eval, base64 payload execution, or nested post parameters.',
    code: `/*
================================================================================
Rule Name: suspicious_php_web_shell
Description: Scans file text for structural characteristics of dangerous PHP backdoors.
================================================================================
*/

rule suspicious_php_web_shell
{
  meta:
    description = "Stealth web backdoor detector"
    author = "Aegis Forensic Lab"
    threat_level = "High"
    cwe = "CWE-94 (Code Injection)"

  strings:
    $php_tag = "<?php" nocase
    $exec = "shell_exec" nocase
    $eval = "eval(" nocase
    $b64 = "base64_decode" nocase
    $post_param = "$_POST[" nocase

  condition:
    $php_tag and ($exec or $eval) and ($b64 or $post_param)
}`
  },
  {
    id: 'injection',
    title: 'Process Thread Injection',
    description: 'Intercepts user-mode Windows DLL binary injection hooks indicating thread context altering actions.',
    code: `/*
================================================================================
Rule Name: memory_injection_syscalls
Description: Matches imported kernel call sequences characteristic of thread stagers.
================================================================================
*/

rule memory_injection_syscalls
{
  meta:
    description = "Detects core virtual process memory loaders"
    author = "Aegis Binary Division"
    threat_level = "Critical"
    mitre_attck = "T1055 (Process Injection)"

  strings:
    $alloc1 = "VirtualAlloc" ascii
    $alloc2 = "VirtualProtect" ascii
    $write = "WriteProcessMemory" ascii
    $thread = "CreateRemoteThread" ascii
    $hook = "SetWindowsHookEx" ascii

  condition:
    3 of them
}`
  },
  {
    id: 'ransomware',
    title: 'Ransomware Cryptor Profile',
    description: 'Detects active local ransomware vectors deploying encryption hooks or ransom wide-string notes.',
    code: `/*
================================================================================
Rule Name: cryptor_key_ransomware
Description: Flags keying APIs coupled with text demanding payment to unlock assets.
================================================================================
*/

rule cryptor_key_ransomware
{
  meta:
    description = "Detects crypt-locking ransom payload markers"
    author = "Aegis Anti-Malware Pod"
    threat_level = "Critical"

  strings:
    $encrypt = "CryptEncrypt" ascii
    $decrypt = "CryptDecrypt" ascii
    $ransom_text1 = "your files have been encrypted" nocase
    $ransom_text2 = "read_me_ransom" nocase
    $locked_extension = ".locked" wide ascii

  condition:
    ($ransom_text1 or $ransom_text2) and (1 of ($encrypt, $decrypt, $locked_extension))
}`
  },
  {
    id: 'mz_pe',
    title: 'Embedded PE Multi-Header',
    description: 'Scans for nested binary deliverables (PE/MZ files inside scripts or host installers).',
    code: `/*
================================================================================
Rule Name: nested_portable_executable
Description: Identifies embedded PE binaries hidden downstream in other files.
================================================================================
*/

rule nested_portable_executable
{
  meta:
    description = "Nested DOS binary executables static signature"
    author = "Aegis Compiler Inspector"
    threat_level = "Medium"

  strings:
    $mz_hdr = "MZ" ascii
    $pe_stub = "This program cannot be run in DOS mode" ascii
    $pe_sig = "PE" ascii

  condition:
    $mz_hdr and $pe_sig and $pe_stub
}`
  }
];

export default function YaraCompiler({ triggerToast }: YaraCompilerProps) {
  const [activeRule, setActiveRule] = useState<string>(TEMPLATES[0].code);
  const [testPayload, setTestPayload] = useState<string>(`<?php
  // Aegis Test File Sample
  $auth_key = "a7d832b84eb2e3bc8fef9de3";
  $user_payload = $_POST["payload"];
  
  if (isset($user_payload)) {
      $decoded = base64_decode($user_payload);
      echo "Staging operational logs...";
      eval($decoded);
  }
?>`);
  
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'templates'>('editor');
  
  // Compiler Output State
  const [isCompiled, setIsCompiled] = useState<boolean>(true);
  const [compileErrors, setCompileErrors] = useState<string | null>(null);
  
  // Run Scan States
  const [scanResult, setScanResult] = useState<{
    scanned: boolean;
    threatDetected: boolean;
    matchedStrings: { name: string; criteria: string; firstMatchOffset: number; count: number }[];
    totalChecked: number;
    diagTimeMs: number;
  } | null>(null);

  // Auto compile rule syntax changes
  useEffect(() => {
    // Validate structural rule format roughly
    const ruleTrim = activeRule.trim();
    if (!ruleTrim) {
      setIsCompiled(false);
      setCompileErrors('Rule input is empty.');
      return;
    }

    if (!ruleTrim.includes('rule')) {
      setIsCompiled(false);
      setCompileErrors("YARA syntax error: Rule declaration starting with 'rule <name>' is required.");
      return;
    }

    if (!ruleTrim.includes('{') || !ruleTrim.includes('}')) {
      setIsCompiled(false);
      setCompileErrors("YARA syntax error: Enclosing scope '{ ... }' is omitted or mismatched.");
      return;
    }

    if (ruleTrim.includes('strings:') && !ruleTrim.includes('condition:')) {
      setIsCompiled(false);
      setCompileErrors("YARA semantics error: A 'condition:' block is required if strings are declared.");
      return;
    }

    setIsCompiled(true);
    setCompileErrors(null);
  }, [activeRule]);

  // Load a template
  const handleLoadTemplate = (code: string) => {
    setActiveRule(code);
    setActiveTab('editor');
    setScanResult(null);
    if (triggerToast) triggerToast('YARA rule template loaded successfully.');
    
    // Auto populate sample payload based on template choice
    const trimCode = code.toLowerCase();
    if (trimCode.includes('web_shell')) {
      setTestPayload(`<?php
  // Aegis Test File Sample
  $auth_key = "a7d832b84eb2e3bc8fef9de3";
  $user_payload = $_POST["payload"];
  
  if (isset($user_payload)) {
      $decoded = base64_decode($user_payload);
      echo "Staging operational logs...";
      eval($decoded);
  }
?>`);
    } else if (trimCode.includes('syscalls')) {
      setTestPayload(`// Windows DLL hook compiler output
#include <windows.h>
void stage_remote_inject() {
    LPVOID pMem = VirtualAlloc(NULL, 4096, MEM_COMMIT, PAGE_EXECUTE_READWRITE);
    WriteProcessMemory(GetCurrentProcess(), pMem, "ShellcodeRaw", 12, NULL);
    CreateRemoteThread(GetCurrentProcess(), NULL, 0, (LPTHREAD_START_ROUTINE)pMem, NULL, 0, NULL);
}`);
    } else if (trimCode.includes('ransomware')) {
      setTestPayload(`ALERT LOGS - ENDPOINT TARGETED
- Event: File System Mutator Thread Hooked
- Action: Write File handle triggered on "corporate_balance.xlsx.locked"
- System: Invocation of local CryptEncrypt cryptographic interface.`);
    } else if (trimCode.includes('nested_portable')) {
      setTestPayload(`00000000: 4D 5A 90 00 03 00 00 00  MZ......
00000040: 54 68 69 73 20 70 72 6F  This pro
00000048: 67 72 61 6D 20 63 61 6E  gram can
00000050: 6E 6F 74 20 62 65 20 72  not be r
00000058: 75 6E 20 69 6E 20 44 4F  un in DO
00000060: 53 20 6D 6F 64 65 2E 0D  S mode..
000000F0: 50 45 00 00 4C 01 03 00  PE..L...`);
    }
  };

  // Generate YARA rule using server Gemini API
  const handleAiSynthesis = async () => {
    if (!aiPrompt.trim()) {
      if (triggerToast) triggerToast('Rule requirement prompt is empty.');
      return;
    }

    setIsAiLoading(true);
    setScanResult(null);

    try {
      const response = await fetch('/api/gemini/generate-yara', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiPrompt })
      });

      const data = await response.json();
      if (data.success && data.text) {
        setActiveRule(data.text);
        setAiPrompt('');
        if (triggerToast) {
          triggerToast(
            data.model === 'offline-heuristics' 
              ? 'YARA compiler generated local fallback template.' 
              : 'Secure YARA rule compiled by Gemini AI.'
          );
        }
      } else {
        if (triggerToast) triggerToast('Error compiling secure prompt rule.');
      }
    } catch (e: any) {
      if (triggerToast) triggerToast(`Pipeline connection failed: ${e.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Local rule scanner evaluating matching strings & general condition
  const handleRunScan = () => {
    if (!isCompiled) {
      if (triggerToast) triggerToast('Evaluate aborted: compilation errors present.');
      return;
    }

    const startTime = Date.now();
    const payloadLower = testPayload.toLowerCase();

    // 1. Parse string declarations from YARA rule
    const stringLines = activeRule.split('\n');
    let insideStringsSection = false;
    const rulesDeclaredStrings: { name: string; searchVal: string; nocase: boolean; isHex: boolean }[] = [];

    stringLines.forEach(line => {
      const trimLine = line.trim();
      if (trimLine.startsWith('strings:')) {
        insideStringsSection = true;
        return;
      }
      if (trimLine.startsWith('condition:')) {
        insideStringsSection = false;
        return;
      }
      if (trimLine.startsWith('}') || trimLine.startsWith('meta:')) {
        insideStringsSection = false;
        return;
      }

      if (insideStringsSection && trimLine.startsWith('$')) {
        // Example match: $exec = "shell_exec" nocase
        // Or: $mz_hdr = { 4D 5A }
        const stringVarMatch = trimLine.match(/^\s*(\$[a-zA-Z0-9_]+)\s*=\s*(.*)$/);
        if (stringVarMatch) {
          const varName = stringVarMatch[1];
          const varConfig = stringVarMatch[2];

          const quoteMatch = varConfig.match(/^"([^"]+)"(.*)/);
          const hexMatch = varConfig.match(/^\{([^}]+)\}(.*)/);

          if (quoteMatch) {
            const rawVal = quoteMatch[1];
            const suffixConfig = quoteMatch[2].toLowerCase();
            const nocase = suffixConfig.includes('nocase');
            rulesDeclaredStrings.push({
              name: varName,
              searchVal: rawVal,
              nocase,
              isHex: false
            });
          } else if (hexMatch) {
            // Clean up hex spacing: "4D 5A" -> "4d5a"
            const hexCleanDigits = hexMatch[1].replace(/\s+/g, '').toLowerCase();
            rulesDeclaredStrings.push({
              name: varName,
              searchVal: hexCleanDigits,
              nocase: true,
              isHex: true
            });
          }
        }
      }
    });

    // 2. Perform matches on test payload
    const matches: { name: string; criteria: string; firstMatchOffset: number; count: number }[] = [];
    
    rulesDeclaredStrings.forEach(str => {
      let count = 0;
      let firstMatchOffset = -1;
      
      if (str.isHex) {
        // For hex matches, we convert hex string of target too
        // Convert ascii payload characters to hex string representation
        let payloadHex = "";
        for (let i = 0; i < testPayload.length; i++) {
          payloadHex += testPayload.charCodeAt(i).toString(16).padStart(2, '0');
        }
        payloadHex = payloadHex.toLowerCase();
        
        const idx = payloadHex.indexOf(str.searchVal);
        if (idx !== -1) {
          firstMatchOffset = Math.floor(idx / 2);
          // Simple count evaluation
          let pos = idx;
          while (pos !== -1) {
            count++;
            pos = payloadHex.indexOf(str.searchVal, pos + 1);
          }
        }
      } else {
        const needle = str.nocase ? str.searchVal.toLowerCase() : str.searchVal;
        const haystack = str.nocase ? payloadLower : testPayload;

        const idx = haystack.indexOf(needle);
        if (idx !== -1) {
          firstMatchOffset = idx;
          let pos = idx;
          while (pos !== -1) {
            count++;
            pos = haystack.indexOf(needle, pos + 1);
          }
        }
      }

      if (count > 0) {
        matches.push({
          name: str.name,
          criteria: str.isHex ? `{ ${str.searchVal.toUpperCase().replace(/(.{2})/g, '$1 ')} }` : `"${str.searchVal}"`,
          firstMatchOffset,
          count
        });
      }
    });

    // 3. Evaluate conditional rule matching (e.g. "any of them", "all of them", "3 of them")
    let conditionLineText = "";
    let isConditionSec = false;
    stringLines.forEach(line => {
      const trimLine = line.trim();
      if (trimLine.startsWith('condition:')) {
        isConditionSec = true;
        return;
      }
      if (isConditionSec) {
        if (trimLine.startsWith('}') || trimLine.includes('rule')) {
          isConditionSec = false;
        } else {
          conditionLineText += " " + trimLine;
        }
      }
    });
    conditionLineText = conditionLineText.trim().toLowerCase();

    // Core rule matching simulation logic
    let threatDetected = false;
    const totalDeclared = rulesDeclaredStrings.length;
    const matchedCount = matches.length;

    if (conditionLineText.includes('any of them')) {
      threatDetected = matchedCount > 0;
    } else if (conditionLineText.includes('all of them') || conditionLineText.includes('all of ($')) {
      threatDetected = matchedCount === totalDeclared && totalDeclared > 0;
    } else if (conditionLineText.match(/(\d+)\s+of\s+them/)) {
      const parts = conditionLineText.match(/(\d+)\s+of\s+them/);
      const reqCount = parts ? parseInt(parts[1], 10) : 1;
      threatDetected = matchedCount >= reqCount;
    } else {
      // General fallbacks parsing: if rule lists specific identifiers like ($php_tag and $exec)
      // We check if those exact variables matched
      let varsMatchedAll = true;
      let varsMatchedAny = false;

      rulesDeclaredStrings.forEach(str => {
        const isMatched = matches.some(m => m.name === str.name);
        if (conditionLineText.includes(str.name.toLowerCase())) {
          if (isMatched) varsMatchedAny = true;
          else varsMatchedAll = false;
        }
      });

      // Default evaluation: if specific logic, require compound components matching
      if (conditionLineText.includes('and')) {
        threatDetected = varsMatchedAll && matchedCount > 0;
      } else {
        threatDetected = varsMatchedAny;
      }
    }

    setScanResult({
      scanned: true,
      threatDetected,
      matchedStrings: matches,
      totalChecked: totalDeclared,
      diagTimeMs: Date.now() - startTime
    });

    if (triggerToast) {
      if (threatDetected) {
        triggerToast('⚠️ CRITICAL: YARA rules matched! Suspicious static patterns identified.');
      } else {
        triggerToast('✓ Scan completed successfully. Target payload is clean.');
      }
    }
  };

  const handleCopyRule = () => {
    navigator.clipboard.writeText(activeRule);
    if (triggerToast) triggerToast('YARA signature code copied to clipboard.');
  };

  return (
    <div className="bg-slate-950/40 backdrop-blur-md border border-white/5 rounded-lg p-6 space-y-6 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
      
      {/* Title & Description Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCode className="text-[#00f0ff]" size={18} />
            <span className="font-serif italic text-lg text-white">YARA Rule Compiler & Engine</span>
          </div>
          <p className="text-xs text-white/50 font-mono mt-1 leading-relaxed">
            Draft, compile, and run lightweight lexical malware triggers against test payloads.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-black/40 border border-white/5 p-1 rounded gap-1 self-start">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-1.5 rounded transition-all text-[11px] font-mono cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-semibold border border-[#00f0ff]/20'
                : 'text-white/40 hover:text-white/80'
            }`}
          >
            Signature Editor
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-3 py-1.5 rounded transition-all text-[11px] font-mono cursor-pointer ${
              activeTab === 'templates'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-semibold border border-[#00f0ff]/20'
                : 'text-white/40 hover:text-white/80'
            }`}
          >
            Intel Templates ({TEMPLATES.length})
          </button>
        </div>
      </div>

      {/* Templates Tab Showcase view */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((tpl) => (
            <div 
              key={tpl.id}
              className="bg-slate-950/40 border border-white/5 rounded p-4 hover:border-[#00f0ff]/30 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-serif italic text-white text-xs">{tpl.title}</span>
                  <span className="text-[9px] font-mono bg-white/5 text-white/40 px-1.5 py-0.5 rounded border border-white/5">Yara Rule</span>
                </div>
                <p className="text-[10px] text-white/40 font-mono leading-relaxed">{tpl.description}</p>
              </div>

              <button
                onClick={() => handleLoadTemplate(tpl.code)}
                className="mt-4 w-full py-1.5 bg-zinc-900 hover:bg-[#00f0ff] hover:text-black transition-all rounded font-mono text-[10px] font-bold border border-white/5 uppercase cursor-pointer"
              >
                Load Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Editor & Core Interaction View */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column - Code Editor & AI Panel */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            
            {/* Editor Top Control Bar */}
            <div className="flex justify-between items-center p-2.5 bg-black/40 border border-white/5 rounded-t-lg font-mono text-[10px] text-white/40">
              <span className="flex items-center gap-1.5">
                <Code2 size={11} className="text-[#00f0ff]" /> active_rule.yar
              </span>
              <div className="flex items-center gap-3">
                {isCompiled ? (
                  <span className="text-emerald-400 font-mono flex items-center gap-1">
                    <Check size={10} /> Syntax Valid
                  </span>
                ) : (
                  <span className="text-rose-400 font-mono flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={10} /> Errors Detected
                  </span>
                )}
                <ExportButton
                  id="btn-export-yara-rule"
                  label="Export Rule"
                  filenamePrefix="yara_custom_rule"
                  jsonData={{
                    rule_source: activeRule,
                    is_valid_syntax: isCompiled,
                    timestamp: new Date().toISOString()
                  }}
                  textReport={activeRule}
                  triggerToast={triggerToast}
                  size="xs"
                />
                <button
                  onClick={handleCopyRule}
                  className="hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                  title="Copy Rule Content"
                >
                  <Copy size={11} /> Copy
                </button>
              </div>
            </div>

            {/* Custom Interactive Text Area Editor */}
            <textarea
              className="w-full h-80 bg-black/50 border-x border-b border-white/5 rounded-b-lg p-4 font-mono text-[11px] leading-relaxed text-[#EDEDED] focus:outline-none focus:border-[#00f0ff]/35 resize-none shadow-inner"
              style={{ tabSize: 2 }}
              value={activeRule}
              onChange={(e) => setActiveRule(e.target.value)}
              placeholder="rule suspicious_malware_identity { meta: ... strings: ... condition: ... }"
              spellCheck={false}
            />

            {/* Syntax compilation panel message output */}
            {compileErrors && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] leading-relaxed rounded p-3 font-mono flex items-start gap-2">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold underline uppercase">Syntax Diagnostics Failed:</span> {compileErrors}
                </div>
              </div>
            )}

            {/* AI Rule Synthesizer Console Panel */}
            <div className="bg-slate-950/40 border border-white/5 rounded p-4 space-y-3.5">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="text-[#00f0ff]/80 uppercase tracking-widest font-serif italic flex items-center gap-1.5">
                  <Sparkles size={11} /> AI Rule Synthesizer
                </span>
                <span className="text-white/20">Gemini-3.5 Secure Draftsman</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-black/50 border border-white/5 rounded px-3 py-2 font-mono text-[10px] text-white focus:outline-none focus:border-[#00f0ff]/30"
                  placeholder="e.g. Detect double PE headers, stealth webshell injection commands, or custom API loading..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                     if (e.key === 'Enter') handleAiSynthesis();
                  }}
                  disabled={isAiLoading}
                />
                <button
                  type="button"
                  onClick={handleAiSynthesis}
                  disabled={isAiLoading || !aiPrompt.trim()}
                  className="px-4 py-2 bg-[#00f0ff]/15 border border-[#00f0ff]/30 hover:bg-[#00f0ff] hover:text-black transition-all rounded text-[10px] font-mono font-bold flex items-center gap-1.5 hover:cursor-pointer disabled:opacity-30 disabled:pointer-events-none text-[#00f0ff]"
                >
                  {isAiLoading ? (
                    <RefreshCw className="animate-spin" size={12} />
                  ) : (
                    <Sparkles size={11} />
                  )}
                  Synthesize
                </button>
              </div>
            </div>

          </div>

          {/* Right Column - Target Sample Buffer Testing & Diagnostics */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            
            {/* Target Sample Area Label */}
            <div className="flex justify-between items-center bg-black/40 border border-white/5 rounded-t-lg p-2.5 font-mono text-[10px] text-white/40">
              <span className="flex items-center gap-1.5">
                <Terminal size={11} className="text-[#00f0ff]" /> Target Payload Sample
              </span>
              <span>ASCII Text Format Buffer</span>
            </div>

            <textarea
              className="w-full h-44 bg-black/50 border-x border-b border-white/5 rounded-b-lg p-4 font-mono text-[11px] leading-relaxed text-[#EDEDED] focus:outline-none focus:border-[#00f0ff]/35 resize-none shadow-inner"
              value={testPayload}
              onChange={(e) => {
                setTestPayload(e.target.value);
                setScanResult(null);
              }}
              placeholder="Paste or write sample contents here to scan and evaluate your YARA matches..."
              spellCheck={false}
            />

            {/* Run Action Trigger Controls */}
            <button
              onClick={handleRunScan}
              disabled={!isCompiled}
              className="w-full py-3 bg-[#00f0ff] hover:bg-[#38f3ff] disabled:opacity-20 text-black rounded font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_24px_rgba(0,240,255,0.12)] disabled:pointer-events-none"
            >
              <Play size={13} fill="currentColor" /> Run Signature test
            </button>

            {/* Simulated Compile & Scan Result Diagnostic Output Terminal */}
            <div className="bg-[#0B0B0E] border border-white/5 rounded-lg p-4 space-y-3 shadow-md font-mono text-[10px]">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-white/30 uppercase tracking-widest font-serif italic text-[9px]">Scan Metrics Terminal</span>
                <div className="flex items-center gap-2">
                  {scanResult && (
                    <ExportButton
                      id="btn-export-yara-scan-result"
                      label="Export Diagnostics"
                      filenamePrefix="yara_signature_scan_diagnostics"
                      jsonData={{
                        rule: activeRule,
                        payload_sample: testPayload,
                        threat_detected: scanResult.threatDetected,
                        matched_count: scanResult.matchedStrings.length,
                        total_checked: scanResult.totalChecked,
                        eval_time_ms: scanResult.diagTimeMs,
                        matches: scanResult.matchedStrings,
                        timestamp: new Date().toISOString()
                      }}
                      csvData={scanResult.matchedStrings.map((m, i) => ({
                        match_id: i + 1,
                        identifier: m.name,
                        occurrences: m.count,
                        criteria: m.criteria,
                        first_offset: m.firstMatchOffset
                      }))}
                      textReport={`=== YARA SIGNATURE SCAN DIAGNOSTICS ===\nVerdict: ${scanResult.threatDetected ? '⚠️ SUSPICIOUS SECURITY THREAT DETECTED' : '✓ SIGNATURE TEST CLEAN'}\nMatched Criteria: ${scanResult.matchedStrings.length} of ${scanResult.totalChecked}\nEvaluation Time: ${(scanResult.diagTimeMs / 1000).toFixed(4)}s\nDate: ${new Date().toISOString()}\n\nMatches Log:\n${scanResult.matchedStrings.map(m => `- [${m.name}] count: ${m.count}, criteria: ${m.criteria}, offset: ${m.firstMatchOffset}`).join('\n')}`}
                      triggerToast={triggerToast}
                      size="xs"
                    />
                  )}
                  <span className="text-white/20">Local Signature Audit v1.2</span>
                </div>
              </div>

              {scanResult ? (
                <div className="space-y-3">
                  
                  {/* Executive Alert State */}
                  <div className={`p-3 rounded border flex items-center gap-3 ${
                    scanResult.threatDetected 
                      ? 'bg-rose-500/5 border-rose-500/20 text-rose-300' 
                      : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                  }`}>
                    <div className={`p-1 rounded ${scanResult.threatDetected ? 'bg-rose-500/15' : 'bg-emerald-500/15'}`}>
                      {scanResult.threatDetected ? (
                        <AlertTriangle size={14} className="animate-bounce" />
                      ) : (
                        <Shield size={14} />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-[10px] uppercase">
                        {scanResult.threatDetected ? '⚠️ SUSPICIOUS SECURITY THREAT DETECTED' : '✓ SIGNATURE TEST CLEAN'}
                      </div>
                      <div className="text-[9px] text-white/40 mt-0.5">
                        Matched {scanResult.matchedStrings.length} of {scanResult.totalChecked} registered string criteria markers.
                      </div>
                    </div>
                  </div>

                  {/* Matching String Markers List */}
                  {scanResult.matchedStrings.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-white/30 uppercase font-mono block text-[9px] tracking-wide">Detailed Matches Log:</span>
                      <div className="bg-black/50 border border-white/5 rounded p-2.5 max-h-36 overflow-y-auto space-y-2 divider-y divide-white/5">
                        {scanResult.matchedStrings.map((match, idx) => (
                          <div key={idx} className="flex flex-col text-[9px]">
                            <div className="flex justify-between font-mono">
                              <span className="text-[#00f0ff] font-bold">{match.name}</span>
                              <span className="text-white/30 font-bold">{match.count} instances</span>
                            </div>
                            <div className="flex justify-between text-white/40 mt-0.5">
                              <span>Criteria: <code className="text-zinc-300">{match.criteria}</code></span>
                              <span>First Match Index: <code className="text-white/60">{match.firstMatchOffset}</code></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Telemetry Statistics info */}
                  <div className="flex justify-between border-t border-white/5 pt-2 text-[9px] text-white/30">
                    <span>EVAL TIME: <code className="text-zinc-400">{(scanResult.diagTimeMs / 1000).toFixed(4)}s</code></span>
                    <span>ENCLAVE: <code className="text-zinc-400">Isolated Sandbox</code></span>
                  </div>

                </div>
              ) : (
                <div className="text-center py-6 text-white/20 flex flex-col items-center justify-center gap-1.5">
                  <Cpu size={18} className="text-white/10" />
                  <span>Rule test pipeline inactive.</span>
                  <span className="text-[9px]">Enter a target payload and run signature scan to inspect results.</span>
                </div>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
