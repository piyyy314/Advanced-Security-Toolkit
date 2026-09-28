import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken,
  GOOGLE_DRIVE_SCOPES 
} from '../services/googleDriveAuth';
import { 
  listGoogleDriveFiles, 
  getGoogleDriveFileContent, 
  uploadGoogleDriveFile, 
  createGoogleDriveFolder, 
  deleteGoogleDriveFile,
  queryGoogleDriveActivity,
  DriveFileItem,
  DriveActivityItem 
} from '../services/googleDriveApi';
import { ActiveTool } from '../types';
import { 
  HardDrive, 
  Folder, 
  FileText, 
  UploadCloud, 
  FolderPlus, 
  Trash2, 
  Download, 
  ExternalLink, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Eye, 
  Share2, 
  LogOut, 
  FileCode, 
  Terminal, 
  Binary, 
  Scale, 
  Activity, 
  Cpu, 
  ChevronRight, 
  Home, 
  Sparkles, 
  Lock,
  Clock,
  User as UserIcon,
  Shield,
  FilePlus,
  ArrowRight
} from 'lucide-react';

interface GoogleDriveVaultProps {
  triggerToast?: (msg: string) => void;
  onLoadIntoTool?: (tool: ActiveTool, payload: string, fileName?: string) => void;
}

export default function GoogleDriveVault({ triggerToast, onLoadIntoTool }: GoogleDriveVaultProps) {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  // Drive Navigation & Files
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [folderBreadcrumbs, setFolderBreadcrumbs] = useState<Array<{ id?: string; name: string }>>([
    { name: 'My Drive' }
  ]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'security_evidence' | 'document' | 'folder'>('all');
  const [selectedFile, setSelectedFile] = useState<DriveFileItem | null>(null);

  // Preview & Inspect Modal
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

  // New Folder Modal
  const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('Aegis-Security-Vault');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);

  // Upload Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadFileName, setUploadFileName] = useState<string>('security_audit_report.json');
  const [uploadContent, setUploadContent] = useState<string>('{\n  "suite": "Aegis VMM",\n  "auditDate": "' + new Date().toISOString() + '",\n  "status": "SECURE",\n  "verifiedProofs": ["constant_time_modexp.smt2", "yara_malware_rules.yar"]\n}');
  const [uploadMimeType, setUploadMimeType] = useState<string>('application/json');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Destructive Delete Confirmation Modal (MANDATORY)
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Activity Feed
  const [activities, setActivities] = useState<DriveActivityItem[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'explorer' | 'activity' | 'quick-backup'>('explorer');

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setHasToken(!!token);
        setAuthChecked(true);
      },
      () => {
        setCurrentUser(null);
        setHasToken(false);
        setAuthChecked(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch files when folder or filter changes
  const fetchFiles = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    setIsLoadingFiles(true);
    try {
      const result = await listGoogleDriveFiles({
        folderId: currentFolderId,
        searchTerm,
        mimeTypeFilter: filterType
      });
      setFiles(result.files);
    } catch (err: any) {
      console.error('Error fetching Drive files:', err);
      if (triggerToast) triggerToast(`Drive Error: ${err.message || 'Could not load files'}`);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [currentFolderId, searchTerm, filterType, triggerToast]);

  const fetchActivities = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    setIsLoadingActivity(true);
    try {
      const act = await queryGoogleDriveActivity(20);
      setActivities(act);
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setIsLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    if (hasToken) {
      fetchFiles();
      if (activeTab === 'activity') {
        fetchActivities();
      }
    }
  }, [hasToken, currentFolderId, filterType, activeTab, fetchFiles, fetchActivities]);

  // Sign In Handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        setHasToken(true);
        if (triggerToast) triggerToast(`Google Drive connected: ${result.user.email}`);
      }
    } catch (err: any) {
      console.error('Sign in failed:', err);
      if (triggerToast) triggerToast(`Sign in error: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Sign Out Handler
  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setHasToken(false);
    setFiles([]);
    setActivities([]);
    if (triggerToast) triggerToast('Google Drive disconnected.');
  };

  // Folder navigation
  const handleOpenFolder = (folder: DriveFileItem) => {
    setCurrentFolderId(folder.id);
    setFolderBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleNavigateBreadcrumb = (index: number) => {
    const target = folderBreadcrumbs[index];
    setFolderBreadcrumbs(prev => prev.slice(0, index + 1));
    setCurrentFolderId(target.id);
  };

  // Create Folder Handler
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      const newFolder = await createGoogleDriveFolder(newFolderName.trim(), currentFolderId);
      if (triggerToast) triggerToast(`Folder created: ${newFolder.name}`);
      setIsFolderModalOpen(false);
      setNewFolderName('');
      fetchFiles();
    } catch (err: any) {
      if (triggerToast) triggerToast(`Failed to create folder: ${err.message}`);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Upload File Handler
  const handleUploadFile = async () => {
    if (!uploadFileName.trim()) return;
    setIsUploading(true);
    try {
      const uploaded = await uploadGoogleDriveFile({
        name: uploadFileName.trim(),
        content: uploadContent,
        mimeType: uploadMimeType,
        folderId: currentFolderId
      });
      if (triggerToast) triggerToast(`File uploaded successfully: ${uploaded.name}`);
      setIsUploadModalOpen(false);
      fetchFiles();
    } catch (err: any) {
      if (triggerToast) triggerToast(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Delete File Handler (Destructive with explicit confirmation)
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteGoogleDriveFile(fileToDelete.id);
      if (triggerToast) triggerToast(`Deleted "${fileToDelete.name}" from Google Drive.`);
      setFileToDelete(null);
      fetchFiles();
    } catch (err: any) {
      if (triggerToast) triggerToast(`Delete failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Preview / Inspect File Content
  const handleInspectFile = async (file: DriveFileItem) => {
    setSelectedFile(file);
    setIsPreviewLoading(true);
    setIsPreviewModalOpen(true);
    try {
      const content = await getGoogleDriveFileContent(file.id, file.mimeType);
      setPreviewContent(content);
    } catch (err: any) {
      setPreviewContent(`[Error reading file content: ${err.message || 'Binary or restricted format'}]`);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Load File into Toolkit Modules
  const handleLoadIntoTool = (tool: ActiveTool) => {
    if (!previewContent || !selectedFile) return;
    if (onLoadIntoTool) {
      onLoadIntoTool(tool, previewContent, selectedFile.name);
      if (triggerToast) triggerToast(`Loaded "${selectedFile.name}" into ${tool.toUpperCase()}`);
      setIsPreviewModalOpen(false);
    }
  };

  // Quick Backups
  const handleBackupThreatArchive = async () => {
    const archiveStr = localStorage.getItem('aegis_threat_archive') || '[]';
    setIsUploading(true);
    try {
      const fileName = `aegis_threat_archive_${new Date().toISOString().split('T')[0]}.json`;
      await uploadGoogleDriveFile({
        name: fileName,
        content: archiveStr,
        mimeType: 'application/json',
        folderId: currentFolderId,
        description: 'Aegis Security Toolkit Threat Archive Export'
      });
      if (triggerToast) triggerToast(`Backed up Threat Archive to Google Drive as ${fileName}`);
      fetchFiles();
    } catch (err: any) {
      if (triggerToast) triggerToast(`Backup failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Helper formatting
  const formatFileSize = (bytesStr?: string) => {
    if (!bytesStr) return '-';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isFolder = (mime: string) => mime === 'application/vnd.google-apps.folder';

  return (
    <div className="space-y-6 select-text">
      
      {/* HEADER TITLE BAR */}
      <div className="bg-[#0A0A0C]/80 border border-white/10 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_0_20px_rgba(0,240,255,0.05)]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00f0ff]/10 border border-[#00f0ff]/30 rounded text-[#00f0ff]">
              <HardDrive size={18} />
            </div>
            <h1 className="text-sm font-serif font-light tracking-[0.2em] text-zinc-100 uppercase">
              Google Drive Security Vault & Cloud Telemetry
            </h1>
            <span className="text-[9px] font-mono bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] px-2 py-0.5 rounded font-bold uppercase">
              OAuth 2.0 Connected
            </span>
          </div>
          <p className="text-[11px] font-mono text-white/40 mt-1 leading-relaxed">
            Securely store, organize, inspect, and import cryptographic proofs, YARA rules, AST source files, and forensic memory captures from your Google Drive.
          </p>
        </div>

        {/* Auth / Connection Status */}
        <div className="flex items-center gap-3">
          {hasToken && currentUser ? (
            <div className="flex items-center gap-3 bg-black/50 border border-white/10 p-2 rounded-lg">
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={currentUser.displayName || 'User'} 
                  className="w-7 h-7 rounded-full border border-[#00f0ff]/40"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#00f0ff]/20 flex items-center justify-center text-[#00f0ff] font-mono text-xs">
                  <UserIcon size={14} />
                </div>
              )}
              <div className="font-mono text-left hidden sm:block">
                <div className="text-xs text-zinc-200 font-bold leading-none truncate max-w-[160px]">
                  {currentUser.displayName || 'Security Analyst'}
                </div>
                <div className="text-[10px] text-white/40 leading-tight truncate max-w-[160px]">
                  {currentUser.email}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Disconnect Google Drive"
                className="p-1.5 hover:bg-rose-950/40 text-white/40 hover:text-rose-400 border border-transparent hover:border-rose-800/40 rounded transition-all cursor-pointer"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button inline-flex items-center gap-2.5 px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-sans font-medium text-xs rounded border border-zinc-300 shadow-sm cursor-pointer transition-all disabled:opacity-50"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
              <span>{isLoggingIn ? 'Connecting to Google Drive...' : 'Sign in with Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* NON-AUTHENTICATED HERO CTA */}
      {!hasToken && (
        <div className="bg-[#0A0A0C]/50 border border-white/5 rounded-lg p-8 text-center space-y-4 font-mono">
          <div className="w-16 h-16 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/30 mx-auto flex items-center justify-center text-[#00f0ff]">
            <HardDrive size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-sm font-serif font-bold text-zinc-100 uppercase tracking-widest">
              Connect Your Google Drive Workspace
            </h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Authenticate to securely list files, import forensic datasets into active analysis sandboxes, and export audited security telemetry directly to your cloud storage.
            </p>
          </div>
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="px-6 py-2.5 bg-[#00f0ff]/15 hover:bg-[#00f0ff] hover:text-black text-[#00f0ff] border border-[#00f0ff]/40 text-xs uppercase font-mono tracking-widest rounded cursor-pointer transition-all font-bold shadow-[0_0_15px_rgba(0,240,255,0.2)] disabled:opacity-50"
          >
            {isLoggingIn ? 'Authorizing Drive Session...' : 'Authorize Google Drive Access →'}
          </button>
        </div>
      )}

      {/* AUTHENTICATED WORKSPACE */}
      {hasToken && (
        <div className="space-y-4">
          
          {/* TOOLBAR: NAVIGATION TABS, SEARCH, AND ACTION BUTTONS */}
          <div className="bg-black/30 border border-white/5 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Tabs */}
            <div className="flex items-center gap-1 font-mono text-xs">
              <button
                onClick={() => setActiveTab('explorer')}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer font-bold ${
                  activeTab === 'explorer'
                    ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40'
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                Drive Explorer
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer font-bold ${
                  activeTab === 'activity'
                    ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40'
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                Audit Activity Feed
              </button>
              <button
                onClick={() => setActiveTab('quick-backup')}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer font-bold ${
                  activeTab === 'quick-backup'
                    ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40'
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                Quick Forensics Backup
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                onClick={() => setIsFolderModalOpen(true)}
                className="px-2.5 py-1.5 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 text-zinc-300 rounded flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <FolderPlus size={13} className="text-[#00f0ff]" /> New Folder
              </button>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-2.5 py-1.5 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/40 text-[#00f0ff] rounded flex items-center gap-1.5 cursor-pointer transition-all font-bold"
              >
                <UploadCloud size={13} /> Upload File
              </button>
              <button
                onClick={fetchFiles}
                disabled={isLoadingFiles}
                title="Refresh Drive Files"
                className="p-1.5 bg-black/40 hover:bg-black/60 border border-white/10 text-white/50 hover:text-white rounded cursor-pointer transition-all"
              >
                <RefreshCw size={13} className={isLoadingFiles ? 'animate-spin' : ''} />
              </button>
            </div>

          </div>

          {/* TAB 1: DRIVE EXPLORER */}
          {activeTab === 'explorer' && (
            <div className="bg-[#08080C] border border-white/5 rounded-lg p-4 space-y-4">
              
              {/* Search & Breadcrumb Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-xs">
                
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  <Home size={13} className="text-[#00f0ff] shrink-0" />
                  {folderBreadcrumbs.map((crumb, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 shrink-0">
                      {idx > 0 && <ChevronRight size={11} className="text-white/30" />}
                      <button
                        onClick={() => handleNavigateBreadcrumb(idx)}
                        className={`hover:underline cursor-pointer ${
                          idx === folderBreadcrumbs.length - 1
                            ? 'text-zinc-100 font-bold'
                            : 'text-white/40 hover:text-white/70'
                        }`}
                      >
                        {crumb.name}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Filter & Search Input */}
                <div className="flex items-center gap-2">
                  <select
                    value={filterType}
                    onChange={(e: any) => setFilterType(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded px-2.5 py-1 text-[11px] text-zinc-300 font-mono focus:outline-none"
                  >
                    <option value="all">All File Formats</option>
                    <option value="security_evidence">Security Artifacts (.yar, .smt2, .json, .log)</option>
                    <option value="document">Text & Code</option>
                    <option value="folder">Folders Only</option>
                  </select>

                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-2.5 text-white/30" />
                    <input
                      type="text"
                      placeholder="Search Drive files..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchFiles()}
                      className="bg-black/50 border border-white/10 rounded pl-7 pr-3 py-1 text-[11px] text-zinc-200 placeholder-white/30 font-mono w-44 md:w-56 focus:border-[#00f0ff]/50 focus:outline-none"
                    />
                  </div>
                </div>

              </div>

              {/* Files Table / Grid */}
              {isLoadingFiles ? (
                <div className="py-16 text-center font-mono text-xs text-white/40 space-y-2">
                  <RefreshCw size={20} className="animate-spin text-[#00f0ff] mx-auto" />
                  <div>Querying Google Drive API index...</div>
                </div>
              ) : files.length === 0 ? (
                <div className="py-14 text-center font-mono text-xs text-white/40 border border-dashed border-white/10 rounded-lg p-6 space-y-2">
                  <Folder size={24} className="mx-auto text-white/20" />
                  <div className="text-zinc-300 font-bold">No files found</div>
                  <p className="text-[11px] text-white/30">
                    {searchTerm ? 'No results matched your search query.' : 'This folder is currently empty.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40 text-[10px] uppercase">
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Last Modified</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {files.map((file) => {
                        const folder = isFolder(file.mimeType);
                        return (
                          <tr
                            key={file.id}
                            className="hover:bg-white/[0.02] transition-colors group"
                          >
                            {/* File Name & Icon */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                {folder ? (
                                  <Folder size={15} className="text-[#00f0ff] shrink-0" />
                                ) : file.name.endsWith('.yar') || file.name.endsWith('.yara') ? (
                                  <FileCode size={15} className="text-amber-400 shrink-0" />
                                ) : file.name.endsWith('.smt2') ? (
                                  <Scale size={15} className="text-emerald-400 shrink-0" />
                                ) : file.name.endsWith('.json') || file.name.endsWith('.log') ? (
                                  <Binary size={15} className="text-purple-400 shrink-0" />
                                ) : (
                                  <FileText size={15} className="text-zinc-400 shrink-0" />
                                )}
                                
                                {folder ? (
                                  <button
                                    onClick={() => handleOpenFolder(file)}
                                    className="text-zinc-200 hover:text-[#00f0ff] font-bold text-left cursor-pointer transition-colors truncate max-w-xs md:max-w-md"
                                  >
                                    {file.name}
                                  </button>
                                ) : (
                                  <span className="text-zinc-200 truncate max-w-xs md:max-w-md">
                                    {file.name}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* MIME Type summary */}
                            <td className="py-2.5 px-3 text-white/40 text-[11px] truncate max-w-[140px]">
                              {folder ? 'Directory' : file.mimeType.replace('application/', '').replace('text/', '')}
                            </td>

                            {/* Size */}
                            <td className="py-2.5 px-3 text-white/50 text-[11px]">
                              {formatFileSize(file.size)}
                            </td>

                            {/* Modified Date */}
                            <td className="py-2.5 px-3 text-white/40 text-[11px]">
                              {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '-'}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                {!folder && (
                                  <button
                                    onClick={() => handleInspectFile(file)}
                                    title="Inspect & Preview Content"
                                    className="p-1.5 hover:bg-[#00f0ff]/15 text-[#00f0ff] rounded border border-transparent hover:border-[#00f0ff]/30 cursor-pointer transition-all"
                                  >
                                    <Eye size={13} />
                                  </button>
                                )}

                                {file.webViewLink && (
                                  <a
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Open in Google Drive"
                                    className="p-1.5 hover:bg-white/10 text-white/50 hover:text-white rounded cursor-pointer transition-all inline-block"
                                  >
                                    <ExternalLink size={13} />
                                  </a>
                                )}

                                <button
                                  onClick={() => setFileToDelete(file)}
                                  title="Delete item from Google Drive"
                                  className="p-1.5 hover:bg-rose-950/40 text-white/30 hover:text-rose-400 rounded border border-transparent hover:border-rose-800/40 cursor-pointer transition-all"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: AUDIT ACTIVITY FEED */}
          {activeTab === 'activity' && (
            <div className="bg-[#08080C] border border-white/5 rounded-lg p-5 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-zinc-200 font-bold uppercase tracking-wider flex items-center gap-2">
                  <Activity size={14} className="text-[#00f0ff]" /> Google Drive Activity Audit Trail
                </span>
                <button
                  onClick={fetchActivities}
                  disabled={isLoadingActivity}
                  className="px-2 py-1 bg-black/40 border border-white/10 text-white/50 hover:text-white rounded text-[10px] cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw size={10} className={isLoadingActivity ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>

              {isLoadingActivity ? (
                <div className="py-12 text-center text-white/40">Querying Drive Activity v2 logs...</div>
              ) : activities.length === 0 ? (
                <div className="py-8 text-center text-white/40 border border-dashed border-white/10 rounded p-4">
                  No recent file activity recorded by the Drive Activity API.
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.map((act, i) => (
                    <div key={i} className="p-3 bg-black/40 border border-white/5 rounded flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Clock size={13} className="text-[#00f0ff]" />
                        <div>
                          <span className="text-zinc-200 font-bold">{act.actor}</span>{' '}
                          <span className="text-[#00f0ff] uppercase text-[10px] font-bold px-1.5 py-0.5 bg-[#00f0ff]/10 rounded border border-[#00f0ff]/30 mx-1">
                            {act.action}
                          </span>{' '}
                          <span className="text-zinc-300">"{act.targetTitle}"</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-white/40">
                        {new Date(act.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QUICK BACKUPS */}
          {activeTab === 'quick-backup' && (
            <div className="bg-[#08080C] border border-white/5 rounded-lg p-5 space-y-5 font-mono text-xs">
              <div className="border-b border-white/5 pb-2">
                <span className="text-zinc-200 font-bold uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-400" /> One-Click Forensics Cloud Sync
                </span>
                <p className="text-[11px] text-white/40 mt-1">
                  Synchronize active security states, incident response archives, and compiled threat rules to your configured Google Drive folder.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-black/40 border border-white/10 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-purple-400 font-bold">
                    <Binary size={16} />
                    <span>Threat & Incident Response Archive</span>
                  </div>
                  <p className="text-[11px] text-white/60">
                    Export all archived kernel syscall events, AST security findings, and triage notes into a structured JSON file on Google Drive.
                  </p>
                  <button
                    onClick={handleBackupThreatArchive}
                    disabled={isUploading}
                    className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded uppercase font-bold text-[10px] tracking-wider cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <UploadCloud size={12} /> Sync Threat Archive to Drive
                  </button>
                </div>

                <div className="p-4 bg-black/40 border border-white/10 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-[#00f0ff] font-bold">
                    <Scale size={16} />
                    <span>SMT Prover Proof Benchmarks</span>
                  </div>
                  <p className="text-[11px] text-white/60">
                    Save generated Z3 / angr SMT-LIB2 constant-time verification scripts and dual-execution proofs directly into your Drive directory.
                  </p>
                  <button
                    onClick={() => {
                      setUploadFileName(`constant_time_proof_${Date.now()}.smt2`);
                      setUploadContent('; SMT-LIB2 Constant Time Dual Execution Benchmark\n(set-logic QF_BV)\n(check-sat)\n');
                      setUploadMimeType('text/plain');
                      setIsUploadModalOpen(true);
                    }}
                    className="w-full py-2 bg-[#00f0ff]/15 hover:bg-[#00f0ff]/25 text-[#00f0ff] border border-[#00f0ff]/40 rounded uppercase font-bold text-[10px] tracking-wider cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <FilePlus size={12} /> Compose SMT Artifact for Drive
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* INSPECT & LOAD INTO TOOL MODAL */}
      <AnimatePresence>
        {isPreviewModalOpen && selectedFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0A0A0E] border border-white/10 rounded-lg w-full max-w-3xl overflow-hidden shadow-2xl font-mono text-xs flex flex-col max-h-[85vh]"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/50">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-[#00f0ff]" />
                  <span className="font-bold text-zinc-100 truncate max-w-md">{selectedFile.name}</span>
                  <span className="text-[10px] text-white/40">({formatFileSize(selectedFile.size)})</span>
                </div>
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="text-white/40 hover:text-white text-base cursor-pointer px-2"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                {isPreviewLoading ? (
                  <div className="py-16 text-center text-white/40 space-y-2">
                    <RefreshCw size={20} className="animate-spin text-[#00f0ff] mx-auto" />
                    <div>Fetching file content from Google Drive...</div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-[11px] text-white/50">
                      <span>RAW CONTENT PREVIEW:</span>
                      {selectedFile.webViewLink && (
                        <a
                          href={selectedFile.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00f0ff] hover:underline flex items-center gap-1"
                        >
                          Open in Google Drive <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <pre className="bg-black/80 border border-white/10 p-3.5 rounded text-emerald-400 text-[11px] overflow-x-auto max-h-72 leading-relaxed">
                      {previewContent}
                    </pre>

                    {/* LOAD INTO TOOL BUTTONS */}
                    {onLoadIntoTool && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <span className="text-[10px] text-white/40 uppercase block font-bold">
                          Import Content Into Security Toolkit Modules:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <button
                            onClick={() => handleLoadIntoTool('smt-verifier')}
                            className="p-2 bg-black/40 hover:bg-[#00f0ff]/15 border border-white/10 hover:border-[#00f0ff]/40 text-zinc-200 hover:text-[#00f0ff] rounded text-[10px] uppercase font-bold cursor-pointer transition-all flex items-center gap-1.5"
                          >
                            <Scale size={12} className="text-[#00f0ff]" /> SMT Constant-Time
                          </button>
                          <button
                            onClick={() => handleLoadIntoTool('ast')}
                            className="p-2 bg-black/40 hover:bg-[#00f0ff]/15 border border-white/10 hover:border-[#00f0ff]/40 text-zinc-200 hover:text-[#00f0ff] rounded text-[10px] uppercase font-bold cursor-pointer transition-all flex items-center gap-1.5"
                          >
                            <FileCode size={12} className="text-amber-400" /> AST Analyzer
                          </button>
                          <button
                            onClick={() => handleLoadIntoTool('yara')}
                            className="p-2 bg-black/40 hover:bg-[#00f0ff]/15 border border-white/10 hover:border-[#00f0ff]/40 text-zinc-200 hover:text-[#00f0ff] rounded text-[10px] uppercase font-bold cursor-pointer transition-all flex items-center gap-1.5"
                          >
                            <Terminal size={12} className="text-purple-400" /> YARA Compiler
                          </button>
                          <button
                            onClick={() => handleLoadIntoTool('entropy')}
                            className="p-2 bg-black/40 hover:bg-[#00f0ff]/15 border border-white/10 hover:border-[#00f0ff]/40 text-zinc-200 hover:text-[#00f0ff] rounded text-[10px] uppercase font-bold cursor-pointer transition-all flex items-center gap-1.5"
                          >
                            <Activity size={12} className="text-emerald-400" /> Entropy Visualizer
                          </button>
                          <button
                            onClick={() => handleLoadIntoTool('signature')}
                            className="p-2 bg-black/40 hover:bg-[#00f0ff]/15 border border-white/10 hover:border-[#00f0ff]/40 text-zinc-200 hover:text-[#00f0ff] rounded text-[10px] uppercase font-bold cursor-pointer transition-all flex items-center gap-1.5"
                          >
                            <Cpu size={12} className="text-rose-400" /> Signature Scanner
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE FOLDER MODAL */}
      <AnimatePresence>
        {isFolderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0A0A0E] border border-white/10 rounded-lg w-full max-w-md p-5 shadow-2xl font-mono text-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-bold text-zinc-100 flex items-center gap-2">
                  <FolderPlus size={14} className="text-[#00f0ff]" /> Create Google Drive Folder
                </span>
                <button onClick={() => setIsFolderModalOpen(false)} className="text-white/40 hover:text-white">✕</button>
              </div>

              <div>
                <label className="block text-[10px] text-white/40 uppercase mb-1">Folder Name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name..."
                  className="w-full bg-black/50 border border-white/10 rounded p-2 text-zinc-200 focus:outline-none focus:border-[#00f0ff]/60"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-3 py-1.5 text-white/50 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="px-4 py-1.5 bg-[#00f0ff]/15 hover:bg-[#00f0ff] hover:text-black text-[#00f0ff] border border-[#00f0ff]/40 rounded uppercase font-bold text-[10px] cursor-pointer transition-all disabled:opacity-50"
                >
                  {isCreatingFolder ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* UPLOAD FILE MODAL */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0A0A0E] border border-white/10 rounded-lg w-full max-w-lg p-5 shadow-2xl font-mono text-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-bold text-zinc-100 flex items-center gap-2">
                  <UploadCloud size={14} className="text-[#00f0ff]" /> Upload to Google Drive
                </span>
                <button onClick={() => setIsUploadModalOpen(false)} className="text-white/40 hover:text-white">✕</button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-white/40 uppercase mb-1">Target Filename</label>
                  <input
                    type="text"
                    value={uploadFileName}
                    onChange={(e) => setUploadFileName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded p-2 text-zinc-200 focus:outline-none focus:border-[#00f0ff]/60"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-white/40 uppercase mb-1">MIME Type</label>
                  <select
                    value={uploadMimeType}
                    onChange={(e) => setUploadMimeType(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded p-2 text-zinc-200"
                  >
                    <option value="application/json">application/json (Threat Artifact)</option>
                    <option value="text/plain">text/plain (Rules / SMT Formula)</option>
                    <option value="application/octet-stream">application/octet-stream (Binary / Dump)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-white/40 uppercase mb-1">File Payload Content</label>
                  <textarea
                    rows={6}
                    value={uploadContent}
                    onChange={(e) => setUploadContent(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded p-2.5 text-emerald-400 font-mono text-xs focus:outline-none resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-3 py-1.5 text-white/50 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadFile}
                  disabled={isUploading || !uploadFileName.trim()}
                  className="px-4 py-1.5 bg-[#00f0ff]/15 hover:bg-[#00f0ff] hover:text-black text-[#00f0ff] border border-[#00f0ff]/40 rounded uppercase font-bold text-[10px] cursor-pointer transition-all disabled:opacity-50"
                >
                  {isUploading ? 'Uploading to Drive...' : 'Confirm Upload'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MANDATORY EXPLICIT CONFIRMATION MODAL FOR DESTRUCTIVE OPERATIONS */}
      <AnimatePresence>
        {fileToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0E0A0A] border border-rose-500/40 rounded-lg w-full max-w-md p-5 shadow-2xl font-mono text-xs space-y-4"
            >
              <div className="flex items-center gap-2.5 text-rose-400 border-b border-rose-500/20 pb-2">
                <AlertTriangle size={18} />
                <span className="font-bold text-sm uppercase">Confirm Delete Operation</span>
              </div>

              <p className="text-zinc-300 text-xs leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-rose-300">"{fileToDelete.name}"</strong> from your Google Drive?
              </p>

              <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded text-[11px] text-rose-200">
                ⚠️ This action mutates user storage and cannot be undone.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => setFileToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-1.5 bg-black/40 hover:bg-black/60 border border-white/10 text-white/70 hover:text-white rounded cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold uppercase text-[10px] tracking-wider cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting from Drive...' : 'Confirm Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
