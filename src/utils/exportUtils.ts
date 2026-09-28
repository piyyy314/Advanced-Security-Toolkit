/**
 * Aegis Security & Space Operations Export Utilities
 * Provides standardized multi-format export routines (JSON, CSV, Text/Markdown)
 * with direct file downloading and clipboard support.
 */

export interface ExportDataPayload {
  title: string;
  filename?: string;
  jsonData: any;
  csvData?: Array<Record<string, any>> | string;
  textReport?: string;
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
