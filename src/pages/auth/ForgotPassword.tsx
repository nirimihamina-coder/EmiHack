import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Send, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const schema = z.object({
  email: z.string().email('Veuillez entrer un email valide.')
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormData>({
    resolver: zodResolver(schema)
  });
  const { forgotPassword, clearError } = useAuth();

  const onSubmit = async (data: FormData) => {
    setApiError('');
    clearError();
    // Appel API via le hook
    const result = await forgotPassword({
      email: data.email
    });

    if (result.success) {
      localStorage.setItem('reset_email', data.email);
      localStorage.setItem('otp_verified', 'false');

      navigate('/auth/verify-otp');
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 15% 85%, rgba(251,191,36,0.12) 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, rgba(167,139,250,0.1) 0%, transparent 50%), #fdfcf8'
      }}
    >
      {/* Décors identiques à LoginPage */}
      <div
        className="absolute -top-32 -right-36 w-105 h-105 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(230,225,215,0.55) 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-[320px] h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(220,215,205,0.45) 0%, transparent 70%)' }}
      />
      <div className="absolute -top-20 -right-16 w-65 h-65 rounded-full border border-black/5.5 pointer-events-none" />
      <div className="absolute top-[18%] left-[8%] w-12 h-12 rounded-full border border-black/9 pointer-events-none" />
      <div className="absolute bottom-[22%] right-[9%] w-8 h-8 rounded-full border border-black/8 pointer-events-none" />
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="0" y1="120" x2="160" y2="0" stroke="#888" strokeWidth="0.8" />
        <line x1="0" y1="200" x2="220" y2="0" stroke="#888" strokeWidth="0.5" />
        <line x1="100%" y1="80%" x2="70%" y2="100%" stroke="#888" strokeWidth="0.8" />
      </svg>

      <div className="w-full max-w-md z-10">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-6">
            <Mail size={20} className="text-blue-600" />
          </div>

          <h1 className="text-xl font-medium text-gray-900 mb-1">Mot de passe oublié ?</h1>
          <p className="text-sm text-gray-500 mb-7">
            Entrez votre email et nous vous enverrons un code de réinitialisation.
          </p>

          {apiError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-medium text-gray-600">
                Adresse email
              </label>
              <div className="relative">
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  placeholder="exemple@mail.com"
                  autoComplete="email"
                  className={`w-full h-10 pl-3 pr-10 text-sm bg-gray-50 border rounded-lg outline-none transition-all
                    focus:bg-white focus:ring-1 focus:ring-blue-100 focus:border-blue-400
                    ${errors.email ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
                <Mail
                  size={15}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
              {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 bg-blue-600 text-white border border-blue-600 rounded-lg text-sm font-medium
                flex items-center justify-center gap-2
                hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Envoi en cours...
                </>
              ) : (
                <>
                  <Send size={15} /> Envoyer le code
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6 pt-5 border-t border-gray-100">
            <span onClick={() => navigate('/login')} className="text-blue-500 cursor-pointer hover:underline">
              ← Retour à la connexion
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
