import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, CheckCircle2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const translations = {
  pt: {
    title: 'Domine a Inteligência Artificial antes da concorrência.',
    sub: 'Junte-se a milhares de profissionais. Receba as 5 melhores notícias e ferramentas de IA da semana, diretamente na sua caixa de entrada.',
    placeholder: 'O seu e-mail...',
    btn: 'Inscrever-se 🚀',
    loading: 'A subscrever...',
    success: 'Obrigado por subscrever!',
    successSub: 'Adicionámos o seu e-mail à lista VIP. Em breve receberá as melhores notícias tecnológicas.',
    spam: 'Zero spam. Cancele a qualquer momento.',
    error: 'Ocorreu um erro. Tente novamente.',
  },
  es: {
    title: 'Domina la Inteligencia Artificial antes que tu competencia.',
    sub: 'Únete a miles de profesionales. Recibe las 5 mejores noticias y herramientas de IA de la semana, directamente en tu bandeja de entrada.',
    placeholder: 'Tu correo electrónico...',
    btn: 'Suscribirme 🚀',
    loading: 'Suscribiendo...',
    success: '¡Gracias por suscribirte!',
    successSub: 'Te hemos añadido a la lista VIP. Pronto recibirás las mejores noticias tecnológicas.',
    spam: 'Cero spam. Cancela tu suscripción en cualquier momento.',
    error: 'Ocurrió un error. Inténtalo de nuevo.',
  },
  en: {
    title: 'Master Artificial Intelligence before your competition.',
    sub: 'Join thousands of professionals. Get the 5 best AI news and tools of the week, straight to your inbox.',
    placeholder: 'Your email address...',
    btn: 'Subscribe 🚀',
    loading: 'Subscribing...',
    success: 'Thanks for subscribing!',
    successSub: "We added your email to the VIP list. You'll soon receive the best tech news.",
    spam: 'Zero spam. Unsubscribe at any time.',
    error: 'An error occurred. Please try again.',
  }
};

export default function NewsletterCTA({ lang }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const location = useLocation();

  const currentLang = lang || (location.pathname.startsWith('/br') ? 'pt' : location.pathname.startsWith('/en') ? 'en' : 'es');
  const copy = translations[currentLang] || translations['es'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    setMessage('');
    try {
      const response = await base44.functions.invoke('subscribeNewsletter', { email, language: currentLang });
      if (response.data.error) {
        setStatus('error');
        setMessage(response.data.error);
      } else {
        setStatus('success');
        setMessage(copy.success);
      }
    } catch (err) {
      setStatus('error');
      setMessage(copy.error);
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-slate-900 text-white rounded-2xl p-8 md:p-12 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-green-500/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-green-500/10 blur-3xl"></div>
        <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-2">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-3xl font-black tracking-tight">{message}</h3>
          <p className="text-slate-300 font-medium max-w-md mx-auto">{copy.successSub}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-green-500/10 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-green-500/10 blur-3xl"></div>
      <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h3 className="text-3xl md:text-4xl font-black tracking-tight mb-3 leading-tight">{copy.title}</h3>
          <p className="text-slate-300 font-medium text-base leading-relaxed">{copy.sub}</p>
        </div>
        <div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                type="email"
                placeholder={copy.placeholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11 h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-green-500 focus-visible:border-green-500 rounded-xl"
                required
              />
            </div>
            <Button
              type="submit"
              className="h-12 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl w-full text-base transition-colors"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? copy.loading : copy.btn}
            </Button>
            {status === 'error' && (
              <p className="text-red-400 text-sm font-medium mt-1 text-center">{message}</p>
            )}
          </form>
          <p className="text-slate-500 text-xs text-center mt-4">{copy.spam}</p>
        </div>
      </div>
    </div>
  );
}