import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import ReactMarkdown from 'react-markdown';

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pending'); 
  
  const [pendingArticles, setPendingArticles] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [newFeed, setNewFeed] = useState({ url: '', name: '', category: 'Tech' });
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchPending = async () => {
    const data = await base44.entities.NewsArticle.filter({ status: 'pending' }, '-created_date');
    setPendingArticles(data);
  };

  const fetchFeeds = async () => {
    const data = await base44.entities.RssFeed.list();
    setFeeds(data);
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchPending();
      fetchFeeds();
    }
  }, [user]);

  if (user?.role !== 'admin') return <div className="p-20 text-center font-bold text-2xl text-slate-500">Acceso denegado. Requiere privilegios de Admin.</div>;

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

  const runProcessFeeds = async () => {
    setIsProcessing(true);
    try {
      const res = await base44.functions.invoke('processFeeds', {});
      toast({ title: "Búsqueda con IA completada", description: `Noticias procesadas: ${res.data.processed}`, duration: 4000 });
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
      <div className="flex justify-between items-center mb-10 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Panel Editorial</h1>
          <p className="text-slate-500 mt-2 font-medium">Revisa y publica contenido generado por IA</p>
        </div>
        <div className="flex gap-3">
          <Button variant={activeTab === 'pending' ? 'default' : 'outline'} onClick={() => setActiveTab('pending')} className={activeTab === 'pending' ? 'bg-slate-900' : ''}>
            Pendientes ({pendingArticles.length})
          </Button>
          <Button variant={activeTab === 'feeds' ? 'default' : 'outline'} onClick={() => setActiveTab('feeds')} className={activeTab === 'feeds' ? 'bg-slate-900' : ''}>
            Fuentes RSS
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
            <div key={article.id} className="bg-white border border-slate-200 p-8 flex flex-col md:flex-row gap-8">
              {article.image_url && (
                <div className="md:w-1/3 shrink-0">
                  <img src={article.image_url} alt="" className="w-full object-cover aspect-video bg-slate-100" />
                  <div className="mt-4 p-4 bg-slate-50 text-xs text-slate-600 font-mono">
                    <strong>Palabras Clave SEO:</strong><br/>
                    {article.seo_keywords}
                  </div>
                </div>
              )}
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-green-600">{article.category} • {article.source_name}</span>
                  <span className="text-xs font-medium text-slate-400">{format(new Date(article.created_date), 'dd/MM/yyyy HH:mm')}</span>
                </div>
                <h2 className="text-3xl font-black tracking-tight mb-3 leading-tight">{article.title}</h2>
                <p className="text-slate-600 font-medium mb-6 text-lg">{article.summary}</p>
                <div className="markdown-content text-sm text-slate-700 max-h-64 overflow-y-auto mb-6 pr-4">
                  <ReactMarkdown>{article.content}</ReactMarkdown>
                </div>
                <div className="mt-auto flex justify-between items-center pt-6 border-t border-slate-100">
                  <a href={article.original_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-slate-400 hover:text-slate-800">Ver fuente original &rarr;</a>
                  <div className="flex gap-3">
                    <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-bold" onClick={() => handleReject(article.id)}>Descartar</Button>
                    <Button className="bg-green-600 hover:bg-green-700 font-bold" onClick={() => handleApprove(article.id)}>Aprobar y Publicar</Button>
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
    </div>
  );
}