import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import ReactMarkdown from 'react-markdown';
import { Video, Loader2, Pencil, Check, X } from 'lucide-react';

export default function ArticleCard({ article, onApprove, onReject, onGenerateScript, generatingScriptId }) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState({
    title: article.title,
    summary: article.summary,
    content: article.content,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await base44.entities.NewsArticle.update(article.id, {
        title: draft.title,
        summary: draft.summary,
        content: draft.content,
      });
      // Update local article object so view mode shows the new text
      article.title = draft.title;
      article.summary = draft.summary;
      article.content = draft.content;
      setIsEditing(false);
      toast({ title: 'Alterações salvas', duration: 3000 });
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive', duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft({ title: article.title, summary: article.summary, content: article.content });
    setIsEditing(false);
  };

  return (
    <div className="bg-white border border-slate-200 p-8 flex flex-col md:flex-row gap-8 overflow-hidden">
      {article.image_url && (
        <div className="md:w-1/3 shrink-0">
          <img src={article.image_url} alt="" className="w-full object-cover aspect-video bg-slate-100" />
          <div className="mt-4 p-4 bg-slate-50 text-xs text-slate-600 font-mono">
            <strong>Palabras Clave SEO:</strong><br />
            {article.seo_keywords}
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-between items-start mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-green-600">{article.category} • {article.source_name}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">{format(new Date(article.created_date), 'dd/MM/yyyy HH:mm')}</span>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="ml-2 text-slate-400 hover:text-slate-700 transition-colors"
                title="Editar artigo"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <>
            <input
              className="text-2xl font-black tracking-tight mb-3 leading-tight w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            />
            <textarea
              className="text-base text-slate-600 font-medium mb-4 w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              rows={3}
              value={draft.summary}
              onChange={e => setDraft(d => ({ ...d, summary: e.target.value }))}
            />
            <textarea
              className="text-sm text-slate-700 font-mono mb-4 w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
              rows={16}
              value={draft.content}
              onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
            />
            <div className="flex gap-3 mb-4">
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 font-bold flex items-center gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Salvar alterações
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving} className="flex items-center gap-2">
                <X className="w-4 h-4" /> Cancelar
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-black tracking-tight mb-3 leading-tight break-words">{article.title}</h2>
            <p className="text-slate-600 font-medium mb-6 text-lg break-words">{article.summary}</p>
            <div className="markdown-content text-base text-slate-700 max-h-96 overflow-y-auto overflow-x-hidden mb-6 pr-6 leading-loose space-y-2 bg-slate-50/50 p-6 rounded-xl border border-slate-100 max-w-full [&_*]:max-w-full [&_*]:break-words [&_table]:block [&_table]:overflow-x-auto">
              <ReactMarkdown>{article.content}</ReactMarkdown>
            </div>
          </>
        )}

        <div className="sticky bottom-0 bg-white border-t border-slate-100 pt-4 pb-2 -mx-8 px-8 mt-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <a href={article.original_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-slate-400 hover:text-slate-800">
              Ver fuente original &rarr;
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onGenerateScript(article)}
              disabled={generatingScriptId === article.id}
              className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 font-bold flex items-center gap-2 shadow-sm"
            >
              {generatingScriptId === article.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
              {generatingScriptId === article.id ? 'Generando...' : 'Script Viral'}
            </Button>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" size="lg" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-bold" onClick={() => onReject(article.id)}>
              Descartar
            </Button>
            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white font-black shadow-lg shadow-green-600/30 px-8 transition-all hover:scale-105" onClick={() => onApprove(article.id)}>
              Aprobar y Publicar ✨
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}