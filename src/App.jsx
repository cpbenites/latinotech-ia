import React, { Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import MainLayout from '@/components/layout/MainLayout';

const Home = React.lazy(() => import('@/pages/Home'));
const Category = React.lazy(() => import('@/pages/Category'));
const Article = React.lazy(() => import('@/pages/Article'));
const Admin = React.lazy(() => import('@/pages/Admin'));
const AffiliateAdmin = React.lazy(() => import('@/pages/AffiliateAdmin'));
const Privacy = React.lazy(() => import('@/pages/Privacy'));
const Terms = React.lazy(() => import('@/pages/Terms'));
const PageNotFound = React.lazy(() => import('./lib/PageNotFound'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Rotas ES (Padrão) */}
          <Route path="/" element={<Home lang="es" />} />
          <Route path="/categoria/:id" element={<Category lang="es" />} />
          <Route path="/noticia/:slug" element={<Article />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/afiliados" element={<AffiliateAdmin />} />
          <Route path="/privacidad" element={<Privacy />} />
          <Route path="/terminos" element={<Terms />} />

          {/* Rotas PT-BR */}
          <Route path="/br" element={<Home lang="pt" />} />
          <Route path="/br/categoria/:id" element={<Category lang="pt" />} />
          <Route path="/br/noticia/:slug" element={<Article />} />
          <Route path="/br/admin" element={<Admin />} />
          <Route path="/br/afiliados" element={<AffiliateAdmin />} />
          <Route path="/br/privacidad" element={<Privacy />} />
          <Route path="/br/terminos" element={<Terms />} />

          {/* Rotas EN */}
          <Route path="/en" element={<Home lang="en" />} />
          <Route path="/en/categoria/:id" element={<Category lang="en" />} />
          <Route path="/en/news/:slug" element={<Article />} />
          <Route path="/en/admin" element={<Admin />} />
          <Route path="/en/afiliados" element={<AffiliateAdmin />} />
          <Route path="/en/privacidad" element={<Privacy />} />
          <Route path="/en/terminos" element={<Terms />} />
        </Route>
        {/* Redirects para rotas base sem slug detetadas pelo Google */}
        <Route path="/Article" element={<Navigate to="/" replace />} />
        <Route path="/Article/*" element={<Navigate to="/" replace />} />
        <Route path="/Privacy" element={<Navigate to="/privacidad" replace />} />
        <Route path="/Terms" element={<Navigate to="/terminos" replace />} />
        <Route path="/Category" element={<Navigate to="/" replace />} />
        <Route path="/category" element={<Navigate to="/" replace />} />
        <Route path="/Category/*" element={<Navigate to="/" replace />} />
        <Route path="/category/*" element={<Navigate to="/" replace />} />
        <Route path="/noticia" element={<Navigate to="/" replace />} />
        <Route path="/news" element={<Navigate to="/" replace />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App;