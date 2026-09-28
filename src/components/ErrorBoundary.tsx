import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Cpu } from 'lucide-react';

interface Props {
  props?: any; // To fulfill custom reference checks
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[!] ErrorBoundary caught critical component exception:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Attempt state recovery routing
    window.location.hash = '';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#0D0D11] border border-rose-500/15 rounded-lg p-6 font-mono text-xs space-y-4 shadow-[0_8px_32px_rgba(239,68,68,0.03)]">
          <div className="flex items-center gap-3 text-rose-400">
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-md">
              <AlertTriangle size={18} className="animate-pulse" />
            </div>
            <div>
              <h4 className="font-serif italic text-sm text-white font-semibold">Integrity Shield Triggered</h4>
              <p className="text-[10px] text-rose-400/70 mt-0.5">A dynamic module component has encountered a runtime error boundary breach.</p>
            </div>
          </div>

          <div className="bg-black/50 border border-white/5 p-4 rounded text-white/80 space-y-2.5 font-mono text-[10px] sm:text-[11px] leading-relaxed">
            <div className="flex justify-between text-white/30 border-b border-white/5 pb-1.5 text-[9px] tracking-widest uppercase">
              <span>Diagnostic Signature</span>
              <span>Kernel Sandbox Mode</span>
            </div>
            <div className="text-rose-300 font-bold max-h-16 overflow-y-auto select-text">
              {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unknown runtime error occurred.'}
            </div>
            <div className="text-white/40 text-[9px] leading-relaxed select-text font-mono max-h-24 overflow-y-auto border-t border-white/5 pt-1.5">
              {this.state.error?.stack || 'No debugger stack trace available via isolated environment.'}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center pt-2">
            <button
              onClick={this.handleReset}
              className="w-full sm:w-auto px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] rounded tracking-wide font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={11} className="animate-spin" /> Force Recharge Module
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-white/60 text-[10px] rounded tracking-wide font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Cpu size={11} /> Reboot Console Link
            </button>
          </div>
        </div>
      );
    }

    // Always use props.children as instructed for children properties in class components
    return this.props.children;
  }
}

export default ErrorBoundary;
