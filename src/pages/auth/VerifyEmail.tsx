import { useNavigate } from 'react-router-dom';

const VerifyEmailPage = () => {
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 15% 85%, rgba(251,191,36,0.12) 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, rgba(167,139,250,0.1) 0%, transparent 50%), #fdfcf8'
      }}
    >
      <div
        className="absolute -top-32 -right-36 w-105 h-105 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(230,225,215,0.55) 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-[320px] h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(220,215,205,0.45) 0%, transparent 70%)' }}
      />

      <div className="absolute -top-20 -right-16 w-65 h-65 rounded-full border border-black/5.5 pointer-events-none" />
      <div className="absolute -top-5 right-10 w-40 h-40 rounded-full border border-black/4 pointer-events-none" />
      <div className="absolute -bottom-14 -left-12 w-50 h-50 rounded-full border border-black/5.5 pointer-events-none" />

      <div className="absolute top-[18%] left-[8%] w-12 h-12 rounded-full border border-black/9 pointer-events-none" />
      <div className="absolute top-[30%] left-[12%] w-5 h-5 rounded-full border border-black/[0.07] pointer-events-none" />
      <div className="absolute bottom-[22%] right-[9%] w-8 h-8 rounded-full border border-black/8 pointer-events-none" />

      <svg
        className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="0" y1="120" x2="160" y2="0" stroke="#888" strokeWidth="0.8" />
        <line x1="0" y1="200" x2="220" y2="0" stroke="#888" strokeWidth="0.5" />
        <line x1="100%" y1="80%" x2="70%" y2="100%" stroke="#888" strokeWidth="0.8" />
      </svg>
      <div className="bg-white border border-gray-100 rounded-xl p-10 max-w-md w-full text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>

        <h1 className="text-xl font-medium text-gray-900 mb-3">Vérifiez votre email</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          Un lien d'activation a été envoyé à votre adresse email. Veuillez vérifier votre boîte de réception pour
          activer votre compte.
        </p>

        <div className="bg-gray-50 rounded-lg p-3 mb-6 flex gap-2 items-start text-left">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="mt-0.5 shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p className="text-xs text-gray-400 leading-relaxed">
            Pensez à vérifier vos spams si vous ne trouvez pas l'email.
          </p>
        </div>

        <button
          onClick={() => {
            /* appel API pour renvoyer l'email */
          }}
          className="w-full py-2.5 px-4 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition mb-3"
        >
          Renvoyer l'email
        </button>

        <button onClick={() => navigate('/login')} className="text-xs text-gray-400 hover:text-gray-600 transition">
          ← Retour à la connexion
        </button>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
