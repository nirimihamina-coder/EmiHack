import { useState } from 'react';

/* ──────────────────────────────────────────────
   DATA
   ────────────────────────────────────────────── */
const trafficEvolution = [
  { hour: '06h', value: 22 },
  { hour: '07h', value: 45 },
  { hour: '08h', value: 78 },
  { hour: '09h', value: 92 },
  { hour: '10h', value: 68 },
  { hour: '11h', value: 55 },
  { hour: '12h', value: 72 },
  { hour: '13h', value: 80 },
  { hour: '14h', value: 65 },
  { hour: '15h', value: 70 },
  { hour: '16h', value: 88 },
  { hour: '17h', value: 95 },
  { hour: '18h', value: 82 },
  { hour: '19h', value: 58 },
  { hour: '20h', value: 35 },
];

const routesData = [
  { name: 'Autoroute A1', from: 'Paris', to: 'Lille', status: 'saturée', speed: 22, vehicles: 3420 },
  { name: 'Boulevard Périphérique', from: 'Paris', to: 'Paris', status: 'dense', speed: 38, vehicles: 5100 },
  { name: 'Route Nationale 7', from: 'Lyon', to: 'Marseille', status: 'fluide', speed: 95, vehicles: 1280 },
  { name: 'Autoroute A6', from: 'Paris', to: 'Lyon', status: 'dense', speed: 45, vehicles: 2890 },
  { name: 'Route Départementale 12', from: 'Bordeaux', to: 'Toulouse', status: 'fluide', speed: 82, vehicles: 640 },
  { name: 'Autoroute A10', from: 'Paris', to: 'Bordeaux', status: 'saturée', speed: 18, vehicles: 4100 },
  { name: 'Route Nationale 20', from: 'Orléans', to: 'Toulouse', status: 'fluide', speed: 88, vehicles: 520 },
  { name: 'Autoroute A7', from: 'Lyon', to: 'Marseille', status: 'dense', speed: 42, vehicles: 2650 },
];

const vehicleBreakdown = [
  { label: 'Voitures', value: 12480, pct: 58, color: 'from-blue-400 to-blue-500', bg: 'bg-blue-50', text: 'text-blue-600', icon: '🚗' },
  { label: 'Motos', value: 3240, pct: 15, color: 'from-amber-400 to-orange-400', bg: 'bg-amber-50', text: 'text-amber-600', icon: '🏍️' },
  { label: 'Vélos', value: 2150, pct: 10, color: 'from-emerald-400 to-teal-400', bg: 'bg-emerald-50', text: 'text-emerald-600', icon: '🚲' },
  { label: 'Bus', value: 3630, pct: 17, color: 'from-violet-400 to-purple-400', bg: 'bg-violet-50', text: 'text-violet-600', icon: '🚌' },
];

/* ──────────────────────────────────────────────
   STATUS HELPERS
   ────────────────────────────────────────────── */
const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  fluide:  { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Fluide' },
  dense:   { bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-500',   label: 'Dense' },
  saturée: { bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-500',     label: 'Saturée' },
};

/* ──────────────────────────────────────────────
   COMPONENTS
   ────────────────────────────────────────────── */

// ── Modern Card wrapper ──
const ModernCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`relative overflow-hidden rounded-xl bg-white border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 ${className}`}>
    {children}
  </div>
);

// ── Mini sparkline (CSS only) ──
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-0.75 h-10">
      {data.map((v, i) => (
        <div
          key={i}
          className={`w-1 rounded-full bg-linear-to-t ${color} transition-all duration-500`}
          style={{ height: `${(v / max) * 100}%`, opacity: 0.5 + (v / max) * 0.5 }}
        />
      ))}
    </div>
  );
};

// ── Animated counter ──
const AnimatedValue = ({ value, suffix = '' }: { value: string | number; suffix?: string }) => (
  <span className="tabular-nums font-bold">
    {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
    {suffix}
  </span>
);

/* ──────────────────────────────────────────────
   MAIN DASHBOARD
   ────────────────────────────────────────────── */
const DashboardPage = () => {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const maxValue = Math.max(...trafficEvolution.map(d => d.value));

  return (
    <div className="min-h-screen bg-linear-to-r from-slate-50 via-blue-50/30 to-violet-50/20 text-slate-900 font-sans selection:bg-blue-200">

      {/* ── Ambient background blobs ── */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-150 h-150 rounded-full bg-blue-200/30 blur-[150px]" />
        <div className="absolute top-1/2 -left-40 w-125 h-125 rounded-full bg-violet-200/20 blur-[150px]" />
        <div className="absolute bottom-0 right-1/3 w-100 h-100 rounded-full bg-emerald-200/20 blur-[150px]" />
      </div>

      {/* ── Header ── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-100">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-emerald-700">Système opérationnel</span>
        </div>
        <div>
          <p className="text-sm text-slate-500 mt-2">Surveillance en temps réel — Dernière mise à jour : il y a 12 sec</p>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          ROW 1 — KPI Cards
          ══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">

        {/* Total Véhicules */}
        <ModernCard className="p-6 group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-linear-to-r from-blue-100 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Véhicules</span>
              <div className="w-10 h-10 rounded-2xl bg-linear-to-r from-blue-50 to-blue-100 flex items-center justify-center text-xl">
                🚗
              </div>
            </div>
            <p className="text-4xl font-bold text-slate-900 mb-2">
              <AnimatedValue value={21500} />
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-semibold">
                ~ 12.5%
              </span>
              
            </div>
            <Sparkline data={[30, 45, 38, 52, 48, 60, 55, 70, 65, 78, 72, 85]} color="from-blue-400 to-blue-500" />
          </div>
        </ModernCard>

        {/* Routes Actives */}
        <ModernCard className="p-6 group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-linear-to-r from-violet-100 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Routes Actives</span>
              <div className="w-10 h-10 rounded-2xl bg-linear-to-r from-violet-50 to-violet-100 flex items-center justify-center text-xl">
                🛣️
              </div>
            </div>
            <p className="text-4xl font-bold text-slate-900 mb-2">
              <AnimatedValue value={342} />
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-blue-50 text-blue-600 text-xs font-semibold">
              ~ 98% du réseau
              </span>
            </div>
            <Sparkline data={[80, 82, 85, 83, 88, 90, 87, 92, 95, 93, 96, 98]} color="from-violet-400 to-violet-500" />
          </div>
        </ModernCard>

        {/* Vitesse Moyenne */}
        <ModernCard className="p-6 group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-linear-to-r from-amber-100 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vitesse Moyenne</span>
              <div className="w-10 h-10 rounded-2xl bg-linear-to-r from-amber-50 to-amber-100 flex items-center justify-center text-xl">
                ⚡
              </div>
            </div>
            <p className="text-4xl font-bold text-slate-900 mb-2">
              <AnimatedValue value={54} suffix=" km/h" />
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-50 text-red-600 text-xs font-semibold">
                ~ 8.2%
              </span>
              
            </div>
            <Sparkline data={[70, 65, 58, 52, 48, 55, 60, 50, 45, 52, 48, 54]} color="from-amber-400 to-amber-500" />
          </div>
        </ModernCard>

        {/* Route la plus congestionnée */}
        <ModernCard className="p-6 group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-linear-to-r from-red-100 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Plus Congestionnée</span>
              <div className="w-10 h-10 rounded-2xl bg-linear-to-r from-red-50 to-red-100 flex items-center justify-center text-xl">
                🚨
              </div>
            </div>
            <p className="text-xl font-bold text-red-600 mb-1 leading-tight">
              Autoroute A1
            </p>
            <p className="text-xs text-slate-500 mb-3">Paris → Lille · 22 km/h</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-red-400 to-orange-400" />
              </div>
              <span className="text-sm font-bold text-red-600">92%</span>
            </div>
          </div>
        </ModernCard>
      </div>

      {/* ══════════════════════════════════════════
          ROW 2 — Vehicle Breakdown + Traffic Chart
          ══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 mb-6">

        {/* ── Vehicle Breakdown ── */}
        <ModernCard className="xl:col-span-2 p-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">
            Répartition des Véhicules
          </h2>

          {/* Donut-like center stat */}
          <div className="flex justify-center mb-8">
            <div className="relative w-44 h-44">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {/* Background circle */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                {/* Segments */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="url(#grad-blue)" strokeWidth="12"
                  strokeDasharray={`${58 * 2.51} ${100 * 2.51}`} strokeDashoffset="0" strokeLinecap="round" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="url(#grad-amber)" strokeWidth="12"
                  strokeDasharray={`${15 * 2.51} ${100 * 2.51}`} strokeDashoffset={`${-58 * 2.51}`} strokeLinecap="round" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="url(#grad-emerald)" strokeWidth="12"
                  strokeDasharray={`${10 * 2.51} ${100 * 2.51}`} strokeDashoffset={`${-73 * 2.51}`} strokeLinecap="round" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="url(#grad-violet)" strokeWidth="12"
                  strokeDasharray={`${17 * 2.51} ${100 * 2.51}`} strokeDashoffset={`${-83 * 2.51}`} strokeLinecap="round" />
                <defs>
                  <linearGradient id="grad-blue"><stop stopColor="#60a5fa"/><stop offset="1" stopColor="#3b82f6"/></linearGradient>
                  <linearGradient id="grad-amber"><stop stopColor="#fbbf24"/><stop offset="1" stopColor="#f59e0b"/></linearGradient>
                  <linearGradient id="grad-emerald"><stop stopColor="#34d399"/><stop offset="1" stopColor="#10b981"/></linearGradient>
                  <linearGradient id="grad-violet"><stop stopColor="#a78bfa"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-900">21 500</span>
                <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total</span>
              </div>
            </div>
          </div>

          {/* Legend items */}
          <div className="space-y-4">
            {vehicleBreakdown.map((v) => (
              <div key={v.label} className="flex items-center gap-3 group">
                <div className={`w-10 h-10 rounded-2xl ${v.bg} flex items-center justify-center text-lg`}>
                  {v.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-700">{v.label}</span>
                    <span className="text-sm font-bold text-slate-900">{v.value.toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${v.color} transition-all duration-1000`}
                      style={{ width: `${v.pct}%` }}
                    />
                  </div>
                </div>
                <span className={`text-xs font-bold ${v.text} w-10 text-right`}>{v.pct}%</span>
              </div>
            ))}
          </div>
        </ModernCard>

        {/* ── Traffic Evolution Chart ── */}
        <ModernCard className="xl:col-span-3 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Évolution du Trafic (aujourd'hui)
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-linear-to-r from-violet-400 to-blue-400" />
                Volume
              </span>
            </div>
          </div>

          {/* Bar chart */}
          <div className="relative h-64 flex items-end gap-2 sm:gap-3 px-2">
            {/* Horizontal grid lines */}
            {[0, 25, 50, 75, 100].map((pct) => (
              <div
                key={pct}
                className="absolute left-0 right-0 border-t border-slate-100"
                style={{ bottom: `${pct}%` }}
              >
                <span className="absolute -left-1 -top-2 text-[10px] text-slate-400 font-medium">
                  {pct > 0 ? `${pct}%` : ''}
                </span>
              </div>
            ))}

            {trafficEvolution.map((d, i) => {
              const heightPct = (d.value / maxValue) * 100;
              const isHovered = hoveredBar === i;
              const isHigh = d.value > 80;
              return (
                <div
                  key={d.hour}
                  className="relative flex-1 flex flex-col items-center group cursor-pointer"
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-slate-900 text-xs font-bold text-white whitespace-nowrap z-10 shadow-lg">
                      {d.value}%
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900" />
                    </div>
                  )}
                  {/* Bar */}
                  <div
                    className={`w-full rounded-t-xl transition-all duration-300 ${
                      isHigh
                        ? 'bg-gradient-to-t from-red-400 to-orange-300'
                        : 'bg-gradient-to-t from-violet-400 to-blue-300'
                    } ${isHovered ? 'opacity-100 scale-105' : 'opacity-80'}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  {/* Label */}
                  <span className={`mt-2 text-xs font-medium transition-colors ${isHovered ? 'text-slate-900' : 'text-slate-400'}`}>
                    {d.hour}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Peak indicator */}
          <div className="mt-6 flex items-center gap-3 px-2">
            <span className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold">
              🔴 Pic : 17h
            </span>
            <span className="text-xs text-slate-500">— congestion maximale détectée à 95%</span>
          </div>
        </ModernCard>
      </div>

      {/* ══════════════════════════════════════════
          ROW 3 — Routes Table
          ══════════════════════════════════════════ */}
      <ModernCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            État des Routes en Temps Réel
          </h2>
          <span className="text-xs text-slate-500 font-medium">{routesData.length} routes surveillées</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Route</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Trajet</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">État</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Vitesse</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Véhicules</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Charge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {routesData.map((route) => {
                const status = statusConfig[route.status];
                const charge = route.status === 'saturée' ? 92 : route.status === 'dense' ? 68 : 30;
                return (
                  <tr
                    key={route.name}
                    className="hover:bg-slate-50/50 transition-colors duration-200 group"
                  >
                    <td className="py-4 px-4">
                      <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {route.name}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-500 hidden sm:table-cell">
                      {route.from} → {route.to}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex justify-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${status.bg} ${status.text}`}>
                          <span className={`w-2 h-2 rounded-full ${status.dot} ${route.status === 'saturée' ? 'animate-pulse' : ''}`} />
                          {status.label}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right hidden md:table-cell">
                      <span className={`font-mono font-bold ${route.speed < 30 ? 'text-red-600' : route.speed < 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {route.speed} km/h
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-slate-600 font-medium hidden lg:table-cell">
                      {route.vehicles.toLocaleString('fr-FR')}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-3">
                        <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              route.status === 'saturée' ? 'bg-gradient-to-r from-red-400 to-orange-400' :
                              route.status === 'dense' ? 'bg-gradient-to-r from-amber-400 to-yellow-400' :
                              'bg-gradient-to-r from-emerald-400 to-teal-400'
                            }`}
                            style={{ width: `${charge}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-600 w-10 text-right">{charge}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ModernCard>

      {/* ── Footer ── */}
      <footer className="mt-8 text-center text-xs text-slate-400 font-medium">
        Centre de Contrôle Trafic © 2026 — Données simulées pour démonstration
      </footer>
    </div>
  );
};

export default DashboardPage;