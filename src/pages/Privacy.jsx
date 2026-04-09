import React from 'react';

export default function Privacy() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-black tracking-tight mb-8 text-slate-900">Política de Privacidad</h1>
      <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-6">
        <p><strong>Última actualización:</strong> {new Date().toLocaleDateString('es-ES')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">1. Introducción</h2>
        <p>
          En <strong>LatinoTech IA</strong> (accesible desde latinotechia.com), la privacidad de nuestros visitantes es una de nuestras principales prioridades. 
          Este documento de Política de Privacidad contiene los tipos de información que es recopilada y registrada por LatinoTech IA y cómo la utilizamos.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">2. Información que Recopilamos</h2>
        <p>
          LatinoTech IA sigue un procedimiento estándar de uso de archivos de registro (log files). Estos archivos registran a los visitantes 
          cuando visitan sitios web. La información recopilada incluye direcciones de protocolo de Internet (IP), tipo de navegador, 
          Proveedor de Servicios de Internet (ISP), sello de fecha y hora, páginas de referencia/salida, y posiblemente el número de clics. 
          Estos no están vinculados a ninguna información que sea personalmente identificable.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">3. Cookies y Web Beacons</h2>
        <p>
          Como cualquier otro sitio web, LatinoTech IA utiliza "cookies". Estas cookies se utilizan para almacenar información, incluyendo 
          las preferencias de los visitantes y las páginas del sitio web a las que el visitante accedió o visitó. La información 
          se utiliza para optimizar la experiencia de los usuarios al personalizar el contenido de nuestra página web en función del 
          tipo de navegador de los visitantes y/o de otra información.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">4. Google DoubleClick DART Cookie (Google AdSense)</h2>
        <p>
          Google es uno de los proveedores de terceros en nuestro sitio. También utiliza cookies, conocidas como cookies DART, para mostrar 
          anuncios a los visitantes de nuestro sitio basándose en su visita a latinotechia.com y otros sitios en Internet. Sin embargo, los 
          visitantes pueden optar por rechazar el uso de cookies DART visitando la Política de Privacidad de la red de anuncios y contenido 
          de Google en la siguiente URL: <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer" className="text-green-600 hover:underline">https://policies.google.com/technologies/ads</a>
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">5. Políticas de Privacidad de Terceros</h2>
        <p>
          La Política de Privacidad de LatinoTech IA no se aplica a otros anunciantes o sitios web. Por lo tanto, le recomendamos que 
          consulte las Políticas de Privacidad respectivas de estos servidores de anuncios de terceros para obtener información más detallada. 
          Puede incluir sus prácticas e instrucciones sobre cómo darse de baja de ciertas opciones.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">6. Información Infantil</h2>
        <p>
          Otra parte de nuestra prioridad es añadir protección para los niños mientras utilizan Internet. Alentamos a los padres y tutores 
          a observar, participar y/o monitorear y guiar su actividad en línea. LatinoTech IA no recopila a sabiendas ninguna Información 
          Personal Identificable de niños menores de 13 años.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">7. Consentimiento</h2>
        <p>
          Al utilizar nuestro sitio web, usted acepta nuestra Política de Privacidad y está de acuerdo con sus términos.
        </p>
      </div>
    </div>
  );
}