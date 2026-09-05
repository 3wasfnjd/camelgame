"use client";

import {
  Beef, CirclePause, Clock3, Compass, Droplets, Heart, MapPin,
  PackageOpen, Play, ShieldAlert, Sparkles, Sun, Wheat, Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { GameSnapshot, MobileControls } from "@/game/types";

const initialSnapshot: GameSnapshot = {
  health: 100,
  stamina: 100,
  thirst: 86,
  hunger: 88,
  water: 2,
  dates: 4,
  time: "16:30",
  weather: "أجواء صافية",
  location: "كثبان العنبر",
  objective: "الوصول إلى واحة بئر القمر",
  objectiveDetail: "اتبع الشعاع الفيروزي واعثر على الماء العذب.",
  objectiveDistance: 890,
  level: 1,
  toast: "",
};

function StatBar({ label, value, tone, icon }: {
  label: string;
  value: number;
  tone: "health" | "stamina" | "thirst" | "hunger";
  icon: React.ReactNode;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="stat-row">
      <span className="stat-label">{icon}{label}</span>
      <span className="bar-track" aria-hidden="true">
        <span className={`bar-fill ${tone}`} style={{ "--value": `${safe}%` } as CSSProperties} />
      </span>
      <span className="stat-value">{safe}</span>
    </div>
  );
}

function CamelIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path fill="currentColor" d="M8 41c0-7 6-12 13-12h5c3-9 9-14 16-12 4 1 6 5 7 11l3 2c4 2 5 7 3 10-1 2-4 3-7 3h-4l-1 12h-5l-1-12H23l-2 12h-5l1-13c-2 3-5 5-9 5v-6Zm35-18c-3-2-6-1-8 1l5 5h5l-2-6Z" />
    </svg>
  );
}

export function DesertCamelGame() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("@/game/Game").Game | null>(null);
  const joystickPointer = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [joy, setJoy] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let disposed = false;
    async function boot() {
      if (!mountRef.current) return;
      try {
        const { Game } = await import("@/game/Game");
        if (disposed || !mountRef.current) return;
        gameRef.current = new Game(mountRef.current, setSnapshot);
        setReady(true);
      } catch (reason) {
        console.error(reason);
        setError("تعذر تشغيل الصحراء ثلاثية الأبعاد على هذا الجهاز. قد لا يكون WebGL متاحًا.");
      }
    }
    boot();
    return () => {
      disposed = true;
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const toggle = (event: KeyboardEvent) => {
      if ((event.key === "Escape" || event.key.toLowerCase() === "p") && started) {
        setPaused((current) => {
          gameRef.current?.setPaused(!current);
          return !current;
        });
      }
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, [started]);

  const begin = useCallback(() => {
    gameRef.current?.start();
    setStarted(true);
    setPaused(false);
  }, []);

  const resume = useCallback(() => {
    gameRef.current?.setPaused(false);
    setPaused(false);
  }, []);

  const togglePause = useCallback(() => {
    setPaused((current) => {
      gameRef.current?.setPaused(!current);
      return !current;
    });
  }, []);

  const setControl = useCallback((name: keyof MobileControls, value: number | boolean) => {
    gameRef.current?.setMobileControl(name, value);
  }, []);

  const updateJoystick = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const limit = rect.width * .31;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const length = Math.hypot(rawX, rawY) || 1;
    const scale = Math.min(1, limit / length);
    const x = rawX * scale;
    const y = rawY * scale;
    setJoy({ x, y });
    setControl("turn", x / limit);
    setControl("forward", -y / limit);
  }, [setControl]);

  const onJoystickDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    joystickPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateJoystick(event);
  }, [updateJoystick]);

  const onJoystickMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current === event.pointerId) updateJoystick(event);
  }, [updateJoystick]);

  const endJoystick = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== event.pointerId) return;
    joystickPointer.current = null;
    setJoy({ x: 0, y: 0 });
    setControl("turn", 0);
    setControl("forward", 0);
  }, [setControl]);

  const hold = (name: keyof MobileControls) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setControl(name, true);
    },
    onPointerUp: () => setControl(name, false),
    onPointerCancel: () => setControl(name, false),
    onPointerLeave: () => setControl(name, false),
  });

  return (
    <main className="game-shell" aria-label="لعبة جمل الصحراء ثلاثية الأبعاد" dir="rtl">
      <div ref={mountRef} className="game-canvas" />
      <div className="vignette" />
      <div className="grain" />

      {started && (
        <>
          <section className="hud" aria-label="حالة اللعبة">
            <div className="status-panel panel">
              <div className="identity-row">
                <div className="camel-mark"><CamelIcon /></div>
                <div>
                  <p className="eyebrow">مستكشفة القوافل</p>
                  <p className="player-name">صحراء · باحثة الواحات</p>
                </div>
                <span className="level-badge">المستوى {snapshot.level}</span>
              </div>
              <div className="bars">
                <StatBar label="الصحة" value={snapshot.health} tone="health" icon={<Heart />} />
                <StatBar label="التحمل" value={snapshot.stamina} tone="stamina" icon={<Zap />} />
                <StatBar label="العطش" value={snapshot.thirst} tone="thirst" icon={<Droplets />} />
                <StatBar label="الجوع" value={snapshot.hunger} tone="hunger" icon={<Wheat />} />
              </div>
            </div>

            <div className="world-panel panel">
              <div className="location-row">
                <MapPin />
                <span className="location-name">{snapshot.location}</span>
                <span className="world-divider" />
                <Sun /><span>{snapshot.weather}</span>
                <span className="world-divider" />
                <Clock3 /><span>{snapshot.time}</span>
              </div>
            </div>

            <div className="objective-panel panel">
              <div className="objective-head">
                <span className="objective-kicker">المهمة الحالية</span>
                <span className="distance-badge">{snapshot.objectiveDistance < 1000 ? `${snapshot.objectiveDistance} م` : `${(snapshot.objectiveDistance / 1000).toFixed(1)} كم`}</span>
              </div>
              <h2 className="objective-title">{snapshot.objective}</h2>
              <p className="objective-copy">{snapshot.objectiveDetail}</p>
            </div>

            <div className="inventory-panel panel">
              <p className="inventory-title">الحقيبة</p>
              <div className="inventory-row">
                <div className="inventory-slot"><Droplets /><span className="inventory-count">×{snapshot.water}</span><span className="inventory-label">ماء</span></div>
                <div className="inventory-slot dates"><Beef /><span className="inventory-count">×{snapshot.dates}</span><span className="inventory-label">تمر</span></div>
              </div>
            </div>

            <div className="control-strip panel">
              <span className="control-chip"><kbd dir="ltr">WASD</kbd> التحرك</span>
              <span className="control-chip"><kbd dir="ltr">SHIFT</kbd> الركض</span>
              <span className="control-chip"><kbd dir="ltr">SPACE</kbd> القفز</span>
              <span className="control-chip"><kbd dir="ltr">E</kbd> استخدام</span>
            </div>

            <button className="pause-button" type="button" onClick={togglePause} aria-label="إيقاف اللعبة مؤقتًا"><CirclePause /></button>
          </section>

          <div className={`toast ${snapshot.toast ? "visible" : ""}`} role="status" aria-live="polite">{snapshot.toast}</div>

          <div className="mobile-controls" aria-label="أزرار التحكم باللمس">
            <div className="joystick-zone" onPointerDown={onJoystickDown} onPointerMove={onJoystickMove} onPointerUp={endJoystick} onPointerCancel={endJoystick} aria-label="عصا التحرك">
              <div className="joystick-knob" style={{ "--joy-x": `${joy.x}px`, "--joy-y": `${joy.y}px` } as CSSProperties} />
            </div>
            <div className="mobile-actions">
              <button type="button" {...hold("jump")}>قفز</button>
              <button type="button" {...hold("sprint")}>ركض</button>
            </div>
          </div>
        </>
      )}

      {!ready && !error && <div className="loading-state"><div><div className="loading-orbit" /><p>جاري تشكيل الكثبان…</p></div></div>}

      {error && <div className="error-state"><div><ShieldAlert size={38} /><h1>تعذر دخول الصحراء</h1><p>{error}</p></div></div>}

      {ready && !started && (
        <section className="start-screen">
          <div className="start-card">
            <div className="title-mark"><Sparkles size={15} /> رحلة في الصحراء المفتوحة</div>
            <h1 className="game-title">جمل <span>الصحراء</span></h1>
            <p className="start-copy">اعبر الكثبان المتحركة، واعثر على واحة بئر القمر، ثم اتبع طريق القوافل القديم نحو الآثار المنسية. حافظ على غذاء صحراء وراحتها، وابقَ متقدمًا على العاصفة.</p>
            <div className="button-row"><button className="primary-button" type="button" onClick={begin}><Play size={17} /> ابدأ الرحلة</button></div>
            <div className="start-controls">
              <span><kbd dir="ltr">WASD</kbd> توجيه</span><span><kbd dir="ltr">SHIFT</kbd> ركض</span><span><kbd dir="ltr">SPACE</kbd> قفز</span><span><kbd dir="ltr">E</kbd> استخدام المؤن</span>
            </div>
          </div>
        </section>
      )}

      {started && paused && (
        <section className="pause-screen">
          <div className="pause-card panel">
            <Compass size={28} /><h2>الرحلة متوقفة</h2><p>الرياح ستنتظر. واصل الرحلة عندما تكون مستعدًا.</p>
            <div className="button-row">
              <button className="primary-button" type="button" onClick={resume}><Play size={16} /> متابعة</button>
              <button className="secondary-button" type="button" onClick={() => gameRef.current?.useSupply()}><PackageOpen size={16} /> استخدام المؤن</button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
