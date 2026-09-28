export type ActiveTool = 'operational-dashboard' | 'vuln-scanner' | 'penetration-framework' | 'network-analysis' | 'entropy' | 'ast' | 'ebpf' | 'pe' | 'signature' | 'crypto' | 'smt-verifier' | 'google-drive' | 'sandbox' | 'waf' | 'wireless' | 'console' | 'archive' | 'overviews' | 'ai-coprocessor' | 'yara';

export interface SysCallAlert {
  id: string;
  timestamp: string;
  pid: number;
  ppid: number;
  comm: string;
  syscall: string;
  args: string;
  status: 'allowed' | 'intercepted';
  severity: 'low' | 'medium' | 'high';
}

export interface ArchivedThreat {
  id: string;
  timestamp: string;
  category: 'ebpf' | 'ast';
  name: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
  rawPayload: string;
  notes?: string;
  status: 'Unresolved' | 'Triaged' | 'Remediated' | 'False Positive';
  assignedOfficer?: string;
  meta: Record<string, any>;
}

export interface EbpfRule {
  id: string;
  name: string;
  type: 'comm' | 'syscall' | 'path';
  pattern: string;
  action: 'allow' | 'block';
  active: boolean;
}

export interface PeSection {
  name: string;
  virtualSize: number;
  virtualAddress: string;
  rawSize: number;
  rawAddress: string;
  entropy: number;
  characteristics: string[];
  anomalous: boolean;
}

export interface PeFileMetadata {
  fileName: string;
  fileSize: number;
  magic: string;
  machine: string;
  numberOfSections: number;
  timeDateStamp: string;
  entryPoint: string;
  subsystem: string;
  sections: PeSection[];
  imports: string[];
}
