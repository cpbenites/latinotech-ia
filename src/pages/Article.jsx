import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useParams, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import NewsletterCTA from '@/components/NewsletterCTA';
import { Copy, Check } from 'lucide-react';
import ShareButtons from '@/components/ShareButtons';

const PreBlock = ({ children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);

  const handleCopy = () => {
    if (codeRef.current) {
      navigator.clipboard.writeText(codeRef.current.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group my-8">
      <button
        onClick={handleCopy}
        className="absolute right-3 top-3 bg-slate-800/80 backdrop-blur-sm text-slate-300 hover:bg-slate-700 hover:text-white px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 z-10"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-400">Copiado!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            Copiar
          </>
        )}
      </button>
      <pre
        ref={codeRef}
        className="bg-slate-900 text-slate-100 p-6 pt-14 md:pt-6 rounded-xl overflow-x-auto text-sm font-mono border border-slate-800 leading-relaxed"
        {...props}
      >
        {children}
      </pre>
    </div>
  );
};

const BlockquoteBlock = ({ children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const textRef = useRef(null);

  const handleCopy = () => {
    if (textRef.current) {
      navigator.clipboard.writeText(textRef.current.innerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group my-8">
      <button
        onClick={handleCopy}
        className="absolute right-3 top-3 bg-white/80 backdrop-blur-sm text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-800 px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 z-10"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-green-600" />
            <span className="text-green-600">Copiado!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            Copiar
          </>
        )}
      </button>
      <blockquote
        ref={textRef}
        className="bg-slate-50 border-l-4 border-green-500 text-slate-700 p-6 pt-12 md:pt-6 rounded-r-xl text-lg italic font-medium leading-relaxed shadow-sm"
        {...props}
      >
        {children}
      </blockquote>
    </div>
  );
};

const isPromptText = (children) => {
  const extractText = (nodes) => {
    let text = '';
    React.Children.forEach(nodes, node => {
      if (typeof node === 'string' || typeof node === 'number') {
        text += node;
      } else if (React.isValidElement(node) && node.props && node.props.children) {
        text += extractText(node.props.children);
      }
    });
    return text;
  };
  
  const text = extractText(children).toLowerCase();
  
  return text.includes('prompt');
};

const PromptCard = ({ children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef(null);

  const handleCopy = () => {
    if (cardRef.current) {
      navigator.clipboard.writeText(cardRef.current.innerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <li className="bg-gray-900 text-gray-200 p-6 rounded-xl my-5 relative text-left w-full font-sans leading-relaxed shadow-lg pr-24 list-none group" {...props}>
      <button
        onClick={handleCopy}
        className="absolute right-3 top-3 bg-slate-800/80 backdrop-blur-sm text-slate-300 hover:bg-slate-700 hover:text-white px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 z-10"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-400">Copiado!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            Copiar
          </>
        )}
      </button>
      <div ref={cardRef} className="[&>p:first-child]:mt-0 [&>*:first-child]:mt-0">
        {children}
      </div>
    </li>
  );
};

const ParagraphBlock = ({ children, ...props }) => {
  return <p {...props}>{children}</p>;
};

const ListItemBlock = ({ children, ...props }) => {
  if (isPromptText(children)) {
    return <PromptCard {...props}>{children}</PromptCard>;
  }
  return <li {...props}>{children}</li>;
};

export default function Article() {
  const { slug } = useParams();
  const location = useLocation();
  const isPt = location.pathname.includes('/br');
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

  useEffect(() => {
    if (article) {
      document.title = `${article.title} - LatinoTech IA`;
      
      const setMetaTag = (selector, attribute, value) => {
        let element = document.querySelector(selector);
        if (!element) {
          element = document.createElement('meta');
          if (selector.includes('property=')) {
            element.setAttribute('property', selector.match(/property="([^"]+)"/)[1]);
          } else if (selector.includes('name=')) {
            element.setAttribute('name', selector.match(/name="([^"]+)"/)[1]);
          }
          document.head.appendChild(element);
        }
        element.setAttribute(attribute, value);
      };

      setMetaTag('meta[property="og:title"]', 'content', article.title);
      setMetaTag('meta[property="og:image"]', 'content', article.image_url || '');
      setMetaTag('meta[property="og:url"]', 'content', window.location.href);
      setMetaTag('meta[property="og:type"]', 'content', 'article');
      setMetaTag('meta[name="twitter:card"]', 'content', 'summary_large_image');
      setMetaTag('meta[name="twitter:image"]', 'content', article.image_url || '');
      setMetaTag('meta[name="twitter:title"]', 'content', article.title);
    }
  }, [article]);

  if (loading) return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin"></div>
    </div>
  );
  if (!article) return <div className="p-12 text-center text-slate-500 font-bold text-2xl">Artículo no encontrado</div>;

  return (
    <article className="container mx-auto px-4 py-12 max-w-4xl relative">
      
      <div className="absolute left-0 top-12 -ml-16 hidden xl:block">
        <ShareButtons title={article.title} isSticky={true} />
      </div>

      <div className="mb-10 text-center max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-green-600 font-bold text-xs uppercase tracking-widest">{article.category}</span>
          <span className="text-slate-300 text-xs">•</span>
          <span className="text-slate-500 text-xs font-medium">{format(new Date(article.published_date || article.created_date), "d 'de' MMMM, yyyy", { locale: es })}</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 leading-[1.1] text-slate-900">{article.title}</h1>
        <p className="text-xl text-slate-600 font-medium leading-relaxed">{article.summary}</p>
        
        <div className="mt-8 flex justify-center xl:hidden">
          <ShareButtons title={article.title} />
        </div>
      </div>
      
      {article.image_url && (
        <div className="aspect-[21/9] bg-slate-100 overflow-hidden mb-12">
          <img src={article.image_url} alt={article.title} className="object-cover w-full h-full" />
        </div>
      )}
      
      <div className="max-w-2xl mx-auto">
        <div className="markdown-content text-lg text-slate-800">
          <ReactMarkdown
            components={{
              pre: PreBlock,
              blockquote: BlockquoteBlock,
              p: ParagraphBlock,
              li: ListItemBlock,
              code({node, inline, className, children, ...props}) {
                return !inline ? (
                  <code className={className} {...props}>
                    {children}
                  </code>
                ) : (
                  <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded-md font-mono text-[0.9em]" {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {article.content}
          </ReactMarkdown>
        </div>
        
        <div className="mt-16 pt-8 border-t border-slate-200 bg-slate-50 p-6 rounded-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
            <div>
              <h3 className="text-xs font-black text-slate-900 mb-3 uppercase tracking-widest">{isPt ? 'INFORMAÇÕES META (SEO)' : 'INFORMACIÓN META (SEO)'}</h3>
              <div className="flex flex-wrap gap-2">
                {article.seo_keywords?.split(',').map((kw, i) => (
                  <span key={i} className="bg-white border border-slate-200 text-slate-600 text-xs px-2 py-1 rounded">{kw.trim()}</span>
                ))}
              </div>
            </div>
            <div className="shrink-0">
              <h3 className="text-xs font-black text-slate-900 mb-3 uppercase tracking-widest">{isPt ? 'PARTILHAR ARTIGO' : 'COMPARTIR ARTÍCULO'}</h3>
              <ShareButtons title={article.title} />
            </div>
          </div>
          {article.original_url && (
            <a href={article.original_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-green-600 hover:text-green-700 transition-colors inline-block">
              {isPt ? 'Ver notícia original no' : 'Ver noticia original en'} {article.source_name || (isPt ? 'fonte' : 'la fuente')} &rarr;
            </a>
          )}
        </div>

        <div className="mt-12 mb-8">
          <NewsletterCTA />
        </div>
      </div>
    </article>
  );
}