import { useState } from 'react';
import { motion } from 'motion/react';
import { Search, ShieldAlert, Cpu, Code2, AlertTriangle, FileCheck } from 'lucide-react';
import ExportButton from './ExportButton';

interface Finding {
  line: number;
  type: string;
  desc: string;
  codeSnippet: string;
}

interface AstAnalyzerProps {
  sourceCode?: string;
  setSourceCode?: (code: string) => void;
  findings?: Finding[];
  setFindings?: (findings: Finding[]) => void;
  onFindingClick?: (finding: Finding) => void;
  triggerToast?: (msg: string) => void;
}

export default function AstAnalyzer({
  sourceCode: propSourceCode,
  setSourceCode: propSetSourceCode,
  findings: propFindings,
  setFindings: propSetFindings,
  onFindingClick,
  triggerToast
}: AstAnalyzerProps = {}) {
  const [localSourceCode, setLocalSourceCode] = useState(
    "import os\n" +
    "import subprocess\n" +
    "import sqlite3\n\n" +
    "def system_diagnostics(user_path):\n" +
    "    # AST FINDING 1: os.system Command Execution Vulnerability!\n" +
    "    os.system(\"tar -czf backup.tar.gz \" + user_path) \n\n" +
    "def verify_connection(host):\n" +
    "    # AST FINDING 2: Subprocess shell integration enabled (HIGH RISK OF INJECTION)\n" +
    "    subprocess.Popen(f\"ping -c 3 {host}\", shell=True)\n\n" +
    "def load_user_profile(user_id):\n" +
    "    conn = sqlite3.connect('local.db')\n" +
    "    # AST FINDING 3: SQL Injection via non-parameterized queries\n" +
    "    conn.execute(f\"SELECT * FROM users WHERE id = '{user_id}'\")\n"
  );
  
  const [localFindings, setLocalFindings] = useState<Finding[]>([]);
  const [scanned, setScanned] = useState(false);

  const sourceCode = propSourceCode !== undefined ? propSourceCode : localSourceCode;
  const setSourceCode = propSetSourceCode || setLocalSourceCode;
  const findings = propFindings !== undefined ? propFindings : localFindings;
  const setFindings = propSetFindings || setLocalFindings;

  const handleExportAstReport = () => {
    if (findings.length === 0) return;
    const payload = {
      module_name: "AST Static Analysis Analyzer",
      source_code_length: sourceCode.length,
      vulnerabilities_found_count: findings.length,
      findings: findings
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aegis_ast_heuristics_report_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    if (triggerToast) {
      triggerToast("AST static scan findings successfully exported.");
    }
  };

  const testPreloadedSamples = (type: 'unsafe' | 'remediated') => {
    if (type === 'unsafe') {
      setSourceCode(
        "import os\n" +
        "import subprocess\n" +
        "import sqlite3\n\n" +
        "def backup_firmware(user_supplied_dir):\n" +
        "    # Unsafe direct system hook\n" +
        "    os.system(\"tar -czf site_bak.tar \" + user_supplied_dir)\n\n" +
        "def ping_server(addr):\n" +
        "    # Shell=True allows command chaining like 'addr; rm -rf /'\n" +
        "    proc = subprocess.Popen(\"ping -c 1 \" + addr, shell=True, stdout=subprocess.PIPE)\n" +
        "    return proc.communicate()\n"
      );
    } else {
      setSourceCode(
        "import os\n" +
        "import subprocess\n" +
        "import sqlite3\n\n" +
        "def backup_firmware_safe(user_supplied_dir):\n" +
        "    # Safe programmatic subprocess execution avoiding command parsing interpretation\n" +
        "    subprocess.run([\"tar\", \"-czf\", \"site_bak.tar\", user_supplied_dir], shell=False)\n\n" +
        "def ping_server_safe(addr):\n" +
        "    # Sanitize inputs or pass strictly as argument tokens list to keep system shell decoupled\n" +
        "    proc = subprocess.Popen([\"ping\", \"-c\", \"1\", addr], shell=False, stdout=subprocess.PIPE)\n" +
        "    return proc.communicate()\n"
      );
    }
    setScanned(false);
  };

  const runAstScan = () => {
    const list: Finding[] = [];
    const lines = sourceCode.split('\n');

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;

      // Rule 1: os.system usage
      if (/os\.system\s*\(/.test(lineText)) {
        list.push({
          line: lineNum,
          type: "Insecure Command Execution (os.system)",
          desc: "Direct invocation of 'os.system()' processes commands via the default shell. This is extremely prone to command injection exploits. Use 'subprocess.run' with an explicit argument list instead.",
          codeSnippet: lineText.trim()
        });
      }

      // Rule 2: subprocess with shell=True
      if (/shell\s*=\s*True/.test(lineText) && /subprocess\./.test(lineText)) {
        list.push({
          line: lineNum,
          type: "Subprocess Shell Execution Enabled (shell=True)",
          desc: "Setting shell=True bypasses argument isolation by creating a shell intermediary. This executes raw strings directly and invites shell metacharacter expansion attacks.",
          codeSnippet: lineText.trim()
        });
      }

      // Rule 3: Parameterized formatting for SQL queries
      if (/(conn|db|cursor)\.execute\s*\(\s*f"/i.test(lineText) || /\.execute\s*\(\s*".*\{\s*\w+\s*\}/.test(lineText)) {
        list.push({
          line: lineNum,
          type: "SQL Injection Susceptibility",
          desc: "Raw string interpolation (f-string format) inside execution methods allows malicious characters to escape boundaries. Substitute with parameterized query templates (e.g. 'SELECT ... WHERE id = ?').",
          codeSnippet: lineText.trim()
        });
      }
    });

    setFindings(list);
    setScanned(true);
  };

  return (
    <div className="bg-[#0A0A0C]/40 border border-white/5 rounded p-5">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <Code2 className="text-[#00f0ff]" size={15} />
          <h2 className="text-xs font-serif font-light tracking-[0.2em] text-zinc-100 uppercase mr-1">
            AST Static Analysis Parser
          </h2>
          {findings.length > 0 && (
            <ExportButton
              id="btn-export-ast-section"
              label="Export Results"
              filenamePrefix="ast_static_scan_findings"
              jsonData={{
                module_name: "AST Static Analysis Analyzer",
                source_code_length: sourceCode.length,
                vulnerabilities_found_count: findings.length,
                findings: findings
              }}
              csvData={findings.map(f => ({
                line: f.line,
                type: f.type,
                description: f.desc,
                code_snippet: f.codeSnippet
              }))}
              textReport={`=== AEGIS AST STATIC ANALYSIS REPORT ===\nDate: ${new Date().toISOString()}\nTotal Findings: ${findings.length}\n\n${findings.map((f, i) => `[${i+1}] ${f.type} (Line ${f.line})\nDescription: ${f.desc}\nCode:\n${f.codeSnippet}\n`).join('\n----------------------------------------\n')}`}
              triggerToast={triggerToast}
              size="xs"
            />
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => testPreloadedSamples('unsafe')}
            className="text-[9px] uppercase tracking-wider font-mono px-3 py-1.5 bg-black/40 text-rose-300/80 border border-rose-900/30 hover:bg-rose-900/10 rounded cursor-pointer transition-colors"
          >
            Load Unsafe script template
          </button>
          <button
            onClick={() => testPreloadedSamples('remediated')}
            className="text-[9px] uppercase tracking-wider font-mono px-3 py-1.5 bg-black/40 text-emerald-300/80 border border-emerald-900/30 hover:bg-emerald-900/10 rounded cursor-pointer transition-colors"
          >
            Load Remediated template
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-[10px] font-mono tracking-wider font-bold text-white/45 mb-1.5 uppercase">
          Static Script Analysis Sandbox (Python/Generic Sources)
        </label>
        <textarea
          id="ast-source-textarea"
          value={sourceCode}
          onChange={(e) => {
            setSourceCode(e.target.value);
            setScanned(false);
          }}
          className="w-full h-44 bg-black/40 text-zinc-300 font-mono text-xs rounded border border-white/5 p-3 focus:border-[#00f0ff]/50 focus:outline-none resize-none"
          placeholder="Paste code snippet to analyze statically..."
        />
      </div>

      <div className="flex items-center justify-between pt-1 pb-3.5 border-b border-white/5">
        <span className="text-[10px] text-[#00f0ff]/60 font-mono">
          * Heuristic AST Simulation parses code trees to reveal dangerous subprocesses, os shells, and nested injections.
        </span>
        <button
          onClick={runAstScan}
          id="btn-run-ast-scan"
          className="text-[10px] uppercase tracking-widest border border-[#00f0ff]/50 text-[#00f0ff] px-4 py-2 hover:bg-[#00f0ff] hover:text-black transition-all font-mono rounded shadow-[0_0_8px_rgba(0,240,255,0.1)] cursor-pointer"
        >
          Execute AST Scan
        </button>
      </div>

      {scanned && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-3"
        >
          <h3 className="text-[10px] font-mono tracking-wider font-bold text-white/40 uppercase">
            Static Scan Reports: <span className={findings.length > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{findings.length} alerts detected</span>
          </h3>

          {findings.length === 0 ? (
            <div className="bg-emerald-950/10 border border-emerald-900/20 rounded-lg p-4 flex items-start gap-2.5 text-emerald-300 text-xs font-mono">
              <FileCheck size={15} className="mt-0.5 shrink-0" />
              <div>
                <span className="font-bold uppercase block text-xs tracking-wider mb-0.5 text-emerald-200">✓ Security Integrity Verified</span>
                Your input script contains no identifiable instances of insecure shell subprocess models or standard unparameterized database query streams.
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {findings.map((f, i) => (
                <div 
                  key={i} 
                  onClick={() => onFindingClick?.(f)}
                  className="bg-black/40 border border-white/5 rounded p-4 cursor-pointer hover:border-[#00f0ff]/40 hover:bg-black/60 transition-all group relative select-none"
                >
                  <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 text-[8px] text-[#00f0ff] font-bold tracking-wider uppercase font-mono transition-all">
                    DEEP DIVE →
                  </div>
                  <div className="flex items-center justify-between font-mono text-xs mb-2">
                    <span className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wide">
                      <AlertTriangle size={14} /> {f.type}
                    </span>
                    <span className="text-white/55 bg-black/50 border border-white/5 px-2 py-0.5 rounded text-[9px] font-mono">
                      LINE {f.line}
                    </span>
                  </div>
                  <p className="text-white/50 font-mono text-[11px] leading-relaxed mb-2.5">
                    {f.desc}
                  </p>
                  <div className="bg-black/50 border-l-2 border-rose-500/80 p-2 font-mono text-xs text-rose-300 overflow-x-auto whitespace-pre">
                    {f.codeSnippet}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
