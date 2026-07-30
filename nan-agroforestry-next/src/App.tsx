'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FarmInput, SystemPlan } from './data/types';
import type { Climate } from './lib/climate';
import './styles/animations.css';
import { UNCHECKED_LEGAL_CLASSES, type ProtectedArea } from './lib/gistda';
import type { SatContext } from './lib/satellite';
import type { SoilContext } from './lib/soil';
import { bahtK } from './lib/format';
import { LAYER_META, PLANTS } from './data/plants';
import type { Layer } from './data/types';
import { InputForm } from './components/InputForm';
import { PlantGlyph } from './components/PlantGlyph';
import { ResultPlan } from './components/ResultPlan';
import { Methodology } from './components/Methodology';
import { Icon, type IconName } from './components/Icon';
import { Splash } from './components/Splash';
import { Tour, type TourStep } from './components/Tour';
import { PlanLoading } from './components/PlanLoading';
import { farmInputSchema, sanitizeAssumptions } from './lib/planSchema';

const TOUR_KEY = 'nan-agro-tour-v1';

const EMPTY_LAYERS: Record<Layer, string[]> = { canopy: [], shrub: [], groundcover: [], root: [] };

// Every plot-specific measurement starts EMPTY. It previously shipped a complete,
// already-valid session (10 ไร่ / ปัว / 19.179,100.907 / 420 ม.), and since validateInput
// checks exactly these fields, the wizard reported "ready" and ออกแบบระบบ was clickable
// from a cold start — so an officer who skipped the GPS tap got a plan computed for Pua.
// `goal` is deliberately kept: it is a preference, not a measurement, so carrying it
// between farmers cannot produce a wrong-plot result. NaN renders as an empty box via
// InputForm's numberValue and fails validateInput's isFiniteNumber check, as intended.
function freshInput(): FarmInput {
  return {
    currentCropId: null,
    sizeRai: NaN,
    elevationM: NaN,
    existingZones: [],
    locationLabel: '',
    lat: undefined,
    lng: undefined,
    selectedByLayer: { ...EMPTY_LAYERS },
    goal: 'balanced',
  };
}

function fireNear(prot: ProtectedArea | null) {
  return Math.max(prot?.fireNearby ?? 0, prot?.disasterFire7dNear ?? 0);
}

function floodNear(prot: ProtectedArea | null) {
  return Math.max(prot?.disasterFlood7dNear ?? 0, prot?.disasterFloodFreqNear ?? 0);
}

// A missing prot (whole GISTDA call failed) and prot.protectedStatus === 'unavailable'
// (only the park/sanctuary lookup failed) both mean the legal signal is UNKNOWN. Neither
// may be presented as a clear result.
function legalUnknown(prot: ProtectedArea | null) {
  return !prot || prot.protectedStatus !== 'ok';
}

function missionLabel(sat: SatContext | null, prot: ProtectedArea | null, climate: Climate | null) {
  if (prot?.inside || sat?.verdict === 'forest') return 'Protect first';
  if (legalUnknown(prot)) return 'Legal status unknown';
  if (fireNear(prot) > 0) return 'Fire buffer';
  if (floodNear(prot) > 0) return 'Flood buffer';
  if (prot?.near) return 'Forest buffer';
  if (prot?.riverNear) return 'Watershed buffer';
  if ((climate?.drym ?? 0) >= 5 && (prot?.disasterDroughtLayers?.length ?? 0) > 0) return 'Drought resilient';
  if (sat?.verdict === 'restore') return 'Restore priority';
  return 'Agroforest upgrade';
}

function missionText(sat: SatContext | null, prot: ProtectedArea | null, climate: Climate | null) {
  if (prot?.inside) return 'อยู่ในเขตอนุรักษ์: ระบบแนะนำให้หยุดการแผ้วถางและประสานหน่วยงาน';
  if (sat?.verdict === 'forest') return 'ภาพดาวเทียมชี้ว่าเป็นป่า: เป้าหมายคือคุ้มครองพื้นที่เดิม';
  // Ranked above the hazard cases on purpose: an unknown legal status is the finding the
  // officer must act on first, and it must never be silently replaced by a softer message.
  if (legalUnknown(prot)) return 'ยังตรวจสถานะพื้นที่อนุรักษ์ไม่สำเร็จรอบนี้: ยังไม่ทราบว่าแปลงนี้อยู่ในเขตคุ้มครองหรือไม่ · ต้องตรวจกับเกษตรอำเภอ/ป่าไม้ก่อนลงมือ';
  if (fireNear(prot) > 0) return `พบ hotspot ไฟป่าจาก GISTDA รอบแปลง ${fireNear(prot)} จุด: วนเกษตรหลายชั้นช่วยลดเชื้อเพลิงโล่งและทำแนวกันไฟสีเขียว`;
  if (floodNear(prot) > 0) return `พบสัญญาณน้ำท่วม/น้ำท่วมซ้ำซากจาก GISTDA รอบแปลง ${floodNear(prot)} พื้นที่: ควรออกแบบแนวริมน้ำ พืชคลุมดิน และโซนรับน้ำ`;
  if (prot?.near) return 'ใกล้แนวป่า: วนเกษตรทำหน้าที่เป็น buffer ลดแรงกดดันต่อพื้นที่อนุรักษ์';
  if (prot?.riverNear) return `ใกล้ลำน้ำในระยะ ${prot.riverDistanceM?.toLocaleString('en-US')} ม.: ควรทำแนวไม้ยืนต้นกันชน ลดดินไหลลงน้ำ`;
  if ((climate?.drym ?? 0) >= 5 && (prot?.disasterDroughtLayers?.length ?? 0) > 0) return `ฤดูแล้ง ${climate?.drym} เดือน และเชื่อมชั้นภัยแล้ง GISTDA (${prot?.disasterDroughtLayers?.join(', ')}): แผนควรเน้นร่มเงา คลุมดิน และชนิดทนแล้ง`;
  if (sat?.verdict === 'restore') return 'พื้นที่เกษตร/เสื่อมโทรม: เหมาะกับการฟื้นฟูด้วยไม้ยืนต้นหลายชั้น';
  // Deliberately NOT "ปลูกได้" — this branch only knows the plot missed two layers
  // (park, sanctuary). ป่าสงวน/ป่าไม้ถาวร/ลุ่มน้ำ 1A were never queried.
  return `ไม่พบในชั้นอุทยาน/เขตรักษาพันธุ์สัตว์ป่า · ยังไม่ได้ตรวจ ${UNCHECKED_LEGAL_CLASSES.join(' / ')} ซึ่งเป็นตัวตัดสินทางกฎหมายบนพื้นที่สูง — ต้องยืนยันสิทธิ์ที่ดินกับเจ้าหน้าที่ก่อนลงมือ`;
}

const STEPS: Array<{ t: string; d: string; icon: IconName }> = [
  { t: 'แปลง', d: 'ขนาดและพืชเดิม', icon: 'plot' },
  { t: 'ตำแหน่ง', d: 'แผนที่ GPS อำเภอ', icon: 'pin' },
  { t: 'เลือกพืช', d: '4 ชั้นวนเกษตร', icon: 'leaf' },
  { t: 'เป้าหมาย', d: 'รายได้และ assumptions', icon: 'target' },
];
const LAST_STEP = STEPS.length - 1;

type RequiredField = 'sizeRai' | 'location' | 'elevationM' | 'goal';
type FieldIssue = { field: RequiredField; step: number; message: string };
type StepRequirement = { field: RequiredField | null; label: string; optional?: boolean };

const REQUIRED_BY_STEP: Record<number, StepRequirement[]> = {
  0: [{ field: 'sizeRai', label: 'ขนาดแปลง' }],
  1: [
    { field: 'location', label: 'พิกัดแปลง' },
    { field: 'elevationM', label: 'ความสูง' },
  ],
  2: [{ field: null, label: 'เลือกพืชเองได้ แต่ไม่บังคับ', optional: true }],
  3: [{ field: 'goal', label: 'เป้าหมายของแผน' }],
};

function isFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateInput(input: FarmInput): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (!isFiniteNumber(input.sizeRai) || input.sizeRai < 0.5 || input.sizeRai > 500) {
    issues.push({ field: 'sizeRai', step: 0, message: 'กรอกขนาดแปลง 0.5–500 ไร่' });
  }
  if (!isFiniteNumber(input.lat) || !isFiniteNumber(input.lng)) {
    issues.push({ field: 'location', step: 1, message: 'เลือกตำแหน่งแปลงจากแผนที่ GPS หรืออำเภอ' });
  }
  if (!isFiniteNumber(input.elevationM) || input.elevationM < 0 || input.elevationM > 2600) {
    issues.push({ field: 'elevationM', step: 1, message: 'กรอกความสูง 0-2,600 เมตร' });
  }
  if (!input.goal) {
    issues.push({ field: 'goal', step: 3, message: 'เลือกเป้าหมายของแผน' });
  }
  return issues;
}

const LAYERS: Layer[] = ['canopy', 'shrub', 'groundcover', 'root'];
function selectedRows(input: FarmInput) {
  const selectedByLayer = input.selectedByLayer ?? EMPTY_LAYERS;
  return LAYERS.map((layer) => ({
    layer,
    meta: LAYER_META[layer],
    plants: (selectedByLayer[layer] ?? [])
      .map((id) => PLANTS.find((p) => p.id === id))
    .filter(Boolean),
  })).filter((row) => row.plants.length);
}

function selectedPlantCount(input: FarmInput) {
  const selectedByLayer = input.selectedByLayer ?? EMPTY_LAYERS;
  return LAYERS.reduce((sum, layer) => sum + (selectedByLayer[layer]?.length ?? 0), 0);
}

function goalLabel(goal: FarmInput['goal']) {
  if (goal === 'fast') return 'คืนทุนเร็ว';
  if (goal === 'profit') return 'กำไรสูงสุด';
  return 'สมดุล';
}

function existingZoneRows(input: FarmInput) {
  const zones = (input.existingZones ?? [])
    .filter((z) => z.cropId && Number.isFinite(z.areaRai) && z.areaRai > 0);
  if (zones.length) return zones;
  if (input.currentCropId) return [{ id: 'legacy-current-crop', cropId: input.currentCropId, areaRai: input.sizeRai }];
  return [];
}

export function App() {
  const [input, setInput] = useState<FarmInput>(freshInput);
  const [systems, setSystems] = useState<SystemPlan[] | null>(null);
  const [activePlan, setActivePlan] = useState(0);
  const [climate, setClimate] = useState<Climate | null>(null);
  const [prot, setProt] = useState<ProtectedArea | null>(null);
  const [sat, setSat] = useState<SatContext | null>(null);
  const [soil, setSoil] = useState<SoilContext | null>(null);
  const [apiWarnings, setApiWarnings] = useState<string[]>([]);
  const [runFailed, setRunFailed] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const copyTimerRef = useRef<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  // Guided coach-mark tour. Each step optionally moves the wizard to the right
  // step BEFORE the Tour measures its target, so the whole flow can be shown from
  // a fresh load. Targets are stable ids/classes already in the markup.
  const gotoStep = useCallback((n: number) => { setTab('planner'); setShowResult(false); setStep(n); }, []);
  const tourSteps: TourStep[] = useMemo(() => [
    {
      icon: 'plot',
      title: 'ขั้น 1 · กรอกขนาดแปลง',
      body: 'พิมพ์ขนาดแปลงเป็น “ไร่” (0.5–500 ไร่) ตัวเลขนี้ใช้คำนวณผลผลิต ต้นทุน และรายได้รวมทั้งแปลง',
      target: '#farm-size',
      onEnter: () => gotoStep(0),
    },
    {
      icon: 'soil',
      title: 'บอกสภาพพื้นที่เดิม',
      body: 'ตอนนี้ปลูกอะไร/สภาพเป็นแบบไหน แบ่งเป็นหลายโซนได้ ระบบจะเอาไปคิด “ต้นทุนเปลี่ยนผ่าน” ปีแรกให้ตรงความจริง',
      target: '.agro-zone-panel',
      onEnter: () => gotoStep(0),
    },
    {
      icon: 'crosshair',
      title: 'ขั้น 2 · ปักตำแหน่งแปลง',
      body: 'ยืนอยู่ในแปลง? กด “ใช้ตำแหน่งปัจจุบัน (GPS)” ปุ่มเดียวได้ทั้งพิกัดและความสูงอัตโนมัติ · หรือแตะเลือกอำเภอในน่าน · ถ้าวางแผนแปลงที่อื่นค่อยกดปักหมุดบนแผนที่ในหัวข้อ “ตัวเลือกเพิ่มเติม”',
      target: '[data-tour="gps"]',
      onEnter: () => gotoStep(1),
    },
    {
      icon: 'leaf',
      title: 'ขั้น 3 · เลือกพืชที่อยากปลูก',
      body: 'แตะเลือกพืชในแต่ละชั้นได้ตามใจ · หรือ “เว้นว่างไว้” แล้วให้ระบบเลือกชนิดที่เหมาะกับพื้นที่ให้เอง ไม่ต้องรู้จักพืชมาก่อนก็ได้',
      target: '.agro-pick',
      onEnter: () => gotoStep(2),
    },
    {
      icon: 'target',
      title: 'ขั้น 4 · เลือกเป้าหมาย',
      body: 'อยากได้แบบไหน: สมดุล · เห็นผลไว (คืนทุนเร็ว) · หรือกำไรสูงสุดระยะยาว ระบบจะจัดแผนให้ตรงเป้าหมายของคุณ',
      target: '.agro-goals',
      onEnter: () => gotoStep(3),
    },
    {
      icon: 'sprout',
      title: 'กดเพื่อดูแผน',
      body: 'พร้อมแล้วกด “ออกแบบระบบ” ได้ 3 แผนวนเกษตรพร้อมกราฟรายได้ 10 ปี จุดคืนทุน คาร์บอน และความเสี่ยง · อยากดูคำแนะนำนี้อีกครั้ง กดปุ่ม “? คู่มือ” มุมขวาบนได้เสมอ',
      target: '[data-tour="submit"]',
      onEnter: () => gotoStep(3),
    },
  ], [gotoStep]);

  const startTour = () => { gotoStep(0); setTourOpen(true); };
  const closeTour = () => {
    setTourOpen(false);
    gotoStep(0);
    try { window.localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ }
  };

  // First visit only: auto-start once the splash has cleared. Skipped when arriving
  // on a shared ?plan= link (that user wants their result, not a tour).
  useEffect(() => {
    let seen = true;
    try { seen = window.localStorage.getItem(TOUR_KEY) === '1'; } catch { /* ignore */ }
    const shared = new URLSearchParams(window.location.search).has('plan');
    if (seen || shared) return;
    const t = window.setTimeout(() => setTourOpen(true), 2000);
    return () => window.clearTimeout(t);
  }, []);

  // Best-effort clipboard copy that NEVER throws (no prompt() — it is unsupported
  // in some webviews and surfaces as an unhandled rejection). The share link is
  // also already in the address bar, so a failure is a soft degrade.
  const copyPlanLink = async () => {
    const url = window.location.href;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); ok = true; }
    } catch { /* fall through to execCommand */ }
    if (!ok) {
      const ta = document.createElement('textarea');
      ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      try {
        ta.focus(); ta.select();
        ok = document.execCommand('copy');
      } catch { ok = false; }
      finally { ta.remove(); } // always clean up the node, even if select/copy throws
    }
    setCopyState(ok ? 'ok' : 'fail');
    if (copyTimerRef.current !== undefined) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopyState('idle'), 2500);
  };
  const [tab, setTab] = useState<'planner' | 'method'>('planner');
  const [step, setStep] = useState(0);
  const [attemptedSteps, setAttemptedSteps] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const activeSystem = systems?.[Math.min(activePlan, Math.max(systems.length - 1, 0))] ?? null;
  const formIssues = validateInput(input);
  const currentIssues = formIssues.filter((issue) => issue.step === step);
  const attemptedStepSet = new Set(attemptedSteps);
  const showCurrentIssues = attemptedStepSet.has(step) && currentIssues.length > 0;
  const invalidFields = showCurrentIssues ? currentIssues.map((issue) => issue.field) : [];
  const stepRequirements = REQUIRED_BY_STEP[step] ?? [];
  const hasPlotData = isFiniteNumber(input.sizeRai) || isFiniteNumber(input.lat)
    || isFiniteNumber(input.elevationM) || Boolean(input.locationLabel)
    || selectedPlantCount(input) > 0 || (input.existingZones?.length ?? 0) > 0;

  const markStepsAttempted = (steps: number[]) => {
    setAttemptedSteps((prev) => Array.from(new Set([...prev, ...steps])));
  };

  const goNext = () => {
    if (currentIssues.length > 0) {
      markStepsAttempted([step]);
      return;
    }
    setStep((s) => Math.min(LAST_STEP, s + 1));
  };

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get('plan');
    if (!encoded) return;
    try {
      // A share link is untrusted input — the app itself tells users to circulate these
      // (คัดลอกลิงก์แผน), so LINE/Facebook is the realistic delivery channel. A bare cast
      // let a crafted blob carry cropAssumptions for plants the victim never selected;
      // because the override editor only renders rows for selectedByLayer, the injected
      // numbers were invisible, and engine.applyAssumption still stamps the pick
      // `pickedBy: 'system'` — so attacker prices were presented as the model's own
      // recommendation. Measured on production: profit10 5.7M -> 34.1M, payback year 1.
      const raw = JSON.parse(decodeURIComponent(atob(encoded)));
      const parsed = farmInputSchema.safeParse(raw);
      if (!parsed.success) {
        setApiWarnings(['ลิงก์แผนนี้มีข้อมูลไม่ถูกต้อง · เริ่มกรอกใหม่เพื่อความปลอดภัย']);
        return;
      }
      setInput(sanitizeAssumptions(parsed.data as FarmInput));
    } catch {
      setApiWarnings(['อ่าน share URL ไม่สำเร็จ']);
    }
  }, []);

  // Officers see several farmers per visit. Without this every plot-specific value —
  // coordinates, elevation, zones, plant picks and any cropAssumptions price override
  // (which engine.applyAssumption silently applies to system-picked plants too) — carried
  // into the next farmer, and ?plan= re-seeded the previous one on any reload.
  const startNewFarmer = () => {
    setInput(freshInput());
    setSystems(null);
    setActivePlan(0);
    setClimate(null);
    setProt(null);
    setSat(null);
    setSoil(null);
    setApiWarnings([]);
    setRunFailed(false);
    setAttemptedSteps([]);
    setShowResult(false);
    setStep(0);
    setTab('planner');
    // Drop ?plan= so a reload cannot resurrect the farmer we just cleared.
    window.history.replaceState(null, '', window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const persistPlan = (nextSystems: SystemPlan[]) => {
    const encoded = btoa(encodeURIComponent(JSON.stringify(input)));
    window.history.replaceState(null, '', `?plan=${encoded}`);
    const item = { input, createdAt: new Date().toISOString(), bestProfit10: nextSystems[0]?.profit10 ?? 0 };
    const history = JSON.parse(window.localStorage.getItem('nan-agro-history') ?? '[]') as unknown[];
    window.localStorage.setItem('nan-agro-history', JSON.stringify([item, ...history].slice(0, 12)));
  };

  const run = async () => {
    const issues = validateInput(input);
    if (issues.length > 0) {
      markStepsAttempted(issues.map((issue) => issue.step));
      setStep(issues[0].step);
      setApiWarnings([]);
      return;
    }

    setBusy(true);
    setApiWarnings([]);
    // NOTE: runFailed is intentionally NOT reset here — keeping it true while a
    // retry is in flight keeps the retry block mounted so its busy state renders
    // (see the warning block below). It is cleared on success instead.
    // Abort a stalled request instead of leaving a field officer stuck on
    // "กำลังวิเคราะห์…" forever on a spotty rural connection. /api/plan fans out to
    // several external sources, so give it a generous but finite budget.
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`plan API ${response.status}`);
      const data = await response.json() as {
        systems: SystemPlan[];
        climate: Climate | null;
        protectedArea: ProtectedArea | null;
        satellite: SatContext | null;
        soil: SoilContext | null;
        warnings: string[];
      };
      setClimate(data.climate);
      setProt(data.protectedArea);
      setSat(data.satellite);
      setSoil(data.soil);
      setApiWarnings(data.warnings ?? []);
      setActivePlan(0);
      setSystems(data.systems);
      setRunFailed(false); // clear any prior failure once a run succeeds
      // Persistence (localStorage/history) is best-effort — a webview/private-mode
      // failure must never masquerade as a failed plan or hide the computed result.
      try { persistPlan(data.systems); } catch { /* ignore */ }
      setShowResult(true);
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 60);
    } catch (error) {
      // Never surface a raw "plan API 500" / "TypeError: Failed to fetch" to a
      // farmer — map to plain Thai by failure mode. Distinguish a deterministic
      // 4xx (bad input — retrying the same payload is pointless) from a transient
      // 5xx/network error (retry makes sense).
      const status = error instanceof Error ? Number(error.message.match(/plan API (\d+)/)?.[1] ?? 0) : 0;
      const isRateLimited = status === 429; // transient — valid input, just too fast
      const isClientError = status >= 400 && status < 500 && !isRateLimited;
      const msg = error instanceof DOMException && error.name === 'AbortError'
        ? 'ใช้เวลานานเกินไป · อินเทอร์เน็ตอาจช้า ลองใหม่อีกครั้ง'
        : isRateLimited
          ? 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'
          : isClientError
            ? 'ข้อมูลที่กรอกไม่ถูกต้อง · โปรดตรวจสอบค่าที่กรอก (เช่น ขนาดแปลง 0.5–500 ไร่) แล้วแก้ไข'
            : status >= 500
              ? 'เซิร์ฟเวอร์ขัดข้องชั่วคราว ลองใหม่อีกครั้งในอีกสักครู่'
              : 'เชื่อมต่อไม่ได้ · ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
      setApiWarnings([msg]);
      // only offer a retry when re-sending the same request could plausibly succeed
      // (bad input won't — but a rate-limit or transient error will)
      setRunFailed(!isClientError);
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };

  return (
    <div className="agro-app">
      <Splash />
      <Tour steps={tourSteps} open={tourOpen} onClose={closeTour} />
      {busy && <PlanLoading />}
      <header className="agro-header">
        <div className="agro-brand">
          <span className="agro-brand-mark"><Icon name="tree" size={34} strokeWidth={1.7} /></span>
          <div>
            <div className="agro-brand-name">
              <span>วนเกษตรน่าน</span>
              <span className="agro-brand-en">Nan Agroforestry Planner</span>
            </div>
            <div className="agro-brand-sub thai">ออกแบบระบบวนเกษตรหลายชั้น จากข้อมูลดาวเทียม GISTDA + โมเดล AI</div>
          </div>
        </div>
        <div className="agro-nav">
          <button className={tab === 'planner' ? 'on' : ''} onClick={() => setTab('planner')}>แพลนเนอร์</button>
          <button className={tab === 'method' ? 'on' : ''} onClick={() => setTab('method')}>วิธีการ<span className="agro-nav-more">&nbsp;&amp; ความน่าเชื่อถือ</span></button>
          <button type="button" className="tour-help-fab thai" onClick={startTour} aria-label="เปิดคู่มือการใช้งาน" title="ดูวิธีใช้งานอีกครั้ง">
            <span className="tour-help-q" aria-hidden>?</span><span className="tour-help-label">คู่มือ</span>
          </button>
        </div>
        <span className="chip data thai agro-model-chip"><span className="dot" />AI แนะนำพืช จากดาวเทียม ดิน และภูมิอากาศจริง</span>
      </header>

      {tab === 'method' && <Methodology />}

      {tab === 'planner' && !showResult && (
        <div className="agro-wizard">
          <div className="agro-wizard-shell">
            <aside className="agro-wizard-side">
              <div className="agro-side-head">
                <span className="agro-impact-k">ออกแบบแปลง</span>
                <b className="thai">ผู้ช่วยวางแผนวนเกษตร</b>
              </div>
              <div className="agro-side-summary">
                <div><Icon name="plot" size={17} /><span className="thai">{isFiniteNumber(input.sizeRai) ? `${input.sizeRai} ไร่` : 'ยังไม่กรอกขนาด'}</span></div>
                <div><Icon name="pin" size={17} /><span className="thai">{input.locationLabel || 'ยังไม่เลือกตำแหน่ง'}</span></div>
                <div><Icon name="target" size={17} /><span className="thai">{goalLabel(input.goal)}</span></div>
                <div><Icon name="soil" size={17} /><span className="thai">{existingZoneRows(input).length ? `${existingZoneRows(input).length} โซนเดิม` : 'ยังไม่ระบุโซนเดิม'}</span></div>
                <div><Icon name="leaf" size={17} /><span className="thai">{selectedPlantCount(input) ? `${selectedPlantCount(input)} ชนิด` : 'ให้ระบบเติมพืช'}</span></div>
              </div>
              <div className="agro-stepper">
                {STEPS.map((s, i) => {
                  const missing = formIssues.some((issue) => issue.step === i);
                  const invalid = attemptedStepSet.has(i) && missing;
                  const done = i < step && !missing;
                  return (
                    <button key={i} type="button"
                      className={`agro-step-dot ${i === step ? 'on' : ''} ${done ? 'done' : ''} ${invalid ? 'invalid' : ''}`}
                      onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
                      <span className="agro-step-ic"><Icon name={invalid ? 'warning' : done ? 'check' : s.icon} size={20} /></span>
                      <span className="agro-step-copy">
                        <span className="agro-step-t thai">{s.t}</span>
                        <span className="agro-step-d thai">{invalid ? `ขาด ${formIssues.filter((issue) => issue.step === i).length} ช่อง` : s.d}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <main className="agro-wizard-main">
              <div className="agro-step-titlebar">
                <div>
                  <span className="agro-impact-k">ขั้นที่ {step + 1}/{STEPS.length}</span>
                  <div className="agro-step-title thai">{STEPS[step].t}</div>
                </div>
                <span className="agro-step-sub thai">{STEPS[step].d}</span>
                {/* Only once something plot-specific has been entered — on a genuinely
                    fresh form there is nothing to clear and the button is just noise. */}
                {hasPlotData && (
                  <button type="button" className="agro-step-reset thai" onClick={startNewFarmer}
                    title="ล้างข้อมูลแปลงทั้งหมดเพื่อเริ่มกับเกษตรกรรายใหม่">
                    <Icon name="plot" size={15} /> เกษตรกรรายใหม่
                  </button>
                )}
              </div>

              <div className="agro-required-line" aria-live="polite">
                <span className="agro-required-label thai">ช่องสำคัญ</span>
                <div className="agro-required-chips">
                  {stepRequirements.map((req) => {
                    const missing = Boolean(req.field && currentIssues.some((issue) => issue.field === req.field));
                    const ready = Boolean(req.field && !missing);
                    return (
                      <span key={`${step}-${req.label}`} className={`agro-required-chip thai ${req.optional ? 'optional' : missing ? 'missing' : ready ? 'ready' : ''}`}>
                        {req.field && <Icon name={missing ? 'warning' : 'check'} size={14} />}
                        {req.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {showCurrentIssues && (
                <div className="agro-validation-panel" role="alert">
                  <span className="agro-validation-icon"><Icon name="warning" size={22} /></span>
                  <div>
                    <b className="thai">เติมข้อมูลสำคัญให้ครบก่อน</b>
                    <ul>
                      {currentIssues.map((issue) => <li key={`${issue.field}-${issue.message}`} className="thai">{issue.message}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              <InputForm value={input} onChange={setInput} step={step} invalidFields={invalidFields} />

              {/* Stay mounted while a retry is in flight (runFailed && busy) even
                  though apiWarnings was cleared — otherwise the retry button unmounts
                  before its busy state can render and the user gets no feedback. */}
              {(apiWarnings.length > 0 || (runFailed && busy)) && (
                <div className="agro-gistda warn">
                  <span className="agro-gistda-icon"><Icon name="warning" size={24} /></span>
                  <div className="agro-gistda-body">
                    {busy ? (
                      <b className="thai">กำลังลองใหม่…</b>
                    ) : (
                      <>
                        <b className="thai">ยังคำนวณไม่สำเร็จ</b>
                        <div className="thai">{apiWarnings.join(' · ')}</div>
                        {runFailed && (
                          <button type="button" className="agro-wiz-btn submit" style={{ marginTop: 10 }} onClick={run}>
                            <Icon name="sprout" size={18} /> ลองใหม่อีกครั้ง
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="agro-wiz-nav">
                <button type="button" className="agro-wiz-btn back" disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}><Icon name="arrowLeft" size={18} /> ย้อนกลับ</button>
                {step < LAST_STEP ? (
                  <button type="button" className="agro-wiz-btn next"
                    onClick={goNext}>ถัดไป <Icon name="arrowRight" size={18} /></button>
                ) : (
                  <button type="button" data-tour="submit" className="agro-wiz-btn submit" disabled={busy} onClick={run}>
                    {busy ? 'กำลังวิเคราะห์…' : <><Icon name="sprout" size={19} /> ออกแบบระบบ</>}
                  </button>
                )}
              </div>
            </main>
          </div>
        </div>
      )}

      {tab === 'planner' && showResult && (<>
      <div className="agro-result-top">
        <button type="button" className="agro-result-back thai" onClick={() => setShowResult(false)}><Icon name="edit" size={16} /> แก้ไขข้อมูล</button>
        <button type="button" className="agro-result-new thai" onClick={startNewFarmer}><Icon name="plot" size={16} /> เกษตรกรรายใหม่</button>
        {/* Plot provenance, promoted out of the 12px muted line: on a phone the side
            summary is display:none, so this was the only place a stale plot could be
            spotted and it was the least legible text on the page. */}
        <span className="agro-result-loc thai">
          <b>{input.locationLabel || 'ไม่ระบุตำแหน่ง'}</b>
          {' · '}{isFiniteNumber(input.sizeRai) ? `${input.sizeRai} ไร่` : 'ไม่ระบุขนาด'}
          {' · '}{isFiniteNumber(input.elevationM) ? `${input.elevationM} ม.` : 'ไม่ระบุความสูง'}
          {isFiniteNumber(input.lat) && isFiniteNumber(input.lng) ? ` · ${input.lat!.toFixed(4)}, ${input.lng!.toFixed(4)}` : ''}
        </span>
      </div>

      {apiWarnings.length > 0 && (
        <div className="agro-gistda warn">
          <span className="agro-gistda-icon"><Icon name="warning" size={24} /></span>
          <div className="agro-gistda-body">
            <b className="thai">ข้อมูลบางส่วนไม่พร้อม</b>
            <div className="thai">{apiWarnings.join(' · ')}</div>
            <div className="agro-gistda-src">ระบบยังใช้ fallback/ข้อมูลที่มีอยู่เพื่อช่วยตัดสินใจ ไม่ใช่ตัวเลขรับรอง</div>
          </div>
        </div>
      )}

      {/* Legality goes ABOVE the plans. Previously the three plans with ฿ figures and
          payback years rendered first and the stop notice sat in a collapsed panel below
          them, so an officer scanning for profit could present a plan for land where
          clearing is a criminal matter. */}
      {prot?.inside && (
        <div className="agro-legal-stop" role="alert">
          <span className="agro-legal-stop-ic"><Icon name="shieldX" size={30} /></span>
          <div>
            <b className="thai">หยุด · แปลงนี้อยู่ในเขต{prot.type}{prot.name ? ` ${prot.name}` : ''}</b>
            <div className="thai">
              การแผ้วถางหรือปลูกในเขตนี้<b>ผิดกฎหมาย</b> แผนด้านล่างแสดงไว้เพื่อการศึกษาเท่านั้น
              · ทำวนเกษตรได้เฉพาะนอกเขต หรือเข้าร่วมโครงการฟื้นฟูกับหน่วยงานที่รับผิดชอบ
            </div>
          </div>
        </div>
      )}
      {!prot?.inside && legalUnknown(prot) && (
        <div className="agro-legal-warn" role="alert">
          <span className="agro-legal-stop-ic"><Icon name="warning" size={26} /></span>
          <div>
            <b className="thai">ยังไม่ทราบสถานะเขตอนุรักษ์ของแปลงนี้</b>
            <div className="thai">
              ตรวจข้อมูลอุทยาน/เขตรักษาพันธุ์สัตว์ป่าไม่สำเร็จรอบนี้ · <b>ไม่ได้แปลว่าปลูกได้</b>
              ต้องยืนยันสิทธิ์ที่ดินกับเกษตรอำเภอหรือหน่วยป่าไม้ก่อนลงมือ
            </div>
          </div>
        </div>
      )}

      {systems && activeSystem && (
        <section className={`agro-results ${prot?.inside ? 'is-illegal' : ''}`}>
          <div className="agro-results-head">
            <h2 className="thai">ระบบวนเกษตรที่แนะนำ</h2>
            <div className="thai agro-results-sub">
              แปลง {input.sizeRai} ไร่ · ความสูง {input.elevationM} ม.
              {climate && Number.isFinite(climate.t2m)
                ? ` · อุณหภูมิ ${climate.t2m.toFixed(1)}°C · ฝน ${climate.prec.toFixed(0)} มม./ปี · เดือนแล้ง ${climate.drym} (NASA POWER)`
                : ' · ใช้เกณฑ์ความสูง (ออฟไลน์)'}
              {' '}· เป้าหมาย {input.goal === 'fast' ? 'เห็นผลไว' : input.goal === 'profit' ? 'กำไรสูงสุด' : 'สมดุล'}
            </div>
            <div className="agro-results-actions">
              <button type="button" className="agro-osm-link thai" onClick={copyPlanLink}>
                <Icon name={copyState === 'ok' ? 'checkCircle' : 'copy'} size={16} />
                {' '}{copyState === 'ok' ? 'คัดลอกแล้ว' : copyState === 'fail' ? 'คัดลอกไม่ได้ · ใช้ลิงก์จากแถบที่อยู่' : 'คัดลอกลิงก์แผน'}
              </button>
              <button type="button" className="agro-osm-link thai" onClick={() => window.print()}><Icon name="print" size={16} /> พิมพ์/PDF</button>
            </div>
          </div>
          <div className="agro-plan-tabs" role="tablist" aria-label="เลือกแผนวนเกษตร">
            {systems.map((s, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={activePlan === i}
                className={activePlan === i ? 'on' : ''}
                onClick={() => setActivePlan(i)}
              >
                <span className="thai">แผน {i + 1}</span>
                <b className="thai">{s.badge}</b>
                <em>{bahtK(s.profit10)} · agroforest {Math.round(s.scoreParts.agroforestry * 100)}%</em>
              </button>
            ))}
          </div>

          <div className="agro-plan-panel" role="tabpanel">
            <ResultPlan sys={activeSystem} rank={activePlan + 1} allSystems={systems} />
          </div>

          {existingZoneRows(input).length > 0 && (
            <div className="agro-selection-summary agro-transition-summary">
              <div>
                <span className="agro-impact-k">ข้อมูลแปลงเดิม</span>
                <h2 className="thai">โซนเดิมถูกใช้ใน cashflow แล้ว</h2>
              </div>
              <div className="agro-selection-grid">
                {existingZoneRows(input).map((zone) => (
                  <div key={zone.id} className="agro-selection-row">
                    <b className="thai">{zone.cropId}</b>
                    <span className="thai">{zone.areaRai.toLocaleString('en-US')} ไร่ · ใช้ประเมินต้นทุนเตรียมพื้นที่ปีแรก</span>
                  </div>
                ))}
                <div className="agro-selection-row agro-transition-cost">
                  <b className="thai">ต้นทุนเปลี่ยนผ่านที่หักในกราฟ</b>
                  <span className="thai">{activeSystem.transitionCost.toLocaleString('en-US')} บาท · อยู่ในปีที่ 1 ของกราฟ cashflow</span>
                </div>
              </div>
            </div>
          )}

          <div className={`agro-impact ${prot?.inside || sat?.verdict === 'forest' || fireNear(prot) > 0 ? 'danger' : sat?.verdict === 'restore' || prot?.near || prot?.riverNear || floodNear(prot) > 0 ? 'ok' : 'data'}`}>
            <div className="agro-impact-main">
              <span className="agro-impact-k">พื้นที่นี้ควรทำอะไร</span>
              <h2 className="thai">{missionLabel(sat, prot, climate)}</h2>
              <p className="thai">{missionText(sat, prot, climate)}</p>
            </div>
            <div className="agro-impact-grid">
              {/* First cell on purpose: legality outranks every economic figure on this
                  page, and it previously had no cell at all — only a collapsed panel
                  below the plans. */}
              <div>
                <span>สถานะเขตอนุรักษ์</span>
                <b>{legalUnknown(prot) ? 'ตรวจไม่สำเร็จ · ไม่ทราบ'
                  : prot!.inside ? `อยู่ในเขต${prot!.type}`
                  : prot!.near ? `ใกล้เขต${prot!.type}`
                  : 'ไม่พบในชั้นที่ตรวจได้'}</b>
              </div>
              <div>
                <span>ป่าปกคลุมเดิม (ปี 2556-57)</span>
                <b>{prot?.forestCoverStatus !== 'ok' ? 'ไม่มีข้อมูล'
                  : prot.forestCover ? 'มีป่าปกคลุม' : 'ไม่พบป่าปกคลุม'}</b>
              </div>
              <div>
                <span>ไฟป่ารอบแปลง</span>
                {/* Only show a count when the read is trustworthy — a failed/partial
                    GISTDA fire query returns 0, which must NOT read as "no fire". */}
                <b>{!prot ? 'ไม่มีข้อมูล'
                  : (prot.disasterStatus === 'live' || prot.fireStatus === 'ok')
                    ? `${fireNear(prot)} จุด · ทั้งน่าน ${prot.disasterStatus === 'live' ? prot.disasterFire7dNan : prot.fireHotspots}`
                    : 'ดึงข้อมูลไม่สำเร็จ'}</b>
              </div>
              <div>
                <span>น้ำท่วม</span>
                <b>{prot?.disasterStatus === 'live' ? `${prot.disasterFlood7dNear} จุด · ซ้ำซาก ${prot.disasterFloodFreqNear}` : 'รอเปิด API'}</b>
              </div>
              <div>
                <span>ใกล้ลำน้ำ</span>
                {/* '===ok' (not '!==unavailable') so any missing/legacy status also
                    degrades to the honest "fetch failed" rather than asserting no river. */}
                <b>{!prot ? 'ไม่มีข้อมูล'
                  : prot.riverNear ? `≤ ${prot.riverDistanceM?.toLocaleString('en-US')} ม.`
                  : prot.riverStatus === 'ok' ? 'ไม่พบใน 3 กม.'
                  : 'ดึงข้อมูลไม่สำเร็จ'}</b>
              </div>
              <div>
                <span>ภัยแล้ง</span>
                <b>{prot?.disasterDroughtLayers?.length ? prot.disasterDroughtLayers.join(' / ') : 'รอข้อมูล'}</b>
              </div>
              <div>
                <span>ความเป็นวนเกษตร</span>
                <b>{activeSystem.scoreParts.agroforestry ? `${Math.round(activeSystem.scoreParts.agroforestry * 100)}%` : '—'}</b>
              </div>
              <div>
                <span>คาร์บอน 10 ปี</span>
                <b>{activeSystem.carbon10.toLocaleString('en-US')} ตัน CO₂</b>
              </div>
              <div>
                <span>กำไร 10 ปี</span>
                <b>{bahtK(activeSystem.profit10)}</b>
              </div>
            </div>
          </div>

          {selectedRows(input).length > 0 && (
            <div className="agro-selection-summary">
              <div>
                <span className="agro-impact-k">พืชที่คุณเลือก</span>
                <h2 className="thai">พืชที่คุณเลือกถูกนำเข้าแผนแล้ว</h2>
              </div>
              <div className="agro-selection-grid">
                {selectedRows(input).map((row) => (
                  <div key={row.layer} className="agro-selection-row">
                    <b className="thai agro-sel-head"><PlantGlyph plantId="" layer={row.layer} size={18} /> {row.meta.th}</b>
                    <span className="thai agro-sel-plants">
                      {row.plants.map((p) => (
                        <span key={p!.id} className="agro-sel-plant">
                          <PlantGlyph plantId={p!.id} layer={p!.layer} size={18} /> {p!.nameTh}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="agro-disclaimer thai">
            * ความเหมาะสมพืชมาจาก SDM (GBIF + NASA POWER + GISTDA features) และถูกคุมด้วยเกณฑ์ agronomic ทั้งความสูง (เช่น กาแฟ/มะแขว่นต้องเป็นพื้นที่สูง) และดินจาก GIS: LDD กลุ่มชุดดิน จ.น่าน + SoilGrids (การระบายน้ำ/ความเป็นกรด/ความอุดมสมบูรณ์) ส่วนผลผลิต/ราคา/ต้นทุนเป็นค่าประมาณการ ควรปรึกษาเกษตรอำเภอและตรวจดินจริงก่อนลงมือ
          </div>
        </section>
      )}

      {(prot || sat || soil) && (
        <details className="agro-context">
          <summary className="thai"><Icon name="info" size={18} /> ข้อมูลพื้นที่จาก GIS/ดาวเทียม: GISTDA · ป่า/ลำน้ำ/ภัยพิบัติ · LDD/SoilGrids</summary>
          <div className="agro-context-body">

            {prot && (
              <div className={`agro-gistda ${prot.inside ? 'danger' : prot.protectedStatus !== 'ok' ? 'warn' : prot.near ? 'warn' : 'ok'}`}>
                <span className="agro-gistda-icon"><Icon name={prot.inside ? 'shieldX' : prot.protectedStatus !== 'ok' ? 'warning' : prot.near ? 'shield' : 'info'} size={24} /></span>
                <div className="agro-gistda-body">
                  {prot.protectedStatus !== 'ok' ? (
                    <><b className="thai">ตรวจสถานะเขตอนุรักษ์ไม่สำเร็จรอบนี้</b>
                      <div className="thai">ดึงข้อมูลอุทยาน/เขตรักษาพันธุ์สัตว์ป่าจาก GISTDA ไม่ได้ · <b>ไม่ได้แปลว่าแปลงนี้อยู่นอกเขตคุ้มครอง</b> ต้องตรวจสิทธิ์ที่ดินกับเกษตรอำเภอหรือหน่วยป่าไม้ก่อนลงมือปลูก</div></>
                  ) : prot.inside ? (
                    <><b className="thai">แปลงอยู่ในเขต{prot.type} {prot.name ?? ''}</b>
                      <div className="thai">ห้ามปลูก/แผ้วถางตามกฎหมาย · ทำวนเกษตรได้เฉพาะนอกเขต หรือร่วมโครงการฟื้นฟูกับหน่วยงาน</div></>
                  ) : prot.near ? (
                    <><b className="thai">ใกล้เขต{prot.type} {prot.name ?? ''} (~3 กม.)</b>
                      <div className="thai">วนเกษตรหลายชั้นช่วยเป็นแนวกันชนปกป้องป่าและลดการรุกป่า</div></>
                  ) : (
                    <><b className="thai">ไม่พบในชั้นอุทยานแห่งชาติและเขตรักษาพันธุ์สัตว์ป่า</b>
                      <div className="thai">
                        <b>ยังไม่ใช่การยืนยันว่าปลูกได้ตามกฎหมาย</b> — ชุดข้อมูลนี้มีเพียง 2 ชั้นดังกล่าว
                        ยังไม่ได้ตรวจ {UNCHECKED_LEGAL_CLASSES.join(' · ')} ซึ่งเป็นชั้นที่ตัดสินว่าการแผ้วถางบนพื้นที่สูงในน่านผิดกฎหมายหรือไม่
                        · ต้องยืนยันสิทธิ์ที่ดินกับเกษตรอำเภอหรือหน่วยป่าไม้ก่อนลงมือ
                      </div></>
                  )}
                  <div className="agro-gistda-src">ที่มา: {prot.source} · ตรวจ 2 ชั้น: อุทยานแห่งชาติ, เขตรักษาพันธุ์สัตว์ป่า</div>
                </div>
              </div>
            )}

            {prot?.forestCover && (
              <div className="agro-gistda warn">
                <span className="agro-gistda-icon"><Icon name="tree" size={24} /></span>
                <div className="agro-gistda-body">
                  <b className="thai">ภาพดาวเทียมปี 2556-2557 ระบุว่าแปลงนี้มีป่าไม้ปกคลุม</b>
                  <div className="thai">
                    เป็น<b>ข้อมูลสภาพพื้นที่ ไม่ใช่สถานะทางกฎหมาย</b> · ถ้ายังมีต้นไม้เดิมอยู่จริง
                    ควรเก็บไว้เป็นชั้นเรือนยอดแล้วเสริมพืชชั้นล่าง (ฟื้นฟู) ดีกว่าถางใหม่
                    · การถางพื้นที่ที่มีไม้ปกคลุมอาจเข้าข่ายผิดกฎหมายแม้อยู่นอกเขตอนุรักษ์ ควรตรวจกับหน่วยป่าไม้
                  </div>
                  <div className="agro-gistda-src">
                    ที่มา: {prot.source} · ชั้นข้อมูลการแปลตีความพื้นที่ป่าไม้ LANDSAT-8/ไทยโชติ ปี พ.ศ. 2556-2557
                  </div>
                </div>
              </div>
            )}

            {prot?.riverNear && (
              <div className="agro-gistda water">
                <span className="agro-gistda-icon"><Icon name="drop" size={24} /></span>
                <div className="agro-gistda-body">
                  <b className="thai">GISTDA ลำน้ำ: ใกล้ลำน้ำภายใน {prot.riverDistanceM?.toLocaleString('en-US')} ม.</b>
                  <div className="thai">
                    แนะนำทำแนวกันชนริมน้ำด้วยไม้ยืนต้น/พืชคลุมดิน ลดการชะล้างหน้าดินและสารเคมีลงลำน้ำน่าน
                    {prot.riverAmphoe ? ` · พื้นที่ ${prot.riverTambon ?? ''} ${prot.riverAmphoe}` : ''}
                  </div>
                  <div className="agro-gistda-src">ที่มา: {prot.source} · ชั้นข้อมูลแม่น้ำ</div>
                </div>
              </div>
            )}

            {prot && prot.fireHotspots > 0 && (
              <div className={`agro-gistda ${prot.fireNearby > 0 ? 'danger' : 'warn'}`}>
                <span className="agro-gistda-icon"><Icon name="fire" size={24} /></span>
                <div className="agro-gistda-body">
                  <b className="thai">GISTDA ไฟป่า: น่านพบ hotspot {prot.fireHotspots.toLocaleString('en-US')} จุด{prot.fireNearby > 0 ? ` · รอบแปลง 50 กม. ${prot.fireNearby} จุด` : ''}</b>
                  <div className="thai">
                    {prot.fireProtected > 0 ? `หลายจุดอยู่ในพื้นที่ป่า/อนุรักษ์ (${prot.fireProtected.toLocaleString('en-US')} จุด) · ` : ''}
                    แนะนำออกแบบแนวกันไฟสีเขียว ลดพื้นที่โล่งเชิงเดี่ยว และเพิ่มความชื้นด้วยพืชคลุมดิน
                  </div>
                  <div className="agro-gistda-src">
                    ที่มา: GISTDA FR_Fire · MODIS/Terra-Aqua + VIIRS/Suomi-NPP
                    {prot.fireMaxConfidence ? ` · confidence สูงสุด ${prot.fireMaxConfidence}` : ''}
                  </div>
                </div>
              </div>
            )}

            {prot?.disasterStatus === 'live' && (
              <div className={`agro-gistda ${fireNear(prot) > 0 ? 'danger' : floodNear(prot) > 0 ? 'warn' : 'ok'}`}>
                <span className="agro-gistda-icon"><Icon name="satellite" size={24} /></span>
                <div className="agro-gistda-body">
                  <b className="thai">
                    GISTDA Disaster API: ไฟป่า 7 วันรอบแปลง {prot.disasterFire7dNear?.toLocaleString('en-US')} จุด · น้ำท่วม 7 วัน {prot.disasterFlood7dNear?.toLocaleString('en-US')} พื้นที่
                  </b>
                  <div className="thai">
                    ทั้งจังหวัดน่าน: VIIRS {prot.disasterFire7dNan?.toLocaleString('en-US')} จุด · น้ำท่วม {prot.disasterFlood7dNan?.toLocaleString('en-US')} พื้นที่
                    {' '}· รอบแปลง {prot.disasterRadiusKm} กม.: burn scar {prot.disasterBurnScarNear?.toLocaleString('en-US')} · flood frequency {prot.disasterFloodFreqNear?.toLocaleString('en-US')}
                  </div>
                  <div className="agro-gistda-src">
                    ที่มา: {prot.disasterSource} · ภัยแล้งพร้อมใช้ {prot.disasterDroughtLayers?.join(' / ') || '—'}
                  </div>
                </div>
              </div>
            )}

            {(prot?.disasterStatus === 'missing-key' || prot?.disasterStatus === 'unavailable') && (
              <div className="agro-gistda warn">
                <span className="agro-gistda-icon"><Icon name="satellite" size={24} /></span>
                <div className="agro-gistda-body">
                  <b className="thai">ยังไม่ได้ประเมินความเสี่ยงภัยพิบัติรอบแปลงในรอบนี้</b>
                  <div className="thai">ข้อมูลไฟป่า/น้ำท่วม/ภัยแล้งจาก GISTDA ยังไม่พร้อมใช้ขณะนี้ · <b>ไม่ได้แปลว่าไม่มีความเสี่ยง</b> ควรสอบถามเกษตรอำเภอ/อบต. เพิ่มเติม</div>
                </div>
              </div>
            )}

            {/* Only when the broader disaster-unavailable box above is NOT already
                showing (missing-key/unavailable) — otherwise the two boxes stack and
                both say fire wasn't assessed. This fire-specific box still covers the
                'live'/'bad-request'/undefined disaster cases where box 653 is silent. */}
            {prot && prot.fireStatus && prot.fireStatus !== 'ok'
              && prot.disasterStatus !== 'live'
              && prot.disasterStatus !== 'missing-key'
              && prot.disasterStatus !== 'unavailable' && (
              <div className="agro-gistda warn">
                <span className="agro-gistda-icon"><Icon name="fire" size={24} /></span>
                <div className="agro-gistda-body">
                  <b className="thai">ข้อมูลไฟป่า GISTDA ดึงไม่สำเร็จรอบนี้</b>
                  <div className="thai">ยังไม่ได้ประเมินจุดความร้อนรอบแปลง · <b>ไม่ได้แปลว่าไม่มีไฟ</b> ช่วงหน้าแล้ง (ก.พ.–เม.ย.) ควรเฝ้าระวังและทำแนวกันไฟไว้เสมอ</div>
                </div>
              </div>
            )}

            {sat && (
              <div className={`agro-gistda ${sat.verdict === 'forest' ? 'danger' : sat.verdict === 'restore' ? 'ok' : 'warn'}`}>
                <span className="agro-gistda-icon"><Icon name="satellite" size={24} /></span>
                <div className="agro-gistda-body">
                  {sat.verdict === 'forest' ? (
                    <><b className="thai">ภาพดาวเทียม: พื้นที่นี้เป็นป่า ({sat.lcTh}, tree cover {sat.tc}%)</b>
                      <div className="thai">ไม่ควรแผ้วถางเพื่อทำเกษตร · ควรอนุรักษ์/ฟื้นฟูสภาพป่า</div></>
                  ) : sat.verdict === 'restore' ? (
                    <><b className="thai">ภาพดาวเทียม: {sat.lcTh}{sat.lossyr ? ` · เคยเป็นป่า สูญเสียปี ${sat.lossyr + 543}` : ''} · NDVI {sat.ndvi ?? '—'}</b>
                      <div className="thai">พื้นที่เสื่อมโทรม/เกษตรเชิงเดี่ยว · เหมาะอย่างยิ่งกับการฟื้นเป็นวนเกษตร</div></>
                  ) : (
                    <><b className="thai">ภาพดาวเทียม: {sat.lcTh} · NDVI {sat.ndvi ?? '—'}</b>
                      <div className="thai">ปลูกวนเกษตรเสริมความหลากหลายได้</div></>
                  )}
                  <div className="agro-gistda-src">ที่มา: {sat.source} (ผ่าน Google Earth Engine) · cell ใกล้สุด {sat.distanceKm} กม.</div>
                </div>
              </div>
            )}

            {soil && (
              <div className={`agro-gistda ${soil.acidity === 'strong' || soil.fertility < 0.45 ? 'warn' : 'ok'}`}>
                <span className="agro-gistda-icon"><Icon name="soil" size={24} /></span>
                <div className="agro-gistda-body">
                  <b className="thai">
                    ดินเชิงพื้นที่: {soil.ldd ? `${soil.ldd.soilGroupLabel} · ` : ''}{soil.texture} · pH {soil.ph} ({soil.acidityTh}) · {soil.drainageTh}
                  </b>
                  <div className="thai">
                    {soil.sdmFeatureSource === 'soilgrids'
                      ? <>อินทรียวัตถุ {soil.organicCarbonPct}% · ไนโตรเจน {soil.nitrogenPct}% · CEC {soil.cec} mmol/kg · เนื้อดิน clay {soil.clayPct}% / sand {soil.sandPct}% / silt {soil.siltPct}% · </>
                      : <>อินทรียวัตถุ/ไนโตรเจน/CEC: <b>ยังไม่มีผลตรวจ</b> (พื้นที่นี้ไม่มีข้อมูล SoilGrids · ต้องเก็บตัวอย่างส่งแล็บ) · เนื้อดินโดยประมาณจากกลุ่มชุดดิน · </>}
                    ความอุดมสมบูรณ์ {soil.fertilityTh}
                    {soil.acidity === 'strong' ? ' · ดินกรดจัด ควรปรับ pH ด้วยปูนก่อนปลูกไม้ผลที่ไวต่อกรด' : ''}
                    {' '}ระบบนำค่าดินนี้ไปปรับอันดับพืชตามการระบายน้ำ/ความเป็นกรดแล้ว
                  </div>
                  {soil.ldd && (
                    <div className="thai">
                      LDD: ดินบน {soil.ldd.textureTopTh} · ดินล่าง {soil.ldd.textureLowTh} · pH ดินบน {soil.ldd.phTopRange}
                      {soil.ldd.limitations.length ? ` · ข้อควรระวัง: ${soil.ldd.limitations.join(' / ')}` : ''}
                    </div>
                  )}
                  <div className="agro-gistda-src">ที่มา: {soil.source} · ความลึก/มาตราส่วน {soil.depthLabel} · ค่าประมาณเชิงพื้นที่ ควรยืนยันด้วยชุดตรวจดินจริงก่อนลงทุน</div>
                </div>
              </div>
            )}

          </div>
        </details>
      )}
      </>)}

      <footer className="agro-foot thai">
        ข้อมูลจาก Google Maps · GISTDA · NASA POWER · LDD กลุ่มชุดดิน · SoilGrids · GBIF · ดูที่มาทั้งหมดได้ที่แท็บ “วิธีการ”
      </footer>
    </div>
  );
}
