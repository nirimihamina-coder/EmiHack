import { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';

/* ──────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────── */
const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  fluide:  { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Fluide' },
  dense:   { bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-500',   label: 'Dense' },
  saturée: { bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-500',     label: 'Saturée' },
};

/* ──────────────────────────────────────────────
   COMPONENTS
   ────────────────────────────────────────────── */

const ModernCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`relative overflow-hidden rounded-xl bg-white border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 ${className}`}>
    {children}
  </div>
);

const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data, 1);
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
  const dash = useDashboardData(5000);

  const maxValue = Math.max(...dash.trafficEvolution.map(d => d.value), 1);

  const lastUpdateSec = Math.floor(
    (Date.now() - dash.lastUpdate.getTime()) / 1000
  );

  const peakBar = dash.trafficEvolution.reduce(
    (max, b) => (b.value > max.value ? b : max),
    dash.trafficEvolution[0] ?? { hour: '—', value: 0 }
  );

  if (dash.loading) {
    return (
      <div className="min-h-screen bg-linear-to-r from-slate-50 via-blue-50/30 to-violet-50/20 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Chargement du tableau de bord…</div>
      </div>
    );
  }

  const totalBreakdown = dash.vehicleBreakdown.reduce((s, v) => s + v.value, 0);
  const circumference = 2 * Math.PI * 40;
  const factor = circumference / 100;
  let offset = 0;

  const sparklineVehicles = dash.routesData.map((r) => Math.min(100, r.vehicles));
  const sparklineRoutes = dash.routesData.map((r) => Math.min(100, (r.vehicles / Math.max(1, totalBreakdown)) * 100));
  const sparklineSpeed = dash.routesData.map((r) => Math.min(100, r.speed));

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
          <span className="text-xs font-semibold text-emerald-700">
            {dash.operational ? 'Simulation active' : 'Aucune simulation active'}
          </span>
        </div>
        <div>
          <p className="text-sm text-slate-500 mt-2">
            {dash.operational
              ? `Surveillance en temps réel — actualisé il y a ${lastUpdateSec}s`
              : 'Configurez une simulation sur la page Simulation pour voir les données'}
          </p>
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
              <div className="w-10 h-10 rounded-2xl bg-linear-to-r from-blue-50 to-blue-100 flex items-center justify-center text-xl">🚗</div>
            </div>
            <p className="text-4xl font-bold text-slate-900 mb-2">
              <AnimatedValue value={dash.totalVehicles} />
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-semibold">
                {dash.activeRoutes} route{dash.activeRoutes > 1 ? 's' : ''} active{dash.activeRoutes > 1 ? 's' : ''}
              </span>
            </div>
            <Sparkline data={sparklineVehicles.length > 2 ? sparklineVehicles : [10, 20, 30, 40, 50, 60, 50, 70, 65, 78, 72, 85]} color="from-blue-400 to-blue-500" />
          </div>
        </ModernCard>

        {/* Routes Actives */}
        <ModernCard className="p-6 group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-linear-to-r from-violet-100 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Routes Actives</span>
              <div className="w-10 h-10 rounded-2xl bg-linear-to-r from-violet-50 to-violet-100 flex items-center justify-center text-xl">🛣️</div>
            </div>
            <p className="text-4xl font-bold text-slate-900 mb-2">
              <AnimatedValue value={dash.activeRoutes} />
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-blue-50 text-blue-600 text-xs font-semibold">
                ~ {dash.totalRoutes > 0 ? Math.round((dash.activeRoutes / dash.totalRoutes) * 100) : 0}% du réseau
              </span>
            </div>
            <Sparkline data={sparklineRoutes.length > 2 ? sparklineRoutes : [10, 20, 30, 40, 50, 60, 70, 80, 85, 83, 86, 88]} color="from-violet-400 to-violet-500" />
          </div>
        </ModernCard>

        {/* Vitesse Moyenne */}
        <ModernCard className="p-6 group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-linear-to-r from-amber-100 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vitesse Moyenne</span>
              <div className="w-10 h-10 rounded-2xl bg-linear-to-r from-amber-50 to-amber-100 flex items-center justify-center text-xl">⚡</div>
            </div>
            <p className="text-4xl font-bold text-slate-900 mb-2">
              <AnimatedValue value={dash.averageSpeed} suffix=" km/h" />
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold"
                style={{ backgroundColor: dash.averageSpeed < 30 ? '#fef2f2' : dash.averageSpeed < 55 ? '#fffbeb' : '#ecfdf5', color: dash.averageSpeed < 30 ? '#dc2626' : dash.averageSpeed < 55 ? '#d97706' : '#059669' }}>
                {dash.activeRoutes} route{dash.activeRoutes > 1 ? 's' : ''}
              </span>
            </div>
            <Sparkline data={sparklineSpeed.length > 2 ? sparklineSpeed : [50, 55, 48, 52, 58, 55, 60, 50, 45, 52, 48, 54]} color="from-amber-400 to-amber-500" />
          </div>
        </ModernCard>

        {/* Route la plus congestionnée */}
        <ModernCard className="p-6 group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-linear-to-r from-red-100 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Plus Congestionnée</span>
              <div className="w-10 h-10 rounded-2xl bg-linear-to-r from-red-50 to-red-100 flex items-center justify-center text-xl">🚨</div>
            </div>
            {dash.mostCongested ? (
              <>
                <p className="text-xl font-bold text-red-600 mb-1 leading-tight">{dash.mostCongested.name}</p>
                <p className="text-xs text-slate-500 mb-3">{dash.mostCongested.speed} km/h</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-red-400 to-orange-400 transition-all duration-700"
                      style={{ width: `${dash.mostCongested.congestion}%` }} />
                  </div>
                  <span className="text-sm font-bold text-red-600">{dash.mostCongested.congestion}%</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400 italic">Aucune congestion</p>
            )}
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

          {/* Donut */}
          <div className="flex justify-center mb-8">
            <div className="relative w-44 h-44">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                {dash.vehicleBreakdown.map((v, i) => {
                  const dashLen = v.pct * factor;
                  const gapLen = circumference;
                  const segOffset = offset;
                  offset += dashLen;
                  const gradId = `grad-${['blue','amber','emerald','violet'][i]}`;
                  return (
                    <circle key={v.label} cx="50" cy="50" r="40" fill="none"
                      stroke={`url(#${gradId})`} strokeWidth="12"
                      strokeDasharray={`${dashLen} ${gapLen}`}
                      strokeDashoffset={`${-segOffset}`}
                      strokeLinecap="round" />
                  );
                })}
                <defs>
                  <linearGradient id="grad-blue"><stop stopColor="#60a5fa"/><stop offset="1" stopColor="#3b82f6"/></linearGradient>
                  <linearGradient id="grad-amber"><stop stopColor="#fbbf24"/><stop offset="1" stopColor="#f59e0b"/></linearGradient>
                  <linearGradient id="grad-emerald"><stop stopColor="#34d399"/><stop offset="1" stopColor="#10b981"/></linearGradient>
                  <linearGradient id="grad-violet"><stop stopColor="#a78bfa"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-900">{dash.totalVehicles.toLocaleString('fr-FR')}</span>
                <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {dash.vehicleBreakdown.filter(v => v.pct > 0).map((v) => (
              <div key={v.label} className="flex items-center gap-3 group">
                <div className={`w-10 h-10 rounded-2xl ${v.bg} flex items-center justify-center text-lg`}>{v.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-700">{v.label}</span>
                    <span className="text-sm font-bold text-slate-900">{v.value.toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${v.color} transition-all duration-1000`}
                      style={{ width: `${v.pct}%` }} />
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
              Évolution du Trafic (temps réel)
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-linear-to-r from-violet-400 to-blue-400" />
                Volume
              </span>
            </div>
          </div>

          <div className="relative h-64 flex items-end gap-2 sm:gap-3 px-2">
            {[0, 25, 50, 75, 100].map((pct) => (
              <div key={pct} className="absolute left-0 right-0 border-t border-slate-100"
                style={{ bottom: `${pct}%` }}>
                <span className="absolute -left-1 -top-2 text-[10px] text-slate-400 font-medium">
                  {pct > 0 ? `${pct}%` : ''}
                </span>
              </div>
            ))}

            {dash.trafficEvolution.map((d, i) => {
              const heightPct = (d.value / maxValue) * 100;
              const isHovered = hoveredBar === i;
              const isHigh = d.value > 80;
              return (
                <div key={d.hour} className="relative flex-1 flex flex-col items-center group cursor-pointer"
                  onMouseEnter={() => setHoveredBar(i)} onMouseLeave={() => setHoveredBar(null)}>
                  {isHovered && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-slate-900 text-xs font-bold text-white whitespace-nowrap z-10 shadow-lg">
                      {d.value}%
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900" />
                    </div>
                  )}
                  <div className={`w-full rounded-t-xl transition-all duration-300 ${
                    isHigh
                      ? 'bg-gradient-to-t from-red-400 to-orange-300'
                      : 'bg-gradient-to-t from-violet-400 to-blue-300'
                  } ${isHovered ? 'opacity-100 scale-105' : 'opacity-80'}`}
                    style={{ height: `${heightPct}%` }} />
                  <span className={`mt-2 text-xs font-medium transition-colors ${isHovered ? 'text-slate-900' : 'text-slate-400'}`}>
                    {d.hour}
                  </span>
                </div>
              );
            })}
          </div>

          {peakBar.value > 0 && (
            <div className="mt-6 flex items-center gap-3 px-2">
              <span className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold">
                🔴 Pic : {peakBar.hour}
              </span>
              <span className="text-xs text-slate-500">— congestion maximale à {peakBar.value}%</span>
            </div>
          )}
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
          <span className="text-xs text-slate-500 font-medium">
            {dash.totalRoutes} routes surveillées · {dash.activeRoutes} actives
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Route</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">État</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Vitesse</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Véhicules</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Charge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {dash.routesData.map((route) => {
                const sConfig = statusConfig[route.status];
                return (
                  <tr key={route.id} className="hover:bg-slate-50/50 transition-colors duration-200 group">
                    <td className="py-4 px-4">
                      <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {route.name}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-500 hidden sm:table-cell capitalize">
                      {route.type}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex justify-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${sConfig.bg} ${sConfig.text}`}>
                          <span className={`w-2 h-2 rounded-full ${sConfig.dot} ${route.status === 'saturée' ? 'animate-pulse' : ''}`} />
                          {sConfig.label}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right hidden md:table-cell">
                      <span className={`font-mono font-bold ${route.speed < 30 ? 'text-red-600' : route.speed < 55 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {route.speed > 0 ? `${route.speed} km/h` : '—'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-slate-600 font-medium hidden lg:table-cell">
                      {route.vehicles > 0 ? route.vehicles.toLocaleString('fr-FR') : '—'}
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
                            style={{ width: `${route.charge}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-600 w-10 text-right">{route.charge}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ModernCard>

      <footer className="mt-8 text-center text-xs text-slate-400 font-medium">
        Centre de Contrôle Trafic © 2026 — Données temps réel
      </footer>
    </div>
  );
};

export default DashboardPage;
