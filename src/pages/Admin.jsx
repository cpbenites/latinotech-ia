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
import { FileText, Rss, Users, MapPin, Download } from 'lucide-react';

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pending'); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [pendingArticles, setPendingArticles] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [visitorLogs, setVisitorLogs] = useState([]);
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

  const fetchAudience = async () => {
    const data = await base44.entities.VisitorLog.list('-access_date', 50);
    setVisitorLogs(data);
  };

  const handleExportLogs = () => {
    console.log("Exporting Visitor Logs (Full Data):", visitorLogs);
    toast({ title: "Logs exportados", description: "Revisa la consola del navegador para ver los datos completos.", duration: 4000 });
  };

  useEffect(() => {
    async function loadData() {
      if (user?.role === 'admin') {
        setIsLoading(true);
        await Promise.all([fetchPending(), fetchFeeds(), fetchAudience()]);
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

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
                <div className="markdown-content text-base text-slate-700 max-h-96 overflow-y-auto mb-6 pr-6 leading-loose space-y-2 bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                  <ReactMarkdown>{article.content}</ReactMarkdown>
                </div>
                <div className="mt-auto flex justify-between items-center pt-6 border-t border-slate-100">
                  <a href={article.original_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-slate-400 hover:text-slate-800">Ver fuente original &rarr;</a>
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

      {activeTab === 'audience' && (
        <div className="space-y-8">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Análisis de Tráfico</h2>
            <Button onClick={handleExportLogs} variant="outline" className="flex items-center gap-2 font-bold text-slate-600">
              <Download className="w-4 h-4" /> Exportar Logs
            </Button>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Users className="w-4 h-4" /> Visitas (Top 50)</h3>
              <p className="text-4xl font-black text-slate-900">{visitorLogs.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4" /> Top 3 Países</h3>
              <div className="flex flex-col gap-3">
                {(() => {
                  const countryCounts = visitorLogs.reduce((acc, log) => {
                    const c = log.country || 'Desconocido';
                    acc[c] = (acc[c] || 0) + 1;
                    return acc;
                  }, {});
                  const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
                  if (topCountries.length === 0) return <p className="text-slate-400 font-medium text-sm">No hay datos.</p>;
                  return topCountries.map(([country, count], i) => (
                    <div key={country} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 shadow-sm text-sm">
                      <span className="font-bold text-slate-800 truncate pr-2">{i + 1}. {country}</span>
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{count}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4" /> Top 3 Ciudades</h3>
              <div className="flex flex-col gap-3">
                {(() => {
                  const cityCounts = visitorLogs.reduce((acc, log) => {
                    const c = log.city || 'Desconocido';
                    acc[c] = (acc[c] || 0) + 1;
                    return acc;
                  }, {});
                  const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
                  if (topCities.length === 0) return <p className="text-slate-400 font-medium text-sm">No hay datos.</p>;
                  return topCities.map(([city, count], i) => (
                    <div key={city} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 shadow-sm text-sm">
                      <span className="font-bold text-slate-800 truncate pr-2">{i + 1}. {city}</span>
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{count}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider">Fecha y Hora</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider">País / Ciudad</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visitorLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                        {log.access_date ? format(new Date(log.access_date), 'dd MMM yyyy, HH:mm') : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {log.country_code && log.country_code !== 'XX' && (
                            <img src={`https://flagcdn.com/24x18/${log.country_code.toLowerCase()}.png`} alt={log.country_code} className="rounded-sm border border-slate-200 shadow-sm" />
                          )}
                          <span className="font-bold text-slate-800">{log.country}</span>
                          <span className="text-slate-400 font-medium">• {log.city}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500">
                        {user?.role === 'super_admin' ? log.ip_address : (log.ip_address?.includes(':') ? log.ip_address.split(':').slice(0, 4).join(':') + ':xxxx:xxxx:xxxx:xxxx' : log.ip_address?.split('.').map((p, i) => i < 2 ? p : 'xxx').join('.'))}
                      </td>
                    </tr>
                  ))}
                  {visitorLogs.length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-6 py-12 text-center text-slate-500 font-medium">No se han registrado visitas todavía.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}