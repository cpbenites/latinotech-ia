import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'true');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'false');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-4 shadow-2xl z-[100] flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="text-sm">
        <p className="font-bold mb-1">Usamos cookies 🍪</p>
        <p className="text-slate-300">Utilizamos cookies para mejorar su experiencia, analizar el tráfico y mostrar anuncios relevantes. Al continuar, acepta nuestro uso de cookies.</p>
      </div>
      <div className="flex gap-3 shrink-0">
        <Button variant="outline" className="text-slate-900 border-white hover:bg-slate-200 bg-white" onClick={handleDecline}>Configurar / Rechazar</Button>
        <Button className="bg-green-600 hover:bg-green-700 text-white font-bold border-none" onClick={handleAccept}>Aceptar Todas</Button>
      </div>
    </div>
  );
}