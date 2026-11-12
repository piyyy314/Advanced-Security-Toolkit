import { useState, useMemo } from 'react';
import {
  Shield,
  ShieldAlert,
  Play,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import ExportButton from './ExportButton';

interface WafRule {
  id: string;
  name: string;
  category: string;
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  score: number;
  enabled: boolean;
}

interface WafEvaluation {
  ruleId: string;
  ruleName: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  score: number;
  matchedText: string;
}

interface WafRuleEngineProps {
  triggerToast?: (msg: string) => void;
}

const DEFAULT_RULES: WafRule[] = [
  {
    id: 'CRS-942100',
    name: 'SQL Injection Attack Detected',
    category: 'SQLi',
    pattern: "(\\bunion\\b\\s+\\bselect\\b|\\bor\\b\\s+1\\s*=\\s*1|';\\s*drop\\b|--\\s*$)",
    severity: 'high',
    score: 45,
    enabled: true
  },
  {
    id: 'CRS-930100',
    name: 'Path Traversal & LFI Probe',
    category: 'LFI',
    pattern: '(\\.\\./|\\.\\.\\\\|/etc/passwd|/etc/shadow|win\\.ini)',
    severity: 'high',
    score: 40,
    enabled: true
  },
  {
    id: 'CRS-932100',
    name: 'OS Command Injection Token',
    category: 'RCE',
    pattern: '(;\\s*(cat|nc|bash|sh|curl|wget)\\b|\\|\\|\\s*(id|whoami)|\\$\\(.*\\))',
    severity: 'high',
    score: 50,
    enabled: true
  },
  {
    id: 'CRS-941100',
    name: 'Cross-Site Scripting (XSS) Vector',
    category: 'XSS',
    pattern: '(<script\\b|onerror\\s*=|javascript:|<svg\\s+onload)',
    severity: 'medium',
    score: 30,
    enabled: true
  },
  {
    id: 'CRS-934100',
    name: 'Cloud Metadata SSRF Attempt',
    category: 'SSRF',
    pattern: '(169\\.254\\.169\\.254|metadata\\.google\\.internal|127\\.0\\.0\\.1:)',
    severity: 'high',
    score: 45,
    enabled: true
  }
];

const PAYLOAD_PRESETS: Array<{ label: string; method: string; uri: string; body: string }> = [
  {
    label: 'SQLi Union Probe',
    method: 'POST',
    uri: '/api/v1/telemetry/query?station=VSAT-04',
    body: '{"station_id": "1\' OR 1=1 UNION SELECT username, password_hash FROM operators--"}'
  },
  {
    label: 'Path Traversal + RCE',
    method: 'GET',
    uri: '/cgi-bin/diagnostics?log=../../../../etc/passwd; cat /etc/shadow',
    body: ''
  },
  {
    label: 'Metadata SSRF',
    method: 'POST',
    uri: '/api/v1/uplink/webhook',
    body: '{"callback": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"}'
  },
  {
    label: 'Clean Ground Telemetry',
    method: 'POST',
    uri: '/api/v1/telemetry/ingest',
    body: '{"station": "VSAT-NORTH-02", "snr_db": 14.3, "doppler_hz": 3.8}'
  }
];

export default function WafRuleEngine({ triggerToast }: WafRuleEngineProps) {
  const [rules, setRules] = useState<WafRule[]>(DEFAULT_RULES);
  const [method, setMethod] = useState('POST');
  const [uri, setUri] = useState('/api/v1/telemetry/query?station=VSAT-04');
  const [headersText, setHeadersText] = useState('Host: ground-uplink.aegis.local\nUser-Agent: Mozilla/5.0\nContent-Type: application/json');
  const [bodyText, setBodyText] = useState('{"station_id": "1\' OR 1=1 UNION SELECT username, password_hash FROM operators--"}');

  // Custom rule creator state
  const [customName, setCustomName] = useState('');
  const [customPattern, setCustomPattern] = useState('');
  const [customSeverity, setCustomSeverity] = useState<'high' | 'medium' | 'low'>('medium');

  const evaluation = useMemo(() => {
    const combinedInput = `${method} ${uri}\n${headersText}\n${bodyText}`;
    const matches: WafEvaluation[] = [];
    let totalScore = 0;

    rules.forEach((rule) => {
      if (!rule.enabled) return;
      try {
        const regex = new RegExp(rule.pattern, 'i');
        const hit = regex.exec(combinedInput);
        if (hit) {
          matches.push({
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            score: rule.score,
            matchedText: hit[0]
          });
          totalScore += rule.score;
        }
      } catch {
        // Ignore invalid user regex syntax cleanly
      }
    });

    const cappedScore = Math.min(100, totalScore);
    const verdict: 'ALLOW' | 'CHALLENGE' | 'BLOCK' =
      cappedScore >= 40 ? 'BLOCK' : cappedScore >= 20 ? 'CHALLENGE' : 'ALLOW';

    return { matches, riskScore: cappedScore, verdict };
  }, [rules, method, uri, headersText, bodyText]);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customPattern.trim()) return;
    try {
      new RegExp(customPattern);
    } catch {
      if (triggerToast) triggerToast('Invalid regular expression pattern for WAF rule.');
      return;
    }

    const newRule: WafRule = {
      id: `CRS-CUST-${Math.floor(100 + Math.random() * 899)}`,
      name: customName.trim(),
      category: 'CUSTOM',
      pattern: customPattern.trim(),
      severity: customSeverity,
      score: customSeverity === 'high' ? 45 : customSeverity === 'medium' ? 25 : 15,
      enabled: true
    };
    setRules((prev) => [newRule, ...prev]);
    setCustomName('');
    setCustomPattern('');
    if (triggerToast) triggerToast(`Added custom WAF inspection rule: ${newRule.id}`);
  };

  return (
    <div className="bg-[#0A0A0C]/90 border border-white/5 rounded-lg shadow-[0_4px_30px_rgba(0,0,0,0.4)] overflow-hidden font-mono text-[11px]">
      {/* Header */}
      <div className="border-b border-white/5 bg-gradient-to-r from-black/80 to-[#101014] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 border border-[#00f0ff]/35 bg-[#00f0ff]/5 text-[#00f0ff] rounded-md">
            <Shield size={15} />
          </div>
          <div>
            <span className="text-[9px] tracking-widest text-[#00f0ff]/80 uppercase font-bold block">
              OWASP CRS / PROTOCOL INSPECTION
            </span>
            <h3 className="text-sm font-serif font-light text-zinc-100">
              Adaptive WAF &amp; Uplink Firewall Engine
            </h3>
          </div>
        </div>

        <ExportButton
          id="btn-export-waf-audit"
          label="Export WAF Audit"
          filenamePrefix="aegis_waf_inspection"
          jsonData={{
            module: 'Adaptive WAF & Protocol Firewall Engine',
            timestamp: new Date().toISOString(),
            request: { method, uri, headers: headersText, body: bodyText },
            verdict: evaluation.verdict,
            risk_score: evaluation.riskScore,
            matched_rules: evaluation.matches,
            active_rules_count: rules.filter((r) => r.enabled).length
          }}
          csvData={evaluation.matches.map((m) => ({
            rule_id: m.ruleId,
            category: m.category,
            severity: m.severity,
            score: m.score,
            matched_token: m.matchedText,
            rule_name: m.ruleName
          }))}
          textReport={`=== AEGIS WAF INSPECTION REPORT ===\nVerdict: ${evaluation.verdict} (Risk Score: ${evaluation.riskScore}/100)\nRequest: ${method} ${uri}\nMatched Rules (${evaluation.matches.length}):\n${evaluation.matches.map((m) => `- [${m.ruleId}] ${m.ruleName} (Token: ${m.matchedText})`).join('\n') || 'None'}`}
          triggerToast={triggerToast}
          size="xs"
        />
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Request Inspector */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] text-white/45 uppercase tracking-wider">
              Request Payload Inspector
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PAYLOAD_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setMethod(preset.method);
                    setUri(preset.uri);
                    setBodyText(preset.body);
                    if (triggerToast) triggerToast(`Loaded WAF test vector: ${preset.label}`);
                  }}
                  className="px-2 py-1 bg-white/5 hover:bg-[#00f0ff]/15 border border-white/10 hover:border-[#00f0ff]/35 rounded text-[9px] text-zinc-300 hover:text-[#00f0ff] transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="bg-black border border-white/10 rounded px-2.5 py-2 text-zinc-200 focus:border-[#00f0ff]/50 focus:outline-none"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
            <input
              type="text"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="/api/v1/..."
              className="sm:col-span-3 bg-black border border-white/10 rounded px-3 py-2 text-zinc-200 focus:border-[#00f0ff]/50 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] text-white/40 uppercase tracking-wider">HTTP Headers</label>
            <textarea
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
              rows={3}
              className="w-full bg-black border border-white/10 rounded p-2.5 text-zinc-300 focus:border-[#00f0ff]/50 focus:outline-none text-[10px]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] text-white/40 uppercase tracking-wider">Request Body / Uplink Frame</label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={3}
              className="w-full bg-black border border-white/10 rounded p-2.5 text-zinc-200 focus:border-[#00f0ff]/50 focus:outline-none text-[10px]"
            />
          </div>

          {/* Verdict Output Banner */}
          <div className="border border-white/10 bg-black/50 rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {evaluation.verdict === 'BLOCK' ? (
                  <ShieldAlert size={16} className="text-rose-400" />
                ) : evaluation.verdict === 'CHALLENGE' ? (
                  <AlertTriangle size={16} className="text-amber-400" />
                ) : (
                  <CheckCircle size={16} className="text-emerald-400" />
                )}
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                  WAF Verdict:{' '}
                  <span
                    className={
                      evaluation.verdict === 'BLOCK'
                        ? 'text-rose-400'
                        : evaluation.verdict === 'CHALLENGE'
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                    }
                  >
                    {evaluation.verdict}
                  </span>
                </span>
              </div>
              <span className="text-xs tabular-nums text-zinc-300">
                Anomaly Score: <strong>{evaluation.riskScore}</strong>/100
              </span>
            </div>

            {evaluation.matches.length === 0 ? (
              <p className="text-[10px] text-emerald-400/80">
                No signature violations triggered. Request permitted cleanly through ingress gateway.
              </p>
            ) : (
              <div className="space-y-2">
                {evaluation.matches.map((m) => (
                  <div
                    key={m.ruleId}
                    className="p-2.5 rounded border border-rose-500/25 bg-rose-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-[10px] font-bold text-rose-300">
                        [{m.ruleId}] {m.ruleName}
                      </div>
                      <div className="text-[9px] text-zinc-400 mt-0.5">
                        Matched token: <code className="text-amber-300 bg-black/60 px-1 rounded">{m.matchedText}</code>
                      </div>
                    </div>
                    <span className="text-[9px] tabular-nums text-rose-400 uppercase font-bold shrink-0">
                      +{m.score} pts ({m.category})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Rules & Custom Rule Builder */}
        <div className="lg:col-span-5 space-y-4">
          <div className="border border-white/5 bg-black/35 rounded p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] text-white/50 uppercase">
              <span>Active Detection Rules ({rules.filter((r) => r.enabled).length}/{rules.length})</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-2.5 rounded border border-white/5 bg-[#07070A] flex items-start justify-between gap-2"
                >
                  <label className="flex items-start gap-2 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() =>
                        setRules((prev) =>
                          prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
                        )
                      }
                      className="mt-0.5 accent-[#00f0ff] cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-[10px] text-zinc-200 font-semibold truncate">
                        {rule.id} · {rule.name}
                      </div>
                      <div className="text-[9px] text-white/35 truncate mt-0.5">
                        /{rule.pattern}/i
                      </div>
                    </div>
                  </label>
                  <button
                    type="button"
                    onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                    className="text-zinc-600 hover:text-rose-400 p-1 cursor-pointer"
                    title="Remove rule"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleAddRule}
            className="border border-white/5 bg-black/35 rounded p-3.5 space-y-2.5"
          >
            <div className="text-[10px] text-white/50 uppercase tracking-wider flex items-center gap-1.5">
              <Play size={10} className="text-[#00f0ff]" /> Register Custom WAF Rule
            </div>
            <input
              type="text"
              required
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Rule description (e.g. Block Debug Header)"
              className="w-full bg-black border border-white/10 rounded px-2.5 py-1.5 text-[10px] text-zinc-200 focus:border-[#00f0ff]/50 focus:outline-none"
            />
            <input
              type="text"
              required
              value={customPattern}
              onChange={(e) => setCustomPattern(e.target.value)}
              placeholder="Regex pattern (e.g. X-Debug-Bypass:\s*true)"
              className="w-full bg-black border border-white/10 rounded px-2.5 py-1.5 text-[10px] text-zinc-200 focus:border-[#00f0ff]/50 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <select
                value={customSeverity}
                onChange={(e) => setCustomSeverity(e.target.value as 'high' | 'medium' | 'low')}
                className="bg-black border border-white/10 rounded px-2 py-1.5 text-[10px] text-zinc-200 focus:outline-none"
              >
                <option value="high">High Severity (+45)</option>
                <option value="medium">Medium Severity (+25)</option>
                <option value="low">Low Severity (+15)</option>
              </select>
              <button
                type="submit"
                className="flex-1 py-1.5 bg-[#00f0ff]/15 hover:bg-[#00f0ff]/25 border border-[#00f0ff]/35 text-[#00f0ff] rounded text-[9.5px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus size={11} /> Add Rule
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
