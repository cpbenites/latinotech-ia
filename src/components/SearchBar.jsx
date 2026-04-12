import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import debounce from 'lodash/debounce';

export default function SearchBar({ lang = 'es' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const performSearch = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    try {
      const data = await base44.entities.NewsArticle.filter({ status: 'published', language: lang }, '-published_date', 300);
      const lowerTerm = searchTerm.toLowerCase();
      
      const filtered = data.filter(article => 
        (article.title && article.title.toLowerCase().includes(lowerTerm)) || 
        (article.summary && article.summary.toLowerCase().includes(lowerTerm))
      );
      
      setResults(filtered.slice(0, 6));
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce((searchTerm) => {
      performSearch(searchTerm);
    }, 400),
    []
  );

  useEffect(() => {
    if (query) {
      setIsSearching(true);
      debouncedSearch(query);
    } else {
      setResults([]);
      setIsSearching(false);
      debouncedSearch.cancel();
    }
  }, [query, debouncedSearch]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    debouncedSearch.cancel();
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xs xl:max-w-sm">
      <div className="relative flex items-center">
        <div className="absolute left-3 text-slate-400">
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-green-600" /> : <Search className="w-4 h-4" />}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query && setIsOpen(true)}
          placeholder="Buscar noticias..."
          className="w-full bg-slate-100 border border-slate-200 rounded-full py-2 pl-10 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors bg-slate-200 hover:bg-slate-300 rounded-full p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {isOpen && query && (
        <div className="absolute top-full mt-2 w-full sm:w-[400px] right-0 md:left-0 md:right-auto bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
          {isSearching ? (
            <div className="p-8 flex justify-center items-center gap-3 text-sm text-slate-500 font-bold tracking-tight">
               <Loader2 className="w-5 h-5 animate-spin text-green-600" /> Buscando...
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-[60vh] overflow-y-auto">
              {results.map((article) => (
                <Link
                  key={article.id}
                  to={`${lang === 'pt' ? '/br' : ''}/noticia/${article.slug || article.id}`}
                  onClick={() => {
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="block p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0"
                >
                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest block mb-1.5">
                    {article.category}
                  </span>
                  <h4 className="text-sm font-black text-slate-900 leading-snug mb-1.5 line-clamp-2">
                    {article.title}
                  </h4>
                  <p className="text-xs text-slate-500 line-clamp-1 font-medium">
                    {article.summary}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50/50">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">
                No se encontraron noticias para <br/><span className="font-black text-slate-800 text-base mt-1 block">"{query}"</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}