import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import CookieBanner from './CookieBanner';
import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

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
          <nav className="hidden md:flex gap-8 font-semibold text-sm text-slate-600">
            <Link to="/?category=IA" className="hover:text-green-600 transition-colors">IA</Link>
            <Link to="/?category=Startups" className="hover:text-green-600 transition-colors">Startups</Link>
            <Link to="/?category=Gadgets" className="hover:text-green-600 transition-colors">Gadgets</Link>
            <Link to="/?category=Software" className="hover:text-green-600 transition-colors">Software</Link>
            <Link to="/?category=Gaming" className="hover:text-green-600 transition-colors">Gaming</Link>
          </nav>
          <div className="flex items-center gap-4">
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