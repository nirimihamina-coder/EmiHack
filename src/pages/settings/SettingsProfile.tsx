import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Shield, CheckCircle2, Camera, Pencil, X, Save, Loader2, UserCircle2, Image } from 'lucide-react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';

import avatarDefault1 from './../../assets/avatar/avatar1.webp';
import avatarDefault2 from './../../assets/avatar/avatar2.webp';
import avatarDefault3 from './../../assets/avatar/avatar3.webp';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';

// ─── Schéma Zod ───────────────────────────────────────────────
const profileSchema = z.object({
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères.'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  email: z.string().email('Veuillez entrer un email valide.'),
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
    )
});

type ProfileFormData = z.infer<typeof profileSchema>;

function getRoleBadge(role: string) {
  const map: Record<string, { label: string; color: string }> = {
    admin: { label: 'Administrateur', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    user: { label: 'Utilisateur', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    moderator: { label: 'Modérateur', color: 'bg-amber-100 text-amber-700 border-amber-200' }
  };
  return map[role] ?? { label: role, color: 'bg-gray-100 text-gray-600 border-gray-200' };
}

// ─── Composant ────────────────────────────────────────────────
export default function SettingsProfile() {
  const { user, isLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? ''
    }
  });

  const { ref: avatarRef, ...avatarRest } = register('avatar');

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
    avatarRest.onChange(e);
  };

  const handleDefaultAvatarClick = async (avatarSrc: string) => {
    try {
      const response = await fetch(avatarSrc);
      const blob = await response.blob();
      const file = new File([blob], 'avatar-default.webp', { type: 'image/webp' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      setValue('avatar', dataTransfer.files);
      setAvatarPreview(avatarSrc);
    } catch (err) {
      console.error("Erreur lors du chargement de l'avatar:", err);
    }
  };

  const handleEditOpen = () => {
    reset({
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? ''
    });
    setAvatarPreview(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setAvatarPreview(null);
  };

  const { updateProfile, clearError, isLoading: isSaving } = useUser();

  const onSubmit = async (data: ProfileFormData) => {
    clearError();

    const storedAuth = localStorage.getItem('auth-storage');
    if (!storedAuth) return console.error('Auth introuvable');

    let userId: string | null = null;
    try {
      const parsed = JSON.parse(storedAuth);
      userId = parsed?.state?.user?.id;
    } catch (error) {
      return console.error('Erreur parsing auth-storage', error);
    }

    if (!userId) return console.error('User ID introuvable');

    const formData = new FormData();
    formData.append('firstName', data.firstName);
    formData.append('lastName', data.lastName);
    formData.append('email', data.email);

    // ✅ Lire directement depuis le ref au lieu de data.avatar
    const fileFromRef = fileInputRef.current?.files?.[0];
    if (fileFromRef) {
      formData.append('file', fileFromRef);
    }

    // ✅ Debug lisible pour FormData
    console.log('🚀 userId:', userId);
    for (const [key, value] of formData.entries()) {
      console.log(`formData → ${key}:`, value);
    }

    const result = await updateProfile(userId, formData);
    console.log('🚀 result:', result);

    if (result.success) {
      setIsEditing(false);
      setAvatarPreview(null);
    }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Non connecté ──
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-gray-500">Utilisateur non connecté.</p>
      </div>
    );
  }

  const roleBadge = getRoleBadge(user.role ?? 'user');
  const currentAvatar = avatarPreview ?? user.avatar ?? null;
  const isDisabled = isSubmitting || isSaving;

  return (
    <div className="bg-white">
      {/* ── Bannière / Avatar ── */}
      <div className="h-36 w-full relative bg-blue-50" />

      <div className="px-6 pb-6">
        {/* ── Avatar + actions ── */}
        <div className="flex items-end justify-between -mt-15 mb-5">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-white shadow-md bg-gray-100 overflow-hidden">
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  referrerPolicy="no-referrer"
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle2 size={80} className="text-gray-300" />
              )}
            </div>
          </div>

          {!isEditing && (
            <button
              onClick={handleEditOpen}
              className="flex items-center cursor-pointer -translate-y-2 gap-1.5 h-9 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-600
                  hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all"
            >
              <Pencil size={14} />
              Modifier
            </button>
          )}
        </div>

        {/* ══════════════════════════════════════
              MODE LECTURE
          ══════════════════════════════════════ */}
        {!isEditing && (
          <div className="flex flex-col gap-4">
            {/* Nom complet + badge */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {user.firstName} {user.lastName}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${roleBadge.color}`}
                >
                  <Shield size={10} />
                  {roleBadge.label}
                </span>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* Champs info */}
            <div className="grid gap-5">
              <InfoRow icon={<User size={20} />} label="Prénom" value={user.firstName} />
              <InfoRow icon={<User size={20} />} label="Nom" value={user.lastName} />
              <InfoRow icon={<Mail size={20} />} label="Email" value={user.email} />
              <InfoRow
                icon={<CheckCircle2 size={20} className="text-green-500" />}
                label="Statut"
                value={
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    Compte actif
                  </span>
                }
              />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
              MODE ÉDITION
          ══════════════════════════════════════ */}
        {isEditing && (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {/* ── Changement avatar ── */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">
                Photo de profil <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <div className="flex items-center gap-4">
                <div
                  className="relative w-14 h-14 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {currentAvatar ? (
                    <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle2 size={24} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                    <Camera size={14} className="text-white" />
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

                {/* Avatars par défaut */}
                <Popover className="relative inline-block">
                  <PopoverButton className="bg-white border group border-gray-200 rounded-md cursor-pointer transition-all w-8 h-8 flex items-center justify-center hover:bg-gray-50 focus:outline-none">
                    <Image className="text-gray-400 w-5 h-5 group-hover:scale-110 group-hover:rotate-12 transition-all" />
                  </PopoverButton>
                  <PopoverPanel className="absolute z-50">
                    {({ close }) => (
                      <div className="absolute bottom-10 mb-4 left-4 -translate-x-1/2">
                        <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px]">
                          <button
                            onClick={() => close()}
                            className="absolute top-2 right-2 cursor-pointer text-gray-400 hover:text-gray-600 z-10"
                          >
                            <X size={14} />
                          </button>
                          <div className="p-4 pt-3">
                            <small className="mb-4 block text-gray-700">Choisir un avatar par défaut</small>
                            <div className="grid grid-cols-3 gap-4 items-center justify-center">
                              {[avatarDefault1, avatarDefault2, avatarDefault3].map((src, i) => (
                                <img
                                  key={i}
                                  src={src}
                                  alt={`Avatar ${i + 1}`}
                                  className="w-12 h-12 border border-gray-400 rounded-full object-cover cursor-pointer hover:scale-110 hover:-translate-y-2 transition-transform"
                                  onClick={() => {
                                    handleDefaultAvatarClick(src);
                                    close();
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-gray-200 rotate-45" />
                        </div>
                      </div>
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
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              {errors.avatar && <span className="text-xs text-red-500">{errors.avatar.message as string}</span>}
            </div>

            <div className="h-px bg-gray-100" />

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
                  className={`w-full h-10 pl-3 pr-10 text-sm bg-gray-50 border rounded-lg outline-none transition-all
                      focus:bg-white focus:ring-1 focus:ring-blue-100 focus:border-blue-400
                      ${errors.email ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
                <Mail
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
              {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isDisabled}
                className="flex-1 h-10 border border-gray-200 rounded-lg text-sm font-medium text-gray-600
                    flex items-center justify-center gap-2
                    hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <X size={14} />
                Annuler
              </button>
              <button
                type="submit"
                disabled={isDisabled}
                className="flex-1 h-10 bg-blue-600 text-white border border-blue-600 rounded-lg text-sm font-medium
                    flex items-center justify-center gap-2
                    hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isDisabled ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Enregistrement...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Enregistrer
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Sous-composant ligne d'info ──────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">{label}</span>
        <span className="text-sm text-gray-800 truncate">{value}</span>
      </div>
    </div>
  );
}
