import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm/index.js';
import { Navigate } from 'react-router-dom';
import { FileText, Rss, Video, Copy, Loader2 } from 'lucide-react';
import AudienceDashboard from '@/components/admin/AudienceDashboard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pending'); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [pendingArticles, setPendingArticles] = useState([]);
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
          await Promise.all([fetchPending(), fetchFeeds(), fetchAudience()]);
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
    await base44.entities.NewsArticle.update(id, { status: 'published', published_date: new Date().toISOString() });
    toast({ title: "Artículo publicado con éxito", duration: 4000 });
    fetchPending();
  };

  const handleReject = async (id) => {
    await base44.entities.NewsArticle.update(id, { status: 'rejected' });
    toast({ title: "Artículo descartado", variant: "destructive", duration: 4000 });
    fetchPending();
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
      await base44.functions.invoke('processFeeds', {});
      toast({ title: "🤖 Geração iniciada!", description: "O artigo está sendo processado em background. Aguarde 2-3 minutos e recarregue os pendentes.", duration: 8000 });
      // Recarrega pendentes após 3 minutos automaticamente
      setTimeout(() => fetchPending(), 3 * 60 * 1000);
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
          <Button onClick={runProcessFeeds} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 font-bold ml-4">
            {isProcessing ? '🤖 Generando...' : 'Generar Noticias Ahora'}
          </Button>
        </div>
      </div>

      {activeTab === 'pending' && (
        <div className="space-y-8">
          {pendingArticles.length === 0 ? (
             <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-12 text-center text-slate-500 font-medium">
               No hay artículos pendientes de revisión en este momento.
             </div>
          ) : pendingArticles.map(article => (
            <div key={article.id} className="bg-white border border-slate-200 p-8 flex flex-col md:flex-row gap-8 overflow-hidden">
              {article.image_url && (
                <div className="md:w-1/3 shrink-0">
                  <img src={article.image_url} alt="" className="w-full object-cover aspect-video bg-slate-100" />
                  <div className="mt-4 p-4 bg-slate-50 text-xs text-slate-600 font-mono">
                    <strong>Palabras Clave SEO:</strong><br/>
                    {article.seo_keywords}
                  </div>
                </div>
              )}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-green-600">{article.category} • {article.source_name}</span>
                  <span className="text-xs font-medium text-slate-400">{format(new Date(article.created_date), 'dd/MM/yyyy HH:mm')}</span>
                </div>
                <h2 className="text-3xl font-black tracking-tight mb-3 leading-tight break-words">{article.title}</h2>
                <p className="text-slate-600 font-medium mb-6 text-lg break-words">{article.summary}</p>
                <div className="markdown-content text-base text-slate-700 max-h-96 overflow-y-auto overflow-x-hidden mb-6 pr-6 leading-loose space-y-2 bg-slate-50/50 p-6 rounded-xl border border-slate-100 max-w-full [&_*]:max-w-full [&_*]:break-words [&_table]:block [&_table]:overflow-x-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
                </div>
                <div className="sticky bottom-0 bg-white border-t border-slate-100 pt-4 pb-2 -mx-8 px-8 mt-auto flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4">
                    <a href={article.original_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-slate-400 hover:text-slate-800">Ver fuente original &rarr;</a>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleGenerateScript(article)}
                      disabled={generatingScriptId === article.id}
                      className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 font-bold flex items-center gap-2 shadow-sm"
                    >
                      {generatingScriptId === article.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                      {generatingScriptId === article.id ? 'Generando...' : 'Script Viral'}
                    </Button>
                  </div>
                  <div className="flex gap-4">
                    <Button variant="outline" size="lg" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-bold" onClick={() => handleReject(article.id)}>Descartar</Button>
                    <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white font-black shadow-lg shadow-green-600/30 px-8 transition-all hover:scale-105" onClick={() => handleApprove(article.id)}>Aprobar y Publicar ✨</Button>
                  </div>
                </div>
              </div>
            </div>
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