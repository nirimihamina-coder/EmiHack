import { useState } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  Shield,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Mail
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';

export default function SettingsPassword() {
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
        <div className="flex flex-col gap-6">
          <SectionPassword />
          <SectionDanger />
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
// SECTION MOT DE PASSE
// ══════════════════════════════════════════════════════════════
function SectionPassword() {
  const [show, setShow] = useState({ current: false, newPwd: false, confirm: false });
  const [form, setForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [success, setSuccess] = useState(false);

  const handleChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleShow = (k: keyof typeof show) => setShow((s) => ({ ...s, [k]: !s[k] }));
  const { updatePassword, isLoading: loading, error: errors, clearError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (form.newPwd !== form.confirm) return;
    // Appel API via le hook
    const result = await updatePassword({
      oldPassword: form.current,
      newPassword: form.newPwd
    });
    console.log('🚀 ~ handleSubmit ~ result:', result);

    if (result?.success) {
      setSuccess(true);
      setForm({ current: '', newPwd: '', confirm: '' });
    }
  };

  const isValid = form.current && form.newPwd && form.newPwd === form.confirm;

  return (
    <SectionCard id="password" icon={<Lock size={16} />} title="Mot de passe" accent="indigo">
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mb-4 text-sm text-green-700">
          <CheckCircle2 size={15} /> Mot de passe mis à jour avec succès !
        </div>
      )}
      {errors && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm text-red-700">
          <CheckCircle2 size={15} /> {errors}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <PasswordField
          label="Mot de passe actuel"
          value={form.current}
          show={show.current}
          onToggle={() => toggleShow('current')}
          onChange={handleChange('current')}
        />
        <PasswordField
          label="Nouveau mot de passe"
          value={form.newPwd}
          show={show.newPwd}
          onToggle={() => toggleShow('newPwd')}
          onChange={handleChange('newPwd')}
        />

        {form.newPwd && <PasswordStrength password={form.newPwd} />}

        <PasswordField
          label="Confirmer le mot de passe"
          value={form.confirm}
          show={show.confirm}
          onToggle={() => toggleShow('confirm')}
          onChange={handleChange('confirm')}
          error={form.confirm && form.newPwd !== form.confirm ? 'Les mots de passe ne correspondent pas.' : ''}
        />

        <button
          type="submit"
          disabled={loading || !isValid}
          className="h-9 bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2
            hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all mt-1"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Mise à jour…
            </>
          ) : (
            <>
              <Shield size={14} /> Mettre à jour
            </>
          )}
        </button>
      </form>

      {/* Badges sécurité */}
      <div className="mt-5 flex flex-col gap-2">
        <SecurityBadge icon={<Mail size={13} />} label="Authentification email activée" ok />
        <SecurityBadge icon={<ExternalLink size={13} />} label="Connexion Google liée" ok />
        <SecurityBadge icon={<Shield size={13} />} label="Double authentification (2FA)" ok={false} />
      </div>
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION DANGER
// ══════════════════════════════════════════════════════════════
function SectionDanger() {
  const [confirm, setConfirm] = useState('');
  const KEYWORD = 'SUPPRIMER';

  const { deleteAccount, clearError, isLoading: loading } = useUser();

  const handleDelete = async () => {
    clearError();
    if (confirm !== KEYWORD) return;

    const storedAuth = localStorage.getItem('auth-storage');

    if (!storedAuth) {
      console.error('Auth introuvable');
      return;
    }

    let userId: string | null = null;

    try {
      const parsed = JSON.parse(storedAuth);
      userId = parsed?.state?.user?.id;
    } catch (error) {
      console.error('Erreur parsing auth-storage', error);
      return;
    }

    if (!userId) {
      console.error('User ID introuvable');
      return;
    }

    const result = await deleteAccount(userId);

    if (result.success) {
      // optionnel: redirection
      // navigate('/login');
    }
  };

  return (
    <SectionCard id="danger" icon={<AlertTriangle size={16} />} title="Zone de danger" accent="red">
      <div className="p-4 bg-red-50/60 border border-red-100 rounded-xl">
        <p className="text-sm font-medium text-red-700 mb-1">Supprimer le compte</p>
        <p className="text-xs text-red-500 leading-relaxed mb-4">
          Cette action est <strong>irréversible</strong>. Toutes vos données, préférences et historique seront
          définitivement supprimés. Tapez <span className="font-mono font-semibold">{KEYWORD}</span> pour confirmer.
        </p>
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={`Tapez ${KEYWORD}`}
          className="w-full h-9 px-3 text-sm bg-white border rounded-lg outline-none transition-all mb-3
            border-red-200 focus:border-red-400 focus:ring-1 focus:ring-red-100 placeholder:text-red-300"
        />
        <button
          onClick={handleDelete}
          disabled={confirm !== KEYWORD || loading}
          className="w-full h-9 bg-red-600 text-white rounded-lg text-sm font-medium
            flex items-center justify-center gap-2
            hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Suppression…
            </>
          ) : (
            <>
              <Trash2 size={14} /> Supprimer définitivement mon compte
            </>
          )}
        </button>
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
    indigo: 'text-indigo-500 bg-indigo-50',
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

function PasswordField({
  label,
  value,
  show,
  onToggle,
  onChange,
  error = ''
}: {
  label: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder="••••••••"
          className={`w-full h-10 pl-3 pr-10 text-sm bg-gray-50 border rounded-lg outline-none transition-all
            focus:bg-white focus:ring-1 focus:ring-indigo-100 focus:border-indigo-400
            ${error ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;

  const labels = ['', 'Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'];
  const barColors = ['', 'bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-green-400', 'bg-emerald-500'];
  const txtColors = ['', 'text-red-500', 'text-orange-500', 'text-amber-600', 'text-green-600', 'text-emerald-600'];

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${i <= score ? barColors[score] : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <span className={`text-xs font-medium ${txtColors[score]}`}>{labels[score]}</span>
    </div>
  );
}

function SecurityBadge({ icon, label, ok }: { icon: React.ReactNode; label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 bg-gray-50">
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span className="text-gray-400">{icon}</span>
        {label}
      </div>
      <span
        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
      >
        {ok ? 'Activé' : 'Inactif'}
      </span>
    </div>
  );
}
