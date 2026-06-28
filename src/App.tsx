import { useEffect, useState } from 'react';
import type { AppData } from './data/types';
import { DataContext, loadAppData } from './data/store';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopBar } from './components/TopBar';
import { OverviewStrip } from './components/OverviewStrip';
import { Module1Map } from './modules/Module1Map';
import { Module2Predict } from './modules/Module2Predict';
import { Module3Decide } from './modules/Module3Decide';
import { VillageView } from './modules/VillageView';

export type ModuleId = 'm1' | 'm2' | 'm3';

export function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [module, setModule] = useState<ModuleId>(() => (localStorage.getItem('cs_mod') as ModuleId) || 'm1');
  const [heroOpen, setHeroOpen] = useState(false);
  const [village, setVillage] = useState<boolean>(() => localStorage.getItem('cs_view') === 'village');

  useEffect(() => { localStorage.setItem('cs_mod', module); }, [module]);
  useEffect(() => { localStorage.setItem('cs_view', village ? 'village' : 'pro'); }, [village]);

  useEffect(() => {
    let alive = true;
    loadAppData()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, []);

  if (error) {
    return <div className="boot boot-error">โหลดข้อมูลไม่สำเร็จ: {error}</div>;
  }
  if (!data) {
    return (
      <div className="boot">
        <div className="boot-mark">🔥</div>
        <div className="boot-title">CropSentinel</div>
        <div className="boot-sub thai">กำลังเชื่อมต่อดาวเทียม VIIRS · Open-Meteo · NASA POWER…</div>
        <div className="boot-bar"><span /></div>
      </div>
    );
  }

  if (village) {
    return (
      <DataContext.Provider value={data}>
        <ErrorBoundary><VillageView onExit={() => setVillage(false)} /></ErrorBoundary>
      </DataContext.Provider>
    );
  }

  let view = null;
  if (module === 'm1') view = <Module1Map />;
  if (module === 'm2') view = <Module2Predict />;
  if (module === 'm3') view = <Module3Decide />;

  return (
    <DataContext.Provider value={data}>
      <div className="app">
        <Sidebar module={module} setModule={setModule} onVillage={() => setVillage(true)} />
        <main
          className="main"
          data-screen-label={module === 'm1' ? '01 Fire Intelligence' : module === 'm2' ? '02 Spread Engine' : '03 Response Platform'}
        >
          <TopBar module={module} />
          <div className="content">
            <OverviewStrip module={module} setModule={setModule} heroOpen={heroOpen} setHeroOpen={setHeroOpen} />
            <ErrorBoundary key={module}>{view}</ErrorBoundary>
          </div>
        </main>
      </div>
    </DataContext.Provider>
  );
}
