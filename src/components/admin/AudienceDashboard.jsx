import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { format, subDays, startOfDay, endOfDay, isToday, isYesterday } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { Users, TrendingUp, Globe, Smartphone, Monitor, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

function KpiCard({ icon: Icon, label, value, sub, color = "text-green-600", bg = "bg-green-50" }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-start gap-4">
      <div className={`${bg} p-3 rounded-lg shrink-0`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <p className="text-3xl font-black text-slate-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400 font-medium mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function getReferrerLabel(ref) {
  if (!ref || ref === '' || ref === 'direct') return 'Direto';
  try {
    const url = new URL(ref);
    const host = url.hostname.replace('www.', '');
    if (host.includes('google')) return 'Google';
    if (host.includes('t.me') || host.includes('telegram')) return 'Telegram';
    if (host.includes('twitter') || host.includes('x.com')) return 'X / Twitter';
    if (host.includes('facebook')) return 'Facebook';
    if (host.includes('linkedin')) return 'LinkedIn';
    if (host.includes('whatsapp')) return 'WhatsApp';
    return host;
  } catch {
    return 'Direto';
  }
}

function getPageLabel(url) {
  if (!url) return '/';
  try {
    const u = new URL(url);
    return u.pathname || '/';
  } catch {
    return url;
  }
}

export default function AudienceDashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await base44.entities.VisitorLog.list('-access_date', 1000);
      setLogs(data);
      setLoading(false);
    }
    load();
  }, []);

  const humanLogs = useMemo(() => logs.filter(l => !l.is_bot), [logs]);

  // KPIs
  const todayLogs = useMemo(() => humanLogs.filter(l => l.access_date && isToday(new Date(l.access_date))), [humanLogs]);
  const yesterdayLogs = useMemo(() => humanLogs.filter(l => l.access_date && isYesterday(new Date(l.access_date))), [humanLogs]);
  const uniqueIPs = useMemo(() => new Set(humanLogs.map(l => l.ip_address)).size, [humanLogs]);

  // Chart: last 7 days
  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = subDays(new Date(), 6 - i);
      const label = format(day, 'dd/MM');
      const count = humanLogs.filter(l => {
        if (!l.access_date) return false;
        const d = new Date(l.access_date);
        return d >= startOfDay(day) && d <= endOfDay(day);
      }).length;
      return { day: label, visitas: count };
    });
  }, [humanLogs]);

  // Top pages
  const topPages = useMemo(() => {
    const counts = {};
    humanLogs.forEach(l => {
      const page = getPageLabel(l.page_url);
      counts[page] = (counts[page] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([page, count]) => ({ page, count }));
  }, [humanLogs]);

  // Referrers
  const referrerData = useMemo(() => {
    const counts = {};
    humanLogs.forEach(l => {
      const ref = getReferrerLabel(l.referrer);
      counts[ref] = (counts[ref] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, count]) => ({ source, count }));
  }, [humanLogs]);

  // Device split
  const deviceData = useMemo(() => {
    const counts = { mobile: 0, desktop: 0, tablet: 0 };
    humanLogs.forEach(l => {
      if (l.device_type && counts[l.device_type] !== undefined) {
        counts[l.device_type]++;
      } else {
        // fallback: detect from user_agent
        const ua = (l.user_agent || '').toLowerCase();
        if (ua.includes('tablet') || ua.includes('ipad')) counts.tablet++;
        else if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) counts.mobile++;
        else counts.desktop++;
      }
    });
    return counts;
  }, [humanLogs]);

  const totalDevices = deviceData.mobile + deviceData.desktop + deviceData.tablet || 1;

  // Top countries
  const topCountries = useMemo(() => {
    const counts = {};
    humanLogs.forEach(l => {
      const c = l.country || 'Desconocido';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([country, count]) => ({ country, count, code: humanLogs.find(l => l.country === country)?.country_code?.toLowerCase() }));
  }, [humanLogs]);

  const handleExport = () => {
    const csv = [
      ['Data', 'País', 'Cidade', 'Página', 'Referrer', 'Dispositivo', 'Bot'].join(','),
      ...logs.map(l => [
        l.access_date ? format(new Date(l.access_date), 'dd/MM/yyyy HH:mm') : '',
        l.country || '',
        l.city || '',
        l.page_url || '',
        l.referrer || '',
        l.device_type || '',
        l.is_bot ? 'Sim' : 'Não'
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audience_export.csv'; a.click();
    toast({ title: "CSV exportado com sucesso!" });
  };

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}</div>
      <div className="h-48 bg-slate-100 rounded-xl" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-xl" />)}</div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Dashboard de Audiência</h2>
        <Button onClick={handleExport} variant="outline" className="flex items-center gap-2 font-bold text-slate-600">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          icon={TrendingUp}
          label="Visitas Hoje"
          value={todayLogs.length}
          sub={`Ontem: ${yesterdayLogs.length} visitas`}
          color="text-green-600"
          bg="bg-green-50"
        />
        <KpiCard
          icon={Users}
          label="Usuários Únicos (Total)"
          value={uniqueIPs}
          sub={`De ${humanLogs.length} visitas totais`}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <KpiCard
          icon={Globe}
          label="Países Alcançados"
          value={topCountries.length}
          sub="Países com visitas registadas"
          color="text-purple-600"
          bg="bg-purple-50"
        />
      </div>

      {/* Line Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-6">Evolução — Últimos 7 Dias</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700 }} />
            <Bar dataKey="visitas" fill="#16a34a" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top Pages */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Top Páginas</h3>
          {topPages.length === 0 ? (
            <p className="text-slate-400 text-sm font-medium">Sem dados de página_url ainda.<br/>Novas visitas já serão rastreadas.</p>
          ) : (
            <div className="space-y-3">
              {topPages.map(({ page, count }, i) => (
                <div key={page} className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-400 w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate" title={page}>{page}</p>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1">
                      <div
                        className="h-1.5 bg-green-500 rounded-full"
                        style={{ width: `${Math.round((count / (topPages[0]?.count || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-900 shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Referrers + Devices */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Fontes de Tráfego</h3>
            {referrerData.length === 0 ? (
              <p className="text-slate-400 text-sm font-medium">Sem dados de referrer ainda.</p>
            ) : (
              <div className="space-y-2">
                {referrerData.map(({ source, count }) => (
                  <div key={source} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{source}</p>
                      <div className="h-1.5 bg-slate-100 rounded-full mt-1">
                        <div
                          className="h-1.5 bg-blue-500 rounded-full"
                          style={{ width: `${Math.round((count / (referrerData[0]?.count || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-black text-slate-900 shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Dispositivos</h3>
            <div className="space-y-2">
              {[
                { label: 'Desktop', icon: Monitor, value: deviceData.desktop, color: 'bg-slate-700' },
                { label: 'Mobile', icon: Smartphone, value: deviceData.mobile, color: 'bg-green-500' },
                { label: 'Tablet', icon: Smartphone, value: deviceData.tablet, color: 'bg-blue-400' },
              ].map(({ label, icon: Icon, value, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-bold text-slate-600">{label}</span>
                      <span className="text-xs font-black text-slate-900">{Math.round((value / totalDevices) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div className={`h-1.5 ${color} rounded-full`} style={{ width: `${Math.round((value / totalDevices) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Countries */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Top Países</h3>
          <div className="space-y-3">
            {topCountries.map(({ country, count, code }, i) => (
              <div key={country} className="flex items-center gap-3">
                <span className="text-xs font-black text-slate-400 w-4 shrink-0">{i + 1}</span>
                {code && code !== 'xx' ? (
                  <img src={`https://flagcdn.com/20x15/${code}.png`} alt={country} className="rounded-sm border border-slate-100 shrink-0" />
                ) : (
                  <Globe className="w-4 h-4 text-slate-300 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{country}</p>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1">
                    <div
                      className="h-1.5 bg-purple-500 rounded-full"
                      style={{ width: `${Math.round((count / (topCountries[0]?.count || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-black text-slate-900 shrink-0">{count}</span>
              </div>
            ))}
            {topCountries.length === 0 && <p className="text-slate-400 text-sm font-medium">Sem dados de geografia.</p>}
          </div>
        </div>

      </div>
    </div>
  );
}