import { useState } from 'react';
import { Bell, Volume2, VolumeX, Mail, Shield } from 'lucide-react';

// ─── Composant principal ──────────────────────────────────────
export default function SettingsNotifications() {
  return (
    <div className="relative px-0 pt-4 py-10 bg-white">
      {/* ── Décor rings ── */}
      <div className="fixed -top-32 -right-32 w-[420px] h-[420px] rounded-full border border-black/[0.04] pointer-events-none" />
      <div className="fixed -top-10 right-10 w-[220px] h-[220px] rounded-full border border-black/[0.03] pointer-events-none" />
      <div className="fixed -bottom-20 -left-20 w-[320px] h-[320px] rounded-full border border-black/[0.04] pointer-events-none" />
      <svg
        className="fixed inset-0 w-full h-full opacity-[0.05] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="0" y1="120" x2="180" y2="0" stroke="#888" strokeWidth="0.8" />
        <line x1="0" y1="200" x2="260" y2="0" stroke="#888" strokeWidth="0.5" />
        <line x1="100%" y1="80%" x2="68%" y2="100%" stroke="#888" strokeWidth="0.8" />
      </svg>

      <div className="relative z-10 mx-auto">
        {/* ── Sections ── */}
        <div className="flex flex-col gap-6">
          <SectionNotifications />
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.45s ease-out both; }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION NOTIFICATIONS
// ══════════════════════════════════════════════════════════════
function SectionNotifications() {
  const [prefs, setPrefs] = useState({
    emailMarketing: false,
    emailSecurity: true,
    emailUpdates: true,
    pushAll: false,
    soundEnabled: true
  });

  const toggle = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  return (
    <SectionCard id="notifications" icon={<Bell size={16} />} title="Notifications" accent="amber">
      <div className="flex flex-col gap-1">
        <NotifRow
          icon={<Mail size={20} />}
          label="Emails marketing"
          desc="Offres, nouveautés et promotions"
          value={prefs.emailMarketing}
          onToggle={() => toggle('emailMarketing')}
        />
        <NotifRow
          icon={<Shield size={20} />}
          label="Alertes sécurité"
          desc="Connexions inhabituelles, changements de mot de passe"
          value={prefs.emailSecurity}
          onToggle={() => toggle('emailSecurity')}
          locked
        />
        <NotifRow
          icon={<Bell size={20} />}
          label="Mises à jour produit"
          desc="Nouvelles fonctionnalités et améliorations"
          value={prefs.emailUpdates}
          onToggle={() => toggle('emailUpdates')}
        />
        <NotifRow
          icon={prefs.soundEnabled ? <Volume2 size={20} /> : <VolumeX size={14} />}
          label="Sons de notification"
          desc="Activer les sons lors des alertes"
          value={prefs.soundEnabled}
          onToggle={() => toggle('soundEnabled')}
        />
      </div>
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════

function SectionCard({
  id,
  icon,
  title,
  accent,
  children
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  const accentMap: Record<string, string> = {
    blue: 'text-blue-500 bg-blue-50',
    amber: 'text-amber-500 bg-amber-50',
    teal: 'text-teal-500 bg-teal-50',
    red: 'text-red-500 bg-red-50'
  };

  return (
    <section id={`section-${id}`} className="bg-white overflow-hidden fade-up">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>{icon}</div>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function NotifRow({
  icon,
  label,
  desc,
  value,
  onToggle,
  locked = false
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  value: boolean;
  onToggle: () => void;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-200 mb-4 last:border-0">
      <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
          {label}
          {locked && (
            <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-normal">Requis</span>
          )}
        </p>
        <p className="text-xs text-gray-400 truncate">{desc}</p>
      </div>
      <button
        onClick={locked ? undefined : onToggle}
        disabled={locked}
        className={`relative w-10 h-5 rounded-full transition-all shrink-0 ${value ? 'bg-amber-400' : 'bg-gray-200'} ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-checked={value}
        role="switch"
      >
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${value ? 'left-[calc(100%-18px)]' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}
