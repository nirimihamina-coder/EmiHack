import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail, LogIn, Loader2, Camera, ArrowLeft, ScanFace } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFaceLogin } from '../../hooks/useFaceLogin';
import { useNavigate } from 'react-router-dom';
import * as faceapi from '@vladmandic/face-api';

// ─── Schéma Zod ───────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Veuillez entrer un email valide.'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.'),
  remember: z.boolean().optional()
});

type LoginFormData = z.infer<typeof loginSchema>;

// ─── Composant ────────────────────────────────────────────────
export default function LoginPage() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [faceMode, setFaceMode] = useState(false); // false = formulaire, true = scan facial
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detectedFace, setDetectedFace] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const navigate = useNavigate();

  const { login, isLoading: isAuthLoading, error: authError, clearError } = useAuth();
  const { loginWithFace, faceError, isScanning } = useFaceLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: false }
  });

  // Chargement des modèles face-api
  useEffect(() => {
    const loadModels = async () => {
      try {
        // Utiliser jsdelivr CDN (le plus fiable)
        const MODEL_URL = '/models';

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        setModelsLoaded(true);
      } catch (err) {
        console.error('❌ Erreur chargement modèles:', err);
      }
    };

    loadModels();
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Erreur webcam:', err);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Démarrer/arrêter la webcam selon faceMode
  useEffect(() => {
    if (faceMode && modelsLoaded) {
      startWebcam();
    } else {
      stopWebcam();
    }
  }, [faceMode, modelsLoaded]);

  // Détection en temps réel pour feedback visuel
  useEffect(() => {
    if (!faceMode || !modelsLoaded) return;

    let lastTime = 0;
    let animFrame: number;

    const detectFrame = async (timestamp: number) => {
      if (!videoRef.current || !canvasRef.current) {
        animFrame = requestAnimationFrame(detectFrame);
        return;
      }

      if (timestamp - lastTime < 200) {
        animFrame = requestAnimationFrame(detectFrame);
        return;
      }
      lastTime = timestamp;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }))
          .withFaceLandmarks(); // landmarks seulement dans la boucle

        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
          const resized = faceapi.resizeResults(detection, displaySize);
          faceapi.draw.drawDetections(canvas, [resized]);
          faceapi.draw.drawFaceLandmarks(canvas, [resized]);
          setDetectedFace('✓ Visage détecté');
        } else {
          setDetectedFace('❌ Aucun visage détecté');
        }
      }

      animFrame = requestAnimationFrame(detectFrame);
    };

    animFrame = requestAnimationFrame(detectFrame);
    return () => cancelAnimationFrame(animFrame);
  }, [faceMode, modelsLoaded]);

  const onSubmit = async (data: LoginFormData) => {
    clearError();
    const result = await login({
      email: data.email,
      password: data.password
    });
    console.log('🚀 ~ onSubmit ~ result:', result);

    if (result.success) {
      if (result.data?.status == 'inactif') {
        navigate('/verify-email');
      } else {
        navigate('/dashboard');
      }
    }
  };

  const url = import.meta.env.VITE_GOOGLE_AUTH_URL;

  const handleGoogleLogin = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      window.location.assign(url);
    } catch (error) {
      console.error('Erreur de redirection:', error);
      setIsGoogleLoading(false);
    }
  };

  const handleFaceLogin = async () => {
    if (!videoRef.current || !modelsLoaded) return;

    console.log('🔍 Début détection login...');

    let detection;
    try {
      detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      console.log('✅ Detection:', detection);
    } catch (err) {
      console.error('❌ Erreur faceapi:', err);
      setDetectedFace('❌ Erreur lors de la détection.');
      return;
    }

    if (!detection) {
      setDetectedFace('❌ Aucun visage détecté. Réessayez.');
      return;
    }

    console.log('📐 Descriptor ok, appel API...');
    const success = await loginWithFace(detection.descriptor);
    console.log('📡 loginWithFace result:', success);

    if (success) {
      stopWebcam();
      navigate('/dashboard');
    } else {
      setDetectedFace('❌ Visage non reconnu. Réessayez.');
    }
  };

  const enableFaceMode = () => {
    setFaceMode(true);
    setDetectedFace(null);
  };

  const disableFaceMode = () => {
    setFaceMode(false);
    setDetectedFace(null);
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 15% 85%, rgba(251,191,36,0.15) 0%, transparent 55%), ' +
          'radial-gradient(ellipse at 85% 15%, rgba(167,139,250,0.1) 0%, transparent 50%), ' +
          '#0f172a'
      }}
    >
      {/* Gradient blobs */}
      <div
        className="absolute -top-32 -right-36 w-105 h-105 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(230,225,215,0.55) 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-[320px] h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(220,215,205,0.45) 0%, transparent 70%)' }}
      />

      {/* Decorative rings */}
      <div className="absolute -top-20 -right-16 w-65 h-65 rounded-full border border-black/5.5 pointer-events-none" />
      <div className="absolute -top-5 right-10 w-40 h-40 rounded-full border border-black/4 pointer-events-none" />
      <div className="absolute -bottom-14 -left-12 w-50 h-50 rounded-full border border-black/5.5 pointer-events-none" />
      <div className="absolute top-[18%] left-[8%] w-12 h-12 rounded-full border border-black/9 pointer-events-none" />
      <div className="absolute top-[30%] left-[12%] w-5 h-5 rounded-full border border-black/[0.07] pointer-events-none" />
      <div className="absolute bottom-[22%] right-[9%] w-8 h-8 rounded-full border border-black/8 pointer-events-none" />

      {/* Diagonal lines */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="0" y1="120" x2="160" y2="0" stroke="#888" strokeWidth="0.8" />
        <line x1="0" y1="200" x2="220" y2="0" stroke="#888" strokeWidth="0.5" />
        <line x1="100%" y1="80%" x2="70%" y2="100%" stroke="#888" strokeWidth="0.8" />
      </svg>

      <div className="flex flex-col items-center w-full max-w-md gap-4">
        {/* ── Card ── */}
        <div className="w-full bg-white z-10 border border-gray-200 rounded-2xl p-8 shadow-sm">
          {/* Logo */}
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-6">
            <Lock size={20} className="text-blue-600" />
          </div>

          <h1 className="text-5xl font-extrabold text-blue-800 mb-1 font-mono">Bon retour</h1>
          <p className="text-sm text-gray-500 mb-7">
            {faceMode ? 'Scannez votre visage' : 'Connectez-vous à votre compte'}
          </p>

          {authError && !faceMode && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{authError}</p>
            </div>
          )}

          {!faceMode ? (
            // ─── FORMULAIRE CLASSIQUE ──────────────────────────────
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              {/* Email */}
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

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-medium text-gray-600">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`w-full h-10 pl-3 pr-10 text-sm bg-gray-50 border rounded-lg outline-none transition-all
                      focus:bg-white focus:ring-1 focus:ring-blue-100 focus:border-blue-400
                      ${errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <span className="text-xs text-red-500">{errors.password.message}</span>}
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
                  <input
                    {...register('remember')}
                    type="checkbox"
                    className="w-3.5 h-3.5 cursor-pointer accent-blue-500"
                  />
                  Se souvenir de moi
                </label>
                <p
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm cursor-pointer text-blue-500 hover:underline"
                >
                  Mot de passe oublié ?
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || isAuthLoading}
                className="w-full h-10 bg-blue-600 text-white border border-blue-600 rounded-lg text-sm font-medium
                  flex items-center justify-center gap-2
                  hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting || isAuthLoading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Connexion...
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    Se connecter
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">ou</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Google + Face Recognition - Ligne à 2 boutons */}
              <div className="flex flex-col gap-3">
                {/* Google */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isGoogleLoading}
                  className="flex-1 py-2 h-10 border cursor-pointer border-gray-200 rounded-lg text-sm text-gray-600
                    flex items-center justify-center gap-2
                    hover:bg-gray-50 hover:border-gray-300
                    active:scale-[0.98]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200"
                  aria-label="Continuer avec Google"
                >
                  {isGoogleLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <GoogleIcon />
                      <span>Continuer avec Google</span>
                    </>
                  )}
                </button>

                {/* Reconnaissance Faciale */}
                <button
                  type="button"
                  onClick={enableFaceMode}
                  disabled={!modelsLoaded}
                  className="flex-1 py-2 h-10 border cursor-pointer border-gray-200 rounded-lg text-sm text-gray-600
                    flex items-center justify-center gap-2
                    hover:bg-gray-50 hover:border-gray-300
                    active:scale-[0.98]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200"
                  aria-label="Connexion par visage"
                >
                  <ScanFace size={16} />
                  <span>{modelsLoaded ? 'Continuer avec la reconnaissance faciale' : 'Chargement...'}</span>
                </button>
              </div>
            </form>
          ) : (
            // ─── SCAN FACIAL (remplace tout le formulaire) ──────────
            <div className="flex flex-col gap-4">
              {/* Bouton retour */}
              <button
                type="button"
                onClick={disableFaceMode}
                className="text-sm text-blue-500 hover:underline flex items-center gap-1 mb-2"
              >
                <ArrowLeft size={14} />
                Retour au formulaire
              </button>

              {/* Caméra */}
              <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              </div>

              {/* Feedback détection */}
              {detectedFace && (
                <p
                  className={`text-sm text-center ${detectedFace.includes('✓') ? 'text-green-600' : 'text-yellow-600'}`}
                >
                  {detectedFace}
                </p>
              )}

              {/* Erreurs */}
              {(faceError || !modelsLoaded) && (
                <p className="text-red-500 text-sm text-center">
                  {!modelsLoaded ? 'Chargement des modèles...' : faceError}
                </p>
              )}

              {/* Bouton scan */}
              <button
                onClick={handleFaceLogin}
                disabled={isScanning || !modelsLoaded}
                className="w-full h-10 bg-blue-600 text-white rounded-lg font-medium
                  flex items-center justify-center gap-2
                  hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {isScanning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Reconnaissance...
                  </>
                ) : (
                  <>
                    <Camera size={16} />
                    Scanner mon visage
                  </>
                )}
              </button>
            </div>
          )}

          {/* Sign up (caché en mode scan facial) */}
          {!faceMode && (
            <p className="text-center text-sm text-gray-500 mt-6 pt-5 border-t border-gray-100">
              Pas encore de compte ?{' '}
              <a href="/register" className="text-blue-500 hover:underline">
                Créer un compte
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Icône Google SVG ─────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
