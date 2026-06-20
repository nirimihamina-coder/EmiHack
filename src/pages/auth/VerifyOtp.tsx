import { useRef, useState, useEffect } from 'react';
import type { KeyboardEvent, ClipboardEvent } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const OTP_LENGTH = 6;

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [apiError, setApiError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const email = localStorage.getItem('reset_email') ?? '';

  // === PROTECTION ===
  useEffect(() => {
    if (!email) {
      navigate('/forgot-password', { replace: true });
      return;
    }
  }, [email, navigate]);

  // Compte à rebours renvoi
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const focusNext = (index: number) => {
    if (index < OTP_LENGTH - 1) inputsRef.current[index + 1]?.focus();
  };
  const focusPrev = (index: number) => {
    if (index > 0) inputsRef.current[index - 1]?.focus();
  };

  const handleChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (cleaned) focusNext(index);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index]) focusPrev(index);
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((c, i) => (next[i] = c));
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };
  
  const { verifyOtp, isLoading: isLoading, clearError } = useAuth();

  const handleSubmit = async () => {
    const code = digits.join('');
    if (code.length < OTP_LENGTH) return;

    setApiError('');
    clearError();

    const result = await verifyOtp({
      email: email,
      code: code
    });
    if (result?.success) {
      
      const { token } = result.data;

      // === NOUVELLE LOGIQUE ===
      localStorage.setItem('reset_token', token);
      localStorage.setItem('otp_verified', 'true');

      navigate('/auth/reset-password');
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    await fetch('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    setResendTimer(60);
    setDigits(Array(OTP_LENGTH).fill(''));
    inputsRef.current[0]?.focus();
  };

  const isFilled = digits.every((d) => d !== '');

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
      <div className="absolute top-[18%] left-[8%] w-12 h-12 rounded-full border border-black/9 pointer-events-none" />
      <div className="absolute bottom-[22%] right-[9%] w-8 h-8 rounded-full border border-black/8 pointer-events-none" />
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="0" y1="120" x2="160" y2="0" stroke="#888" strokeWidth="0.8" />
        <line x1="0" y1="200" x2="220" y2="0" stroke="#888" strokeWidth="0.5" />
      </svg>

      <div className="w-full max-w-md z-10">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-6">
            <ShieldCheck size={20} className="text-blue-600" />
          </div>

          <h1 className="text-xl font-medium text-gray-900 mb-1">Vérification du code</h1>
          <p className="text-sm text-gray-500 mb-7">
            Un code à 6 chiffres a été envoyé à <span className="font-medium text-gray-700">{email}</span>.
          </p>

          {apiError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{apiError}</p>
            </div>
          )}

          {/* Inputs OTP */}
          <div className="grid grid-cols-6 gap-2 mb-6">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className={`flex-1 h-12 text-center text-lg font-medium bg-gray-50 border border-gray-300 rounded-lg outline-none transition-all
                  focus:bg-white focus:ring-1 focus:ring-blue-100 focus:border-blue-400
                  ${digit ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200'}
                  ${apiError ? 'border-red-300' : ''}`}
              />
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isFilled || isLoading}
            className="w-full h-10 bg-blue-600 text-white border border-blue-600 rounded-lg text-sm font-medium
              flex items-center justify-center gap-2
              hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-4"
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Vérification...
              </>
            ) : (
              'Vérifier le code'
            )}
          </button>

          <p className="text-center text-sm text-gray-500">
            Vous n'avez pas reçu le code ?{' '}
            <button
              onClick={handleResend}
              disabled={resendTimer > 0}
              className="text-blue-500 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              {resendTimer > 0 ? `Renvoyer (${resendTimer}s)` : 'Renvoyer'}
            </button>
          </p>

          <p className="text-center text-sm text-gray-500 mt-6 pt-5 border-t border-gray-100">
            <span
              onClick={() => navigate('//forgot-password')}
              className="text-blue-500 cursor-pointer hover:underline"
            >
              ← Retour
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
