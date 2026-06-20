import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X, ChevronLeft } from 'lucide-react';
import SidebarContent from './SidebarContent';
import Header from './Header';
import { ModalProvider } from '../../context/ModalContext';
import { ModalManager } from '../../components/modals/ModalManager';

// Configuration des titres et descriptions par route
const routeConfig: Record<string, { title: string; description: string }> = {
  '/dashboard': {
    title: 'Tableau de bord',
    description: 'Aperçu général de votre activité'
  },
  '/dashboard/users': {
    title: 'Utilisateurs',
    description: 'Gérez les utilisateurs de votre application'
  },
  '/dashboard/settings': {
    title: 'Paramètres',
    description: 'Configurez votre application et vos préférences'
  },
  '/dashboard/settings/profil': {
    title: 'Paramètres / Profil',
    description: 'Configurez votre application et vos préférences'
  },
  '/dashboard/settings/password': {
    title: 'Paramètres / Sécurité',
    description: 'Configurez votre application et vos préférences'
  },
  '/dashboard/settings/notifications': {
    title: 'Paramètres / Notifications',
    description: 'Configurez votre application et vos préférences'
  },
  '/dashboard/deviation': {
    title: 'Déviation d\'itinéraire',
    description: 'Planificateur de déviations - Fianarantsoa'
  }
};

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const firstName = user?.firstName || '-';
  const lastName = user?.lastName || '-';

  // Obtenir la configuration de la route actuelle
  const currentRoute = routeConfig[location.pathname] || {
    title: 'Mon App',
    description: 'Bienvenue sur votre espace de travail'
  };

  return (
    <ModalProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {/* Sidebar desktop */}
        <aside
          className={`hidden md:flex flex-col m-3 bg-white border border-gray-200 rounded-lg transition-all duration-300 relative overflow-visible ${
            collapsed ? 'w-16' : 'w-60'
          }`}
        >
          <SidebarContent collapsed={collapsed} />

          {/* Collapse toggle - CORRIGÉ */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute z-[99999] top-[60px] -right-3 hidden md:flex items-center justify-center w-6 h-6 bg-gray-800 rounded-full text-white hover:bg-gray-700 transition-all shadow-lg cursor-pointer"
            aria-label={collapsed ? 'Ouvrir le menu' : 'Fermer le menu'}
          >
            <ChevronLeft size={14} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* Sidebar mobile drawer */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 md:hidden ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
          <SidebarContent onNavClick={() => setMobileOpen(false)} />
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 pb-4 overflow-hidden">
          <div className="md:hidden">
            <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
              <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                <Menu size={20} />
              </button>

              <div>
                <h1 className="font-semibold text-gray-900 text-sm">{currentRoute.title}</h1>
                <p className="text-xs text-gray-500">{currentRoute.description}</p>
              </div>

              <img
                src={`https://ui-avatars.com/api/?background=random&name=${firstName}+${lastName}`}
                className="ml-auto w-9 h-9 border border-gray-200 bg-blue-50 rounded-full"
                alt="logo"
              />
            </header>
          </div>

          {/* Header desktop */}
          <div className="hidden md:block">
            <Header title={currentRoute.title} description={currentRoute.description} />
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4">
            <Outlet />
          </main>
        </div>
      </div>
      <ModalManager />
    </ModalProvider>
  );
};

export default Layout;