import { NavLink } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { User, Bell, SettingsIcon, ShieldCheckIcon, ScanFace } from 'lucide-react';

const settingsMenus = [
  { to: '/dashboard/settings', icon: SettingsIcon, label: 'Paramètres' },
  { to: '/dashboard/settings/profil', icon: User, label: 'Profil' },
  { to: '/dashboard/settings/password', icon: ShieldCheckIcon, label: 'Sécurité' },
  { to: '/dashboard/settings/notifications', icon: Bell, label: 'Notifications' },
  { to: '/dashboard/settings/scan-facial', icon: ScanFace, label: 'Scan facial' }
];

export default function Settings() {
  return (
    <div className="h-full">
      <div className="grid grid-cols-3 h-full gap-6">
        {/* Contenu de la page sélectionnée */}
        <div
          className="bg-white rounded-lg border border-gray-200 shadow-md p-0 overflow-y-auto h-full col-span-2
            [&::-webkit-scrollbar]:w-2
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-gray-200
            [&::-webkit-scrollbar-thumb]:rounded-full
            hover:[&::-webkit-scrollbar-thumb]:bg-neutral-300"
        >
          <Outlet />
        </div>

        {/* Menu latéral */}
        <div className="bg-white sticky top-0 rounded-lg border border-gray-200 shadow-md p-4 h-fit">
          <nav className="space-y-1">
            {settingsMenus.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard/settings'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
