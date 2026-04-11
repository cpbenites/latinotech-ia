import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import CookieBanner from './CookieBanner';
import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import SearchBar from '@/components/SearchBar';

const TelegramIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.415-1.21.226-1.838.165-.16 3.046-2.795 3.104-3.032.007-.029.015-.138-.048-.192-.062-.053-.153-.036-.219-.021-.093.021-1.579 1.01-4.464 2.951-.421.289-.803.432-1.144.423-.377-.01-1.103-.213-1.642-.423-.664-.26-1.19-.398-1.142-.84.025-.23.32-.464.887-.704 3.465-1.507 5.774-2.502 6.928-2.984 3.29-1.373 3.974-1.614 4.417-1.624z"/>
  </svg>
);

export default function MainLayout() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    async function trackVisitor() {
      // 1. Ignorar rotas Admin
      if (location.pathname.startsWith('/admin')) return;
      
      // 2. Ignorar Sessão de Administrador
      if (user?.role === 'admin') return;

      try {
        const logged = sessionStorage.getItem('tracked_visit');
        if (logged) return;
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        
        const hasConsent = localStorage.getItem('cookieConsent') === 'true';
        
        const log = await base44.entities.VisitorLog.create({
          ip_address: hasConsent ? (data.ip || 'Desconocido') : 'Oculto (Sin Consentimiento)',
          country: data.country_name || 'Desconocido',
          country_code: data.country_code || 'XX',
          city: data.city || 'Desconocido',
          access_date: new Date().toISOString(),
          user_agent: navigator.userAgent || 'Desconocido',
          is_bot: false,
          consent_given: hasConsent
        });
        
        sessionStorage.setItem('tracked_visit', 'true');
        sessionStorage.setItem('visitor_log_id', log.id);
      } catch (err) {
        console.error("Error tracking visitor", err);
      }
    }
    trackVisitor();
  }, [location.pathname, user]);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-2xl font-black tracking-tighter text-green-600">
            LatinoTech IA<span className="text-slate-900">.</span>
          </Link>
          <nav className="hidden lg:flex gap-6 font-semibold text-sm text-slate-600">
            <Link to="/?category=IA" className="hover:text-green-600 transition-colors">IA</Link>
            <Link to="/?category=Startups" className="hover:text-green-600 transition-colors">Startups</Link>
            <Link to="/?category=Gadgets" className="hover:text-green-600 transition-colors">Gadgets</Link>
            <Link to="/?category=Software" className="hover:text-green-600 transition-colors">Software</Link>
            <Link to="/?category=Gaming" className="hover:text-green-600 transition-colors">Gaming</Link>
            <Link to="/?category=Tutoriales" className="hover:text-green-600 transition-colors">Tutoriales</Link>
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden md:block mr-2">
              <SearchBar />
            </div>
            <a 
              href="https://t.me/latinotech" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-[#0088cc] transition-colors flex items-center justify-center w-9 h-9 rounded-full hover:bg-[#0088cc]/10"
              title="Únete a nuestro canal de Telegram"
            >
              <TelegramIcon className="w-5 h-5" />
            </a>
            {user?.role === 'admin' && (
              <Link to="/admin">
                <Button variant="ghost" size="sm" className="font-bold text-slate-800 hover:bg-slate-100">Panel Admin</Button>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-12 mt-12 bg-slate-50">
        <div className="container mx-auto px-4 text-center">
          <div className="mb-10">
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4">Comunidad</h4>
            <a 
              href="https://t.me/latinotech" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-white border border-slate-200 px-6 py-3 rounded-full text-slate-700 font-bold hover:text-[#0088cc] hover:border-[#0088cc]/30 hover:bg-[#0088cc]/5 transition-all shadow-sm hover:shadow-md"
            >
              <TelegramIcon className="w-5 h-5 text-[#0088cc]" />
              Únete a nuestro canal para noticias en tiempo real
            </a>
          </div>
          <p className="text-slate-500 text-sm font-medium mb-4">
            © {new Date().getFullYear()} LatinoTech IA. Noticias curadas e impulsadas por Inteligencia Artificial.
          </p>
          <div className="flex justify-center gap-6 text-xs text-slate-400">
            <Link to="/privacidad" className="hover:text-slate-600 transition-colors">Política de Privacidad</Link>
            <Link to="/terminos" className="hover:text-slate-600 transition-colors">Términos de Uso</Link>
          </div>
        </div>
      </footer>
      <CookieBanner />
    </div>
  );
}