import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import ReactMarkdown from 'react-markdown';
import { Navigate } from 'react-router-dom';
import { FileText, Rss, Video, Copy, Loader2 } from 'lucide-react';
import AudienceDashboard from '@/components/admin/AudienceDashboard';
import ArticleCard from '@/components/admin/ArticleCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pending'); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [pendingArticles, setPendingArticles] = useState([]);
  const [historyArticles, setHistoryArticles] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [visitorLogs, setVisitorLogs] = useState([]); // kept for fetchAudience compat
  const [newFeed, setNewFeed] = useState({ url: '', name: '', category: 'Tech' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [generatingScriptId, setGeneratingScriptId] = useState(null);

  const fetchPending = async () => {
    const data = await base44.entities.NewsArticle.filter({ status: 'pending' }, '-created_date');
    setPendingArticles(data);
  };

  const fetchHistory = async () => {
    const data = await base44.entities.NewsArticle.list('-updated_date', 100);
    setHistoryArticles(data.filter(a => a.status !== 'pending'));
  };

  const fetchFeeds = async () => {
    const data = await base44.entities.RssFeed.list();
    setFeeds(data);
  };

  const fetchAudience = async () => {
    const data = await base44.entities.VisitorLog.list('-access_date', 50);
    setVisitorLogs(data);
  };

  useEffect(() => {
    async function loadData() {
      if (user?.role === 'admin') {
        setIsLoading(true);
        try {
          await Promise.all([fetchPending(), fetchHistory(), fetchFeeds(), fetchAudience()]);
        } catch (error) {
          console.error("Error loading admin data:", error);
          toast({ title: "Error de red", description: "No se pudieron cargar algunos datos. Por favor, recargue la página.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      }
    }
    loadData();
  }, [user, toast]);

  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  if (isLoading) return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold tracking-tight">Cargando panel...</p>
      </div>
    </div>
  );

  const handleApprove = async (id) => {
    const article = pendingArticles.find(a => a.id === id);
    if (!article) return;

    // Get the correct base URL for the article
    let articlePath = `/noticia/${article.slug || id}`;
    if (article.language === 'pt') articlePath = `/br/noticia/${article.slug || id}`;
    if (article.language === 'en') articlePath = `/en/news/${article.slug || id}`;
    
    const absoluteUrl = `https://latinotechia.com${articlePath}`;

    // Update status
    await base44.entities.NewsArticle.update(id, { status: 'published', published_date: new Date().toISOString() });

    // Submit to Google Indexing API
    try {
      await base44.functions.invoke('submitToGoogleIndexing', { url: absoluteUrl, articleId: id });
    } catch (e) {
      console.warn('Google Indexing submission failed (non-critical):', e.message);
    }

    toast({ title: "Artículo publicado con éxito", duration: 4000 });
    fetchPending();
    fetchHistory();
  };

  const handleReject = async (id) => {
    await base44.entities.NewsArticle.update(id, { status: 'rejected' });
    toast({ title: "Artículo descartado", variant: "destructive", duration: 4000 });
    fetchPending();
    fetchHistory();
  };

  const handleApproveAll = async () => {
    if (!window.confirm(`¿Aprobar y publicar los ${pendingArticles.length} artículos pendientes?`)) return;
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      for (const a of pendingArticles) {
        await base44.entities.NewsArticle.update(a.id, { status: 'published', published_date: now });
        
        let articlePath = `/noticia/${a.slug || a.id}`;
        if (a.language === 'pt') articlePath = `/br/noticia/${a.slug || a.id}`;
        if (a.language === 'en') articlePath = `/en/news/${a.slug || a.id}`;
        const absoluteUrl = `https://latinotechia.com${articlePath}`;
        
        try {
          await base44.functions.invoke('submitToGoogleIndexing', { url: absoluteUrl, articleId: a.id });
        } catch (e) {
          console.warn('Google Indexing submission failed:', e.message);
        }
        await new Promise(res => setTimeout(res, 300));
      }
      toast({ title: `${pendingArticles.length} artículos publicados con éxito`, duration: 4000 });
      fetchPending();
      fetchHistory();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectAll = async () => {
    if (!window.confirm(`¿Descartar los ${pendingArticles.length} artículos pendientes?`)) return;
    setIsLoading(true);
    try {
      for (const a of pendingArticles) {
        await base44.entities.NewsArticle.update(a.id, { status: 'rejected' });
        await new Promise(res => setTimeout(res, 300));
      }
      toast({ title: `${pendingArticles.length} artículos descartados`, variant: "destructive", duration: 4000 });
      fetchPending();
      fetchHistory();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFeed = async () => {
    if(!newFeed.url || !newFeed.name) return toast({ title: "Faltan campos", variant: "destructive", duration: 4000 });
    await base44.entities.RssFeed.create(newFeed);
    setNewFeed({ url: '', name: '', category: 'Tech' });
    toast({ title: "Feed RSS añadido", duration: 4000 });
    fetchFeeds();
  };

  const handleGenerateScript = async (article) => {
    setGeneratingScriptId(article.id);
    try {
      const res = await base44.functions.invoke('generateVideoScript', {
        title: article.title,
        summary: article.summary,
        content: article.content
      });
      setGeneratedScript(res.data.script);
      setScriptModalOpen(true);
    } catch (e) {
      toast({ title: "Error al generar guion", description: e.message, variant: "destructive", duration: 4000 });
    } finally {
      setGeneratingScriptId(null);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedScript);
    toast({ title: "¡Copiado!", description: "Guion copiado al portapapeles.", duration: 3000 });
  };

  const runProcessFeeds = async () => {
    setIsProcessing(true);
    try {
      const res = await base44.functions.invoke('processFeeds', {});
      if (res.data?.processed === 0) {
        toast({ title: "Aviso", description: res.data.message || "No se generaron nuevos artículos (Límite alcanzado o sin noticias nuevas).", duration: 6000 });
      } else {
        toast({ title: "¡Generación completada!", description: "Los nuevos artículos ya están disponibles.", duration: 5000 });
      }
      fetchPending();
    } catch (e) {
      console.error("Erro no processFeeds:", e);
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 8000 });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="flex justify-between items-start mb-10 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Panel Editorial</h1>
          <p className="text-slate-500 mt-2 font-medium">Revisa y publica contenido generado por IA</p>
          <div className="flex gap-4 mt-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 flex items-center gap-4 shadow-sm">
              <div className="bg-orange-100 text-orange-600 p-2.5 rounded-lg">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Pendientes</p>
                <p className="text-2xl font-black leading-none mt-1 text-slate-900">{pendingArticles.length}</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 flex items-center gap-4 shadow-sm">
              <div className="bg-blue-100 text-blue-600 p-2.5 rounded-lg">
                <Rss className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Fuentes RSS</p>
                <p className="text-2xl font-black leading-none mt-1 text-slate-900">{feeds.length}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant={activeTab === 'pending' ? 'default' : 'outline'} onClick={() => setActiveTab('pending')} className={activeTab === 'pending' ? 'bg-slate-900' : ''}>
            Pendientes ({pendingArticles.length})
          </Button>
          <Button variant={activeTab === 'feeds' ? 'default' : 'outline'} onClick={() => setActiveTab('feeds')} className={activeTab === 'feeds' ? 'bg-slate-900' : ''}>
            Fuentes RSS
          </Button>
          <Button variant={activeTab === 'audience' ? 'default' : 'outline'} onClick={() => setActiveTab('audience')} className={activeTab === 'audience' ? 'bg-slate-900' : ''}>
            Audiencia
          </Button>
          <Button variant={activeTab === 'history' ? 'default' : 'outline'} onClick={() => setActiveTab('history')} className={activeTab === 'history' ? 'bg-slate-900' : ''}>
            Historial
          </Button>
          <Button onClick={runProcessFeeds} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 font-bold ml-4">
            {isProcessing ? '🤖 Generando...' : 'Generar Noticias Ahora'}
          </Button>
        </div>
      </div>

      {activeTab === 'pending' && (
        <div className="space-y-8">
          {pendingArticles.length > 0 && (
            <div className="flex justify-end gap-3 mb-4">
              <button onClick={handleRejectAll} className="text-sm text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2 rounded-lg font-medium">
                Descartar todos ({pendingArticles.length})
              </button>
              <button onClick={handleApproveAll} className="text-sm text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-bold shadow-sm">
                Aprobar todos ({pendingArticles.length})
              </button>
            </div>
          )}
          {pendingArticles.length === 0 ? (
             <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-12 text-center text-slate-500 font-medium">
               No hay artículos pendientes de revisión en este momento.
             </div>
          ) : pendingArticles.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              onApprove={handleApprove}
              onReject={handleReject}
              onGenerateScript={handleGenerateScript}
              generatingScriptId={generatingScriptId}
            />
          ))}
        </div>
      )}

      {activeTab === 'feeds' && (
        <div className="max-w-3xl">
          <div className="bg-slate-50 p-8 mb-10 border border-slate-200">
            <h3 className="text-xl font-black tracking-tight mb-6">Conectar Nueva Fuente RSS</h3>
            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <Input placeholder="Nombre (ej. The Verge)" value={newFeed.name} onChange={e => setNewFeed({...newFeed, name: e.target.value})} className="flex-1 bg-white" />
                <Select value={newFeed.category} onValueChange={v => setNewFeed({...newFeed, category: v})}>
                  <SelectTrigger className="w-1/3 bg-white font-medium"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IA">Inteligencia Artificial</SelectItem>
                    <SelectItem value="Gadgets">Gadgets</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Startups">Startups</SelectItem>
                    <SelectItem value="Gaming">Gaming</SelectItem>
                    <SelectItem value="Tech">General Tech</SelectItem>
                    <SelectItem value="Tutoriales">Tutoriales</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-4">
                <Input placeholder="URL del feed (ej. https://www.theverge.com/rss/index.xml)" value={newFeed.url} onChange={e => setNewFeed({...newFeed, url: e.target.value})} className="flex-1 bg-white" />
                <Button onClick={handleAddFeed} className="w-1/3 bg-slate-900 font-bold">Añadir Feed</Button>
              </div>
            </div>
          </div>
          
          <h3 className="text-xl font-black tracking-tight mb-6">Fuentes Activas</h3>
          <div className="grid gap-4">
            {feeds.map(feed => (
              <div key={feed.id} className="border border-slate-200 p-5 flex justify-between items-center bg-white">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-bold text-lg">{feed.name}</h4>
                    <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{feed.category}</span>
                  </div>
                  <p className="text-sm text-slate-500 font-mono">{feed.url}</p>
                </div>
                <Button variant={feed.is_active ? "outline" : "default"} size="sm" onClick={() => {
                  base44.entities.RssFeed.update(feed.id, { is_active: !feed.is_active }).then(fetchFeeds);
                }} className={!feed.is_active ? "bg-slate-800" : "text-slate-500"}>
                  {feed.is_active ? 'Pausar Lectura' : 'Activar Lectura'}
                </Button>
              </div>
            ))}
            {feeds.length === 0 && <p className="text-slate-500 font-medium">No hay fuentes configuradas.</p>}
          </div>
        </div>
      )}

      {activeTab === 'audience' && <AudienceDashboard />}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <h3 className="text-xl font-black tracking-tight mb-6">Historial de Artículos (Últimos 100)</h3>
          {historyArticles.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-12 text-center text-slate-500 font-medium">
              Aún no hay artículos publicados o descartados.
            </div>
          ) : (
            historyArticles.map(article => (
              <div key={article.id} className="bg-white border border-slate-200 p-5 rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 shadow-sm">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${article.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {article.status === 'published' ? 'Publicado' : 'Descartado'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">{article.language.toUpperCase()} • {article.category}</span>
                  </div>
                  <h4 className="font-bold text-lg text-slate-900 leading-tight">{article.title}</h4>
                  <p className="text-sm text-slate-500 mt-1">{format(new Date(article.updated_date || article.created_date), 'dd/MM/yyyy HH:mm')} - {article.source_name}</p>
                </div>
                {article.status === 'published' && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/${article.language === 'pt' ? 'br/' : article.language === 'en' ? 'en/' : ''}${article.language === 'en' ? 'news' : 'noticia'}/${article.slug}`} target="_blank" rel="noreferrer">
                      Ver Artículo
                    </a>
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <Dialog open={scriptModalOpen} onOpenChange={setScriptModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2 text-slate-900">
              <Video className="w-6 h-6 text-purple-600" /> Guion Viral Generado
            </DialogTitle>
          </DialogHeader>
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 my-4 max-h-[60vh] overflow-y-auto">
            <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium text-lg">
              {generatedScript}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setScriptModalOpen(false)} className="font-bold">Cerrar</Button>
            <Button onClick={copyToClipboard} className="bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center gap-2">
              <Copy className="w-4 h-4" /> Copiar Guion
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}