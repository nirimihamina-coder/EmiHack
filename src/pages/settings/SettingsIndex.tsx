import { useState } from 'react';
import { User, Newspaper, ChevronRight, Calendar, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { User as UserType } from '../../interface/User';
import { useNavigate } from 'react-router-dom';

// ─── Composant principal ──────────────────────────────────────
export default function SettingsIndex() {
  const { user } = useAuth();

  if (!user) {
    return <div className="flex items-center justify-center text-gray-500">Utilisateur non connecté</div>;
  }

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
          <SectionProfil user={user} />
          <SectionInfoDuJour />
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
// SECTION PROFIL
// ══════════════════════════════════════════════════════════════
function SectionProfil({ user }: { user: UserType }) {
  const navigate = useNavigate();

  return (
    <SectionCard id="profil" icon={<User size={16} />} title="Profil" accent="blue">
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 border-2 border-white shadow shrink-0">
          {user?.avatar ? (
            <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-semibold">
              {user?.firstName?.[0] ?? '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
            <CheckCircle2 size={9} /> Compte actif
          </span>
        </div>
        <a
          onClick={() => navigate('/dashboard/settings/profil')}
          className="shrink-0 flex items-center cursor-pointer gap-1.5 px-3 h-8 rounded-lg border border-gray-200 text-xs text-gray-600 font-medium hover:bg-white hover:border-gray-300 transition-all"
        >
          Modifier <ChevronRight size={12} />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <InfoTile label="Prénom" value={user?.firstName ?? '—'} />
        <InfoTile label="Nom" value={user?.lastName ?? '—'} />
        <InfoTile label="Email" value={user?.email ?? '—'} className="col-span-2" />
        <InfoTile label="Rôle" value={user?.role ?? '—'} />
        {/* <InfoTile
          label="Membre depuis"
          value={user?.iat ? new Date(user.iat * 1000).toLocaleDateString('fr-FR') : '—'}
        /> */}
      </div>
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION INFO DU JOUR
// ══════════════════════════════════════════════════════════════
function SectionInfoDuJour() {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const facts = [
    {
      label: 'Fait du jour',
      value: "La tour Eiffel peut mesurer jusqu'à 15 cm de plus en été à cause de la dilatation thermique."
    },
    { label: 'Astuce tech', value: 'Utilisez `Ctrl + Shift + T` pour rouvrir un onglet fermé dans votre navigateur.' },
    { label: 'Citation', value: '"Le succès, c\'est tomber sept fois et se relever huit." — Proverbe japonais' }
  ];

  const [index, setIndex] = useState(0);
  const fact = facts[index];

  return (
    <SectionCard id="infos" icon={<Newspaper size={16} />} title="Info du jour" accent="teal">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={13} className="text-gray-400" />
        <span className="text-xs text-gray-400 capitalize">{today}</span>
      </div>

      <div
        className="relative p-4 rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50/60 overflow-hidden"
        key={index}
        style={{ animation: 'fadeUp 0.35s ease-out both' }}
      >
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-teal-100/40 -translate-y-8 translate-x-8 pointer-events-none" />
        <span className="text-[10px] font-semibold text-teal-600 uppercase tracking-widest">{fact.label}</span>
        <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">{fact.value}</p>
      </div>

      <div className="flex gap-2 mt-3">
        {facts.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`flex-1 h-7 rounded-lg text-xs font-medium transition-all border
              ${i === index ? 'bg-teal-500 text-white border-teal-500' : 'border-gray-200 text-gray-400 hover:border-teal-300 hover:text-teal-500'}`}
          >
            {['Fait', 'Astuce', 'Citation'][i]}
          </button>
        ))}
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

function InfoTile({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 ${className}`}>
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 truncate">{value}</p>
    </div>
  );
}
