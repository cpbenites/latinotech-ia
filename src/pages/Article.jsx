import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';

export default function Article() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArticle() {
      try {
        // Buscar primeiro pelo slug, com fallback para ID em notícias antigas
        let data;
        const articlesBySlug = await base44.entities.NewsArticle.filter({ slug: slug });
        if (articlesBySlug.length > 0) {
          data = articlesBySlug[0];
        } else {
          try {
            data = await base44.entities.NewsArticle.get(slug);
          } catch (e) {
             // Não encontrado nem por slug nem por ID
          }
        }
        setArticle(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchArticle();
  }, [slug]);

  if (loading) return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin"></div>
    </div>
  );
  if (!article) return <div className="p-12 text-center text-slate-500 font-bold text-2xl">Artículo no encontrado</div>;

  return (
    <article className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-10 text-center max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-green-600 font-bold text-xs uppercase tracking-widest">{article.category}</span>
          <span className="text-slate-300 text-xs">•</span>
          <span className="text-slate-500 text-xs font-medium">{format(new Date(article.published_date || article.created_date), "d 'de' MMMM, yyyy", { locale: es })}</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 leading-[1.1] text-slate-900">{article.title}</h1>
        <p className="text-xl text-slate-600 font-medium leading-relaxed">{article.summary}</p>
      </div>
      
      {article.image_url && (
        <div className="aspect-[21/9] bg-slate-100 overflow-hidden mb-12">
          <img src={article.image_url} alt={article.title} className="object-cover w-full h-full" />
        </div>
      )}
      
      <div className="max-w-2xl mx-auto">
        <div className="markdown-content text-lg text-slate-800">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>
        
        <div className="mt-16 pt-8 border-t border-slate-200 bg-slate-50 p-6 rounded-xl">
          <h3 className="text-xs font-black text-slate-900 mb-3 uppercase tracking-widest">Información Meta (SEO)</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {article.seo_keywords?.split(',').map((kw, i) => (
              <span key={i} className="bg-white border border-slate-200 text-slate-600 text-xs px-2 py-1 rounded">{kw.trim()}</span>
            ))}
          </div>
          {article.original_url && (
            <a href={article.original_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-green-600 hover:text-green-700 transition-colors inline-block">
              Ver noticia original en {article.source_name || 'la fuente'} &rarr;
            </a>
          )}
        </div>
      </div>
    </article>
  );
}