# Aegis Unified Security Suite (`v2.5.0-Enterprise`)

An interactive, full-stack cybersecurity operations, binary forensics, and space/ground-station telemetry console built with **React 19**, **Vite 6**, **Tailwind CSS v4**, **Express 4**, **Socket.IO**, **Recharts**, **jsPDF**, and **Google Gemini (`gemini-4-hydrogen`)**.

---

## Key Capabilities & Modules

### 1. Operational Dashboard & Real-Time Visualization
- **24-Hour Alert Velocity Mini-Chart (`Recharts`)**: Interactive area/bar chart tracking hourly **eBPF Kernel** and **AST Static** alert frequencies over the trailing 24 hours, with dynamic spike threshold detection.
- **Threat Frequency Heatmap**: Color-coded 24-hour rolling grid visualizing alert density across severity tiers (`Critical`, `Medium`, `Low`, `All`) sourced from the durable Threat Archive (`localStorage` key `aegis_threat_archive`), complete with clickable hourly incident inspection.
- **RF & Ground-Station Hardening Controls**: Live carrier SNR, Doppler shift, jitter, and anomaly injection controls alongside security posture toggles (`SNMPv3`, `HTTPS/TLS`, `VLAN Segmentation`, `Cryptographic Firmware Signatures`).

### 2. iPhone Deep Diagnostics & Forensic Analyzer
- **USB Cable (`WebUSB` & Host USB Bridge `/api/iphone/host-usb`)**: Direct Apple VID (`0x05AC`) USB connection reading hardware product IDs, boot states (`Normal`, `Recovery`, `DFU`), serial/interface descriptors, and optional `libimobiledevice` battery domain telemetry.
- **Bluetooth LE (`Web Bluetooth`)**: GATT device discovery with live `battery_level` notifications, Battery Health/Energy characteristics (`0x2BED`/`0x2BEB`/`0x2BF0`), thermal sensing, and Apple Continuity UUIDs.
- **Cable / Internet Tether Relay**: Generates a live 6-digit relay pairing session (`/api/iphone/session`, `/api/iphone/ingest/:code`) streaming real-time battery voltage, thermal status, and device telemetry over **Socket.IO** (`iphone_telemetry`) and HTTPS.
- **Battery & Power Health**: Real-time readout of connected **battery voltage**, **thermal status**, **charging cycles**, and **charge/power state** exclusively from real attached hardware, browser `navigator.getBattery()`, or imported `.ips`/Powerlog streams, plus a **Low Power Mode Stress Test** measuring real WebCrypto throughput and animation-frame pacing.
- **`.ips` Crash & `sysdiagnose` Inspector**: Parses imported iOS analytics logs for jailbreak/hook markers (`frida`, `dyld_insert`, `/private/var/jb`), critical subsystem crashes (`BlastDoor`, `IMTransferAgent`, `WebKit`), untrusted MDM/root CAs, battery faults, and AI deep forensic triage.

### 3. Advanced Tactical & Formal Analysis Suite
- **Adaptive WAF & Protocol Firewall**: OWASP CRS-style HTTP/uplink payload inspection with custom regex rule creation and risk scoring.
- **Behavioral Malware Detonation Sandbox**: Isolated micro-VM execution simulator mapping syscall traces to MITRE ATT&CK techniques with one-click Threat Vault archiving.
- **Wireless & RF Spectrum Auditor**: 802.11 / Ku-Band beacon scanner, `Recharts` SNR vs. interference chart, deauth flood simulation, and BSSID containment.
- **Vulnerability Scanner & Penetration Framework**: CISA KEV vulnerability verification and uplink payload injection exercises.
- **9-Element Tactical Suite**: Network scanner, password strength auditor, social engineering analyzer, sandbox runner, forensic extractor, report compiler, RF jamming check, IDS feed, and compliance checklist.
- **Static, Binary & Formal Provers**:
  - **AST Static Security Analyzer**
  - **eBPF Live Kernel Syscall Monitor**
  - **PE Executable Header & Section Inspector**
  - **Shannon Entropy Visualizer**
  - **Aho-Corasick Signature Scanner**
  - **YARA Rule Compiler** (AI + offline heuristic synthesis)
  - **Diffie-Hellman & HKDF Key Generator**
  - **SMT Constant-Time Prover** (side-channel verification)
  - **AI Threat Coprocessor** (`/api/gemini/analyze`)

### 4. Persistence, Cloud Evidence & Forensic Exports
- **60-Second Auto-Save**: Automatically persists active forensic audit state to `localStorage` (`aegis_forensic_audit_state`) with live countdown and manual force-save controls.
- **Forensic Data Exporter (`JSON` / `CSV` / `PDF`)**:
  - Generates unified **JSON** dumps, **CSV** incident matrices, and formal multi-page **A4 PDF** reports (`jsPDF`) featuring an executive **Cover Page** with **timestamp**, **system status**, KPI snapshot, metrics table, and categorized findings.
- **Universal Module `ExportButton`**: Every module supports direct export in **JSON**, **CSV**, **Text**, **PDF**, and Clipboard copy.
- **Google Drive Vault**: Optional Firebase/Google OAuth cloud evidence vault (gracefully degrades when `firebase-applet-config.json` is absent).

---

## Project Structure

```text
├── index.html                  # App entry HTML & metadata
├── metadata.json               # AI Studio applet capability manifest
├── server.ts                   # Express + Socket.IO + Gemini API + Vite middleware
├── .env.example                # Environment variable template
├── package.json                # Dependencies & npm scripts
├── src-tauri/tauri.conf.json   # Optional Tauri desktop shell configuration
└── src/
    ├── App.tsx                 # Main workspace shell, auto-save, & Forensic Exporter
    ├── types.ts                # Shared TypeScript interfaces & ActiveTool routes
    ├── utils/exportUtils.ts    # JSON, CSV, TXT, and jsPDF report generators
    ├── services/               # Optional Firebase / Google Drive OAuth helpers
    └── components/             # Security modules, charts, heatmaps, & UI widgets
```

---

## Setup & Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env` (or configure secrets in AI Studio):
   - `GEMINI_API_KEY` — Server-side key for `gemini-4-hydrogen` AI Threat Coprocessor and YARA synthesis (falls back gracefully to the local heuristic engine when unset).
   - `SECURE_RPC_URL` — Optional Ethereum JSON-RPC endpoint for live block telemetry (defaults to `http://127.0.0.1:8545`, falls back gracefully to simulated telemetry if offline).

3. **Run in development mode** (serves Express API + Vite SPA on port `3000`):
   ```bash
   npm run dev
   ```

4. **Type-check & production build**:
   ```bash
   npm run lint
   npm run build
   npm start
   ```
