import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
  Smartphone,
  Usb,
  Bluetooth,
  Globe,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Upload,
  Sparkles,
  RefreshCw,
  Archive,
  Copy,
  Check,
  Unplug,
  Activity,
  Battery,
  BatteryCharging,
  Thermometer,
  Zap,
  Gauge,
  Play,
  Square,
  ExternalLink
} from 'lucide-react';
import ExportButton from './ExportButton';
import { ArchivedThreat } from '../types';

type ConnectionMode = 'usb' | 'bluetooth' | 'internet';

interface ConnectedDeviceInfo {
  transport: ConnectionMode;
  name: string;
  manufacturer: string;
  modelOrProductId: string;
  serialOrId: string;
  iosMode: string;
  batteryPercent: number | null;
  servicesOrInterfaces: string[];
  connectedAt: string;
  rawDescriptor: Record<string, any>;
}

interface BatteryTelemetry {
  voltageMv: number | null;
  thermalState: string | null;
  temperatureC: number | null;
  cycleCount: number | null;
  chargePercent: number | null;
  isCharging: boolean | null;
  lowPowerMode: boolean | null;
  designCapacityMah: number | null;
  nominalCapacityMah: number | null;
  sourceLabel: string | null;
  updatedAt: string | null;
}

interface HostBrowserBatteryState {
  supported: boolean;
  levelPct: number | null;
  charging: boolean | null;
  chargingTimeSec: number | null;
  dischargingTimeSec: number | null;
  updatedAt: string | null;
}

interface TelemetrySamplePoint {
  timeLabel: string;
  timestampMs: number;
  voltageMv: number | null;
  chargePercent: number | null;
  temperatureC: number | null;
}

interface StressTestResult {
  startedAt: string;
  completedAt: string;
  durationSec: number;
  totalOps: number;
  opsPerSec: number;
  avgFrameMs: number;
  p95FrameMs: number;
  droppedFrames: number;
  deviceSamplesDuringTest: number;
  voltageDeltaMv: number | null;
  chargeDeltaPct: number | null;
  thermalObserved: string | null;
  verdict: string;
}

interface DiagnosticFinding {
  id: string;
  domain: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  remediation: string;
}

interface IphoneDiagnosticsProps {
  triggerToast?: (msg: string) => void;
}

const EMPTY_BATTERY_TELEMETRY: BatteryTelemetry = {
  voltageMv: null,
  thermalState: null,
  temperatureC: null,
  cycleCount: null,
  chargePercent: null,
  isCharging: null,
  lowPowerMode: null,
  designCapacityMah: null,
  nominalCapacityMah: null,
  sourceLabel: null,
  updatedAt: null
};

function decodeAppleProductId(pid: number): string {
  switch (pid) {
    case 0x12a8:
      return 'Normal Mode (iPhone / usbmuxd + PTP)';
    case 0x12ab:
      return 'Normal Mode (iPad / usbmuxd)';
    case 0x1281:
      return 'Recovery Mode (iBoot)';
    case 0x1227:
      return 'DFU Mode (SecureROM)';
    case 0x12a0:
    case 0x12a2:
    case 0x12aa:
      return 'Apple Mobile Device Composite (Tether / usbmuxd)';
    default:
      if (pid >= 0x1290 && pid <= 0x129f) {
        return `Apple Mobile Device USB Mode (0x${pid.toString(16).toUpperCase()})`;
      }
      return `Apple USB PID 0x${pid.toString(16).toUpperCase()}`;
  }
}

function classifyUsbInterface(cls: number, subCls: number, proto: number): string {
  if (cls === 0xff && subCls === 0xfe && proto === 0x02) return 'Apple usbmuxd';
  if (cls === 0xff && subCls === 0x42) return 'Apple NCM / USB Tether';
  if (cls === 0x02 && subCls === 0x0d) return 'CDC NCM Network Tether';
  if (cls === 0x06 && subCls === 0x01) return 'PTP / Media Transfer';
  if (cls === 0x01) return 'USB Audio';
  if (cls === 0x03) return 'HID';
  return `Class 0x${cls.toString(16).padStart(2, '0')}`;
}

function decodeSfloat16(raw: number): number | null {
  if (raw === 0x07ff || raw === 0x0800 || raw === 0x0801 || raw === 0x07fe) return null;
  let mantissa = raw & 0x0fff;
  if (mantissa >= 0x0800) mantissa -= 0x1000;
  let exponent = (raw >> 12) & 0x0f;
  if (exponent >= 0x08) exponent -= 0x10;
  return mantissa * Math.pow(10, exponent);
}

function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toBooleanOrNull(val: unknown): boolean | null {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === '1' || val === 1) return true;
  if (val === 'false' || val === '0' || val === 0) return false;
  return null;
}

function extractBatteryTelemetryFromPayload(
  obj: Record<string, any> | null | undefined,
  sourceLabel: string
): Partial<BatteryTelemetry> {
  if (!obj || typeof obj !== 'object') return {};

  const rawVoltageMv =
    toFiniteNumber(obj.batteryVoltageMv) ??
    toFiniteNumber(obj.voltageMv) ??
    toFiniteNumber(obj.Voltage) ??
    (() => {
      const v = toFiniteNumber(obj.batteryVoltageV ?? obj.voltage);
      if (v === null) return null;
      return v < 20 ? Math.round(v * 1000) : Math.round(v);
    })();

  let tempC = toFiniteNumber(obj.temperatureC ?? obj.batteryTempC);
  if (tempC === null) {
    const rawTemp = toFiniteNumber(obj.Temperature ?? obj.BatteryTemp ?? obj.VirtualTemperature);
    if (rawTemp !== null) {
      tempC = rawTemp > 200 ? Number((rawTemp / 100).toFixed(1)) : Number(rawTemp.toFixed(1));
    }
  }

  const thermalStateRaw =
    obj.thermalState ?? obj.ThermalLevel ?? obj.thermalStatus ?? obj.temperatureState ?? null;

  const cycleCount =
    toFiniteNumber(obj.cycleCount ?? obj.CycleCount ?? obj.chargingCycles ?? obj.batteryCycleCount);

  const chargePercent =
    toFiniteNumber(
      obj.batteryLevel ?? obj.batteryPercent ?? obj.BatteryCurrentCapacity ?? obj.CurrentCapacity
    );

  const designCapacityMah = toFiniteNumber(obj.designCapacityMah ?? obj.DesignCapacity);
  const nominalCapacityMah = toFiniteNumber(
    obj.nominalCapacityMah ?? obj.NominalChargeCapacity ?? obj.AppleRawMaxCapacity
  );

  return {
    ...(rawVoltageMv !== null ? { voltageMv: rawVoltageMv } : {}),
    ...(thermalStateRaw !== null && String(thermalStateRaw).trim() !== ''
      ? { thermalState: String(thermalStateRaw) }
      : {}),
    ...(tempC !== null ? { temperatureC: tempC } : {}),
    ...(cycleCount !== null ? { cycleCount: Math.round(cycleCount) } : {}),
    ...(chargePercent !== null ? { chargePercent } : {}),
    ...(toBooleanOrNull(obj.isCharging ?? obj.BatteryIsCharging ?? obj.charging) !== null
      ? { isCharging: toBooleanOrNull(obj.isCharging ?? obj.BatteryIsCharging ?? obj.charging) }
      : {}),
    ...(toBooleanOrNull(obj.lowPowerMode ?? obj.LowPowerModeEnabled) !== null
      ? { lowPowerMode: toBooleanOrNull(obj.lowPowerMode ?? obj.LowPowerModeEnabled) }
      : {}),
    ...(designCapacityMah !== null ? { designCapacityMah } : {}),
    ...(nominalCapacityMah !== null ? { nominalCapacityMah } : {}),
    sourceLabel,
    updatedAt: obj.receivedAt || new Date().toISOString()
  };
}

function parseBatteryTelemetryFromText(raw: string): Partial<BatteryTelemetry> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Attempt JSON extraction first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const target = Array.isArray(parsed) ? parsed[0] : parsed;
      const extracted = extractBatteryTelemetryFromPayload(target, 'Imported iOS JSON / .ips Log');
      if (
        extracted.voltageMv !== undefined ||
        extracted.thermalState !== undefined ||
        extracted.temperatureC !== undefined ||
        extracted.cycleCount !== undefined ||
        extracted.chargePercent !== undefined
      ) {
        return extracted;
      }
    } catch {
      // Fall through to regex/key-value extraction (multi-JSON .ips header + payload)
    }
  }

  const out: Partial<BatteryTelemetry> = {};

  const voltMvMatch = trimmed.match(
    /(?:batteryVoltageMv|voltageMv|Voltage)["'\s:=]+(\d{3,4}(?:\.\d+)?)/i
  );
  const voltVMatch = trimmed.match(/(?:batteryVoltageV|voltage)["'\s:=]+(\d(?:\.\d{1,3}))\s*V?/i);
  if (voltMvMatch) {
    out.voltageMv = Math.round(Number(voltMvMatch[1]));
  } else if (voltVMatch) {
    out.voltageMv = Math.round(Number(voltVMatch[1]) * 1000);
  }

  const cycleMatch = trimmed.match(/(?:CycleCount|cycleCount|chargingCycles)["'\s:=]+(\d{1,5})/i);
  if (cycleMatch) {
    out.cycleCount = parseInt(cycleMatch[1], 10);
  }

  const thermalMatch = trimmed.match(
    /(?:thermalState|ThermalLevel|thermalStatus)["'\s:=]+"?([A-Za-z0-9_-]+)"?/i
  );
  if (thermalMatch) {
    out.thermalState = thermalMatch[1];
  }

  const tempMatch = trimmed.match(
    /(?:temperatureC|BatteryTemp|VirtualTemperature|Temperature)["'\s:=]+(\d{1,4}(?:\.\d+)?)/i
  );
  if (tempMatch) {
    const t = Number(tempMatch[1]);
    out.temperatureC = t > 200 ? Number((t / 100).toFixed(1)) : Number(t.toFixed(1));
  }

  const capMatch = trimmed.match(
    /(?:batteryLevel|BatteryCurrentCapacity|CurrentCapacity)["'\s:=]+(\d{1,3}(?:\.\d+)?)/i
  );
  if (capMatch) {
    const c = Number(capMatch[1]);
    if (c >= 0 && c <= 100) out.chargePercent = c;
  }

  const lpmMatch = trimmed.match(/(?:lowPowerMode|LowPowerModeEnabled)["'\s:=]+(true|false|1|0)/i);
  if (lpmMatch) {
    out.lowPowerMode = lpmMatch[1].toLowerCase() === 'true' || lpmMatch[1] === '1';
  }

  const chgMatch = trimmed.match(/(?:isCharging|BatteryIsCharging|ExternalConnected)["'\s:=]+(true|false|1|0)/i);
  if (chgMatch) {
    out.isCharging = chgMatch[1].toLowerCase() === 'true' || chgMatch[1] === '1';
  }

  const hasAny =
    out.voltageMv !== undefined ||
    out.thermalState !== undefined ||
    out.temperatureC !== undefined ||
    out.cycleCount !== undefined ||
    out.chargePercent !== undefined;

  if (!hasAny) return null;
  out.sourceLabel = 'Imported iOS .ips / Powerlog Stream';
  out.updatedAt = new Date().toISOString();
  return out;
}

export default function IphoneDiagnostics({ triggerToast }: IphoneDiagnosticsProps) {
  const [activeTransport, setActiveTransport] = useState<ConnectionMode>('usb');
  const [connectedDevice, setConnectedDevice] = useState<ConnectedDeviceInfo | null>(null);
  const [transportNotice, setTransportNotice] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Real Battery & Power Health State (exclusively from connected hardware, real logs, or real sensors)
  const [liveDeviceBattery, setLiveDeviceBattery] = useState<BatteryTelemetry>(EMPTY_BATTERY_TELEMETRY);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetrySamplePoint[]>([]);
  const [hostBattery, setHostBattery] = useState<HostBrowserBatteryState>({
    supported: false,
    levelPct: null,
    charging: null,
    chargingTimeSec: null,
    dischargingTimeSec: null,
    updatedAt: null
  });

  // Host USB Bus Scan Results
  const [hostUsbCheckStatus, setHostUsbCheckStatus] = useState<{
    polledAt: string | null;
    libimobiledeviceAvailable: boolean;
    count: number;
  }>({ polledAt: null, libimobiledeviceAvailable: false, count: 0 });

  // Internet / Cable Tether Relay State
  const [relayCode, setRelayCode] = useState<string>('');
  const [relayTelemetry, setRelayTelemetry] = useState<Record<string, any> | null>(null);
  const [relayLastPing, setRelayLastPing] = useState<string>('');
  const [copiedRelay, setCopiedRelay] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Diagnostic Artifact / Log Input (starts empty — zero fabricated logs)
  const [diagnosticInput, setDiagnosticInput] = useState<string>('');
  const [aiReport, setAiReport] = useState<string>('');
  const [aiModelUsed, setAiModelUsed] = useState<string>('');
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);

  // Low Power Mode Stress Test State (real runtime measurements)
  const [stressRunning, setStressRunning] = useState(false);
  const [stressProgressPct, setStressProgressPct] = useState(0);
  const [stressLiveMetrics, setStressLiveMetrics] = useState<{
    opsCount: number;
    opsPerSec: number;
    avgFrameMs: number;
  }>({ opsCount: 0, opsPerSec: 0, avgFrameMs: 0 });
  const [stressResult, setStressResult] = useState<StressTestResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const usbDeviceRef = useRef<any>(null);
  const bleDeviceRef = useRef<any>(null);
  const bleNotifyCharRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const stressAbortRef = useRef<boolean>(false);
  const stressRunningRef = useRef<boolean>(false);
  const stressSamplesCountRef = useRef<number>(0);

  // Chart container sizing (avoids Recharts ResponsiveContainer -1 width warning)
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const usbSupported = typeof navigator !== 'undefined' && Boolean((navigator as any).usb);
  const bleSupported = typeof navigator !== 'undefined' && Boolean((navigator as any).bluetooth);
  const isEmbeddedIframe =
    typeof window !== 'undefined' &&
    (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

  const [usbIframeBlocked, setUsbIframeBlocked] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    try {
      const policy = (document as any).permissionsPolicy || (document as any).featurePolicy;
      if (policy && typeof policy.allowsFeature === 'function') {
        return policy.allowsFeature('usb') === false;
      }
    } catch {
      // Ignore feature policy check error
    }
    return false;
  });
  const [isCloudHost, setIsCloudHost] = useState(false);
  const [copiedUsbBridge, setCopiedUsbBridge] = useState(false);

  const pushTelemetrySample = useCallback((next: Partial<BatteryTelemetry>) => {
    if (
      next.voltageMv === undefined &&
      next.chargePercent === undefined &&
      next.temperatureC === undefined
    ) {
      return;
    }
    const now = Date.now();
    if (stressRunningRef.current && !stressAbortRef.current) {
      stressSamplesCountRef.current += 1;
    }
    setTelemetryHistory((prev) => {
      const point: TelemetrySamplePoint = {
        timeLabel: new Date(now).toLocaleTimeString([], { hour12: false }),
        timestampMs: now,
        voltageMv: next.voltageMv ?? null,
        chargePercent: next.chargePercent ?? null,
        temperatureC: next.temperatureC ?? null
      };
      return [...prev.slice(-29), point];
    });
  }, []);

  const mergeLiveBattery = useCallback(
    (patch: Partial<BatteryTelemetry>) => {
      setLiveDeviceBattery((prev) => ({
        ...prev,
        ...patch
      }));
      pushTelemetrySample(patch);
    },
    [pushTelemetrySample]
  );

  // Observe chart wrapper width
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const update = () => setChartWidth(Math.max(0, Math.floor(el.getBoundingClientRect().width)));
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [telemetryHistory.length]);

  // Monitor real browser runtime W3C Battery Status API (only if supported by browser/OS)
  useEffect(() => {
    let batteryManager: any = null;
    let cancelled = false;

    const nav = navigator as any;
    if (typeof nav?.getBattery !== 'function') {
      return;
    }

    const syncHostBattery = (bm: any) => {
      if (cancelled) return;
      setHostBattery({
        supported: true,
        levelPct: typeof bm.level === 'number' ? Math.round(bm.level * 100) : null,
        charging: typeof bm.charging === 'boolean' ? bm.charging : null,
        chargingTimeSec: Number.isFinite(bm.chargingTime) ? bm.chargingTime : null,
        dischargingTimeSec: Number.isFinite(bm.dischargingTime) ? bm.dischargingTime : null,
        updatedAt: new Date().toISOString()
      });
    };

    const handler = () => {
      if (batteryManager) syncHostBattery(batteryManager);
    };

    nav
      .getBattery()
      .then((bm: any) => {
        if (cancelled) return;
        batteryManager = bm;
        syncHostBattery(bm);
        bm.addEventListener('levelchange', handler);
        bm.addEventListener('chargingchange', handler);
        bm.addEventListener('chargingtimechange', handler);
        bm.addEventListener('dischargingtimechange', handler);
      })
      .catch(() => {
        // Battery API blocked or unsupported
      });

    return () => {
      cancelled = true;
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', handler);
        batteryManager.removeEventListener('chargingchange', handler);
        batteryManager.removeEventListener('chargingtimechange', handler);
        batteryManager.removeEventListener('dischargingtimechange', handler);
      }
    };
  }, []);

  // Apply real telemetry extracted from any imported .ips / sysdiagnose / IOPMPowerSource text
  const parsedLogBattery = useMemo(
    () => parseBatteryTelemetryFromText(diagnosticInput),
    [diagnosticInput]
  );

  // Unified real Battery & Power view: prefers live connected hardware transport, falls back to real imported diagnostic log values
  const activePowerHealth: BatteryTelemetry = useMemo(() => {
    const hasLiveHardware = Boolean(liveDeviceBattery.sourceLabel);
    if (hasLiveHardware) {
      return {
        voltageMv: liveDeviceBattery.voltageMv ?? parsedLogBattery?.voltageMv ?? null,
        thermalState: liveDeviceBattery.thermalState ?? parsedLogBattery?.thermalState ?? null,
        temperatureC: liveDeviceBattery.temperatureC ?? parsedLogBattery?.temperatureC ?? null,
        cycleCount: liveDeviceBattery.cycleCount ?? parsedLogBattery?.cycleCount ?? null,
        chargePercent: liveDeviceBattery.chargePercent ?? parsedLogBattery?.chargePercent ?? null,
        isCharging: liveDeviceBattery.isCharging ?? parsedLogBattery?.isCharging ?? null,
        lowPowerMode: liveDeviceBattery.lowPowerMode ?? parsedLogBattery?.lowPowerMode ?? null,
        designCapacityMah:
          liveDeviceBattery.designCapacityMah ?? parsedLogBattery?.designCapacityMah ?? null,
        nominalCapacityMah:
          liveDeviceBattery.nominalCapacityMah ?? parsedLogBattery?.nominalCapacityMah ?? null,
        sourceLabel: liveDeviceBattery.sourceLabel,
        updatedAt: liveDeviceBattery.updatedAt
      };
    }

    if (parsedLogBattery) {
      return {
        ...EMPTY_BATTERY_TELEMETRY,
        ...parsedLogBattery
      };
    }

    return EMPTY_BATTERY_TELEMETRY;
  }, [liveDeviceBattery, parsedLogBattery]);

  // Apply real relay telemetry packet helper
  const applyRelayTelemetry = useCallback(
    (code: string, payload: Record<string, any>) => {
      setRelayTelemetry(payload);
      setRelayLastPing(payload.receivedAt || new Date().toISOString());

      const extracted = extractBatteryTelemetryFromPayload(
        payload,
        `Socket.IO Tether Relay (#${code})`
      );
      mergeLiveBattery(extracted);

      setConnectedDevice({
        transport: 'internet',
        name: payload.deviceName || payload.deviceModel || 'iPhone (Tethered Relay)',
        manufacturer: 'Apple Inc.',
        modelOrProductId: payload.osVersion || payload.deviceModel || 'iOS Tether Telemetry',
        serialOrId: `RELAY-${code}`,
        iosMode: payload.connectionType || 'USB/Internet Tether Active',
        batteryPercent: extracted.chargePercent ?? null,
        servicesOrInterfaces: [
          `Relay Session #${code}`,
          payload.activeInterface || 'HTTPS Telemetry Ingest',
          payload.clientIp ? `Peer ${payload.clientIp}` : 'Encrypted TLS'
        ],
        connectedAt: payload.receivedAt || new Date().toISOString(),
        rawDescriptor: payload
      });

      setDiagnosticInput(JSON.stringify(payload, null, 2));
    },
    [mergeLiveBattery]
  );

  // Real-time Socket.IO subscription + polling fallback for Internet Tether Relay
  useEffect(() => {
    if (!relayCode) return;

    const socket = io();
    socketRef.current = socket;

    const onTelemetry = (evt: { code: string; telemetry: Record<string, any> }) => {
      if (evt?.code === relayCode && evt.telemetry) {
        applyRelayTelemetry(relayCode, evt.telemetry);
      }
    };

    socket.on('iphone_telemetry', onTelemetry);

    const poll = async () => {
      try {
        const res = await fetch(`/api/iphone/session/${relayCode}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.telemetry) {
          applyRelayTelemetry(relayCode, data.telemetry);
        }
      } catch {
        // Silent retry on transient network errors
      }
    };

    poll();
    const timer = setInterval(poll, 5000);

    return () => {
      clearInterval(timer);
      socket.off('iphone_telemetry', onTelemetry);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [relayCode, applyRelayTelemetry]);

  const handleDisconnect = async () => {
    try {
      if (bleNotifyCharRef.current) {
        await bleNotifyCharRef.current.stopNotifications().catch(() => {});
        bleNotifyCharRef.current = null;
      }
      if (usbDeviceRef.current?.opened) {
        await usbDeviceRef.current.close();
      }
      if (bleDeviceRef.current?.gatt?.connected) {
        bleDeviceRef.current.gatt.disconnect();
      }
    } catch {
      // Ignore disconnect errors
    }
    usbDeviceRef.current = null;
    bleDeviceRef.current = null;
    setConnectedDevice(null);
    setLiveDeviceBattery(EMPTY_BATTERY_TELEMETRY);
    setTelemetryHistory([]);
    setTransportNotice('Disconnected active iPhone diagnostic transport.');
    if (triggerToast) triggerToast('Disconnected iPhone diagnostic session.');
  };

  // Probe physically connected Apple USB devices on the server host (/api/iphone/host-usb)
  const handleScanHostUsb = async () => {
    setIsConnecting(true);
    setTransportNotice('');
    try {
      const res = await fetch('/api/iphone/host-usb');
      const data = await res.json();
      const devices: Array<Record<string, any>> = Array.isArray(data.devices) ? data.devices : [];
      setIsCloudHost(Boolean(data.isCloudContainer));
      setHostUsbCheckStatus({
        polledAt: data.polledAt || new Date().toISOString(),
        libimobiledeviceAvailable: Boolean(data.libimobiledeviceAvailable),
        count: devices.length
      });

      if (devices.length === 0) {
        setTransportNotice(
          data.isCloudContainer
            ? 'Server USB scan checked the remote cloud container (0 physical USB ports attached). Plug your iPhone into your computer and use Direct WebUSB (in a top-level tab) or the USB-to-Relay Bridge below.'
            : data.libimobiledeviceAvailable
              ? 'Host USB bus & libimobiledevice scanned: 0 Apple devices currently plugged in. Check your cable and unlock the iPhone.'
              : 'Host USB bus scanned: 0 Apple VID 0x05AC devices detected on local USB bus.'
        );
        return;
      }

      const primary = devices[0];
      const bat = primary.battery || null;
      const pidNum =
        typeof primary.productId === 'string'
          ? parseInt(primary.productId, 16)
          : Number(primary.productId || 0);

      const info: ConnectedDeviceInfo = {
        transport: 'usb',
        name: primary.deviceName || primary.productName || 'Apple iPhone',
        manufacturer: primary.manufacturer || 'Apple Inc.',
        modelOrProductId:
          primary.productType ||
          `VID ${primary.vendorId || '0x05ac'} · PID ${primary.productId || 'unknown'}`,
        serialOrId: primary.serialNumber || primary.udid || 'Locked',
        iosMode: primary.osVersion
          ? `iOS ${primary.osVersion} (${primary.source})`
          : pidNum
            ? decodeAppleProductId(pidNum)
            : 'Apple USB Attached',
        batteryPercent: bat?.batteryLevel ?? null,
        servicesOrInterfaces: [primary.source || 'host-usb', primary.busId || primary.udid || 'USB'],
        connectedAt: data.polledAt || new Date().toISOString(),
        rawDescriptor: primary
      };

      setConnectedDevice(info);
      setDiagnosticInput(JSON.stringify(primary, null, 2));

      if (bat) {
        mergeLiveBattery({
          voltageMv: bat.batteryVoltageMv ?? null,
          cycleCount: bat.cycleCount ?? null,
          temperatureC: bat.temperatureC ?? null,
          chargePercent: bat.batteryLevel ?? null,
          isCharging: bat.isCharging ?? null,
          sourceLabel: 'Host USB / libimobiledevice',
          updatedAt: data.polledAt || new Date().toISOString()
        });
      }

      setTransportNotice(`Detected real Apple USB hardware via ${primary.source}.`);
      if (triggerToast) triggerToast(`Connected to ${info.name} via Host USB.`);
    } catch {
      setTransportNotice('Unable to query host USB bus endpoint.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Helper to open/inspect a real WebUSB Apple device (handles OS usbmuxd exclusive locks + missing active configuration)
  const bindWebUsbDevice = useCallback(
    async (device: any, announce = true) => {
      usbDeviceRef.current = device;
      let osDriverLocked = false;
      let lockReason = '';

      try {
        if (!device.opened) {
          await device.open();
        }
        if (!device.configuration && Array.isArray(device.configurations) && device.configurations.length > 0) {
          await device.selectConfiguration(device.configurations[0].configurationValue);
        }
      } catch (openErr: any) {
        osDriverLocked = true;
        lockReason = openErr?.message || 'OS usbmuxd / Apple Mobile Device driver holds exclusive USB lock';
      }

      const activeConfig = device.configuration || device.configurations?.[0] || null;
      const interfaces: string[] = [];
      if (activeConfig?.interfaces) {
        activeConfig.interfaces.forEach((iface: any) => {
          const alt = iface.alternates?.[0];
          const label = alt
            ? classifyUsbInterface(alt.interfaceClass, alt.interfaceSubclass, alt.interfaceProtocol)
            : 'Interface';
          interfaces.push(`#${iface.interfaceNumber} (${label})`);
        });
      }

      const info: ConnectedDeviceInfo = {
        transport: 'usb',
        name: device.productName || 'Apple iPhone',
        manufacturer: device.manufacturerName || 'Apple Inc.',
        modelOrProductId: `VID 0x${device.vendorId.toString(16).padStart(4, '0')} · PID 0x${device.productId.toString(16).padStart(4, '0')}`,
        serialOrId: device.serialNumber || 'Locked (Unlock & tap Trust This Computer)',
        iosMode: decodeAppleProductId(device.productId),
        batteryPercent: null,
        servicesOrInterfaces: interfaces.length > 0 ? interfaces : ['Apple Composite USB Descriptor'],
        connectedAt: new Date().toISOString(),
        rawDescriptor: {
          vendorId: `0x${device.vendorId.toString(16).padStart(4, '0')}`,
          productId: `0x${device.productId.toString(16).padStart(4, '0')}`,
          productName: device.productName,
          manufacturerName: device.manufacturerName,
          serialNumber: device.serialNumber,
          usbVersion: `${device.usbVersionMajor}.${device.usbVersionMinor}`,
          deviceVersion: `${device.deviceVersionMajor}.${device.deviceVersionMinor}`,
          osDriverLocked,
          lockReason: lockReason || null,
          interfaces
        }
      };

      setConnectedDevice(info);
      setDiagnosticInput(JSON.stringify(info.rawDescriptor, null, 2));
      setLiveDeviceBattery((prev) => ({
        ...prev,
        sourceLabel: osDriverLocked
          ? 'WebUSB Descriptor (OS usbmuxd claims interface — use USB-to-Relay Bridge for battery SMBus telemetry)'
          : 'WebUSB Hardware Descriptor (raw USB descriptors do not expose Apple SMBus battery registers)',
        updatedAt: new Date().toISOString()
      }));
      setTransportNotice(
        osDriverLocked
          ? `USB iPhone bound (${info.name}). Host OS usbmuxd holds exclusive interface claim (${lockReason}); hardware descriptor loaded.`
          : `USB cable link active: ${info.name} (${info.iosMode}).`
      );
      if (announce && triggerToast) triggerToast(`Connected to ${info.name} via USB cable.`);
    },
    [triggerToast]
  );

  // Auto-detect pre-paired Apple WebUSB devices & subscribe to live hot-plug connect/disconnect events
  useEffect(() => {
    if (!usbSupported) return;
    const usb = (navigator as any).usb;
    let mounted = true;

    const checkAuthorizedDevices = async () => {
      try {
        const devices: any[] = await usb.getDevices();
        if (!mounted) return;
        const appleDev = devices.find((d) => d.vendorId === 0x05ac);
        if (appleDev && !usbDeviceRef.current) {
          await bindWebUsbDevice(appleDev, false);
        }
      } catch (err: any) {
        if (!mounted) return;
        if (err?.name === 'SecurityError' || /permissions policy/i.test(err?.message || '')) {
          setUsbIframeBlocked(true);
        }
      }
    };

    const handleUsbConnect = (ev: any) => {
      if (ev?.device?.vendorId === 0x05ac) {
        bindWebUsbDevice(ev.device, true);
      }
    };

    const handleUsbDisconnect = (ev: any) => {
      if (usbDeviceRef.current && ev?.device === usbDeviceRef.current) {
        usbDeviceRef.current = null;
        setConnectedDevice(null);
        setLiveDeviceBattery(EMPTY_BATTERY_TELEMETRY);
        setTransportNotice('iPhone USB cable unplugged.');
        if (triggerToast) triggerToast('iPhone USB cable disconnected.');
      }
    };

    checkAuthorizedDevices();
    usb.addEventListener?.('connect', handleUsbConnect);
    usb.addEventListener?.('disconnect', handleUsbDisconnect);

    return () => {
      mounted = false;
      usb.removeEventListener?.('connect', handleUsbConnect);
      usb.removeEventListener?.('disconnect', handleUsbDisconnect);
    };
  }, [usbSupported, bindWebUsbDevice, triggerToast]);

  // Helper to create & copy a one-line macOS/Linux USB-to-Relay bridge command (pipes real ideviceinfo over cable)
  const handleStartUsbBridge = async () => {
    setIsConnecting(true);
    setTransportNotice('');
    try {
      let code = relayCode;
      if (!code) {
        const res = await fetch('/api/iphone/session', { method: 'POST' });
        const data = await res.json();
        if (data.success && data.code) {
          code = data.code;
          setRelayCode(code);
        }
      }
      if (code && typeof window !== 'undefined') {
        const url = `${window.location.origin}/api/iphone/ingest/${code}`;
        const bridgeScript = `curl -sS -X POST "${url}" -H "Content-Type: application/json" -d "$(python3 -c 'import json,subprocess; kv=lambda args: dict(l.split(": ",1) for l in subprocess.check_output(args,text=True).splitlines() if ": " in l); i=kv(["ideviceinfo"]); b=kv(["ideviceinfo","-q","com.apple.mobile.battery"]); print(json.dumps({"deviceName":i.get("DeviceName","iPhone"),"deviceModel":i.get("ProductType"),"osVersion":i.get("ProductVersion"),"connectionType":"USB Cable (usbmuxd)","batteryLevel":int(b["BatteryCurrentCapacity"]) if "BatteryCurrentCapacity" in b else None,"isCharging":b.get("BatteryIsCharging")=="true","batteryVoltageMv":int(b["Voltage"]) if "Voltage" in b else None,"cycleCount":int(b["CycleCount"]) if "CycleCount" in b else None}))')"`;
        await navigator.clipboard.writeText(bridgeScript).catch(() => {});
        setCopiedUsbBridge(true);
        setTimeout(() => setCopiedUsbBridge(false), 3000);
        setTransportNotice(
          `USB Bridge Relay #${code} active & command copied! Run it on the computer your iPhone is plugged into to stream real cable telemetry.`
        );
        if (triggerToast) triggerToast(`USB-to-Relay Bridge #${code} ready (command copied).`);
      }
    } catch {
      setTransportNotice('Failed to initialize USB-to-Relay session.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Mode 1: Direct USB Cable Connection via WebUSB (Apple VID 0x05ac)
  const handleConnectUsb = async () => {
    setTransportNotice('');
    if (!usbSupported) {
      setTransportNotice(
        'Browser WebUSB API is unavailable (Safari does not support WebUSB). Use Chrome/Edge in a top-level tab, or click "Generate USB Bridge Relay".'
      );
      return;
    }

    setIsConnecting(true);
    try {
      const usb = (navigator as any).usb;
      const device = await usb.requestDevice({ filters: [{ vendorId: 0x05ac }] });
      await bindWebUsbDevice(device, true);
    } catch (err: any) {
      const msg = err?.message || 'USB pairing cancelled or blocked.';
      if (err?.name === 'SecurityError' || /permissions policy/i.test(msg)) {
        setUsbIframeBlocked(true);
        setTransportNotice(
          'WebUSB is blocked inside this embedded preview iframe by browser Permissions-Policy. Click "Open Top-Level Tab" below for direct USB pairing, or use the USB Bridge Relay.'
        );
      } else if (err?.name === 'NotFoundError') {
        setTransportNotice(
          'No Apple USB device selected. Make sure your iPhone is plugged into a data-capable USB cable, unlocked, and you clicked Allow in Chrome.'
        );
      } else {
        setTransportNotice(`USB connection notice: ${msg}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Mode 2: Bluetooth LE Connection via Web Bluetooth (with real GATT Battery/Thermal/Health reads + live notifications)
  const handleConnectBluetooth = async () => {
    setTransportNotice('');
    if (!bleSupported) {
      setTransportNotice(
        'Web Bluetooth API is unavailable in this browser or blocked by iframe Permissions-Policy. Open directly in Chrome/Edge or use Cable/Internet Tether Relay.'
      );
      return;
    }

    setIsConnecting(true);
    try {
      const bluetooth = (navigator as any).bluetooth;
      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'device_information',
          'battery_service',
          'generic_access',
          'current_time',
          'health_thermometer',
          'environmental_sensing',
          '7905f431-b5ce-4e99-a40f-4b1e122d00d0', // Apple Notification Center Service
          '89d3502b-0f36-433a-8ef4-c502ad55f8dc' // Apple Media Service
        ]
      });
      bleDeviceRef.current = device;

      let battery: number | null = null;
      let voltageMv: number | null = null;
      let cycleCount: number | null = null;
      let tempC: number | null = null;
      let isCharging: boolean | null = null;
      let manufacturer = 'Apple Inc. (BLE GATT)';
      let model = 'BLE Paired Device';
      const discoveredServices: string[] = [];

      if (device.gatt) {
        const server = await device.gatt.connect();
        try {
          const services = await server.getPrimaryServices();
          services.forEach((s: any) => discoveredServices.push(String(s.uuid)));
        } catch {
          // Some OS stacks limit full service enumeration
        }

        try {
          const batSvc = await server.getPrimaryService('battery_service');

          // 1. Standard Battery Level (0x2A19) + real-time notification subscription
          try {
            const batChar = await batSvc.getCharacteristic('battery_level');
            const val = await batChar.readValue();
            battery = val.getUint8(0);

            try {
              await batChar.startNotifications();
              bleNotifyCharRef.current = batChar;
              batChar.addEventListener('characteristicvaluechanged', (ev: any) => {
                const updatedVal = ev?.target?.value;
                if (updatedVal) {
                  const pct = updatedVal.getUint8(0);
                  mergeLiveBattery({
                    chargePercent: pct,
                    sourceLabel: 'BLE GATT Live Notification',
                    updatedAt: new Date().toISOString()
                  });
                  setConnectedDevice((prev) => (prev ? { ...prev, batteryPercent: pct } : prev));
                }
              });
            } catch {
              // Notifications optional
            }
          } catch {
            // Battery level optional
          }

          // 2. Battery Level Status (0x2BED) — power/charging state
          try {
            const statusChar = await batSvc.getCharacteristic(0x2bed);
            const dv = await statusChar.readValue();
            if (dv.byteLength >= 3) {
              const powerState = dv.getUint16(1, true);
              const chargeStateBits = (powerState >> 5) & 0x03;
              if (chargeStateBits === 1) isCharging = true;
              else if (chargeStateBits === 2 || chargeStateBits === 3) isCharging = false;
            }
          } catch {
            // Optional GATT v1.1 characteristic
          }

          // 3. Battery Health Information (0x2BEB) — real cycle count if exposed
          try {
            const healthInfoChar = await batSvc.getCharacteristic(0x2beb);
            const dv = await healthInfoChar.readValue();
            if (dv.byteLength >= 3) {
              const flags = dv.getUint8(0);
              if ((flags & 0x01) !== 0) {
                cycleCount = dv.getUint16(1, true);
              }
            }
          } catch {
            // Optional GATT v1.1 characteristic
          }

          // 4. Battery Energy Status (0x2BF0) — real present voltage (SFLOAT) if exposed
          try {
            const energyChar = await batSvc.getCharacteristic(0x2bf0);
            const dv = await energyChar.readValue();
            if (dv.byteLength >= 3) {
              const flags = dv.getUint8(0);
              let offset = 1;
              if ((flags & 0x01) !== 0) offset += 2; // external source power present
              if ((flags & 0x02) !== 0 && dv.byteLength >= offset + 2) {
                const vVolts = decodeSfloat16(dv.getUint16(offset, true));
                if (vVolts !== null && vVolts > 0) {
                  voltageMv = Math.round(vVolts * 1000);
                }
              }
            }
          } catch {
            // Optional GATT v1.1 characteristic
          }
        } catch {
          // Battery service optional
        }

        // 5. Optional BLE Thermal / Temperature service
        try {
          const envSvc = await server.getPrimaryService('environmental_sensing');
          const tempChar = await envSvc.getCharacteristic(0x2a6e);
          const dv = await tempChar.readValue();
          if (dv.byteLength >= 2) {
            tempC = Number((dv.getInt16(0, true) / 100).toFixed(1));
          }
        } catch {
          // Environmental temperature optional
        }

        try {
          const devSvc = await server.getPrimaryService('device_information');
          const decoder = new TextDecoder();
          try {
            const mfgChar = await devSvc.getCharacteristic('manufacturer_name_string');
            manufacturer = decoder.decode(await mfgChar.readValue());
          } catch {
            /* optional */
          }
          try {
            const mdlChar = await devSvc.getCharacteristic('model_number_string');
            model = decoder.decode(await mdlChar.readValue());
          } catch {
            /* optional */
          }
        } catch {
          // Device info service optional
        }
      }

      const nowIso = new Date().toISOString();
      const info: ConnectedDeviceInfo = {
        transport: 'bluetooth',
        name: device.name || 'iPhone Bluetooth Peripheral',
        manufacturer,
        modelOrProductId: model,
        serialOrId: device.id || 'BLE-GATT-UUID',
        iosMode: 'Bluetooth LE GATT Connected',
        batteryPercent: battery,
        servicesOrInterfaces: discoveredServices.length > 0 ? discoveredServices : ['GATT Connected'],
        connectedAt: nowIso,
        rawDescriptor: {
          bleId: device.id,
          bleName: device.name,
          manufacturer,
          model,
          batteryPercent: battery,
          voltageMv,
          cycleCount,
          temperatureC: tempC,
          isCharging,
          gattServices: discoveredServices
        }
      };

      setConnectedDevice(info);
      setDiagnosticInput(JSON.stringify(info.rawDescriptor, null, 2));
      mergeLiveBattery({
        chargePercent: battery,
        voltageMv,
        cycleCount,
        temperatureC: tempC,
        isCharging,
        sourceLabel: 'BLE GATT Live Readout',
        updatedAt: nowIso
      });
      setTransportNotice('Bluetooth LE GATT link established.');
      if (triggerToast) triggerToast(`Connected to ${info.name} over Bluetooth LE.`);
    } catch (err: any) {
      const msg = err?.message || 'Bluetooth pairing cancelled or blocked.';
      setTransportNotice(`Bluetooth pairing notice: ${msg}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Mode 3: Internet / USB Tether Relay Session
  const handleCreateRelaySession = async () => {
    setIsConnecting(true);
    setTransportNotice('');
    try {
      const res = await fetch('/api/iphone/session', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.code) {
        setRelayCode(data.code);
        setRelayTelemetry(null);
        setTransportNotice(
          `Real-time tether relay session #${data.code} active (30m TTL). Post real device JSON from your iPhone Shortcut or tethered companion CLI.`
        );
        if (triggerToast) triggerToast(`Created iPhone Internet/Cable Tether Relay #${data.code}.`);
      }
    } catch {
      setTransportNotice('Failed to initialize server tether relay session.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCopyIngestUrl = async () => {
    if (!relayCode || typeof window === 'undefined') return;
    const url = `${window.location.origin}/api/iphone/ingest/${relayCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedRelay(true);
      setTimeout(() => setCopiedRelay(false), 2000);
      if (triggerToast) triggerToast('Copied iPhone relay ingest endpoint URL.');
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleCopyTelemetrySchema = async () => {
    if (!relayCode || typeof window === 'undefined') return;
    const url = `${window.location.origin}/api/iphone/ingest/${relayCode}`;
    const cmd = `curl -X POST "${url}" -H "Content-Type: application/json" -d '{"deviceName":"My iPhone","osVersion":"iOS 18","batteryLevel":85,"batteryVoltageMv":3890,"thermalState":"nominal","temperatureC":31.4,"cycleCount":142,"isCharging":true,"lowPowerMode":false}'`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2000);
      if (triggerToast) triggerToast('Copied real-device telemetry POST command.');
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setDiagnosticInput(content);
      const parsed = parseBatteryTelemetryFromText(content);
      if (parsed) {
        pushTelemetrySample(parsed);
      }
      if (triggerToast) triggerToast(`Loaded real diagnostic artifact: ${file.name} (${file.size} bytes)`);
    };
    reader.readAsText(file);
  };

  // Real Low Power Mode Stress Test Simulation (measures real runtime frame pacing, WebCrypto hash rate, and any live connected device power delta)
  const handleToggleStressTest = async () => {
    if (stressRunning) {
      stressAbortRef.current = true;
      return;
    }

    stressAbortRef.current = false;
    stressRunningRef.current = true;
    stressSamplesCountRef.current = 0;
    setStressRunning(true);
    setStressProgressPct(0);
    setStressResult(null);

    const startedIso = new Date().toISOString();
    const initialVoltage = activePowerHealth.voltageMv;
    const initialCharge = activePowerHealth.chargePercent ?? hostBattery.levelPct;
    const testDurationMs = 10000;
    const startMs = performance.now();

    const frameDeltas: number[] = [];
    let lastFrameMs = startMs;
    let totalOps = 0;
    const buffer = new Uint8Array(16384);
    for (let i = 0; i < buffer.length; i++) buffer[i] = i & 0xff;

    const runHashBatch = async () => {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        await crypto.subtle.digest('SHA-256', buffer);
        totalOps += 1;
      } else {
        let acc = 0;
        for (let i = 0; i < 4096; i++) acc = (acc * 31 + buffer[i]) | 0;
        if (acc >= -Infinity) totalOps += 1;
      }
    };

    while (!stressAbortRef.current) {
      const now = performance.now();
      const elapsed = now - startMs;
      if (elapsed >= testDurationMs) break;

      // Measure real animation frame spacing + execute WebCrypto compute work inside each frame budget
      await new Promise<void>((resolve) => {
        requestAnimationFrame(async (rafTs) => {
          const dt = rafTs - lastFrameMs;
          if (dt > 0 && dt < 2000) frameDeltas.push(dt);
          lastFrameMs = rafTs;

          // Execute bounded compute batch per frame
          for (let b = 0; b < 12; b++) {
            await runHashBatch();
          }
          resolve();
        });
      });

      const pct = Math.min(100, Math.round(((performance.now() - startMs) / testDurationMs) * 100));
      const secElapsed = Math.max(0.1, (performance.now() - startMs) / 1000);
      const runningAvgFrame =
        frameDeltas.length > 0
          ? frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length
          : 16.7;

      setStressProgressPct(pct);
      setStressLiveMetrics({
        opsCount: totalOps,
        opsPerSec: Math.round(totalOps / secElapsed),
        avgFrameMs: Number(runningAvgFrame.toFixed(1))
      });
    }

    const endMs = performance.now();
    const durationSec = Number(Math.max(0.1, (endMs - startMs) / 1000).toFixed(2));
    const sortedFrames = [...frameDeltas].sort((a, b) => a - b);
    const avgFrameMs =
      frameDeltas.length > 0
        ? Number((frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length).toFixed(1))
        : 0;
    const p95FrameMs =
      sortedFrames.length > 0
        ? Number(sortedFrames[Math.min(sortedFrames.length - 1, Math.floor(sortedFrames.length * 0.95))].toFixed(1))
        : 0;
    const droppedFrames = frameDeltas.filter((d) => d > 36).length;
    const opsPerSec = Math.round(totalOps / durationSec);

    const endVoltage = activePowerHealth.voltageMv;
    const endCharge = activePowerHealth.chargePercent ?? hostBattery.levelPct;
    const voltageDeltaMv =
      initialVoltage !== null && endVoltage !== null ? endVoltage - initialVoltage : null;
    const chargeDeltaPct =
      initialCharge !== null && endCharge !== null ? Number((endCharge - initialCharge).toFixed(1)) : null;

    const thermalObserved = activePowerHealth.thermalState
      ? activePowerHealth.temperatureC !== null
        ? `${activePowerHealth.thermalState} (${activePowerHealth.temperatureC} °C)`
        : activePowerHealth.thermalState
      : activePowerHealth.temperatureC !== null
        ? `${activePowerHealth.temperatureC} °C`
        : null;

    let verdict = 'Sustained Real-Time Pacing (No Throttling Observed)';
    if (stressAbortRef.current) {
      verdict = 'Stress Test Aborted by Operator';
    } else if (
      activePowerHealth.thermalState &&
      /serious|critical/i.test(activePowerHealth.thermalState)
    ) {
      verdict = 'Thermal Throttling Detected on Connected Device';
    } else if (avgFrameMs >= 29 && avgFrameMs <= 38) {
      verdict = 'Low Power / 30 Hz Frame Pacing Active (~33 ms frame interval)';
    } else if (droppedFrames > Math.max(3, Math.floor(frameDeltas.length * 0.15))) {
      verdict = 'Frame Pacing Drops Detected Under Power/Compute Load';
    }

    setStressResult({
      startedAt: startedIso,
      completedAt: new Date().toISOString(),
      durationSec,
      totalOps,
      opsPerSec,
      avgFrameMs,
      p95FrameMs,
      droppedFrames,
      deviceSamplesDuringTest: stressSamplesCountRef.current,
      voltageDeltaMv,
      chargeDeltaPct,
      thermalObserved,
      verdict
    });
    stressRunningRef.current = false;
    setStressRunning(false);
    setStressProgressPct(100);
    if (triggerToast) triggerToast(`Low Power Mode Stress Test finished: ${verdict}`);
  };

  // Deep 6-Domain Diagnostic & Security Analysis Engine (only analyzes real connected/imported data)
  const diagnosticReport = useMemo(() => {
    const raw = diagnosticInput || '';
    const lower = raw.toLowerCase();
    const findings: DiagnosticFinding[] = [];

    // 1. Jailbreak / Runtime Hooking / Spyware Indicators
    if (/(jailbreak|cydia|sileo|frida|cycript|substrate|\/private\/var\/jb|dyld_insert)/i.test(raw)) {
      findings.push({
        id: 'ios-jb-01',
        domain: 'Kernel & Runtime Integrity',
        severity: 'high',
        title: 'Unauthorized Dynamic Instrumentation or Jailbreak Artifacts',
        detail: 'Diagnostic stream references jailbreak toolchains, dyld injection, or Frida hooking libraries.',
        remediation: 'Erase device via DFU restore to verified signed IPSW and re-enable Apple Secure Boot verification.'
      });
    }

    // 2. High-Value Subsystem Crash Analysis (.ips)
    if (/(blastdoor|imtransferagent|webkit|webcontent|exc_bad_access|kern_invalid_address|sigsegv)/i.test(raw)) {
      findings.push({
        id: 'ios-ips-02',
        domain: 'Crash & Exploit Surface (.ips)',
        severity: 'high',
        title: 'Critical Memory Fault in High-Risk iOS Subsystem',
        detail: 'Crash telemetry references BlastDoor, IMTransferAgent, WebKit, or EXC_BAD_ACCESS memory corruption.',
        remediation: 'Update iOS immediately, enable Lockdown Mode, and preserve full .ips crash file for MVT forensic triage.'
      });
    }

    // 3. Untrusted MDM / Root Certificates / Network Proxy
    if (/(mdm|untrusted|root-ca|http_proxy|http:\/\/)/i.test(raw)) {
      findings.push({
        id: 'ios-net-03',
        domain: 'Network & Profile Trust',
        severity: 'medium',
        title: 'Proxy Intercept or Unverified Configuration Profile Flagged',
        detail: 'Detected explicit proxy forwarding, cleartext HTTP endpoint, or non-standard enterprise MDM/root CA entry.',
        remediation: 'Inspect Settings > General > VPN & Device Management and Certificate Trust Settings; remove unknown profiles.'
      });
    }

    // 4. USB Accessories Restricted Mode Check
    if (lower.includes('usb_restricted_mode=disabled') || lower.includes('"usbaccessoriesrestricted": false')) {
      findings.push({
        id: 'ios-usb-04',
        domain: 'Physical Port Hardening',
        severity: 'medium',
        title: 'USB Accessories Permitted While Locked',
        detail: 'Device allows USB data negotiation while locked, increasing risk of Lightning/USB-C extraction tools.',
        remediation: 'Disable Settings > Face ID & Passcode > Accessories to enforce 1-hour USB data lockout.'
      });
    }

    // 5. Real Battery & Thermal Health Flags
    if (activePowerHealth.voltageMv !== null && activePowerHealth.voltageMv < 3450) {
      findings.push({
        id: 'ios-pwr-voltage',
        domain: 'Battery & Power Health',
        severity: 'high',
        title: `Critically Low Cell Voltage (${(activePowerHealth.voltageMv / 1000).toFixed(3)} V)`,
        detail: 'Measured cell voltage below 3.45 V risks sudden unexpected shutdown or PMIC brownout.',
        remediation: 'Connect Apple-certified USB-C PD charger and inspect battery health capacity in Settings > Battery.'
      });
    }

    if (
      (activePowerHealth.thermalState && /serious|critical/i.test(activePowerHealth.thermalState)) ||
      (activePowerHealth.temperatureC !== null && activePowerHealth.temperatureC >= 42)
    ) {
      findings.push({
        id: 'ios-pwr-thermal',
        domain: 'Battery & Power Health',
        severity: 'high',
        title: `Elevated Thermal State (${activePowerHealth.thermalState || `${activePowerHealth.temperatureC} °C`})`,
        detail: 'iOS thermal pressure reached Serious/Critical threshold; CPU/GPU clocks and charging current may throttle.',
        remediation: 'Remove fast wireless/wired charging load, inspect background processes for runaway loops, and allow device cooling.'
      });
    }

    if (activePowerHealth.cycleCount !== null && activePowerHealth.cycleCount >= 800) {
      findings.push({
        id: 'ios-pwr-cycles',
        domain: 'Battery & Power Health',
        severity: 'medium',
        title: `High Battery Cycle Wear (${activePowerHealth.cycleCount} cycles)`,
        detail: 'Lithium-ion cell has accumulated 800+ charge cycles; internal resistance and peak performance throttling risk increase.',
        remediation: 'Verify Peak Performance Capability in Settings > Battery > Battery Health & Charging.'
      });
    }

    // 6. Older iOS Train Check
    const iosVerMatch = raw.match(/iOS\s*(\d+)(?:\.(\d+))?/i);
    if (iosVerMatch) {
      const major = parseInt(iosVerMatch[1], 10);
      if (major < 18) {
        findings.push({
          id: 'ios-ver-05',
          domain: 'OS Patch Currency',
          severity: major <= 16 ? 'high' : 'medium',
          title: `Outdated iOS Major Train Detected (iOS ${iosVerMatch[1]})`,
          detail: 'Running an older iOS release exposes unpatched WebKit, ImageIO, and Kernel zero-day vectors.',
          remediation: 'Upgrade to the latest supported iOS 18 security release.'
        });
      }
    }

    // 7. DFU / Recovery Mode Check from Live USB
    if (connectedDevice?.iosMode.includes('DFU') || connectedDevice?.iosMode.includes('Recovery')) {
      findings.push({
        id: 'ios-dfu-06',
        domain: 'Hardware Boot State',
        severity: 'medium',
        title: `Device Connected in ${connectedDevice.iosMode}`,
        detail: 'iPhone is currently in low-level bootloader/DFU state rather than normal encrypted userland.',
        remediation: 'Verify whether firmware restoration or diagnostic imaging was intentionally initiated.'
      });
    }

    // 8. Open BLE Services Audit
    if (connectedDevice?.transport === 'bluetooth') {
      findings.push({
        id: 'ios-ble-07',
        domain: 'Bluetooth LE Exposure',
        severity: 'low',
        title: `BLE GATT Session Enumerated (${connectedDevice.servicesOrInterfaces.length} service(s))`,
        detail: 'Bluetooth Low Energy discovery active. Confirm AirDrop is set to Contacts Only when outside trusted networks.',
        remediation: 'Limit AirDrop/Continuity discoverability and verify only recognized BLE peripherals are paired.'
      });
    }

    // Baseline status when connected or log imported with zero anomalies
    if (findings.length === 0 && (connectedDevice || raw.trim().length > 0)) {
      findings.push({
        id: 'ios-ok-00',
        domain: 'Baseline Integrity',
        severity: 'low',
        title: 'iPhone Diagnostic Snapshot Nominal',
        detail: 'No jailbreak artifacts, subsystem crash exploits, thermal faults, or untrusted proxy profiles detected in current real telemetry.',
        remediation: 'Continue periodic sysdiagnose review and keep automatic Apple Rapid Security Responses enabled.'
      });
    }

    const highCount = findings.filter((f) => f.severity === 'high').length;
    const medCount = findings.filter((f) => f.severity === 'medium').length;
    const hasData = Boolean(connectedDevice || raw.trim().length > 0);
    const healthScore = hasData ? Math.max(10, 100 - highCount * 30 - medCount * 15) : null;

    return {
      findings,
      highCount,
      medCount,
      healthScore,
      posture:
        healthScore === null
          ? 'AWAITING DEVICE'
          : healthScore >= 85
            ? 'HARDENED'
            : healthScore >= 60
              ? 'ELEVATED RISK'
              : 'CRITICAL ATTENTION'
    };
  }, [diagnosticInput, connectedDevice, activePowerHealth]);

  const handleRunAiDiagnosis = async () => {
    if (!diagnosticInput.trim() && !connectedDevice) return;
    setIsAnalyzingAi(true);
    try {
      const payloadTarget = [
        connectedDevice ? `Connected Device: ${JSON.stringify(connectedDevice)}` : 'Connected Device: Imported Log Artifact',
        `Battery & Power Health: Voltage=${activePowerHealth.voltageMv !== null ? `${activePowerHealth.voltageMv}mV` : 'Unreported'}, Thermal=${activePowerHealth.thermalState || 'Unreported'}, Temp=${activePowerHealth.temperatureC !== null ? `${activePowerHealth.temperatureC}C` : 'Unreported'}, Cycles=${activePowerHealth.cycleCount ?? 'Unreported'}`,
        `Findings Summary (${diagnosticReport.posture}):`,
        ...diagnosticReport.findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.domain}: ${f.title}`),
        '',
        'Raw Telemetry / .ips Artifact:',
        diagnosticInput.slice(0, 6000)
      ].join('\n');

      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'iphone',
          target: payloadTarget,
          context: `Transport=${activeTransport}; HealthScore=${diagnosticReport.healthScore ?? 'N/A'}`
        })
      });
      const data = await res.json();
      if (data.text) {
        setAiReport(data.text);
        setAiModelUsed(data.model || 'gemini-4-hydrogen');
        if (triggerToast) triggerToast('Deep iOS forensic triage report compiled.');
      }
    } catch {
      if (triggerToast) triggerToast('AI diagnostics request failed. Local analyzer remains active.');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleArchiveFindings = () => {
    if (diagnosticReport.findings.length === 0) {
      if (triggerToast) triggerToast('Connect a device or import real iOS logs before archiving.');
      return;
    }
    try {
      const existingRaw = localStorage.getItem('aegis_threat_archive');
      const existing: ArchivedThreat[] = existingRaw ? JSON.parse(existingRaw) : [];

      const actionable = diagnosticReport.findings.filter((f) => f.severity !== 'low' || f.id !== 'ios-ok-00');
      const toArchive = actionable.length > 0 ? actionable : diagnosticReport.findings;

      const entries: ArchivedThreat[] = toArchive.map((f) => ({
        id: `ios-${f.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        category: 'ebpf',
        name: `iPhone Audit [${f.domain}]: ${f.title}`,
        severity: f.severity,
        details: f.detail,
        rawPayload: `${f.remediation}\n\nDevice: ${connectedDevice?.name || 'Imported iOS Log'}`,
        status: 'Unresolved',
        notes: `Logged from iPhone Deep Diagnostics (${activeTransport.toUpperCase()} transport).`,
        assignedOfficer: 'alexhuhter313@gmail.com',
        meta: {
          transport: activeTransport,
          health_score: diagnosticReport.healthScore,
          battery_voltage_mv: activePowerHealth.voltageMv,
          battery_cycles: activePowerHealth.cycleCount
        }
      }));

      localStorage.setItem('aegis_threat_archive', JSON.stringify([...entries, ...existing]));
      window.dispatchEvent(new Event('aegis-archive-updated'));
      if (triggerToast) triggerToast(`Archived ${entries.length} iPhone diagnostic finding(s) to Threat Vault.`);
    } catch {
      if (triggerToast) triggerToast('Failed to archive iPhone findings to LocalStorage.');
    }
  };

  return (
    <div className="bg-[#0A0A0C]/90 border border-white/5 rounded-lg shadow-[0_4px_30px_rgba(0,0,0,0.4)] overflow-hidden font-mono text-[11px]">
      {/* Header */}
      <div className="border-b border-white/5 bg-gradient-to-r from-black/80 to-[#101014] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 border border-[#00f0ff]/35 bg-[#00f0ff]/5 text-[#00f0ff] rounded-md">
            <Smartphone size={15} />
          </div>
          <div>
            <span className="text-[9px] tracking-widest text-[#00f0ff]/80 uppercase font-bold block">
              iOS Hardware · Bluetooth LE · Cable &amp; Internet Tether
            </span>
            <h3 className="text-sm font-serif font-light text-zinc-100">
              iPhone Deep Diagnostics &amp; Forensic Analyzer
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleArchiveFindings}
            className="px-2.5 py-1.5 bg-white/5 hover:bg-[#00f0ff]/15 border border-white/10 hover:border-[#00f0ff]/35 rounded text-[9px] uppercase font-bold text-zinc-200 hover:text-[#00f0ff] flex items-center gap-1 cursor-pointer"
          >
            <Archive size={10} /> Archive Findings
          </button>
          <ExportButton
            id="btn-export-iphone-diagnostics"
            label="Export iOS Audit"
            filenamePrefix="aegis_iphone_diagnostics"
            jsonData={{
              module: 'iPhone Deep Diagnostics & Forensic Analyzer',
              timestamp: new Date().toISOString(),
              transport: activeTransport,
              connected_device: connectedDevice,
              battery_power_health: activePowerHealth,
              low_power_stress_test: stressResult,
              health_score: diagnosticReport.healthScore,
              posture: diagnosticReport.posture,
              findings: diagnosticReport.findings,
              ai_assessment: aiReport || null
            }}
            csvData={diagnosticReport.findings.map((f) => ({
              id: f.id,
              domain: f.domain,
              severity: f.severity,
              title: f.title,
              detail: f.detail,
              remediation: f.remediation
            }))}
            textReport={`=== AEGIS iPHONE DEEP DIAGNOSTIC REPORT ===\nTimestamp: ${new Date().toISOString()}\nTransport: ${activeTransport.toUpperCase()}\nDevice: ${connectedDevice?.name || 'No Device Connected'}\nHealth Score: ${diagnosticReport.healthScore !== null ? `${diagnosticReport.healthScore}/100` : 'N/A'} (${diagnosticReport.posture})\n\nBattery & Power Health:\n- Voltage: ${activePowerHealth.voltageMv !== null ? `${(activePowerHealth.voltageMv / 1000).toFixed(3)} V (${activePowerHealth.voltageMv} mV)` : 'Not exposed'}\n- Thermal Status: ${activePowerHealth.thermalState || (activePowerHealth.temperatureC !== null ? `${activePowerHealth.temperatureC} °C` : 'Not exposed')}\n- Charging Cycles: ${activePowerHealth.cycleCount ?? 'Not exposed'}\n- Charge Level: ${activePowerHealth.chargePercent !== null ? `${activePowerHealth.chargePercent}%` : 'Not exposed'}\n\nFindings (${diagnosticReport.findings.length}):\n${diagnosticReport.findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.domain}: ${f.title}\n  Detail: ${f.detail}\n  Remediation: ${f.remediation}`).join('\n')}${aiReport ? `\n\n=== AI DEEP FORENSIC SUMMARY ===\n${aiReport}` : ''}`}
            triggerToast={triggerToast}
            size="xs"
          />
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Connection Transport Selector & Live Hardware Readout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 border border-white/5 bg-black/35 rounded p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
              <span className="text-[10px] text-white/55 uppercase tracking-wider font-bold">
                1. Connect Real iPhone Transport
              </span>
              <div className="flex bg-[#050507] border border-white/10 rounded p-0.5 text-[9px]">
                <button
                  type="button"
                  onClick={() => setActiveTransport('usb')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 uppercase cursor-pointer ${
                    activeTransport === 'usb'
                      ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-bold'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  <Usb size={10} /> USB Cable
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTransport('bluetooth')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 uppercase cursor-pointer ${
                    activeTransport === 'bluetooth'
                      ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-bold'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  <Bluetooth size={10} /> Bluetooth
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTransport('internet')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 uppercase cursor-pointer ${
                    activeTransport === 'internet'
                      ? 'bg-[#00f0ff]/15 text-[#00f0ff] font-bold'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  <Globe size={10} /> Internet Tether
                </button>
              </div>
            </div>

            {activeTransport === 'usb' && (
              <div className="space-y-3">
                <p className="text-[10px] text-white/45 leading-relaxed">
                  Plug your iPhone in via Lightning or USB-C cable, unlock it and tap{' '}
                  <strong className="text-zinc-200">Trust</strong>, then pair directly with WebUSB (Apple VID{' '}
                  <code className="text-[#00f0ff]">0x05AC</code>) or bridge via <code className="text-zinc-300">libimobiledevice</code>.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConnectUsb}
                    disabled={isConnecting}
                    className="px-3.5 py-2 bg-[#00f0ff] hover:bg-[#00d0e0] text-black font-bold uppercase text-[10px] rounded flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Usb size={12} /> {isConnecting ? 'Waiting for Device...' : 'Pair via WebUSB'}
                  </button>
                  <button
                    type="button"
                    onClick={handleScanHostUsb}
                    disabled={isConnecting}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/15 text-zinc-200 rounded text-[9.5px] uppercase font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={10} className="text-[#00f0ff]" /> Scan Host USB Bus
                  </button>
                  <button
                    type="button"
                    onClick={handleStartUsbBridge}
                    disabled={isConnecting}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/15 text-zinc-200 rounded text-[9.5px] uppercase font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {copiedUsbBridge ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} className="text-[#00f0ff]" />}
                    {copiedUsbBridge ? 'Bridge Cmd Copied' : 'USB Bridge Relay'}
                  </button>
                  {(usbIframeBlocked || isEmbeddedIframe) && typeof window !== 'undefined' && (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 rounded text-[9.5px] uppercase font-bold flex items-center gap-1"
                    >
                      <ExternalLink size={10} /> Open Top-Level Tab
                    </a>
                  )}
                  {connectedDevice && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="px-3 py-2 bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/35 text-zinc-300 hover:text-rose-300 rounded text-[9.5px] uppercase font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Unplug size={11} /> Disconnect
                    </button>
                  )}
                </div>
                <div className="text-[9px] text-white/35 space-y-0.5 tabular-nums">
                  <div>
                    Browser WebUSB:{' '}
                    {!usbSupported
                      ? 'Unavailable in this browser (use Chrome/Edge or USB Bridge Relay)'
                      : usbIframeBlocked
                        ? 'Blocked in embedded preview iframe — use "Open Top-Level Tab" for direct cable access'
                        : 'Available (auto-detects plugged-in Apple VID 0x05AC)'}
                  </div>
                  {isCloudHost && (
                    <div className="text-amber-300/80">
                      Remote cloud runtime detected: use Direct WebUSB (top-level Chrome/Edge tab) or USB Bridge Relay to reach your computer&apos;s physical USB port.
                    </div>
                  )}
                  {hostUsbCheckStatus.polledAt && (
                    <div>
                      Last Host USB Scan: {new Date(hostUsbCheckStatus.polledAt).toLocaleTimeString()} ·{' '}
                      {hostUsbCheckStatus.count} Apple device(s) found
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTransport === 'bluetooth' && (
              <div className="space-y-3">
                <p className="text-[10px] text-white/45 leading-relaxed">
                  Enable Bluetooth on your host &amp; iPhone and discover real GATT services (Battery Service, Battery Energy/Health, Thermal Sensing, and Apple Continuity ANCS/AMS UUIDs) with live notifications.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConnectBluetooth}
                    disabled={isConnecting}
                    className="px-3.5 py-2 bg-[#00f0ff] hover:bg-[#00d0e0] text-black font-bold uppercase text-[10px] rounded flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Bluetooth size={12} /> {isConnecting ? 'Scanning BLE...' : 'Scan & Pair Bluetooth LE'}
                  </button>
                  {connectedDevice && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="px-3 py-2 bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/35 text-zinc-300 hover:text-rose-300 rounded text-[9.5px] uppercase font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Unplug size={11} /> Disconnect
                    </button>
                  )}
                </div>
                <div className="text-[9px] text-white/35">
                  Browser Web Bluetooth: {bleSupported ? 'Available' : 'Restricted in current browser context'}
                </div>
              </div>
            )}

            {activeTransport === 'internet' && (
              <div className="space-y-3">
                <p className="text-[10px] text-white/45 leading-relaxed">
                  Stream live battery voltage, thermal status, and charging cycles over Socket.IO / HTTPS from an iPhone connected via USB Personal Hotspot or the internet (iOS Shortcuts or local{' '}
                  <code className="text-zinc-300">ideviceinfo</code> bridge).
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCreateRelaySession}
                    disabled={isConnecting}
                    className="px-3.5 py-2 bg-[#00f0ff] hover:bg-[#00d0e0] text-black font-bold uppercase text-[10px] rounded flex items-center gap-1.5 cursor-pointer"
                  >
                    <Globe size={12} /> {relayCode ? 'Regenerate Relay Code' : 'Start Real-Time Tether Relay'}
                  </button>
                  {relayCode && (
                    <button
                      type="button"
                      onClick={handleCopyTelemetrySchema}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/15 text-zinc-200 rounded text-[9.5px] uppercase font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSchema ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} className="text-[#00f0ff]" />}
                      {copiedSchema ? 'Copied Bridge Cmd' : 'Copy Live Push Command'}
                    </button>
                  )}
                </div>

                {relayCode && (
                  <div className="bg-black/60 border border-[#00f0ff]/25 rounded p-3 space-y-2 text-[9.5px]">
                    <div className="flex items-center justify-between">
                      <span className="text-white/50 uppercase">Pairing Session Code:</span>
                      <span className="text-sm font-bold text-[#00f0ff] tabular-nums">{relayCode}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-zinc-300 truncate">
                        POST /api/iphone/ingest/{relayCode}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyIngestUrl}
                        className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[#00f0ff] flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedRelay ? <Check size={10} /> : <Copy size={10} />}
                        {copiedRelay ? 'Copied' : 'Copy URL'}
                      </button>
                    </div>
                    <div className="text-white/40 tabular-nums">
                      {relayLastPing
                        ? `Last live packet received: ${new Date(relayLastPing).toLocaleTimeString()}`
                        : 'Listening via WebSocket & HTTPS for live device telemetry...'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {transportNotice && (
              <div className="p-2.5 rounded border border-white/10 bg-black/50 text-[10px] text-zinc-300">
                {transportNotice}
              </div>
            )}
          </div>

          {/* Connected Hardware Status Panel */}
          <div className="lg:col-span-6 border border-white/5 bg-black/35 rounded p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-[10px] text-white/55 uppercase tracking-wider font-bold flex items-center gap-1.5">
                <Activity size={12} className="text-[#00f0ff]" /> Live Hardware &amp; Health Readout
              </span>
              <span
                className={`text-[9px] uppercase font-bold tabular-nums ${
                  diagnosticReport.healthScore === null
                    ? 'text-zinc-500'
                    : diagnosticReport.healthScore >= 85
                      ? 'text-emerald-400'
                      : diagnosticReport.healthScore >= 60
                        ? 'text-amber-300'
                        : 'text-rose-400'
                }`}
              >
                {diagnosticReport.healthScore !== null
                  ? `Score: ${diagnosticReport.healthScore}/100 (${diagnosticReport.posture})`
                  : diagnosticReport.posture}
              </span>
            </div>

            {connectedDevice ? (
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div>
                  <span className="text-[8.5px] text-white/35 uppercase block">Device Name</span>
                  <span className="text-zinc-100 font-semibold">{connectedDevice.name}</span>
                </div>
                <div>
                  <span className="text-[8.5px] text-white/35 uppercase block">Transport</span>
                  <span className="text-[#00f0ff] uppercase font-bold">{connectedDevice.transport}</span>
                </div>
                <div>
                  <span className="text-[8.5px] text-white/35 uppercase block">Model / Descriptor</span>
                  <span className="text-zinc-300 tabular-nums">{connectedDevice.modelOrProductId}</span>
                </div>
                <div>
                  <span className="text-[8.5px] text-white/35 uppercase block">Boot / Interface Mode</span>
                  <span className="text-zinc-300">{connectedDevice.iosMode}</span>
                </div>
                <div>
                  <span className="text-[8.5px] text-white/35 uppercase block">Serial / Session ID</span>
                  <span className="text-zinc-400 tabular-nums truncate block">{connectedDevice.serialOrId}</span>
                </div>
                <div>
                  <span className="text-[8.5px] text-white/35 uppercase block">Battery Telemetry</span>
                  <span className="text-zinc-200 tabular-nums">
                    {connectedDevice.batteryPercent !== null
                      ? `${connectedDevice.batteryPercent}%`
                      : 'Not exposed by transport'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[8.5px] text-white/35 uppercase block">Discovered Interfaces / Services</span>
                  <div className="text-zinc-400 text-[9.5px] mt-0.5 break-all">
                    {connectedDevice.servicesOrInterfaces.join(' · ')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-white/35 text-[10px] space-y-1">
                <div>No live iPhone hardware transport currently bound.</div>
                <div>Pair via USB Cable, Bluetooth LE, Internet Tether Relay, or import a real iOS .ips / sysdiagnose file below.</div>
              </div>
            )}

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[9px] text-white/40 tabular-nums">
              <span>
                Findings: <strong className="text-rose-400">{diagnosticReport.highCount} Critical</strong> ·{' '}
                <strong className="text-amber-300">{diagnosticReport.medCount} Medium</strong>
              </span>
              <span>
                {relayTelemetry
                  ? 'Live Relay Synced'
                  : connectedDevice
                    ? 'Hardware Bound'
                    : 'Awaiting Real Device Telemetry'}
              </span>
            </div>
          </div>
        </div>

        {/* Battery & Power Health Diagnostic Sub-Section */}
        <div className="border border-white/5 bg-black/35 rounded p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <span className="text-[10px] text-white/55 uppercase tracking-wider font-bold flex items-center gap-1.5">
                <Battery size={13} className="text-[#00f0ff]" /> Battery &amp; Power Health
              </span>
              <p className="text-[9.5px] text-white/40 mt-0.5 tabular-nums">
                {activePowerHealth.sourceLabel
                  ? `Real Source: ${activePowerHealth.sourceLabel}${activePowerHealth.updatedAt ? ` · Updated ${new Date(activePowerHealth.updatedAt).toLocaleTimeString()}` : ''}`
                  : 'Real-time device telemetry only — connect an iPhone (BLE GATT / USB libimobiledevice / Tether Relay) or import a real .ips / Powerlog snapshot.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleStressTest}
              className={`px-3.5 py-2 rounded text-[10px] font-bold uppercase flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
                stressRunning
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300'
                  : 'bg-[#00f0ff]/15 hover:bg-[#00f0ff]/25 border border-[#00f0ff]/40 text-[#00f0ff]'
              }`}
            >
              {stressRunning ? (
                <>
                  <Square size={11} /> Stop Stress Test ({stressProgressPct}%)
                </>
              ) : (
                <>
                  <Play size={11} /> Low Power Mode Stress Test
                </>
              )}
            </button>
          </div>

          {/* 4 Real-Time Hardware Power Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Battery Voltage */}
            <div className="bg-[#07070A] border border-white/5 rounded p-3 space-y-1">
              <div className="flex items-center justify-between text-[9px] text-white/45 uppercase">
                <span>Battery Voltage</span>
                <Zap size={11} className="text-[#00f0ff]" />
              </div>
              <div className="text-lg font-light text-zinc-100 tabular-nums">
                {activePowerHealth.voltageMv !== null
                  ? `${(activePowerHealth.voltageMv / 1000).toFixed(3)} V`
                  : 'Not reported'}
              </div>
              <div className="text-[9px] text-white/35 tabular-nums">
                {activePowerHealth.voltageMv !== null
                  ? `${activePowerHealth.voltageMv} mV live cell potential`
                  : 'Awaiting device voltage telemetry'}
              </div>
            </div>

            {/* Thermal Status */}
            <div className="bg-[#07070A] border border-white/5 rounded p-3 space-y-1">
              <div className="flex items-center justify-between text-[9px] text-white/45 uppercase">
                <span>Thermal Status</span>
                <Thermometer size={11} className="text-amber-300" />
              </div>
              <div
                className={`text-lg font-light capitalize tabular-nums ${
                  activePowerHealth.thermalState && /serious|critical/i.test(activePowerHealth.thermalState)
                    ? 'text-rose-400'
                    : activePowerHealth.thermalState === 'fair'
                      ? 'text-amber-300'
                      : activePowerHealth.thermalState || activePowerHealth.temperatureC !== null
                        ? 'text-emerald-400'
                        : 'text-zinc-100'
                }`}
              >
                {activePowerHealth.thermalState ??
                  (activePowerHealth.temperatureC !== null
                    ? `${activePowerHealth.temperatureC} °C`
                    : 'Not reported')}
              </div>
              <div className="text-[9px] text-white/35 tabular-nums">
                {activePowerHealth.temperatureC !== null
                  ? `Sensor Temp: ${activePowerHealth.temperatureC} °C`
                  : 'Awaiting device thermal sensor'}
              </div>
            </div>

            {/* Charging Cycles */}
            <div className="bg-[#07070A] border border-white/5 rounded p-3 space-y-1">
              <div className="flex items-center justify-between text-[9px] text-white/45 uppercase">
                <span>Charging Cycles</span>
                <RefreshCw size={11} className="text-[#00f0ff]" />
              </div>
              <div className="text-lg font-light text-zinc-100 tabular-nums">
                {activePowerHealth.cycleCount !== null
                  ? `${activePowerHealth.cycleCount} cycles`
                  : 'Not reported'}
              </div>
              <div className="text-[9px] text-white/35 tabular-nums">
                {activePowerHealth.nominalCapacityMah !== null && activePowerHealth.designCapacityMah !== null
                  ? `Max Cap: ${Math.round((activePowerHealth.nominalCapacityMah / activePowerHealth.designCapacityMah) * 100)}% (${activePowerHealth.nominalCapacityMah}/${activePowerHealth.designCapacityMah} mAh)`
                  : 'Awaiting AppleSmartBattery cycle count'}
              </div>
            </div>

            {/* Charge & Power State */}
            <div className="bg-[#07070A] border border-white/5 rounded p-3 space-y-1">
              <div className="flex items-center justify-between text-[9px] text-white/45 uppercase">
                <span>Charge &amp; Power Mode</span>
                <BatteryCharging size={11} className="text-emerald-400" />
              </div>
              <div className="text-lg font-light text-zinc-100 tabular-nums">
                {activePowerHealth.chargePercent !== null
                  ? `${activePowerHealth.chargePercent}%`
                  : 'Not reported'}
              </div>
              <div className="text-[9px] text-white/35 tabular-nums">
                {activePowerHealth.isCharging !== null
                  ? activePowerHealth.isCharging
                    ? 'External Power Charging'
                    : 'Running on Battery'
                  : 'State unknown'}
                {activePowerHealth.lowPowerMode !== null
                  ? ` · LPM ${activePowerHealth.lowPowerMode ? 'ON' : 'OFF'}`
                  : ''}
              </div>
            </div>
          </div>

          {/* Live Runtime Browser Power Status (if exposed by browser Navigator Battery API) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2.5 text-[9.5px] text-white/45 tabular-nums">
            <span>
              Browser Runtime Power API (<code className="text-zinc-300">navigator.getBattery</code>):{' '}
              {hostBattery.supported ? (
                <span className="text-zinc-200">
                  {hostBattery.levelPct !== null ? `${hostBattery.levelPct}%` : 'N/A'} ·{' '}
                  {hostBattery.charging ? 'AC Charging' : 'Discharging'}
                  {hostBattery.updatedAt ? ` (${new Date(hostBattery.updatedAt).toLocaleTimeString()})` : ''}
                </span>
              ) : (
                'Not exposed by current browser'
              )}
            </span>
            <span>Real telemetry samples recorded: {telemetryHistory.length}</span>
          </div>

          {/* Real Observed Telemetry Chart (rendered strictly when real samples exist) */}
          <div ref={chartWrapRef} className="w-full border border-white/5 bg-[#060609] rounded p-3">
            {telemetryHistory.length >= 2 && chartWidth > 0 ? (
              <div className="space-y-1.5">
                <div className="text-[9px] text-white/45 uppercase tracking-wider">
                  Real-Time Device Telemetry Stream ({telemetryHistory.length} live observations)
                </div>
                <LineChart width={Math.max(240, chartWidth - 24)} height={120} data={telemetryHistory}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <XAxis dataKey="timeLabel" tick={{ fill: '#71717a', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 9 }} width={42} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A0A0E',
                      borderColor: 'rgba(255,255,255,0.12)',
                      fontSize: '10px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="voltageMv"
                    name="Voltage (mV)"
                    stroke="#00f0ff"
                    strokeWidth={1.75}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="chargePercent"
                    name="Charge (%)"
                    stroke="#34d399"
                    strokeWidth={1.5}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                </LineChart>
              </div>
            ) : (
              <div className="text-[9.5px] text-white/35 text-center py-3">
                Live telemetry waveform plots automatically once 2+ real readings arrive from BLE GATT notifications, Host USB, or Tether Relay.
              </div>
            )}
          </div>

          {/* Low Power Mode Stress Test Live Progress & Measured Results */}
          {(stressRunning || stressResult) && (
            <div className="border border-[#00f0ff]/20 bg-[#07090D] rounded p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-[#00f0ff] uppercase font-bold flex items-center gap-1.5">
                  <Gauge size={12} /> Low Power Mode Stress Test Telemetry (Measured Runtime Load)
                </span>
                <span className="text-[9.5px] text-zinc-300 tabular-nums">
                  {stressRunning
                    ? `Executing WebCrypto SHA-256 + Frame Budget Audit (${stressProgressPct}%)`
                    : `Completed in ${stressResult?.durationSec}s`}
                </span>
              </div>

              <div className="w-full h-1.5 bg-white/5 rounded overflow-hidden">
                <div
                  className="h-full bg-[#00f0ff] transition-all duration-150"
                  style={{ width: `${stressRunning ? stressProgressPct : 100}%` }}
                />
              </div>

              {stressRunning ? (
                <div className="grid grid-cols-3 gap-3 text-[10px] tabular-nums">
                  <div>
                    <span className="text-white/40 block text-[8.5px] uppercase">SHA-256 Operations</span>
                    <span className="text-zinc-100 font-semibold">{stressLiveMetrics.opsCount}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[8.5px] uppercase">Measured Throughput</span>
                    <span className="text-[#00f0ff] font-semibold">{stressLiveMetrics.opsPerSec} ops/s</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[8.5px] uppercase">Live Frame Interval</span>
                    <span className="text-zinc-100 font-semibold">{stressLiveMetrics.avgFrameMs} ms</span>
                  </div>
                </div>
              ) : (
                stressResult && (
                  <div className="space-y-2.5 text-[10px] tabular-nums">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-white/40 block text-[8.5px] uppercase">Throughput</span>
                        <span className="text-[#00f0ff] font-semibold">
                          {stressResult.opsPerSec} ops/s ({stressResult.totalOps} total)
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[8.5px] uppercase">Frame Pacing (Avg / p95)</span>
                        <span className="text-zinc-100 font-semibold">
                          {stressResult.avgFrameMs} ms / {stressResult.p95FrameMs} ms
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[8.5px] uppercase">Device Voltage Δ</span>
                        <span className="text-zinc-200">
                          {stressResult.voltageDeltaMv !== null
                            ? `${stressResult.voltageDeltaMv > 0 ? '+' : ''}${stressResult.voltageDeltaMv} mV`
                            : 'No voltage sensor bound'}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block text-[8.5px] uppercase">Thermal / Charge Δ</span>
                        <span className="text-zinc-200">
                          {stressResult.thermalObserved ?? 'No thermal telemetry'}
                          {stressResult.chargeDeltaPct !== null ? ` · ${stressResult.chargeDeltaPct}%` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[9.5px]">
                      <span className="text-zinc-200">
                        Verdict: <strong className="text-[#00f0ff]">{stressResult.verdict}</strong>
                      </span>
                      <span className="text-white/40">
                        Dropped frames (&gt;36ms): {stressResult.droppedFrames} · Device updates during window:{' '}
                        {stressResult.deviceSamplesDuringTest}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* .ips Crash / Sysdiagnose Artifact Inspector + Deep Diagnostics Findings */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 border border-white/5 bg-black/35 rounded p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] text-white/55 uppercase tracking-wider font-bold">
                2. Real iOS Crash Log (.ips) / Powerlog / Sysdiagnose Stream
              </span>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ips,.log,.json,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] text-zinc-200 flex items-center gap-1 cursor-pointer uppercase"
                >
                  <Upload size={10} className="text-[#00f0ff]" /> Import .ips / Log
                </button>
              </div>
            </div>

            <textarea
              value={diagnosticInput}
              onChange={(e) => setDiagnosticInput(e.target.value)}
              rows={9}
              placeholder="Connect a real iPhone above or import/paste a real .ips analytics log, Powerlog, or AppleSmartBattery/ideviceinfo readout..."
              className="w-full bg-black border border-white/10 rounded p-3 text-zinc-300 focus:border-[#00f0ff]/50 focus:outline-none text-[10px] leading-relaxed"
            />

            <button
              type="button"
              onClick={handleRunAiDiagnosis}
              disabled={isAnalyzingAi || (!diagnosticInput.trim() && !connectedDevice)}
              className="w-full py-2 bg-[#00f0ff]/15 hover:bg-[#00f0ff]/25 border border-[#00f0ff]/40 text-[#00f0ff] font-bold uppercase text-[10px] rounded flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <Sparkles size={12} /> {isAnalyzingAi ? 'Running Deep Forensic Triage...' : 'Run Deep AI & Heuristic Diagnosis'}
            </button>
          </div>

          {/* Diagnostic Findings Breakdown */}
          <div className="lg:col-span-6 border border-white/5 bg-black/35 rounded p-4 space-y-3">
            <div className="text-[10px] text-white/55 uppercase tracking-wider font-bold border-b border-white/5 pb-2.5">
              3. Deep Diagnostic Findings ({diagnosticReport.findings.length})
            </div>

            {diagnosticReport.findings.length === 0 ? (
              <div className="py-12 text-center text-white/35 text-[10px] space-y-1">
                <div>No real device telemetry or diagnostic log loaded yet.</div>
                <div>Connect your iPhone or import an .ips / sysdiagnose file to evaluate findings.</div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[305px] overflow-y-auto pr-1">
                {diagnosticReport.findings.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded border border-white/10 bg-[#07070A] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-white/45 uppercase tracking-wider">
                        {f.domain}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase flex items-center gap-1 ${
                          f.severity === 'high'
                            ? 'text-rose-400'
                            : f.severity === 'medium'
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                        }`}
                      >
                        {f.severity === 'high' ? (
                          <ShieldAlert size={10} />
                        ) : f.severity === 'medium' ? (
                          <AlertTriangle size={10} />
                        ) : (
                          <CheckCircle size={10} />
                        )}
                        {f.severity === 'high' ? 'Critical' : f.severity}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-zinc-100">{f.title}</div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">{f.detail}</p>
                    <div className="text-[9.5px] text-[#00f0ff]/85 pt-1 border-t border-white/5">
                      Remediation: {f.remediation}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Deep Triage Output Panel */}
        {aiReport && (
          <div className="border border-[#00f0ff]/25 bg-black/50 rounded p-4 space-y-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] text-[#00f0ff] uppercase font-bold flex items-center gap-1.5">
                <Sparkles size={12} /> Deep iOS Forensic Triage Report ({aiModelUsed})
              </span>
              <button
                type="button"
                onClick={() => setAiReport('')}
                className="text-[9px] text-zinc-500 hover:text-zinc-200 uppercase cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[10px] text-zinc-300 leading-relaxed max-h-64 overflow-y-auto">
              {aiReport}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
