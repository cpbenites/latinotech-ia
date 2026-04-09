import React from 'react';

export default function Terms() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-black tracking-tight mb-8 text-slate-900">Términos de Uso</h1>
      <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-6">
        <p><strong>Última actualización:</strong> {new Date().toLocaleDateString('es-ES')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">1. Aceptación de los Términos</h2>
        <p>
          Al acceder y utilizar el sitio web <strong>LatinoTech IA</strong> (latinotechia.com), usted acepta cumplir y estar sujeto a estos Términos de Uso. 
          Si no está de acuerdo con alguna parte de estos términos, no debe utilizar nuestro sitio web.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">2. Naturaleza del Contenido</h2>
        <p>
          LatinoTech IA es un portal de noticias tecnológicas donde gran parte del contenido es generado, curado o reescrito 
          utilizando Inteligencia Artificial a partir de fuentes de terceros. Aunque nos esforzamos por mantener la información 
          precisa y actualizada, no garantizamos la exactitud, integridad o fiabilidad de la información presentada. 
          El uso de la información obtenida de este sitio es bajo su propio riesgo.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">3. Propiedad Intelectual</h2>
        <p>
          El diseño del sitio, la marca, los logotipos y el formato del contenido estructurado en LatinoTech IA son propiedad de 
          sus respectivos creadores. Los artículos publicados contienen enlaces a sus fuentes originales para dar el crédito correspondiente. 
          Si usted es el titular de los derechos de autor de algún contenido original y desea solicitar su eliminación, por favor 
          comuníquese con nosotros.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">4. Enlaces a Terceros</h2>
        <p>
          Nuestro Servicio puede contener enlaces a sitios web o servicios de terceros que no son propiedad ni están controlados 
          por LatinoTech IA. No tenemos control ni asumimos responsabilidad alguna por el contenido, las políticas de privacidad 
          o las prácticas de sitios web o servicios de terceros. Usted reconoce y acepta que LatinoTech IA no será responsable, 
          directa o indirectamente, de ningún daño o pérdida causada por o en conexión con el uso de dicho contenido o bienes 
          disponibles a través de dichos sitios web o servicios.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">5. Uso Aceptable</h2>
        <p>
          Usted se compromete a utilizar el sitio web únicamente con fines lícitos y de una manera que no infrinja los derechos 
          de, o restrinja o inhiba el uso y disfrute de este sitio web por parte de cualquier tercero. Queda terminantemente 
          prohibido extraer contenido de manera automatizada (scraping) sin nuestro consentimiento previo por escrito.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">6. Modificaciones de los Términos</h2>
        <p>
          Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en vigor 
          inmediatamente después de su publicación en el sitio web. Su uso continuado del sitio web después de cualquier modificación 
          constituye su aceptación de los nuevos términos.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4 text-slate-900">7. Limitación de Responsabilidad</h2>
        <p>
          En ningún caso LatinoTech IA, ni sus directores, empleados o afiliados, serán responsables de ningún daño indirecto, 
          incidental, especial, consecuente o punitivo, incluyendo, sin limitación, pérdida de beneficios, datos, uso, buena voluntad, 
          u otras pérdidas intangibles, resultantes de (i) su acceso o uso o incapacidad de acceder o usar el Servicio; (ii) 
          cualquier conducta o contenido de un tercero en el Servicio.
        </p>
      </div>
    </div>
  );
}