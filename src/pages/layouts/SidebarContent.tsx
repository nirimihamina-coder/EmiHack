import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, LogOut, MailIcon, PresentationIcon, MapIcon, Route, Globe, SigmaSquareIcon } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from '../../context/ModalContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/dashboard/settings', icon: Settings, label: 'Paramètres' },
  { to: '/dashboard/carte', icon: MapIcon, label: 'Cartes' },
  { to: '/dashboard/deviation', icon: Route, label: 'Déviation' },
  { to: '/dashboard/fokontany', icon: Globe, label: 'Fokontany' },
  { to: '/dashboard/simulation', icon: SigmaSquareIcon, label: 'Simulation' },
];

// Images de fond pour le slideshow - Tes liens exacts
const backgroundImages = [
  // 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTkf7v_jeLyTrTZCkZ7lUiKn21AwEpmiL9II3pcXoQa5g&s=10',
  'https://fr.digi.com/getattachment/Blog/post/Smart-Traffic-Management-Ready-to-Deploy-Infrastru/GettyImages-635752744-1280x720.jpg?lang=en-US',
  'https://www.vinci-autoroutes.com/static/aed7145beb37cede901969b639b30ae1/9e8c6/info-trafic-hero.jpg',
  'https://media.sudouest.fr/8655520/1200x-1/so-57ebd67166a4bd6f7784654b-ph0.jpg',
];

interface SidebarContentProps {
  collapsed?: boolean;
  onNavClick?: () => void;
}

const SidebarContent = ({ collapsed = false, onNavClick }: SidebarContentProps) => {
  const { openModal } = useModal();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Changement automatique d'image toutes les 6 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
    }, 6000); // Change toutes les 6 secondes

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Slideshow de fond avec transition fluide */}
      {backgroundImages.map((imageUrl, index) => (
        <div
          key={imageUrl}
          className="absolute inset-0 rounded-lg transition-opacity duration-1000 ease-in-out"
          style={{
            backgroundImage: `url('${imageUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'left',
            backgroundRepeat: 'no-repeat',
            opacity: index === currentImageIndex ? 1 : 0,
            zIndex: index === currentImageIndex ? 1 : 0
          }}
        />
      ))}
      
      {/* Overlay blanc semi-transparent pour la lisibilité */}
      <div className="absolute inset-0 bg-white/85 backdrop-blur-[1px]" style={{ zIndex: 2 }} />
      
      {/* Contenu */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200/60 transition-all duration-300">
          <div className="w-8 h-8 bg-linear-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
            <LayoutDashboard size={16} className="text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-gray-900 text- font-poppins whitespace-nowrap transition-opacity duration-200">
              Traffic-Lab
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavItem key={to} to={to} icon={Icon} label={label} end={end} collapsed={collapsed} onNavClick={onNavClick} />
          ))}
        </nav>

        {/* Logout */}
        <div className="px-2 py-3 border-t border-gray-200/60">
          <button
            onClick={() => openModal('logout')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-red-50 hover:text-red-600 text-red-900 cursor-pointer transition-all duration-300 relative z-10"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span className="line-clamp-1">Se déconnecter</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  end?: boolean;
  collapsed: boolean;
  onNavClick?: () => void;
}

function NavItem({ to, icon: Icon, label, end, collapsed, onNavClick }: NavItemProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!collapsed || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top: rect.top + rect.height / 2,
      left: rect.right + 8
    });
  };

  const handleMouseLeave = () => setPos(null);

  return (
    <>
      <div ref={ref} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <NavLink
          to={to}
          end={end}
          onClick={onNavClick}
          className={({ isActive }) =>
            `group flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-300 relative z-10 ${
              isActive ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-black/10 hover:text-gray-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                size={19}
                className={`flex-shrink-0 transition-colors ${
                  isActive ? 'text-indigo-600' : 'group-hover:text-gray-900'
                }`}
              />
              {!collapsed && <span className="transition-opacity duration-200">{label}</span>}
            </>
          )}
        </NavLink>
      </div>

      {collapsed &&
        pos &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none flex items-center"
            style={{ top: pos.top, left: pos.left, transform: 'translateY(-50%)' }}
          >
            <div className="w-0 h-0 border-y-4 border-y-transparent border-r-4 border-r-gray-900" />
            <div className="px-3 py-2 text-xs text-white bg-gray-900 rounded-md shadow-lg whitespace-nowrap">
              {label}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default SidebarContent;