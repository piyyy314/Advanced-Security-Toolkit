import React, { useState, useRef, useEffect } from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, Copy, Check, ChevronDown } from 'lucide-react';
import { exportAsJson, exportAsCsv, exportAsText, copyToClipboard } from '../utils/exportUtils';

export interface ExportButtonProps {
  label?: string;
  filenamePrefix?: string;
  jsonData?: any;
  csvData?: Array<Record<string, any>> | string;
  textReport?: string;
  triggerToast?: (msg: string) => void;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'primary' | 'secondary' | 'ghost';
  id?: string;
  disabled?: boolean;
  className?: string;
}

export default function ExportButton({
  label = 'Export',
  filenamePrefix = 'aegis_export',
  jsonData,
  csvData,
  textReport,
  triggerToast,
  size = 'xs',
  variant = 'secondary',
  id,
  disabled = false,
  className = ''
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const handleExportJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!jsonData && !csvData && !textReport) return;
    const dataToExport = jsonData || (csvData ? (typeof csvData === 'string' ? { content: csvData } : csvData) : { report: textReport });
    exportAsJson(dataToExport, `${filenamePrefix}_${timestamp}.json`);
    if (triggerToast) triggerToast(`Exported ${filenamePrefix}.json successfully`);
    setIsOpen(false);
  };

  const handleExportCsv = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!csvData && !jsonData) return;
    const dataToExport = csvData || (Array.isArray(jsonData) ? jsonData : [jsonData]);
    exportAsCsv(dataToExport, `${filenamePrefix}_${timestamp}.csv`);
    if (triggerToast) triggerToast(`Exported ${filenamePrefix}.csv successfully`);
    setIsOpen(false);
  };

  const handleExportText = (e: React.MouseEvent) => {
    e.stopPropagation();
    let text = textReport;
    if (!text) {
      if (typeof jsonData === 'string') {
        text = jsonData;
      } else {
        text = JSON.stringify(jsonData || csvData, null, 2);
      }
    }
    exportAsText(text, `${filenamePrefix}_${timestamp}.txt`);
    if (triggerToast) triggerToast(`Exported ${filenamePrefix}.txt report successfully`);
    setIsOpen(false);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let textToCopy = textReport;
    if (!textToCopy) {
      if (jsonData) {
        textToCopy = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);
      } else if (csvData) {
        textToCopy = typeof csvData === 'string' ? csvData : JSON.stringify(csvData, null, 2);
      }
    }
    if (textToCopy) {
      const success = await copyToClipboard(textToCopy);
      if (success) {
        setCopied(true);
        if (triggerToast) triggerToast('Copied results to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      }
    }
    setIsOpen(false);
  };

  const sizeClasses = {
    xs: 'px-2 py-1 text-[9px]',
    sm: 'px-2.5 py-1.5 text-[10px]',
    md: 'px-3 py-2 text-xs'
  }[size];

  const variantClasses = {
    primary: 'bg-[#00f0ff] hover:bg-[#00f0ff]/80 text-black font-bold border-transparent',
    secondary: 'bg-black/50 hover:bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 hover:border-[#00f0ff]/60',
    ghost: 'bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 hover:border-white/20'
  }[variant];

  // If only one export format is supported, direct download on click
  const hasMultiple = (jsonData ? 1 : 0) + (csvData ? 1 : 0) + (textReport ? 1 : 0) > 1 || Boolean(jsonData);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (hasMultiple) {
            setIsOpen(!isOpen);
          } else if (textReport) {
            handleExportText({ stopPropagation: () => {} } as any);
          } else if (csvData) {
            handleExportCsv({ stopPropagation: () => {} } as any);
          } else if (jsonData) {
            handleExportJson({ stopPropagation: () => {} } as any);
          }
        }}
        className={`font-mono uppercase tracking-wider rounded transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses}`}
        title="Export result data"
      >
        <Download size={size === 'xs' ? 10 : 12} className="shrink-0" />
        <span>{label}</span>
        {hasMultiple && <ChevronDown size={size === 'xs' ? 9 : 11} className={`transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />}
      </button>

      {isOpen && hasMultiple && (
        <div 
          className="absolute right-0 mt-1.5 w-44 rounded-md shadow-2xl bg-[#0e0e12] border border-[#00f0ff]/30 backdrop-blur-md z-50 py-1 font-mono text-[10px]"
          role="menu"
        >
          <div className="px-2.5 py-1 text-[8px] uppercase tracking-widest text-white/40 border-b border-white/5">
            Export Format
          </div>

          {(jsonData || (!csvData && !textReport)) && (
            <button
              onClick={handleExportJson}
              className="w-full text-left px-3 py-1.5 text-zinc-300 hover:bg-[#00f0ff]/10 hover:text-[#00f0ff] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FileJson size={12} className="text-[#00f0ff]/80" />
              <span>JSON Data (.json)</span>
            </button>
          )}

          {csvData && (
            <button
              onClick={handleExportCsv}
              className="w-full text-left px-3 py-1.5 text-zinc-300 hover:bg-[#00f0ff]/10 hover:text-[#00f0ff] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={12} className="text-emerald-400/80" />
              <span>CSV Spreadsheet (.csv)</span>
            </button>
          )}

          <button
            onClick={handleExportText}
            className="w-full text-left px-3 py-1.5 text-zinc-300 hover:bg-[#00f0ff]/10 hover:text-[#00f0ff] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <FileText size={12} className="text-amber-400/80" />
            <span>Text Report (.txt)</span>
          </button>

          <div className="border-t border-white/5 my-1" />

          <button
            onClick={handleCopy}
            className="w-full text-left px-3 py-1.5 text-zinc-300 hover:bg-[#00f0ff]/10 hover:text-[#00f0ff] flex items-center gap-2 transition-colors cursor-pointer"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-white/60" />}
            <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
