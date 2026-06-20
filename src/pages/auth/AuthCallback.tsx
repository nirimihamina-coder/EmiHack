import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

const AuthCallback = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const hasRun = useRef(false);

  useEffect(() => {
    console.log('teste');

    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      navigate('/register');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      // ✅ IMPORTANT
      setAuth(payload, token);

      setTimeout(() => {
        navigate('/dashboard');
      }, 2200);
    } catch (e) {
      console.error('Erreur décodage token', e);
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    }
  }, []);

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 20% 80%, rgba(96,165,250,0.1) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(167,139,250,0.09) 0%, transparent 50%), #fdfcf8'
      }}
    >
      <div className="absolute -top-28 -right-28 w-95 h-95 rounded-full border border-black/5 pointer-events-none animate-[spin_30s_linear_infinite]" />
      <div className="absolute -top-10 -right-10 w-55 h-55 rounded-full border border-black/4 pointer-events-none animate-[spin_20s_linear_infinite_reverse]" />
      <div className="absolute -bottom-20 -left-20 w-75 h-75 rounded-full border border-black/5 pointer-events-none animate-[spin_25s_linear_infinite]" />
      <div className="absolute bottom-10 left-10 w-35 h-35 rounded-full border border-black/4 pointer-events-none animate-[spin_18s_linear_infinite_reverse]" />

      <div className="absolute top-[15%] left-[12%] w-2 h-2 rounded-full bg-blue-300/40 pointer-events-none animate-[bounce_3s_ease-in-out_infinite]" />
      <div className="absolute top-[25%] left-[18%] w-1.5 h-1.5 rounded-full bg-purple-300/40 pointer-events-none animate-[bounce_4s_ease-in-out_0.5s_infinite]" />
      <div className="absolute top-[70%] right-[14%] w-2 h-2 rounded-full bg-blue-300/40 pointer-events-none animate-[bounce_3.5s_ease-in-out_1s_infinite]" />
      <div className="absolute top-[40%] right-[8%] w-1.5 h-1.5 rounded-full bg-indigo-300/30 pointer-events-none animate-[bounce_5s_ease-in-out_0.2s_infinite]" />
      <div className="absolute bottom-[30%] left-[8%] w-2.5 h-2.5 rounded-full bg-sky-200/40 pointer-events-none animate-[bounce_4s_ease-in-out_0.8s_infinite]" />

      <svg
        className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="0" y1="100" x2="180" y2="0" stroke="#888" strokeWidth="0.8" />
        <line x1="0" y1="180" x2="260" y2="0" stroke="#888" strokeWidth="0.5" />
        <line x1="100%" y1="75%" x2="65%" y2="100%" stroke="#888" strokeWidth="0.8" />
        <line x1="100%" y1="60%" x2="75%" y2="100%" stroke="#888" strokeWidth="0.5" />
      </svg>

      <div
        className="absolute -top-24 -right-24 w-85 h-85 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(219,234,254,0.5) 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-16 -left-16 w-65 h-65 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(221,214,254,0.4) 0%, transparent 70%)' }}
      />

      <div
        className="relative z-10 flex flex-col items-center gap-6 bg-white border border-gray-200 rounded-2xl shadow-sm px-10 py-10"
        style={{ minWidth: 320 }}
      >
        <div className="relative flex items-center justify-center">
          <div
            className="absolute w-20 h-20 rounded-full bg-blue-100/70 animate-ping"
            style={{ animationDuration: '1.4s' }}
          />
          <div
            className="absolute w-14 h-14 rounded-full bg-blue-200/50 animate-ping"
            style={{ animationDuration: '1.8s', animationDelay: '0.3s' }}
          />

          <div className="relative w-16 h-16 rounded-full bg-linear-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
            <svg
              className="absolute inset-0 w-full h-full animate-spin"
              style={{ animationDuration: '1.1s' }}
              viewBox="0 0 64 64"
            >
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="3"
                strokeDasharray="88 176"
                strokeLinecap="round"
              />
            </svg>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-white">
              <path
                d="M12 1C9.24 1 7 3.24 7 6v2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V10a2 2 0 00-2-2h-2V6c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v2H9V6c0-1.66 1.34-3 3-3zm0 9a2 2 0 110 4 2 2 0 010-4z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-[17px] font-semibold text-gray-900 tracking-tight">Connexion en cours…</h1>
          <p className="text-sm text-gray-400">Vérification de vos identifiants</p>
        </div>

        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-blue-400 via-green-200 to-white rounded-full"
            style={{
              backgroundSize: '200% 100%',
              animation: 'progressSlide 1.6s ease-in-out infinite, progressGrow 2s ease-out forwards'
            }}
          />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <Step label="Décodage du token" delay="0s" />
          <Step label="Récupération du profil" delay="0.5s" />
          <Step label="Redirection en cours . . ." delay="1s" />
        </div>
      </div>

      <style>{`
        @keyframes progressGrow {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes progressSlide {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AuthCallback;

function Step({ label, delay }: { label: string; delay: string }) {
  return (
    <div
      className="flex items-center gap-2.5 opacity-0"
      style={{ animation: `fadeSlideIn 0.4s ease-out ${delay} forwards` }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full bg-neutral-700 shrink-0"
        style={{ animation: `dotPulse 1.2s ease-in-out ${delay} infinite` }}
      />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}
