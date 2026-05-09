import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Video, Loader2, Eye, Code } from 'lucide-react';

export default function ArticleEditor({ article, onApprove, onReject, onGenerateScript, generatingScriptId }) {
  const [content, setContent] = useState(article.content || '');
  const [title, setTitle] = useState(article.title || '');
  const [summary, setSummary] = useState(article.summary || '');
  const [mobileTab, setMobileTab] = useState('editor'); // 'editor' | 'preview'

  const handleApprove = () => {
    onApprove(article.id, { title, summary, content });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          {article.image_url && (
            <img src={article.image_url} alt="" className="w-16 h-10 object-cover rounded-md shrink-0" />
          )}
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-green-600">{article.category} • {article.source_name}</span>
            <p className="text-xs text-slate-400 font-medium">{format(new Date(article.created_date), 'dd/MM/yyyy HH:mm')}</p>
          </div>
        </div>
        {/* Mobile tab toggle */}
        <div className="flex md:hidden gap-2">
          <button
            onClick={() => setMobileTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${mobileTab === 'editor' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            <Code className="w-3.5 h-3.5" /> Editor
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${mobileTab === 'preview' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
        </div>
      </div>

      {/* Editable meta fields */}
      <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-col gap-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full text-xl font-black tracking-tight border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Título..."
        />
        <input
          value={summary}
          onChange={e => setSummary(e.target.value)}
          className="w-full text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Resumo..."
        />
      </div>

      {/* Split view */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200" style={{ minHeight: '400px', maxHeight: '520px' }}>

        {/* Editor pane */}
        <div className={`flex flex-col ${mobileTab === 'preview' ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-4 py-2 bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <Code className="w-3 h-3" /> Editor Markdown
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="flex-1 w-full p-4 font-mono text-sm text-slate-800 bg-slate-900 text-green-300 resize-none focus:outline-none leading-relaxed"
            style={{ minHeight: '360px' }}
            spellCheck={false}
          />
        </div>

        {/* Preview pane */}
        <div className={`flex flex-col ${mobileTab === 'editor' ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-4 py-2 bg-white border-b border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <Eye className="w-3 h-3" /> Preview em Tempo Real
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5">
            <div className="markdown-content text-sm text-slate-700 leading-relaxed space-y-2 [&_*]:max-w-full [&_*]:break-words [&_table]:block [&_table]:overflow-x-auto">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          <a href={article.original_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-slate-400 hover:text-slate-800">
            Ver fonte original →
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onGenerateScript(article)}
            disabled={generatingScriptId === article.id}
            className="border-purple-200 text-purple-700 hover:bg-purple-50 font-bold flex items-center gap-2"
          >
            {generatingScriptId === article.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
            {generatingScriptId === article.id ? 'Generando...' : 'Script Viral'}
          </Button>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="text-red-600 border-red-200 hover:bg-red-50 font-bold"
            onClick={() => onReject(article.id)}
          >
            Descartar
          </Button>
          <Button
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white font-black shadow-lg shadow-green-600/30 px-8"
            onClick={handleApprove}
          >
            Aprovar e Publicar ✨
          </Button>
        </div>
      </div>
    </div>
  );
}