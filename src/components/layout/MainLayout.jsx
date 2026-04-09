import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';

export default function MainLayout() {
  const { user } = useAuth();
  
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
        <div className="container mx-auto px-4 text-center text-slate-500 text-sm font-medium">
          <p>© {new Date().getFullYear()} LatinoTech IA. Contenido generado con IA.</p>
        </div>
      </footer>
    </div>
  );
}