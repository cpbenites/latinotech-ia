import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams, useParams, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { es, ptBR, enUS } from 'date-fns/locale';

// LAZY LOADING AGRESSIVO
const SmoothImage = ({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isInView) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px' });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [isInView]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full">
      {!isLoaded && <div className="absolute inset-0 bg-slate-200 animate-pulse z-0"></div>}
      {isInView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          fetchPriority="low"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} relative z-10 transition-opacity duration-700 ease-in-out w-full h-full object-cover`}
        />
      )}
    </div>
  );
};

export default function Category() {
  const [articles, setArticles] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useParams();
  const categoryId = routeParams.id;
  const location = useLocation();
  
  const currentLang = location.pathname.includes('/br') ? 'pt' : location.pathname.includes('/en') ? 'en' : 'es';
  const currentLocale = currentLang === 'pt' ? ptBR : currentLang === 'en' ? enUS : es;
  const langPrefix = currentLang === 'pt' ? '/br' : currentLang === 'en' ? '/en' : '';
  
  const category = categoryId;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const ITEMS_PER_PAGE = 13;

  const handleHoneypot = async (e) => {
    if (e.target.value) {
      const logId = sessionStorage.getItem('visitor_log_id');
      if (logId) {
        try {
          await base44.entities.VisitorLog.update(logId, { is_bot: true });
        } catch (err) {}
      }
    }
  };

  useEffect(() => {
    async function fetchArticles() {
      setLoading(true);
      try {
        const allPublished = await base44.entities.NewsArticle.filter({ status: 'published', language: currentLang }, '-published_date', 5000);
        
        const filteredByCategory = categoryId 
          ? allPublished.filter(article => article.category && article.category.toLowerCase() === categoryId.toLowerCase())
          : allPublished;
          
        setTotalCount(filteredByCategory.length);
        
        const skip = (page - 1) * ITEMS_PER_PAGE;
        const paginatedData = filteredByCategory.slice(skip, skip + ITEMS_PER_PAGE);
        
        setArticles(paginatedData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, [category, page, currentLang, categoryId]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
    window.scrollTo(0, 0);
  };

  if (loading) return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="text-center py-20 text-slate-400">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
        {currentLang === 'pt' ? 'Carregando...' : currentLang === 'en' ? 'Loading...' : 'Cargando...'}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <input type="text" name="website_url" style={{display: 'none'}} tabIndex="-1" autoComplete="off" onChange={handleHoneypot} aria-hidden="true" />
      
      <div className="flex items-center gap-4 mb-12 border-b border-slate-200 pb-4">
        <h1 className="text-4xl font-black tracking-tight capitalize text-slate-900">{category}</h1>
        <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
          {totalCount} {currentLang === 'pt' ? 'Artigos' : currentLang === 'en' ? 'Articles' : 'Artículos'}
        </span>
      </div>

      {articles.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10 border-t border-slate-200 pt-12">
          {articles.slice(0, 12).map(article => (
            <Link key={article.id} to={`${langPrefix}/noticia/${article.slug || article.id}`} className="group flex flex-col content-auto">
              <div className="aspect-video bg-slate-100 overflow-hidden mb-5 relative rounded-xl">
                {article.image_url ? (
                  <SmoothImage src={article.image_url} alt={article.title} className="group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 bg-slate-200"></div>
                )}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-600 font-bold text-[10px] uppercase tracking-widest">{article.category}</span>
                <span className="text-slate-300 text-[10px]">•</span>
                <span className="text-slate-500 text-[10px] font-medium">{format(new Date(article.published_date || article.created_date), "d MMM", { locale: currentLocale })}</span>
              </div>
              <h3 className="text-xl font-black tracking-tight mb-3 group-hover:text-green-600 transition-colors leading-snug">{article.title}</h3>
              <p className="text-sm text-slate-600 line-clamp-2 mt-auto leading-relaxed">{article.summary}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-2xl font-bold tracking-tight text-slate-400 mb-2">
            {currentLang === 'pt' ? 'Ainda não há notícias nesta categoria.' : currentLang === 'en' ? 'No news in this category yet.' : 'Aún no hay noticias en esta categoría.'}
          </p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-12 pb-8 border-t border-slate-200 mt-12">
          <button 
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="px-4 py-2 border border-slate-200 rounded-md font-bold text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            &lt; {currentLang === 'pt' ? 'Anterior' : currentLang === 'en' ? 'Prev' : 'Anterior'}
          </button>
          <span className="text-sm font-medium text-slate-500">
            {currentLang === 'pt' ? 'Página' : currentLang === 'en' ? 'Page' : 'Página'} {page} / {totalPages}
          </span>
          <button 
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className="px-4 py-2 border border-slate-200 rounded-md font-bold text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {currentLang === 'pt' ? 'Próxima' : currentLang === 'en' ? 'Next' : 'Próxima'} &gt;
          </button>
        </div>
      )}
    </div>
  );
}