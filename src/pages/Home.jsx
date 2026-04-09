import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const ITEMS_PER_PAGE = 12;

  const handleHoneypot = async (e) => {
    if (e.target.value) {
      const logId = sessionStorage.getItem('visitor_log_id');
      if (logId) {
        try {
          await base44.entities.VisitorLog.update(logId, { is_bot: true });
        } catch (err) {
          console.error("Error updating honeypot status");
        }
      }
    }
  };

  useEffect(() => {
    async function fetchArticles() {
      setLoading(true);
      try {
        const filter = { status: 'published' };
        if (category) filter.category = category;
        
        const skip = (page - 1) * ITEMS_PER_PAGE;
        const data = await base44.entities.NewsArticle.filter(filter, '-published_date', ITEMS_PER_PAGE, skip);
        
        const allData = await base44.entities.NewsArticle.filter(filter, '-published_date', 5000);
        setTotalCount(allData.length);
        
        console.log('Artigos recebidos:', data);
        setArticles(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, [category, page]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
    window.scrollTo(0, 0);
  };

  if (loading) return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin"></div>
    </div>
  );

  const featured = (page === 1 && !category) ? articles[0] : null;
  const gridArticles = (page === 1 && !category) ? articles.slice(1) : articles;

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      {/* Honeypot field for bot detection */}
      <input type="text" name="website_url" style={{display: 'none'}} tabIndex="-1" autoComplete="off" onChange={handleHoneypot} aria-hidden="true" />
      
      {category && (
        <div className="flex items-center gap-4 mb-12 border-b border-slate-200 pb-4">
          <h1 className="text-4xl font-black tracking-tight capitalize text-slate-900">{category}</h1>
          <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
            {totalCount} Artículos
          </span>
        </div>
      )}
      
      {!category && featured && (
        <Link to={`/noticia/${featured.slug || featured.id}`} className="block mb-16 group">
          <div className="grid md:grid-cols-5 gap-8 items-center">
            <div className="md:col-span-3 aspect-[16/10] bg-slate-100 overflow-hidden relative">
              {featured.image_url ? (
                <img src={featured.image_url} alt={featured.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700 ease-out" />
              ) : (
                <div className="w-full h-full bg-slate-200"></div>
              )}
            </div>
            <div className="md:col-span-2 pr-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-green-600 font-bold text-xs uppercase tracking-widest">{featured.category}</span>
                <span className="text-slate-300 text-xs">•</span>
                <span className="text-slate-500 text-xs font-medium">{format(new Date(featured.published_date || featured.created_date), "d MMM yyyy", { locale: es })}</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 group-hover:text-green-600 transition-colors leading-[1.1]">{featured.title}</h2>
              <p className="text-lg text-slate-600 line-clamp-3 leading-relaxed">{featured.summary}</p>
            </div>
          </div>
        </Link>
      )}

      {gridArticles.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10 border-t border-slate-200 pt-12">
          {gridArticles.map(article => (
            <Link key={article.id} to={`/noticia/${article.slug || article.id}`} className="group flex flex-col">
              <div className="aspect-video bg-slate-100 overflow-hidden mb-5 relative">
                {article.image_url ? (
                  <img src={article.image_url} alt={article.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out" />
                ) : (
                  <div className="w-full h-full bg-slate-200"></div>
                )}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-600 font-bold text-[10px] uppercase tracking-widest">{article.category}</span>
                <span className="text-slate-300 text-[10px]">•</span>
                <span className="text-slate-500 text-[10px] font-medium">{format(new Date(article.published_date || article.created_date), "d MMM", { locale: es })}</span>
              </div>
              <h3 className="text-xl font-black tracking-tight mb-3 group-hover:text-green-600 transition-colors leading-snug">{article.title}</h3>
              <p className="text-sm text-slate-600 line-clamp-2 mt-auto leading-relaxed">{article.summary}</p>
            </Link>
          ))}
        </div>
      )}
      
      {articles.length === 0 && (
        <div className="text-center py-20">
          <p className="text-2xl font-bold tracking-tight text-slate-400 mb-2">Aún no hay noticias.</p>
          <p className="text-slate-500">Los artículos publicados aparecerán aquí.</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-12 pb-8 border-t border-slate-200 mt-12">
          <button 
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="px-4 py-2 border border-slate-200 rounded-md font-bold text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            &lt; Anterior
          </button>
          <span className="text-sm font-medium text-slate-500">
            Página {page} de {totalPages}
          </span>
          <button 
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className="px-4 py-2 border border-slate-200 rounded-md font-bold text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Próxima &gt;
          </button>
        </div>
      )}
    </div>
  );
}