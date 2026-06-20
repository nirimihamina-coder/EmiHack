import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

/* ─── GLOBAL STYLES ─── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Barlow:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --violet: #5b21b6;
    --violet-mid: #7c3aed;
    --violet-light: #8b5cf6;
    --indigo: #4338ca;
    --blue: #2563eb;
    --blue-elec: #3b82f6;
    --white: #ffffff;
    --offwhite: #f9f8ff;
    --gray-subtle: #f3f2ff;
    --text-dark: #0f0a2a;
    --text-mid: #4b4578;
    --text-muted: #9490b8;
    --border: rgba(124,58,237,0.12);
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'Barlow', sans-serif;
    background: var(--white);
    color: var(--text-dark);
    overflow-x: hidden;
  }

  h1,h2,h3,h4,h5 {
    font-family: 'Outfit', sans-serif;
    line-height: 1.1;
  }

  /* Floating badge animation */
  @keyframes floatY {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-10px); }
  }
  @keyframes floatY2 {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-7px); }
  }
  @keyframes morphShape {
    0%,100% { border-radius: 60% 40% 55% 45% / 45% 55% 45% 55%; }
    33%     { border-radius: 45% 55% 65% 35% / 60% 40% 60% 40%; }
    66%     { border-radius: 70% 30% 45% 55% / 40% 60% 50% 50%; }
  }
  @keyframes spinSlow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes pulse2 {
    0%,100% { opacity:1; transform:scale(1); }
    50%     { opacity:0.6; transform:scale(0.94); }
  }
  @keyframes slideUp {
    from { opacity:0; transform:translateY(30px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }

  .float1 { animation: floatY  4s ease-in-out infinite; }
  .float2 { animation: floatY2 5s ease-in-out infinite 1s; }
  .float3 { animation: floatY  6s ease-in-out infinite 2s; }
  .slide-up { animation: slideUp 0.7s ease forwards; }

  /* Hexagon clip */
  .hex-clip {
    clip-path: polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%);
  }
  .hex-clip-soft {
    clip-path: polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%);
  }

  /* Glassmorphism card */
  .glass {
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.7);
  }

  /* Section dots pattern */
  .dots-bg {
    background-image: radial-gradient(circle, rgba(124,58,237,0.12) 1.5px, transparent 1.5px);
    background-size: 30px 30px;
  }

  /* Navbar blur */
  .nav-blur {
    background: rgba(255,255,255,0.82);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  /* Hover card lift */
  .card-lift {
    transition: transform 0.35s cubic-bezier(.22,.68,0,1.2), box-shadow 0.35s ease, border-color 0.25s;
  }
  .card-lift:hover {
    transform: translateY(-6px);
    box-shadow: 0 24px 60px -12px rgba(91,33,182,0.18);
    border-color: rgba(124,58,237,0.3);
  }

  /* Accordion */
  .acc-body {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.4s cubic-bezier(.4,0,.2,1);
  }
  .acc-body.open { max-height: 300px; }

  /* CTA btn */
  .btn-primary {
    background: linear-gradient(135deg, #7c3aed, #4338ca);
    color: #fff;
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .btn-primary:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 12px 40px -8px rgba(91,33,182,0.45);
  }
  .btn-outline {
    background: transparent;
    border: 1.5px solid rgba(124,58,237,0.35);
    color: var(--violet-mid);
    font-family: 'Outfit', sans-serif;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }
  .btn-outline:hover {
    background: rgba(124,58,237,0.06);
    border-color: rgba(124,58,237,0.6);
  }

  /* Star */
  .star { color: #f59e0b; }

  /* FAQ icon rotate */
  .faq-icon { transition: transform 0.3s; }
  .faq-icon.open { transform: rotate(45deg); }

  input[type=email] {
    outline: none;
    border: 1.5px solid var(--border);
    transition: border-color 0.2s;
    font-family: 'Barlow', sans-serif;
  }
  input[type=email]:focus { border-color: var(--violet-light); }

  /* ── Navbar responsive ── */
  .nav-desktop-links { display: flex; }
  .nav-desktop-cta   { display: flex; }
  .nav-hamburger     { display: none !important; }

  @media (max-width: 900px) {
    .nav-desktop-links { display: none !important; }
    .nav-desktop-cta   { display: none !important; }
    .nav-hamburger     { display: flex !important; }
  }

  @media (max-width: 768px) {
    .hero-grid { grid-template-columns: 1fr !important; }
    .hero-right { display: none !important; }
    .services-grid { grid-template-columns: 1fr !important; }
    .team-grid { grid-template-columns: repeat(2,1fr) !important; }
    .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
    .testi-grid { grid-template-columns: 1fr !important; }
    .footer-grid { grid-template-columns: 1fr !important; }
    .why-grid { grid-template-columns: 1fr !important; }
  }
`;

/* ─── DATA ─── */
const NAV = ['Solutions', 'Produit', 'Équipe', 'Témoignages', 'FAQ'];

const SERVICES = [
  {
    icon: '◈',
    grad: '135deg,#7c3aed,#4338ca',
    bg: '#ede9fe',
    title: 'Développement Web',
    desc: 'Applications web sur-mesure, performantes et évolutives, conçues pour scaler avec votre croissance.'
  },
  {
    icon: '⬡',
    grad: '135deg,#2563eb,#4338ca',
    bg: '#dbeafe',
    title: 'Innovation IA',
    desc: "Intégration d'intelligences artificielles personnalisées pour automatiser et amplifier vos processus métiers."
  },
  {
    icon: '◆',
    grad: '135deg,#6d28d9,#7c3aed',
    bg: '#ede9fe',
    title: 'Architecture Cloud',
    desc: 'Infrastructures cloud résilientes et sécurisées, optimisées pour la performance à grande échelle.'
  },
  {
    icon: '⬟',
    grad: '135deg,#0ea5e9,#2563eb',
    bg: '#e0f2fe',
    title: 'UX / Design Système',
    desc: 'Expériences utilisateurs mémorables, cohérentes et accessibles, de la maquette au déploiement.'
  },
  {
    icon: '◇',
    grad: '135deg,#7c3aed,#db2777',
    bg: '#fce7f3',
    title: 'API & Intégrations',
    desc: 'Connexions fluides entre vos outils existants grâce à des APIs robustes et des connecteurs modulaires.'
  },
  {
    icon: '⬠',
    grad: '135deg,#4338ca,#2563eb',
    bg: '#e0e7ff',
    title: 'Cybersécurité Web',
    desc: 'Audits, tests de pénétration et stratégies de sécurisation pour protéger vos assets digitaux.'
  }
];

const WHY = [
  {
    n: '01',
    title: 'Approche produit',
    desc: 'Nous pensons comme des fondateurs de produit, pas comme des prestataires. Chaque décision technique sert un objectif business.'
  },
  {
    n: '02',
    title: "Vélocité d'exécution",
    desc: 'Nos sprints de 2 semaines garantissent des livraisons rapides, mesurables et itérables en continu.'
  },
  {
    n: '03',
    title: 'Stack de pointe',
    desc: 'Next.js, Edge Computing, LLMs, WebAssembly — nous maîtrisons les technologies qui définissent le web de demain.'
  },
  {
    n: '04',
    title: 'Transparence totale',
    desc: 'Accès en temps réel à notre board de projet, nos métriques et nos KPIs. Vous voyez tout, à tout moment.'
  }
];

const STATS = [
  { val: '340+', label: 'Projets livrés' },
  { val: '99.9%', label: 'Uptime garanti' },
  { val: '4.9/5', label: 'Note client' },
  { val: '18', label: 'Pays couverts' }
];

const TEAM = [
  {
    initials: 'NK',
    name: 'Noa Karim',
    role: 'CEO & Co-fondateur',
    grad: '135deg,#7c3aed,#4338ca',
    desc: 'Architecte produit et visionnaire, ex-Google, 10 ans à construire des plateformes à fort trafic.'
  },
  {
    initials: 'SM',
    name: 'Sara Mekki',
    role: 'CTO',
    grad: '135deg,#2563eb,#4338ca',
    desc: "Ingénieure full-stack passionnée par les systèmes distribués et l'infrastructure cloud-native."
  },
  {
    initials: 'YB',
    name: 'Yann Breton',
    role: 'Head of Design',
    grad: '135deg,#6d28d9,#db2777',
    desc: "Designer de systèmes, ex-Figma, obsédé par les interfaces qui disparaissent pour laisser place à l'usage."
  },
  {
    initials: 'AL',
    name: 'Amira Larbi',
    role: 'Lead AI Engineer',
    grad: '135deg,#0ea5e9,#4338ca',
    desc: "Chercheuse en NLP appliqué, spécialiste de l'intégration LLM en production à grande échelle."
  }
];

const TESTI = [
  {
    init: 'RL',
    name: 'Romain Lefèvre',
    role: 'CTO · Fintech Pulse',
    col: '#ede9fe',
    tc: '#5b21b6',
    rating: 5,
    text: "Cod' Art a livré notre plateforme en 8 semaines là où deux autres agences avaient échoué en 6 mois. Une équipe d'un niveau technique impressionnant."
  },
  {
    init: 'CM',
    name: 'Céleste Martin',
    role: 'CEO · Shoploop',
    col: '#dbeafe',
    tc: '#1e40af',
    rating: 5,
    text: "Leur intégration IA a augmenté nos conversions de 34% en un mois. Ils comprennent vraiment l'impact business de chaque choix technologique."
  },
  {
    init: 'TV',
    name: 'Thomas Vidal',
    role: 'Head of Product · Eratis',
    col: '#e0e7ff',
    tc: '#3730a3',
    rating: 5,
    text: 'Un partenaire tech comme on en rêve : proactif, rigoureux, et qui délivre. Notre MVP est passé de concept à production en 6 semaines.'
  }
];

const FAQS = [
  {
    q: 'Quels types de projets prenez-vous en charge ?',
    a: "De la landing page au SaaS complexe avec IA embarquée, en passant par les refontres d'architectures legacy et les apps mobiles hybrides. Si c'est sur le web, on peut le construire."
  },
  {
    q: 'Comment fonctionnent vos sprints et livraisons ?',
    a: 'Nous travaillons en cycles de 2 semaines avec des démonstrations à chaque fin de sprint. Vous accédez à un board Notion live et à un canal Slack dédié dès le jour 1.'
  },
  {
    q: 'Proposez-vous une phase de discovery avant de démarrer ?',
    a: "Oui, systématiquement. Une phase de cadrage de 1 à 2 semaines permet d'aligner vision produit, architecture technique et roadmap avant tout développement."
  },
  {
    q: "Qu'arrive-t-il au code après la mission ?",
    a: 'Le code vous appartient intégralement. Nous livrons les sources complètes, la documentation technique et un guide de reprise en main pour votre équipe interne.'
  },
  {
    q: "Travaillez-vous à l'international ?",
    a: 'Absolument. Notre équipe est répartie entre Paris, Tunis, Montréal et Antananarivo. Nous gérons des projets dans 18 pays avec des équipes entièrement distribuées.'
  }
];

/* ─── COMPONENTS ─── */

function Navbar({ scrolled }: { scrolled: boolean }) {
  const [open, setOpen] = useState(false);

  /* Close menu on link click */
  const close = () => setOpen(false);

  const textColor = scrolled ? '#4b4578' : 'rgba(255,255,255,0.82)';
  const logoColor = scrolled ? '#0f0a2a' : '#fff';

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        transition: 'all 0.4s',
        ...(scrolled
          ? {
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(124,58,237,0.1)',
              boxShadow: '0 4px 24px -8px rgba(91,33,182,0.1)'
            }
          : {
              background: open ? 'rgba(15,10,42,0.97)' : 'transparent'
            })
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg,#7c3aed,#4338ca)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(91,33,182,0.35)',
              flexShrink: 0
            }}
          >
            <span style={{ color: '#fff', fontFamily: 'Outfit', fontWeight: 900, fontSize: 18 }}>N</span>
          </div>
          <span
            style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 20, color: logoColor, transition: 'color 0.3s' }}
          >
            Cod' Art
          </span>
        </div>

        {/* Desktop links — hidden on mobile via inline media (handled by CSS class) */}
        <div className="nav-desktop-links" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {NAV.map((n) => (
            <a
              key={n}
              href={`#${n.toLowerCase()}`}
              style={{
                textDecoration: 'none',
                fontSize: 15,
                fontWeight: 500,
                color: textColor,
                transition: 'color 0.2s',
                fontFamily: 'Barlow',
                whiteSpace: 'nowrap'
              }}
              // onMouseEnter={(e) => (e.target.style.color = '#7c3aed')}
              // onMouseLeave={(e) => (e.target.style.color = textColor)}
            >
              {n}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="nav-desktop-cta" style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <NavLink
            to={'/login'}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: scrolled ? '#7c3aed' : 'rgba(255,255,255,0.85)',
              fontFamily: 'Outfit',
              whiteSpace: 'nowrap'
            }}
          >
            Connexion
          </NavLink>
          <button
            className="btn-primary"
            style={{ padding: '9px 20px', borderRadius: 10, fontSize: 14, whiteSpace: 'nowrap' }}
          >
            Démo gratuite
          </button>
        </div>

        {/* Hamburger — visible only on mobile */}
        <button
          className="nav-hamburger"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          style={{
            display: 'none' /* shown via CSS below */,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 5,
            width: 44,
            height: 44,
            borderRadius: 10,
            border: 'none',
            background: open ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.08)',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0
          }}
        >
          {/* Three bars → X animation */}
          <span
            style={{
              display: 'block',
              width: 22,
              height: 2,
              background: open ? '#a78bfa' : scrolled ? '#7c3aed' : '#fff',
              borderRadius: 2,
              transform: open ? 'translateY(7px) rotate(45deg)' : 'none',
              transition: 'transform 0.3s, background 0.3s'
            }}
          />
          <span
            style={{
              display: 'block',
              width: 22,
              height: 2,
              background: open ? '#a78bfa' : scrolled ? '#7c3aed' : '#fff',
              borderRadius: 2,
              opacity: open ? 0 : 1,
              transition: 'opacity 0.2s, background 0.3s'
            }}
          />
          <span
            style={{
              display: 'block',
              width: 22,
              height: 2,
              background: open ? '#a78bfa' : scrolled ? '#7c3aed' : '#fff',
              borderRadius: 2,
              transform: open ? 'translateY(-7px) rotate(-45deg)' : 'none',
              transition: 'transform 0.3s, background 0.3s'
            }}
          />
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: open ? 500 : 0,
          transition: 'max-height 0.4s cubic-bezier(.4,0,.2,1)'
        }}
      >
        <div
          style={{
            padding: '8px 24px 28px',
            borderTop: '1px solid rgba(124,58,237,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}
        >
          {NAV.map((n) => (
            <a
              key={n}
              href={`#${n.toLowerCase()}`}
              onClick={close}
              style={{
                textDecoration: 'none',
                fontSize: 17,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
                fontFamily: 'Outfit',
                padding: '13px 0',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'block',
                transition: 'color 0.2s, padding-left 0.2s'
              }}
              // onMouseEnter={(e) => {
              //   e.target.style.color = '#a78bfa';
              //   e.target.style.paddingLeft = '8px';
              // }}
              // onMouseLeave={(e) => {
              //   e.target.style.color = 'rgba(255,255,255,0.85)';
              //   e.target.style.paddingLeft = '0';
              // }}
            >
              {n}
            </a>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <button
              style={{
                padding: '13px',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.85)',
                cursor: 'pointer',
                fontFamily: 'Outfit'
              }}
            >
              Connexion
            </button>
            <button className="btn-primary" style={{ padding: '13px', borderRadius: 12, fontSize: 15 }}>
              Démo gratuite →
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

/* Hexagonal image frame — faithful to KASIA reference */
function HexFrame() {
  return (
    <div style={{ position: 'relative', width: 420, height: 440, margin: '0 auto' }}>
      {/* Outer rotating ring */}
      <div
        style={{
          position: 'absolute',
          inset: -20,
          border: '2px dashed rgba(139,92,246,0.25)',
          borderRadius: '50%',
          animation: 'spinSlow 20s linear infinite'
        }}
      />

      {/* Main hex shape */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          right: 20,
          bottom: 20,
          background: 'linear-gradient(135deg,#7c3aed 0%,#4338ca 60%,#2563eb 100%)',
          clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)',
          boxShadow: '0 40px 100px -20px rgba(91,33,182,0.55)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Inner pattern overlay — mimics team photo tinted */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(160deg,rgba(139,92,246,0.3) 0%,rgba(37,99,235,0.15) 100%)'
          }}
        />

        {/* Dot grid inside */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.18) 1px,transparent 1px)',
            backgroundSize: '22px 22px'
          }}
        />

        {/* Simulated team at desks */}
        <div style={{ position: 'relative', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>💻</div>
          <div style={{ fontFamily: 'Barlow', fontWeight: 300, fontSize: 13, letterSpacing: 2 }}>
            INNOVATION · WEB · TECH
          </div>
        </div>
      </div>

      {/* Small decorative hex top-right */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 60,
          height: 64,
          background: 'linear-gradient(135deg,#a78bfa,#6366f1)',
          clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)',
          opacity: 0.85
        }}
      />
      {/* Small decorative hex bottom-left */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 0,
          width: 44,
          height: 48,
          background: 'linear-gradient(135deg,#60a5fa,#4338ca)',
          clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)',
          opacity: 0.75
        }}
      />

      {/* Floating badge top-left */}
      <div
        className="float1 glass"
        style={{
          position: 'absolute',
          top: 30,
          left: -30,
          borderRadius: 16,
          padding: '12px 18px',
          boxShadow: '0 12px 40px -8px rgba(91,33,182,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 170
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            flexShrink: 0,
            background: 'linear-gradient(135deg,#34d399,#059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16
          }}
        >
          ✓
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#9490b8', fontWeight: 500 }}>Projet livré</div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Outfit', color: '#0f0a2a' }}>MVP · 6 semaines</div>
        </div>
      </div>

      {/* Floating badge right */}
      <div
        className="float2 bg-white"
        style={{
          position: 'absolute',
          top: '40%',
          right: -40,
          borderRadius: 16,
          padding: '14px 18px',
          boxShadow: '0 12px 40px -8px rgba(91,33,182,0.18)',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            fontFamily: 'Outfit',
            background: 'linear-gradient(135deg,#7c3aed,#2563eb)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          99.9%
        </div>
        {/* <div style={{ fontSize: 11, color: '#9490b8', fontWeight: 500, marginTop: 2 }}>uptime garanti</div> */}
      </div>

      {/* Floating badge bottom-right */}
      <div
        className="float3 glass"
        style={{
          position: 'absolute',
          bottom: 20,
          right: -20,
          borderRadius: 16,
          padding: '12px 16px',
          boxShadow: '0 12px 40px -8px rgba(91,33,182,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        <div style={{ display: 'flex', marginRight: 2 }}>
          {['NK', 'SM', 'YB'].map((i) => (
            <div
              key={i}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#7c3aed,#4338ca)',
                border: '2px solid #fff',
                marginLeft: -6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: '#fff',
                fontFamily: 'Outfit'
              }}
            >
              {i}
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Outfit', color: '#0f0a2a' }}>40+ experts</div>
          <div style={{ fontSize: 10, color: '#9490b8' }}>en ligne</div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}
    >
      {/* Deep gradient bg — matches KASIA purple/indigo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(140deg,#2e1065 0%,#3b0764 20%,#1e1b4b 55%,#1e3a8a 100%)'
        }}
      />

      {/* Blob top right */}
      <div
        style={{
          position: 'absolute',
          top: -120,
          right: -120,
          width: 650,
          height: 650,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse,rgba(139,92,246,0.35) 0%,transparent 70%)',
          animation: 'morphShape 14s ease-in-out infinite'
        }}
      />

      {/* Blob bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: -100,
          left: -80,
          width: 500,
          height: 500,
          background: 'radial-gradient(ellipse,rgba(99,102,241,0.25) 0%,transparent 70%)',
          borderRadius: '60% 40% 55% 45%',
          animation: 'morphShape 18s ease-in-out infinite reverse'
        }}
      />

      {/* Dot grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.08,
          backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)',
          backgroundSize: '36px 36px'
        }}
      />

      {/* Hexagonal decorative shapes — KASIA-style corners */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: '8%',
          width: 48,
          height: 52,
          opacity: 0.3,
          background: 'rgba(167,139,250,0.6)',
          clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 140,
          left: '12%',
          width: 32,
          height: 36,
          opacity: 0.25,
          background: 'rgba(167,139,250,0.6)',
          clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)'
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          maxWidth: 1200,
          margin: '0 auto',
          padding: '100px 32px 60px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 60,
          alignItems: 'center'
        }}
        className="hero-grid"
      >
        {/* LEFT */}
        <div style={{ animation: 'slideUp 0.8s ease forwards' }}>
          {/* Tag pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 40,
              padding: '8px 18px',
              marginBottom: 32
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#34d399',
                display: 'inline-block',
                animation: 'pulse2 2s infinite'
              }}
            />
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 500, fontFamily: 'Barlow' }}>
              Innovation · Web · Intelligence Artificielle
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(38px,5.5vw,68px)',
              fontWeight: 900,
              color: '#fff',
              marginBottom: 24,
              letterSpacing: '-1.5px'
            }}
          >
            Le web <br />
            <span
              style={{
                display: 'text-sm block',
                background: 'linear-gradient(90deg,#c4b5fd,#93c5fd)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              de demain, <br /> c'est aujourd'hui.
            </span>
          </h1>

          <p
            style={{
              color: 'white',
              fontSize: 18,
              lineHeight: 1.75,
              marginBottom: 44,
              maxWidth: 480,
              fontWeight: 300
            }}
          >
            Cod' Art conçoit des produits web d'exception — applications, plateformes IA, systèmes cloud — qui
            transforment vos ambitions en avantages compétitifs mesurables.
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button className="btn-primary" style={{ padding: '15px 32px', borderRadius: 14, fontSize: 16 }}>
              Démarrer un projet →
            </button>
            <button
              style={{
                padding: '15px 32px',
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 600,
                border: '1.5px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'Outfit',
                transition: 'background 0.2s'
              }}
              // onMouseEnter={(e) => (e.target.style.background = 'rgba(255,255,255,0.08)')}
              // onMouseLeave={(e) => (e.target.style.background = 'transparent')}
            >
              Voir nos travaux
            </button>
          </div>

          {/* Inline stats */}
          <div
            style={{
              display: 'flex',
              gap: 40,
              marginTop: 56,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: 32
            }}
          >
            {[
              { v: '340+', l: 'Projets' },
              { v: '18', l: 'Pays' },
              { v: '4.9★', l: 'Satisfaction' }
            ].map((s) => (
              <div key={s.l}>
                <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 28, color: '#fff' }}>{s.v}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — hex image */}
        <div
          className="hero-right"
          style={{ display: 'flex', justifyContent: 'center', animation: 'slideUp 0.9s ease 0.15s both' }}
        >
          <HexFrame />
        </div>
      </div>

      {/* Wave */}
      <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0 }}>
        <svg viewBox="0 0 1440 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <path
            d="M0 70L80 60C160 50 320 30 480 24C640 18 800 26 960 32C1120 38 1280 42 1360 44L1440 46V70H0Z"
            fill="#f9f8ff"
          />
        </svg>
      </div>
    </section>
  );
}

function Services() {
  const [hov, setHov] = useState<number | null>(null);
  return (
    <section id="solutions" style={{ background: '#f9f8ff', padding: '100px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 3,
              color: '#7c3aed',
              textTransform: 'uppercase',
              fontFamily: 'Outfit'
            }}
          >
            Nos Solutions
          </span>
          <h2
            style={{
              fontSize: 'clamp(28px,4vw,48px)',
              fontWeight: 900,
              marginTop: 14,
              marginBottom: 16,
              color: '#0f0a2a'
            }}
          >
            Des solutions web qui font la différence
          </h2>
          <p style={{ color: '#9490b8', fontSize: 17, lineHeight: 1.7, maxWidth: 560, margin: '0 auto' }}>
            De l'idée au déploiement, nous couvrons l'intégralité du spectre du développement web moderne.
          </p>
        </div>

        <div className="services-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {SERVICES.map((s, i) => (
            <div
              key={i}
              className="card-lift"
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 32,
                border: '1px solid rgba(124,58,237,0.1)',
                cursor: 'default',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Hover gradient bg */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 24,
                  background: `linear-gradient(${s.grad})`,
                  opacity: hov === i ? 0.04 : 0,
                  transition: 'opacity 0.3s'
                }}
              />

              {/* Icon hex */}
              <div
                style={{
                  width: 52,
                  height: 56,
                  marginBottom: 24,
                  background: s.bg,
                  clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.3s',
                  transform: hov === i ? 'scale(1.1) rotate(8deg)' : 'scale(1)'
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    background: `linear-gradient(${s.grad})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  {s.icon}
                </span>
              </div>

              <h3 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 20, color: '#0f0a2a', marginBottom: 10 }}>
                {s.title}
              </h3>
              <p style={{ color: '#9490b8', fontSize: 14, lineHeight: 1.7 }}>{s.desc}</p>

              <div
                style={{
                  marginTop: 20,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'Outfit',
                  background: `linear-gradient(${s.grad})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  opacity: hov === i ? 1 : 0,
                  transition: 'opacity 0.3s'
                }}
              >
                En savoir plus →
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyUs() {
  return (
    <section style={{ background: '#fff', padding: '100px 32px', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          className="why-grid"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}
        >
          {/* Left visual — organic hex blob */}
          <div style={{ position: 'relative' }}>
            {/* Blob bg */}
            <div
              style={{
                position: 'absolute',
                top: -60,
                left: -60,
                width: 380,
                height: 380,
                borderRadius: '50%',
                background: 'radial-gradient(ellipse,rgba(139,92,246,0.12) 0%,transparent 70%)'
              }}
            />

            {/* Central hex */}
            <div
              style={{
                position: 'relative',
                width: 380,
                height: 380,
                margin: '0 auto',
                background: 'linear-gradient(135deg,#ede9fe,#ddd6fe,#c4b5fd)',
                animation: 'morphShape 10s ease-in-out infinite',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12
              }}
            >
              {[
                { icon: '🏆', text: 'Partenaire tech de confiance' },
                { icon: '⚡', text: 'Livraison rapide & itérative' },
                { icon: '🔐', text: 'Sécurité by design' }
              ].map((item) => (
                <div
                  key={item.text}
                  className="glass"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 16,
                    padding: '12px 20px',
                    width: 260,
                    boxShadow: '0 4px 20px rgba(91,33,182,0.08)'
                  }}
                >
                  <span style={{ fontSize: 22 }}>{item.icon}</span>
                  <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 13, color: '#0f0a2a' }}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Decorative hex shapes */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 50,
                height: 54,
                background: 'linear-gradient(135deg,#a78bfa,#6366f1)',
                clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)',
                opacity: 0.6
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 30,
                left: 10,
                width: 36,
                height: 40,
                background: 'linear-gradient(135deg,#60a5fa,#4338ca)',
                clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)',
                opacity: 0.5
              }}
            />
          </div>

          {/* Right content */}
          <div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 3,
                color: '#7c3aed',
                textTransform: 'uppercase',
                fontFamily: 'Outfit'
              }}
            >
              Pourquoi Cod' Art
            </span>
            <h2
              style={{
                fontSize: 'clamp(28px,3.5vw,44px)',
                fontWeight: 900,
                marginTop: 14,
                marginBottom: 16,
                color: '#0f0a2a',
                lineHeight: 1.15
              }}
            >
              L'expertise technique au service de votre croissance
            </h2>
            <p style={{ color: '#9490b8', fontSize: 16, lineHeight: 1.75, marginBottom: 40 }}>
              Nous ne sommes pas une agence de plus. Nous sommes un partenaire tech long-terme, aligné sur vos KPIs,
              obsédé par la qualité d'exécution.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {WHY.map((w, i) => (
                <div key={i} style={{ display: 'flex', gap: 20 }}>
                  <div
                    style={{
                      flexShrink: 0,
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg,#7c3aed,#4338ca)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontFamily: 'Outfit',
                      fontWeight: 900,
                      fontSize: 14,
                      boxShadow: '0 6px 20px rgba(91,33,182,0.25)'
                    }}
                  >
                    {w.n}
                  </div>
                  <div>
                    <div
                      style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 16, color: '#0f0a2a', marginBottom: 4 }}
                    >
                      {w.title}
                    </div>
                    <div style={{ color: '#9490b8', fontSize: 14, lineHeight: 1.65 }}>{w.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section
      style={{
        position: 'relative',
        padding: '90px 32px',
        overflow: 'hidden',
        background: 'linear-gradient(140deg,#2e1065,#1e1b4b,#1e3a8a)'
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.07,
          backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -80,
          right: -80,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse,rgba(139,92,246,0.3),transparent 70%)'
        }}
      />
      {/* hex deco */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 60,
          width: 40,
          height: 44,
          opacity: 0.2,
          background: 'rgba(167,139,250,0.8)',
          clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)'
        }}
      />

      <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{ fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 900, color: '#fff' }}>
            Des résultats concrets, mesurables
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginTop: 12, fontSize: 16 }}>
            Chaque chiffre est le reflet d'une mission accomplie.
          </p>
        </div>
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
          {STATS.map((s, i) => (
            <div
              key={i}
              style={{
                textAlign: 'center',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 24,
                padding: '40px 20px',
                backdropFilter: 'blur(8px)',
                transition: 'background 0.3s, transform 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'scale(1.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 52, color: '#fff', lineHeight: 1 }}>
                {s.val}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginTop: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Team() {
  return (
    <section id="équipe" style={{ background: '#f9f8ff', padding: '100px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 3,
              color: '#7c3aed',
              textTransform: 'uppercase',
              fontFamily: 'Outfit'
            }}
          >
            L'Équipe
          </span>
          <h2
            style={{
              fontSize: 'clamp(28px,4vw,46px)',
              fontWeight: 900,
              marginTop: 14,
              marginBottom: 16,
              color: '#0f0a2a'
            }}
          >
            Des esprits brillants, un seul objectif
          </h2>
          <p style={{ color: '#9490b8', fontSize: 17, maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            Notre équipe pluridisciplinaire réunit ingénieurs, designers et stratèges autour d'une même passion : créer
            des produits qui comptent.
          </p>
        </div>

        <div className="team-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
          {TEAM.map((m, i) => (
            <div
              key={i}
              className="card-lift"
              style={{
                background: '#fff',
                borderRadius: 28,
                padding: 28,
                border: '1px solid rgba(124,58,237,0.1)',
                textAlign: 'center'
              }}
            >
              {/* Avatar in hex shape */}
              <div
                style={{
                  width: 80,
                  height: 86,
                  margin: '0 auto 20px',
                  background: `linear-gradient(${m.grad})`,
                  clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontFamily: 'Outfit',
                  fontWeight: 900,
                  fontSize: 22,
                  boxShadow: '0 12px 36px -8px rgba(91,33,182,0.3)'
                }}
              >
                {m.initials}
              </div>

              <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 17, color: '#0f0a2a', marginBottom: 4 }}>
                {m.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'Outfit',
                  marginBottom: 12,
                  background: `linear-gradient(${m.grad})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                {m.role}
              </div>
              <p style={{ color: '#9490b8', fontSize: 13, lineHeight: 1.65 }}>{m.desc}</p>

              {/* Social dots */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 18 }}>
                {['in', 'tw'].map((s) => (
                  <button
                    key={s}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: '#ede9fe',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#7c3aed',
                      fontFamily: 'Outfit',
                      transition: 'background 0.2s, color 0.2s'
                    }}
                    // onMouseEnter={(e) => {
                    //   e.target.style.background = '#7c3aed';
                    //   e.target.style.color = '#fff';
                    // }}
                    // onMouseLeave={(e) => {
                    //   e.target.style.background = '#ede9fe';
                    //   e.target.style.color = '#7c3aed';
                    // }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section id="témoignages" style={{ background: '#fff', padding: '100px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 3,
              color: '#7c3aed',
              textTransform: 'uppercase',
              fontFamily: 'Outfit'
            }}
          >
            Témoignages
          </span>
          <h2 style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 900, marginTop: 14, color: '#0f0a2a' }}>
            Ce que disent nos clients
          </h2>
        </div>

        <div className="testi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {TESTI.map((t, i) => (
            <div
              key={i}
              className="card-lift"
              style={{
                background: '#fff',
                borderRadius: 28,
                padding: 32,
                border: '1px solid rgba(124,58,237,0.1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 20,
                  fontSize: 72,
                  color: 'rgba(124,58,237,0.06)',
                  fontFamily: 'Outfit',
                  fontWeight: 900,
                  lineHeight: 1
                }}
              >
                "
              </div>

              <div style={{ display: 'flex', gap: 2, marginBottom: 18 }}>
                {Array(t.rating)
                  .fill(0)
                  .map((_, j) => (
                    <span key={j} className="star" style={{ fontSize: 16 }}>
                      ★
                    </span>
                  ))}
              </div>

              <p style={{ color: '#4b4578', fontSize: 14, lineHeight: 1.8, marginBottom: 28, position: 'relative' }}>
                {t.text}
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderTop: '1px solid rgba(124,58,237,0.07)',
                  paddingTop: 20
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: t.col,
                    color: t.tc,
                    fontFamily: 'Outfit',
                    fontWeight: 700,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {t.init}
                </div>
                <div>
                  <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 14, color: '#0f0a2a' }}>{t.name}</div>
                  <div style={{ color: '#9490b8', fontSize: 12 }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" style={{ background: '#f9f8ff', padding: '100px 32px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 3,
              color: '#7c3aed',
              textTransform: 'uppercase',
              fontFamily: 'Outfit'
            }}
          >
            FAQ
          </span>
          <h2
            style={{
              fontSize: 'clamp(28px,4vw,44px)',
              fontWeight: 900,
              marginTop: 14,
              marginBottom: 14,
              color: '#0f0a2a'
            }}
          >
            Questions fréquentes
          </h2>
          <p style={{ color: '#9490b8', fontSize: 16 }}>Tout ce que vous souhaitez savoir avant de nous contacter.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FAQS.map((f, i) => (
            <div
              key={i}
              style={{
                background: '#fff',
                borderRadius: 20,
                border: `1px solid ${open === i ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.1)'}`,
                overflow: 'hidden',
                boxShadow: open === i ? '0 8px 32px -8px rgba(91,33,182,0.12)' : 'none',
                transition: 'border-color 0.3s, box-shadow 0.3s'
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '22px 28px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span
                  style={{
                    fontFamily: 'Outfit',
                    fontWeight: 700,
                    fontSize: 16,
                    color: open === i ? '#7c3aed' : '#0f0a2a',
                    paddingRight: 20
                  }}
                >
                  {f.q}
                </span>
                <span
                  className={`faq-icon ${open === i ? 'open' : ''}`}
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: open === i ? 'linear-gradient(135deg,#7c3aed,#4338ca)' : '#ede9fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: open === i ? '#fff' : '#7c3aed',
                    fontSize: 20,
                    fontWeight: 300,
                    lineHeight: 1
                  }}
                >
                  +
                </span>
              </button>
              <div className={`acc-body ${open === i ? 'open' : ''}`}>
                <p style={{ padding: '0 28px 24px', color: '#9490b8', fontSize: 14, lineHeight: 1.75 }}>{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section style={{ background: '#fff', padding: '60px 32px 100px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            position: 'relative',
            borderRadius: 40,
            overflow: 'hidden',
            background: 'linear-gradient(140deg,#2e1065,#1e1b4b,#1e3a8a)',
            padding: '80px 48px',
            textAlign: 'center'
          }}
        >
          {/* Decorative blobs */}
          <div
            style={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse,rgba(139,92,246,0.35),transparent 70%)'
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -40,
              left: -40,
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse,rgba(99,102,241,0.3),transparent 70%)'
            }}
          />
          {/* Hex deco */}
          <div
            style={{
              position: 'absolute',
              top: 30,
              left: 60,
              width: 44,
              height: 48,
              opacity: 0.2,
              background: 'rgba(167,139,250,0.7)',
              clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)'
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 30,
              right: 80,
              width: 32,
              height: 36,
              opacity: 0.2,
              background: 'rgba(167,139,250,0.7)',
              clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)'
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.06,
              backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)',
              backgroundSize: '32px 32px'
            }}
          />

          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 40,
                padding: '8px 20px',
                marginBottom: 28,
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13,
                fontWeight: 500
              }}
            >
              Démo gratuite — sans engagement
            </div>

            <h2
              style={{
                fontSize: 'clamp(30px,5vw,58px)',
                fontWeight: 900,
                color: '#fff',
                marginBottom: 20,
                lineHeight: 1.1
              }}
            >
              Prêt à construire
              <br />
              <span
                style={{
                  background: 'linear-gradient(90deg,#c4b5fd,#93c5fd)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                quelque chose d'exceptionnel ?
              </span>
            </h2>
            <p
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 18,
                marginBottom: 44,
                maxWidth: 520,
                margin: '0 auto 44px',
                lineHeight: 1.7
              }}
            >
              Rejoignez 340+ équipes qui font confiance à Cod' Art pour concrétiser leurs projets web les plus
              ambitieux.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-primary" style={{ padding: '16px 40px', borderRadius: 16, fontSize: 17 }}>
                Démarrer maintenant →
              </button>
              <button
                style={{
                  padding: '16px 40px',
                  borderRadius: 16,
                  fontSize: 17,
                  fontWeight: 600,
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  background: 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'Outfit',
                  transition: 'background 0.2s'
                }}
                // onMouseEnter={(e) => (e.target.style.background = 'rgba(255,255,255,0.1)')}
                // onMouseLeave={(e) => (e.target.style.background = 'transparent')}
              >
                Nous contacter
              </button>
            </div>
            <div
              style={{
                marginTop: 28,
                display: 'flex',
                gap: 32,
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.35)',
                fontSize: 13
              }}
            >
              {['✓ Sans carte bancaire', '✓ Réponse en 24h', '✓ Expert dédié'].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const [email, setEmail] = useState('');
  return (
    <footer style={{ background: '#070417', color: '#fff', padding: '80px 32px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          className="footer-grid"
          style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 60 }}
        >
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div
                style={{
                  width: 38,
                  height: 40,
                  background: 'linear-gradient(135deg,#7c3aed,#4338ca)',
                  clipPath: 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ color: '#fff', fontFamily: 'Outfit', fontWeight: 900, fontSize: 16 }}>N</span>
              </div>
              <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 20 }}>Cod' Art</span>
            </div>
            <p
              style={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: 14,
                lineHeight: 1.75,
                marginBottom: 24,
                maxWidth: 280
              }}
            >
              Innovation web & intelligence artificielle. Nous construisons les produits digitaux de demain pour les
              entreprises d'aujourd'hui.
            </p>
            {/* Newsletter */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                placeholder="Votre email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 14,
                  color: '#fff'
                }}
              />
              <button className="btn-primary" style={{ padding: '10px 18px', borderRadius: 10, fontSize: 14 }}>
                →
              </button>
            </div>
          </div>

          {[
            {
              title: 'Solutions',
              links: ['Développement Web', 'Innovation IA', 'Architecture Cloud', 'UX & Design', 'API & Intégrations']
            },
            { title: 'Entreprise', links: ['À propos', 'Équipe', 'Carrières', 'Blog tech', 'Partenaires'] },
            {
              title: 'Contact',
              links: ["hello@Cod' Art.io", '+33 1 80 XX XX XX', 'Paris · Tunis', 'Antananarivo', 'Montréal']
            }
          ].map((col) => (
            <div key={col.title}>
              <h4
                style={{
                  fontFamily: 'Outfit',
                  fontWeight: 800,
                  fontSize: 13,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: 20
                }}
              >
                {col.title}
              </h4>
              <ul style={{ listStyle: 'none' }}>
                {col.links.map((l) => (
                  <li key={l} style={{ marginBottom: 10 }}>
                    <a
                      href="#"
                      style={{
                        color: 'rgba(255,255,255,0.35)',
                        fontSize: 14,
                        textDecoration: 'none',
                        transition: 'color 0.2s'
                      }}
                      // onMouseEnter={(e) => (e.target.style.color = '#a78bfa')}
                      // onMouseLeave={(e) => (e.target.style.color = 'rgba(255,255,255,0.35)')}
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: 28,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>© 2025 Cod' Art. Tous droits réservés.</span>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Twitter', 'LinkedIn', 'GitHub', 'Dribbble'].map((s) => (
              <a
                key={s}
                href="#"
                style={{
                  color: 'rgba(255,255,255,0.25)',
                  fontSize: 13,
                  textDecoration: 'none',
                  transition: 'color 0.2s'
                }}
                // onMouseEnter={(e) => (e.target.style.color = '#a78bfa')}
                // onMouseLeave={(e) => (e.target.style.color = 'rgba(255,255,255,0.25)')}
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── ROOT ─── */
export default function Index() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <Navbar scrolled={scrolled} />
      <Hero />
      <Services />
      <WhyUs />
      <Stats />
      <Team />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </>
  );
}
