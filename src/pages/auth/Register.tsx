import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, User, UserCircle2, Camera, Loader2, UserPlus, Image, EyeOff, Eye } from 'lucide-react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';

import avatarDefault1 from './../../assets/avatar/avatar1.webp';
import avatarDefault2 from './../../assets/avatar/avatar2.webp';
import avatarDefault3 from './../../assets/avatar/avatar3.webp';
import { useAuth } from '../../hooks/useAuth';

// ─── Schéma Zod ───────────────────────────────────────────────
const registerSchema = z
  .object({
    firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères.'),
    lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
    email: z.string().email('Veuillez entrer un email valide.'),

    // Nouveaux champs
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
      .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
      .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule.')
      .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.'),

    confirmPassword: z.string(),

    avatar: z
      .instanceof(FileList)
      .optional()
      .refine(
        (files) => !files || files.length === 0 || files[0].size <= 2 * 1024 * 1024,
        "L'avatar ne doit pas dépasser 2 Mo."
      )
      .refine(
        (files) => !files || files.length === 0 || ['image/jpeg', 'image/png', 'image/webp'].includes(files[0].type),
        'Format accepté : JPG, PNG ou WEBP.'
      ),

    terms: z
      .boolean()
      .refine((value) => value === true, { message: "Vous devez accepter les conditions d'utilisation." })
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword']
  });

type RegisterFormData = z.infer<typeof registerSchema>;

// ─── Composant ────────────────────────────────────────────────
export default function RegisterPage() {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { terms: undefined }
  });

  const { ref: avatarRef, ...avatarRest } = register('avatar');

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    } else {
      setAvatarPreview(null);
    }
    avatarRest.onChange(e);
  };

  const { registerUser, isLoading: isLoading, error: serverError2, clearError } = useAuth();

  const onSubmit = async (data: RegisterFormData) => {
    console.log('🚀 ~ onSubmit ~ data:', data);
    clearError();

    const formData = new FormData();
    formData.append('firstName', data.firstName);
    formData.append('lastName', data.lastName);
    formData.append('email', data.email);
    formData.append('password', data.password);

    if (data.avatar && data.avatar.length > 0) {
      formData.append('file', data.avatar[0]);
    }

    const result = await registerUser(formData);
    console.log('🚀33 ~ onSubmit ~ result:', result);

    if (result.success) {
      navigate('/verify-email');
    }
  };

  const handleDefaultAvatarClick = async (avatarSrc: string) => {
    try {
      const response = await fetch(avatarSrc);
      const blob = await response.blob();
      const file = new File([blob], 'avatar-default.webp', { type: 'image/webp' });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileList = dataTransfer.files;

      setValue('avatar', fileList);
      setAvatarPreview(avatarSrc);
    } catch (error) {
      console.error("Erreur lors du chargement de l'avatar:", error);
    }
  };

  const isDisabled = isSubmitting || isLoading;
  const url = import.meta.env.VITE_GOOGLE_AUTH_URL;

  const handleGoogleLogin = async () => {
    if (isGoogleLoading) return;

    setIsGoogleLoading(true);

    try {
      window.location.assign(url);
    } catch (error) {
      console.error('Erreur de redirection:', error);
      setServerError('Impossible de se connecter avec Google. Veuillez réessayer.');
      setIsGoogleLoading(false);
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
      {/* Gradient blobs */}
      <div
        className="absolute -top-32 -right-36 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(230,225,215,0.55) 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-[320px] h-[320px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(220,215,205,0.45) 0%, transparent 70%)' }}
      />

      {/* Decorative rings */}
      <div className="absolute -top-20 -right-16 w-[260px] h-[260px] rounded-full border border-black/[0.055] pointer-events-none" />
      <div className="absolute -top-5 right-10 w-[160px] h-[160px] rounded-full border border-black/[0.04] pointer-events-none" />
      <div className="absolute -bottom-14 -left-12 w-[200px] h-[200px] rounded-full border border-black/[0.055] pointer-events-none" />
      <div className="absolute top-[18%] left-[8%] w-12 h-12 rounded-full border border-black/[0.09] pointer-events-none" />
      <div className="absolute top-[30%] left-[12%] w-5 h-5 rounded-full border border-black/[0.07] pointer-events-none" />
      <div className="absolute bottom-[22%] right-[9%] w-8 h-8 rounded-full border border-black/[0.08] pointer-events-none" />

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
            <UserPlus size={20} className="text-blue-600" />
          </div>

          <h1 className="text-xl font-medium text-gray-900 mb-1">Créer un compte ✨</h1>
          <p className="text-sm text-gray-500 mb-7">Rejoignez-nous en quelques secondes</p>

          {/* Erreur serveur */}
          {(serverError || serverError2) && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{serverError || serverError2}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {/* ── Avatar ── */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">
                Photo de profil <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <div className="flex items-center gap-4">
                <div
                  className="relative w-16 h-16 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle2 size={28} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                    <Camera size={16} className="text-white" />
                  </div>
                </div>
                <div className="flex flex-col flex-1 gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm text-blue-500 hover:underline text-left"
                  >
                    Choisir une image
                  </button>
                  <span className="text-xs text-gray-400">JPG, PNG ou WEBP · max 2 Mo</span>
                </div>

                <Popover className="relative inline-block">
                  <PopoverButton className="bg-white border group border-gray-200 rounded-md cursor-pointer transition-all w-8 h-8 flex items-center justify-center hover:bg-gray-50 focus:outline-none">
                    <Image className="text-gray-400 w-7 h-7 group-hover:scale-110 group-hover:rotate-12 group-active:rotate-0 transition-all" />
                  </PopoverButton>

                  <PopoverPanel className="absolute z-50">
                    {({ close }) => (
                      <>
                        {/* Desktop: en haut centré */}
                        <div className="hidden sm:block absolute bottom-10 mb-4 left-4 -translate-x-1/2">
                          <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px]">
                            <button
                              onClick={() => close()}
                              className="absolute top-2 right-2 cursor-pointer text-gray-400 hover:text-gray-600 z-10"
                              aria-label="Fermer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>

                            <div className="p-4 pt-3">
                              <div className="text-sm text-gray-700">
                                <small className="mb-4 block">Choisir un avatar par défaut</small>
                                <div className="grid grid-cols-3 gap-4 items-center justify-center">
                                  <img
                                    src={avatarDefault1}
                                    alt="Avatar 1"
                                    className="w-12 h-12 border border-gray-400 rounded-full object-cover cursor-pointer hover:scale-110 hover:-translate-y-2 transition-transform"
                                    onClick={() => {
                                      handleDefaultAvatarClick(avatarDefault1);
                                      close();
                                    }}
                                  />
                                  <img
                                    src={avatarDefault2}
                                    alt="Avatar 2"
                                    className="w-12 h-12 border border-gray-400 rounded-full object-cover cursor-pointer hover:scale-110 hover:-translate-y-2 transition-transform"
                                    onClick={() => {
                                      handleDefaultAvatarClick(avatarDefault2);
                                      close();
                                    }}
                                  />
                                  <img
                                    src={avatarDefault3}
                                    alt="Avatar 3"
                                    className="w-12 h-12 border border-gray-400 rounded-full object-cover cursor-pointer hover:scale-110 hover:-translate-y-2 transition-transform"
                                    onClick={() => {
                                      handleDefaultAvatarClick(avatarDefault3);
                                      close();
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-gray-200 rotate-45"></div>
                          </div>
                        </div>

                        {/* Mobile: à gauche */}
                        <div className="sm:hidden absolute right-full -top-4 -translate-y-1/2 mr-5">
                          <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px]">
                            <button
                              onClick={() => close()}
                              className="absolute top-2 right-2 cursor-pointer text-gray-400 hover:text-gray-600 z-10"
                              aria-label="Fermer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>

                            <div className="p-4 pt-3">
                              <div className="text-sm text-gray-700">
                                <small className="mb-4 block">Choisir un avatar par défaut</small>
                                <div className="grid grid-cols-3 gap-4 items-center justify-center">
                                  <img
                                    src={avatarDefault1}
                                    alt="Avatar 1"
                                    className="w-12 h-12 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform"
                                    onClick={() => {
                                      handleDefaultAvatarClick(avatarDefault1);
                                      close();
                                    }}
                                  />
                                  <img
                                    src={avatarDefault2}
                                    alt="Avatar 2"
                                    className="w-12 h-12 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform"
                                    onClick={() => {
                                      handleDefaultAvatarClick(avatarDefault2);
                                      close();
                                    }}
                                  />
                                  <img
                                    src={avatarDefault3}
                                    alt="Avatar 3"
                                    className="w-12 h-12 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform"
                                    onClick={() => {
                                      handleDefaultAvatarClick(avatarDefault3);
                                      close();
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-t border-l border-gray-200 rotate-135"></div>
                          </div>
                        </div>
                      </>
                    )}
                  </PopoverPanel>
                </Popover>
              </div>
              <input
                {...avatarRest}
                ref={(e) => {
                  avatarRef(e);
                  fileInputRef.current = e;
                }}
                id="avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              {errors.avatar && <span className="text-xs text-red-500">{errors.avatar.message as string}</span>}
            </div>
            {/* Nom */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lastName" className="text-xs font-medium text-gray-600">
                Nom
              </label>
              <div className="relative">
                <input
                  {...register('lastName')}
                  id="lastName"
                  type="text"
                  placeholder="Dupont"
                  autoComplete="family-name"
                  className={`w-full h-10 pl-3 pr-9 text-sm bg-gray-50 border rounded-lg outline-none transition-all
                      focus:bg-white focus:ring-1 focus:ring-blue-100 focus:border-blue-400
                      ${errors.lastName ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
                <User
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
              {errors.lastName && <span className="text-xs text-red-500">{errors.lastName.message}</span>}
            </div>
            {/* Prénom */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="firstName" className="text-xs font-medium text-gray-600">
                Prénom
              </label>
              <div className="relative">
                <input
                  {...register('firstName')}
                  id="firstName"
                  type="text"
                  placeholder="Jean"
                  autoComplete="given-name"
                  className={`w-full h-10 pl-3 pr-9 text-sm bg-gray-50 border rounded-lg outline-none transition-all
                      focus:bg-white focus:ring-1 focus:ring-blue-100 focus:border-blue-400
                      ${errors.firstName ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
                <User
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
              {errors.firstName && <span className="text-xs text-red-500">{errors.firstName.message}</span>}
            </div>
            {/* ── Email ── */}
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
            {/* ── Mot de passe ── */}
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
                  className={`w-full h-10 pl-3 pr-11 text-sm bg-gray-50 border rounded-lg outline-none transition-all
                    focus:bg-white focus:ring-1 focus:ring-blue-100 focus:border-blue-400
                    ${errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff size={18} className="cursor-pointer" />
                  ) : (
                    <Eye size={18} className="cursor-pointer" />
                  )}
                </button>
              </div>
              {errors.password && <span className="text-xs text-red-500">{errors.password.message}</span>}
            </div>
            {/* ── Confirmation mot de passe ── */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-xs font-medium text-gray-600">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`w-full h-10 pl-3 pr-11 text-sm bg-gray-50 border rounded-lg outline-none transition-all
                    focus:bg-white focus:ring-1 focus:ring-blue-100 focus:border-blue-400
                    ${errors.confirmPassword ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} className="cursor-pointer" />
                  ) : (
                    <Eye size={18} className="cursor-pointer" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && <span className="text-xs text-red-500">{errors.confirmPassword.message}</span>}
            </div>
            {/* ── CGU ── */}
            <div className="flex flex-col gap-1">
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  {...register('terms')}
                  type="checkbox"
                  className="mt-0.5 w-3.5 h-3.5 cursor-pointer accent-blue-500 shrink-0"
                />
                <span className="text-sm text-gray-500 leading-snug">
                  J'accepte les{' '}
                  <a href="/terms" className="text-blue-500 hover:underline">
                    conditions d'utilisation
                  </a>{' '}
                  !
                </span>
              </label>
              {errors.terms && <span className="text-xs text-red-500 ml-5">{errors.terms.message}</span>}
            </div>
            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={isDisabled}
              className="w-full h-10 bg-blue-600 text-white border border-blue-600 rounded-lg text-sm font-medium
                flex items-center justify-center gap-2
                hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-1"
            >
              {isDisabled ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <UserPlus size={15} />
                  Créer mon compte
                </>
              )}
            </button>
            {/* ── Divider ── */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">ou continuer avec</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            {/* ── Google ── */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full h-10 border cursor-pointer border-gray-200 rounded-lg text-sm text-gray-600
                flex items-center justify-center gap-2
                hover:bg-gray-50 hover:border-gray-300
                active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-200"
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
          </form>

          {/* ── Lien connexion ── */}
          <p className="text-center text-sm text-gray-500 mt-6 pt-5 border-t border-gray-100">
            Déjà un compte ?{' '}
            <a href="/login" className="text-blue-500 hover:underline">
              Se connecter
            </a>
          </p>
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
