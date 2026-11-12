/**
 * Aegis Security & Space Operations Export Utilities
 * Provides standardized multi-format export routines (JSON, CSV, Text/Markdown, PDF)
 * with direct file downloading and clipboard support.
 */
import { jsPDF } from 'jspdf';

export interface ExportDataPayload {
  title: string;
  filename?: string;
  jsonData: any;
  csvData?: Array<Record<string, any>> | string;
  textReport?: string;
}

export interface ForensicAstFindingExport {
  line: number | string;
  vulnerability_type: string;
  description_remediation: string;
  offending_signature: string;
}

export interface ForensicSignatureDetectionExport {
  buffer_offset: number | string;
  pattern_signature_catalog: string;
  matched_bytes_sequence: string;
}

export interface ForensicEbpfLogExport {
  event_id: string;
  timestamp_offset: string;
  process_id: number | string;
  parent_process_id: number | string;
  executable_name: string;
  invoked_system_call: string;
  syscall_arguments: string;
  governing_sandbox_action: string;
  incident_severity_classification: string;
}

export interface ForensicReportPayload {
  meta: {
    suite: string;
    version: string;
    exported_by: string;
    compiled_timestamp_utc: string;
    system_time: string;
    threat_posture_configured: string;
    uncompromising_defense_active: boolean;
    system_status_label?: string;
    auto_save_status?: string;
  };
  current_tool_viewing: string;
  real_time_statistics: {
    active_mitigations_count: number;
    shannon_entropy_bytes_scanned: number;
    shannon_entropy_peak_score: number;
    active_binary_selection: string;
    diffie_hellman_handshake_prime: string;
    diffie_hellman_handshake_generator: string;
    derived_ephemeral_key: string;
  };
  ast_static_scan: {
    checked_source_module_length: number;
    ast_heuristics_vulnerability_matches: ForensicAstFindingExport[];
  };
  signature_matching_ledger: {
    raw_hex_input_length_bytes: number;
    untrusted_hex_dump: string;
    malicious_signature_detections: ForensicSignatureDetectionExport[];
  };
  ebpf_kernel_execution_logs: ForensicEbpfLogExport[];
}

/**
 * Downloads a string as a file to the client browser
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Convert an array of objects into standard CSV format
 */
export function convertToCsv(data: Array<Record<string, any>>): string {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(obj => {
    return headers.map(header => {
      const val = obj[header];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Exports data as formatted JSON
 */
export function exportAsJson(data: any, defaultFilename: string = 'aegis_export.json'): void {
  const jsonStr = JSON.stringify(data, null, 2);
  downloadFile(jsonStr, defaultFilename, 'application/json;charset=utf-8;');
}

/**
 * Exports data as CSV
 */
export function exportAsCsv(
  data: Array<Record<string, any>> | string, 
  defaultFilename: string = 'aegis_export.csv'
): void {
  const csvContent = typeof data === 'string' ? data : convertToCsv(data);
  downloadFile(csvContent, defaultFilename, 'text/csv;charset=utf-8;');
}

/**
 * Exports data as a plain text or markdown report
 */
export function exportAsText(
  text: string, 
  defaultFilename: string = 'aegis_security_report.txt'
): void {
  downloadFile(text, defaultFilename, 'text/plain;charset=utf-8;');
}

/**
 * Copies content to the system clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    }
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}

/**
 * Sanitizes strings so built-in Type1 jsPDF fonts render cleanly without glyph artifacts
 */
function cleanPdfText(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[^\x20-\x7E\n]/g, '?');
}

/**
 * Generates a formal, multi-page Forensic Audit PDF report using jsPDF,
 * featuring an executive cover page with timestamp & system status followed by
 * structured summary, threat metrics, and full findings tables.
 */
export function exportForensicsPdf(
  payload: ForensicReportPayload,
  filename: string = `aegis_forensics_report_${new Date().toISOString().substring(0, 10)}.pdf`
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  const posture = (payload.meta.threat_posture_configured || 'LOW').toUpperCase();
  const statusLabel =
    payload.meta.system_status_label ||
    (posture === 'HIGH'
      ? 'MAXIMUM SHIELD ACTIVE'
      : posture === 'MEDIUM'
        ? 'ELEVATED AUDITING'
        : 'PASSIVE MONITORING');

  const statusColor: [number, number, number] =
    posture === 'HIGH'
      ? [220, 38, 38]
      : posture === 'MEDIUM'
        ? [217, 119, 6]
        : [22, 163, 74];

  const generatedIso = payload.meta.system_time || new Date().toISOString();
  const generatedUtcFormatted = `${generatedIso.replace('T', ' ').substring(0, 19)} UTC`;
  const generatedLocalFormatted = new Date(generatedIso).toLocaleString();

  // =========================================================================
  // PAGE 1: FORMAL COVER PAGE
  // =========================================================================
  // Top Navy Header Block
  doc.setFillColor(11, 17, 32); // #0B1120
  doc.rect(0, 0, pageWidth, 84, 'F');

  // Cyan Accent Divider Line
  doc.setFillColor(0, 180, 216);
  doc.rect(0, 84, pageWidth, 2, 'F');

  // Brand & Document Classification
  doc.setTextColor(0, 210, 240);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('AEGIS UNIFIED SECURITY SUITE  //  ENTERPRISE FORENSICS', margin, 22);

  // Main Report Title
  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(23);
  doc.text('FORENSIC SECURITY AUDIT', margin, 42);
  doc.text('& TELEMETRY REPORT', margin, 52);

  // Cover Subtitle
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    'Consolidated Kernel eBPF, AST Heuristic, Cryptographic & Malware Signature Ledger',
    margin,
    66
  );

  // Version Badge Text (plain clean border box, non-cluttered)
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, 72, 46, 6.5, 1, 1, 'S');
  doc.setTextColor(203, 213, 225);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text(cleanPdfText(payload.meta.version || 'v2.5.0-Enterprise'), margin + 3, 76.5);

  // System Status & Timestamp Panel
  let y = 100;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, y, contentWidth, 64, 1.5, 1.5, 'FD');

  // Left vertical status indicator bar inside metadata panel
  doc.setFillColor(...statusColor);
  doc.rect(margin, y, 2.5, 64, 'F');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SYSTEM STATUS & AUDIT METADATA', margin + 7, y + 10);

  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 7, y + 13.5, margin + contentWidth - 6, y + 13.5);

  const coverMetaRows: Array<[string, string, [number, number, number]?]> = [
    ['System Status:', `${statusLabel} (${posture} POSTURE)`, statusColor],
    ['Report Timestamp (UTC):', generatedUtcFormatted],
    ['Local Generation Time:', cleanPdfText(generatedLocalFormatted)],
    ['Uncompromising Defense:', payload.meta.uncompromising_defense_active ? 'ACTIVE (BLOCK ON INTERCEPT)' : 'STANDBY (MONITORING)'],
    ['Active Operator:', cleanPdfText(payload.meta.exported_by)],
    ['Active Audit Module:', cleanPdfText(payload.current_tool_viewing)],
    ['Target Binary Sample:', cleanPdfText(payload.real_time_statistics.active_binary_selection)],
    ['Persistence State:', cleanPdfText(payload.meta.auto_save_status || 'LocalStorage Active (60s)')],
  ];

  let metaY = y + 21;
  coverMetaRows.forEach(([label, value, accent]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(label, margin + 7, metaY);

    doc.setFont('courier', accent ? 'bold' : 'normal');
    doc.setFontSize(9);
    if (accent) {
      doc.setTextColor(...accent);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(cleanPdfText(value), margin + 56, metaY, { maxWidth: contentWidth - 62 });
    metaY += 5.4;
  });

  // Executive Findings Snapshot Grid on Cover Page
  y = 176;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('EXECUTIVE TELEMETRY SNAPSHOT', margin, y);

  y += 5;
  const kpis = [
    {
      label: 'ACTIVE MITIGATIONS',
      value: String(payload.real_time_statistics.active_mitigations_count),
      sub: 'Intercepted Kernel Events'
    },
    {
      label: 'AST VULNERABILITIES',
      value: String(payload.ast_static_scan.ast_heuristics_vulnerability_matches.length),
      sub: 'Static Heuristic Matches'
    },
    {
      label: 'SIGNATURE HITS',
      value: String(payload.signature_matching_ledger.malicious_signature_detections.length),
      sub: 'Malware Byte Patterns'
    },
    {
      label: 'PEAK ENTROPY',
      value: `${Number(payload.real_time_statistics.shannon_entropy_peak_score || 0).toFixed(3)}`,
      sub: 'Bits / Byte Ceiling'
    }
  ];

  const cardGap = 4;
  const cardW = (contentWidth - cardGap * 3) / 4;
  kpis.forEach((kpi, idx) => {
    const cx = margin + idx * (cardW + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(cx, y, cardW, 25, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, cx + 3, y + 6.5);

    doc.setFont('courier', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, cx + 3, y + 15.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, cx + 3, y + 21.5);
  });

  // Table of Contents / Document Scope
  y = 214;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('REPORT CONTENTS', margin, y);

  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y + 2.5, margin + contentWidth, y + 2.5);

  const tocItems = [
    ['01', 'Executive Summary & Defense Posture', 'System state, audit scope, and cryptographic enclave parameters'],
    ['02', 'Real-Time Threat & Entropy Metrics', 'Mitigations, Shannon entropy scan metrics, and DH key negotiation'],
    ['03', 'AST Static Security Findings', `${payload.ast_static_scan.ast_heuristics_vulnerability_matches.length} static heuristic vulnerability match(es)`],
    ['04', 'Malware Signature Matching Ledger', `${payload.signature_matching_ledger.malicious_signature_detections.length} binary pattern signature detection(s)`],
    ['05', 'eBPF Kernel Execution Telemetry Logs', `${payload.ebpf_kernel_execution_logs.length} intercepted or audited syscall event(s)`]
  ];

  let tocY = y + 9;
  tocItems.forEach(([num, title, desc]) => {
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 130, 170);
    doc.text(num, margin, tocY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin + 9, tocY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(desc, margin + 9, tocY + 4.2);

    tocY += 10.5;
  });

  // Cover Footer
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, pageHeight - 20, margin + contentWidth, pageHeight - 20);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CONFIDENTIAL // TLP:AMBER  -  GENERATED BY AEGIS UNIFIED SECURITY SUITE', margin, pageHeight - 13);

  // =========================================================================
  // CONTENT PAGES: HELPERS
  // =========================================================================
  let cursorY = margin;

  const drawContentHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 14, 'F');
    doc.setFillColor(0, 180, 216);
    doc.rect(0, 14, pageWidth, 0.7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(248, 250, 252);
    doc.text('AEGIS FORENSIC SECURITY AUDIT REPORT', margin, 9);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${statusLabel}  |  ${generatedUtcFormatted}`, pageWidth - margin, 9, { align: 'right' });

    cursorY = 23;
  };

  const addContentPage = () => {
    doc.addPage();
    drawContentHeader();
  };

  const ensureSpace = (neededMm: number) => {
    if (cursorY + neededMm > pageHeight - 20) {
      addContentPage();
    }
  };

  const drawSectionHeading = (num: string, title: string, subtitle?: string) => {
    ensureSpace(18);
    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 130, 170);
    doc.text(`SECTION ${num}`, margin, cursorY);

    cursorY += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, cursorY);

    if (subtitle) {
      cursorY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(cleanPdfText(subtitle), margin, cursorY);
    }

    cursorY += 3;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.line(margin, cursorY, margin + contentWidth, cursorY);
    cursorY += 6;
  };

  const drawKeyValueTable = (rows: Array<[string, string]>) => {
    const labelColW = 68;
    const valColW = contentWidth - labelColW - 6;

    rows.forEach(([key, val], idx) => {
      const wrappedVal = doc.splitTextToSize(cleanPdfText(val), valColW);
      const rowHeight = Math.max(7, wrappedVal.length * 4.2 + 3);
      ensureSpace(rowHeight + 1);

      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, cursorY - 4.2, contentWidth, rowHeight, 'F');
      }

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, cursorY + rowHeight - 4.2, margin + contentWidth, cursorY + rowHeight - 4.2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(cleanPdfText(key), margin + 2.5, cursorY);

      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(wrappedVal, margin + labelColW, cursorY);

      cursorY += rowHeight;
    });

    cursorY += 5;
  };

  // Start Page 2
  addContentPage();

  // =========================================================================
  // SECTION 1: EXECUTIVE SUMMARY & SYSTEM POSTURE
  // =========================================================================
  drawSectionHeading(
    '01',
    'Executive Summary & System Posture',
    'High-level assessment compiled from current active forensic sandboxes and telemetry logs'
  );

  const summaryParagraph =
    `This formal forensic audit report captures the operational security state of the ${payload.meta.suite} (${payload.meta.version}) ` +
    `at ${generatedUtcFormatted}. The active threat posture is configured to ${posture} (${statusLabel}), with ` +
    `${payload.real_time_statistics.active_mitigations_count} active mitigation(s) recorded, ` +
    `${payload.ast_static_scan.ast_heuristics_vulnerability_matches.length} AST static security vulnerability match(es), ` +
    `${payload.signature_matching_ledger.malicious_signature_detections.length} malware byte-signature detection(s), and ` +
    `${payload.ebpf_kernel_execution_logs.length} eBPF kernel syscall log entry/entries.`;

  const summaryLines = doc.splitTextToSize(cleanPdfText(summaryParagraph), contentWidth);
  ensureSpace(summaryLines.length * 4.5 + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(summaryLines, margin, cursorY);
  cursorY += summaryLines.length * 4.5 + 6;

  drawKeyValueTable([
    ['Suite / Release', `${payload.meta.suite} (${payload.meta.version})`],
    ['Exported By', payload.meta.exported_by],
    ['Compiled Reference Timestamp', payload.meta.compiled_timestamp_utc],
    ['Generation System Time (ISO)', payload.meta.system_time],
    ['Configured Threat Posture', posture],
    ['System Status Classification', statusLabel],
    ['Uncompromising Defense Mode', payload.meta.uncompromising_defense_active ? 'ENABLED (Active Enforcement)' : 'DISABLED (Standard Audit)'],
    ['Current Focused Module', payload.current_tool_viewing]
  ]);

  // =========================================================================
  // SECTION 2: REAL-TIME THREAT & CRYPTOGRAPHIC METRICS
  // =========================================================================
  drawSectionHeading(
    '02',
    'Real-Time Threat Metrics & Key Exchange Telemetry',
    'Entropy analysis, binary inspection targets, and Diffie-Hellman ephemeral handshake values'
  );

  drawKeyValueTable([
    ['Active Mitigations Count', String(payload.real_time_statistics.active_mitigations_count)],
    ['Shannon Entropy Bytes Scanned', `${payload.real_time_statistics.shannon_entropy_bytes_scanned} bytes`],
    ['Shannon Entropy Peak Score', `${payload.real_time_statistics.shannon_entropy_peak_score} bits/byte`],
    ['Active PE Binary Selection', payload.real_time_statistics.active_binary_selection],
    ['Diffie-Hellman Prime (g/P)', payload.real_time_statistics.diffie_hellman_handshake_prime],
    ['Diffie-Hellman Generator (p/G)', payload.real_time_statistics.diffie_hellman_handshake_generator],
    ['Derived Ephemeral Shared Key', payload.real_time_statistics.derived_ephemeral_key || 'NO_ACTIVE_NEGOTIATION'],
    ['AST Source Module Size', `${payload.ast_static_scan.checked_source_module_length} characters`],
    ['Signature Hex Buffer Length', `${payload.signature_matching_ledger.raw_hex_input_length_bytes} bytes`]
  ]);

  // =========================================================================
  // SECTION 3: AST STATIC SECURITY FINDINGS
  // =========================================================================
  const astMatches = payload.ast_static_scan.ast_heuristics_vulnerability_matches;
  drawSectionHeading(
    '03',
    'AST Static Security Findings',
    `Heuristic syntax-tree vulnerability detections (${astMatches.length} total)`
  );

  if (astMatches.length === 0) {
    ensureSpace(12);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, cursorY - 2, contentWidth, 10, 1, 1, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No AST static security vulnerabilities detected in the current source buffer.', margin + 4, cursorY + 4.2);
    cursorY += 14;
  } else {
    astMatches.forEach((finding, index) => {
      const descLines = doc.splitTextToSize(cleanPdfText(finding.description_remediation), contentWidth - 10);
      const codeLines = doc.splitTextToSize(cleanPdfText(finding.offending_signature || 'N/A'), contentWidth - 12);
      const blockHeight = 16 + descLines.length * 4 + codeLines.length * 3.8 + 4;

      ensureSpace(blockHeight);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, cursorY, contentWidth, blockHeight - 2, 1, 1, 'FD');

      // Severity left edge marker
      doc.setFillColor(220, 38, 38);
      doc.rect(margin, cursorY, 2, blockHeight - 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        cleanPdfText(`#${index + 1}  ${finding.vulnerability_type}`),
        margin + 5,
        cursorY + 6
      );

      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(185, 28, 28);
      doc.text(`LINE ${finding.line}  |  HIGH`, pageWidth - margin - 4, cursorY + 6, { align: 'right' });

      let innerY = cursorY + 11.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(descLines, margin + 5, innerY);
      innerY += descLines.length * 4 + 2;

      doc.setFillColor(15, 23, 42);
      doc.rect(margin + 5, innerY - 3, contentWidth - 9, codeLines.length * 3.8 + 3, 'F');
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(248, 250, 252);
      doc.text(codeLines, margin + 7, innerY + 0.5);

      cursorY += blockHeight + 2;
    });
  }

  // =========================================================================
  // SECTION 4: MALWARE SIGNATURE MATCHING LEDGER
  // =========================================================================
  const sigMatches = payload.signature_matching_ledger.malicious_signature_detections;
  drawSectionHeading(
    '04',
    'Malware Signature Matching Ledger',
    `Aho-Corasick trie marker scan detections (${sigMatches.length} total)`
  );

  if (sigMatches.length === 0) {
    ensureSpace(12);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, cursorY - 2, contentWidth, 10, 1, 1, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No malicious byte signatures matched within the inspected hex dump buffer.', margin + 4, cursorY + 4.2);
    cursorY += 14;
  } else {
    sigMatches.forEach((sig, index) => {
      const seqLines = doc.splitTextToSize(cleanPdfText(sig.matched_bytes_sequence || 'N/A'), contentWidth - 10);
      const rowH = 14 + seqLines.length * 4;
      ensureSpace(rowH + 2);

      doc.setFillColor(index % 2 === 0 ? 248 : 255, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, cursorY, contentWidth, rowH, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(cleanPdfText(`#${index + 1}  ${sig.pattern_signature_catalog}`), margin + 4, cursorY + 5.5);

      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(217, 119, 6);
      doc.text(`OFFSET: ${sig.buffer_offset}`, pageWidth - margin - 4, cursorY + 5.5, { align: 'right' });

      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(seqLines, margin + 4, cursorY + 11);

      cursorY += rowH + 3;
    });
  }

  if (payload.signature_matching_ledger.untrusted_hex_dump) {
    const hexRaw = payload.signature_matching_ledger.untrusted_hex_dump.trim();
    const hexExcerpt = hexRaw.length > 500 ? `${hexRaw.slice(0, 500)} ... [truncated]` : hexRaw;
    const hexLines = doc.splitTextToSize(cleanPdfText(hexExcerpt), contentWidth - 10);
    const hexBoxH = 10 + hexLines.length * 3.8;
    ensureSpace(hexBoxH + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `INSPECTED HEX STREAM EXCERPT (${payload.signature_matching_ledger.raw_hex_input_length_bytes} BYTES)`,
      margin,
      cursorY + 3
    );
    cursorY += 5.5;

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, cursorY, contentWidth, hexBoxH - 3, 1, 1, 'F');
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(226, 232, 240);
    doc.text(hexLines, margin + 4, cursorY + 4.5);
    cursorY += hexBoxH + 2;
  }

  // =========================================================================
  // SECTION 5: EBPF KERNEL EXECUTION TELEMETRY LOGS
  // =========================================================================
  const ebpfLogs = payload.ebpf_kernel_execution_logs;
  drawSectionHeading(
    '05',
    'eBPF Kernel Execution Telemetry Logs',
    `Audited process syscalls & kernel sandbox enforcement decisions (${ebpfLogs.length} total)`
  );

  if (ebpfLogs.length === 0) {
    ensureSpace(12);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, cursorY - 2, contentWidth, 10, 1, 1, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No kernel syscall events recorded during this monitoring session.', margin + 4, cursorY + 4.2);
    cursorY += 14;
  } else {
    ebpfLogs.forEach((log, index) => {
      const argText = `Args: ${log.syscall_arguments || 'none'}`;
      const argLines = doc.splitTextToSize(cleanPdfText(argText), contentWidth - 10);
      const cardH = 17 + argLines.length * 3.8;
      ensureSpace(cardH + 2);

      const sevUpper = (log.incident_severity_classification || 'low').toUpperCase();
      const sevColor: [number, number, number] =
        sevUpper === 'HIGH'
          ? [220, 38, 38]
          : sevUpper === 'MEDIUM'
            ? [217, 119, 6]
            : [22, 163, 74];

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, cursorY, contentWidth, cardH, 1, 1, 'FD');

      doc.setFillColor(...sevColor);
      doc.rect(margin, cursorY, 2, cardH, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(
        cleanPdfText(`#${index + 1}  ${log.executable_name} -> ${log.invoked_system_call}()`),
        margin + 5,
        cursorY + 5.5
      );

      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...sevColor);
      doc.text(
        cleanPdfText(`${sevUpper}  |  ${String(log.governing_sandbox_action || '').toUpperCase()}`),
        pageWidth - margin - 4,
        cursorY + 5.5,
        { align: 'right' }
      );

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        cleanPdfText(`Event ID: ${log.event_id}  |  Time: ${log.timestamp_offset}  |  PID: ${log.process_id}  |  PPID: ${log.parent_process_id}`),
        margin + 5,
        cursorY + 10.5
      );

      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(argLines, margin + 5, cursorY + 15);

      cursorY += cardH + 3;
    });
  }

  // =========================================================================
  // FINAL PASS: ADD PAGE NUMBERS TO ALL CONTENT PAGES
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p === 1) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page 1 of ${totalPages}`, pageWidth - margin, pageHeight - 13, { align: 'right' });
    } else {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.line(margin, pageHeight - 15, margin + contentWidth, pageHeight - 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `CONFIDENTIAL  |  ${payload.meta.suite} ${payload.meta.version}`,
        margin,
        pageHeight - 10
      );

      doc.setFont('courier', 'bold');
      doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * Exports any module's telemetry/findings payload as a formatted PDF report with cover header.
 */
export function exportGenericReportPdf(
  title: string,
  jsonData: any,
  textReport?: string,
  filename: string = 'aegis_module_report.pdf'
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const nowIso = new Date().toISOString();

  // Page 1: Formal Cover Page
  doc.setFillColor(11, 17, 32);
  doc.rect(0, 0, pageWidth, 82, 'F');
  doc.setFillColor(0, 180, 216);
  doc.rect(0, 82, pageWidth, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 210, 240);
  doc.text('AEGIS UNIFIED SECURITY SUITE  //  MODULE AUDIT REPORT', margin, 24);

  doc.setFontSize(20);
  doc.setTextColor(248, 250, 252);
  doc.text(cleanPdfText(title.toUpperCase()), margin, 44, { maxWidth: contentWidth });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('Formal Security Module Telemetry & Findings Export', margin, 62);

  // Cover Metadata Panel
  const coverY = 102;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, coverY, contentWidth, 42, 1.5, 1.5, 'FD');
  doc.setFillColor(0, 180, 216);
  doc.rect(margin, coverY, 2.5, 42, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('REPORT METADATA & SYSTEM STATUS', margin + 7, coverY + 10);

  const metaItems: Array<[string, string]> = [
    ['System Status:', 'VERIFIED MODULE EXPORT // OPERATIONAL'],
    ['Timestamp (UTC):', `${nowIso.replace('T', ' ').substring(0, 19)} UTC`],
    ['Local Timestamp:', cleanPdfText(new Date(nowIso).toLocaleString())],
    ['Suite Release:', 'Aegis Unified Security Suite (v2.5.0-Enterprise)']
  ];
  let mY = coverY + 18;
  metaItems.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(71, 85, 105);
    doc.text(k, margin + 7, mY);
    doc.setFont('courier', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(v, margin + 48, mY, { maxWidth: contentWidth - 54 });
    mY += 5.5;
  });

  doc.setDrawColor(203, 213, 225);
  doc.line(margin, pageHeight - 20, margin + contentWidth, pageHeight - 20);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CONFIDENTIAL // TLP:AMBER  -  AEGIS UNIFIED SECURITY SUITE', margin, pageHeight - 13);

  // Page 2+: Report Body
  doc.addPage();
  let cursorY = 20;

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageHeight - 18) {
      doc.addPage();
      cursorY = 20;
    }
  };

  if (textReport) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('EXECUTIVE REPORT NARRATIVE', margin, cursorY);
    cursorY += 6;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(cleanPdfText(textReport), contentWidth);
    lines.forEach((line: string) => {
      ensureSpace(5);
      doc.text(line, margin, cursorY);
      cursorY += 4.2;
    });
    cursorY += 6;
  }

  if (jsonData !== undefined) {
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('STRUCTURED TELEMETRY PAYLOAD', margin, cursorY);
    cursorY += 6;

    const jsonStr = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);
    const jsonLines = doc.splitTextToSize(cleanPdfText(jsonStr), contentWidth);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(51, 65, 85);
    jsonLines.forEach((line: string) => {
      ensureSpace(4.5);
      doc.text(line, margin, cursorY);
      cursorY += 3.8;
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`AEGIS SECURITY SUITE  |  Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 10, {
      align: 'right'
    });
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

