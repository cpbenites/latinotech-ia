import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Zap, Loader2, ExternalLink, Check, X } from 'lucide-react';

const EMPTY_FORM = { name: '', affiliate_url: '', description: '', active: true };

export default function AffiliateAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [testingId, setTestingId] = useState(null);

  const fetchAffiliates = async () => {
    setLoading(true);
    const data = await base44.entities.AffiliateProgram.list('-created_date');
    setAffiliates(data);
    setLoading(false);
  };

  useEffect(() => {
    if (user?.role === 'admin') fetchAffiliates();
  }, [user]);

  const handleSave = async () => {
    if (!form.name || !form.affiliate_url) {
      return toast({ title: "Preencha Nome e URL", variant: "destructive" });
    }
    setSavingId('new');
    if (editingId) {
      await base44.entities.AffiliateProgram.update(editingId, form);
      toast({ title: "Afiliado atualizado!" });
    } else {
      await base44.entities.AffiliateProgram.create(form);
      toast({ title: "Afiliado criado!" });
    }
    setSavingId(null);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormOpen(false);
    fetchAffiliates();
  };

  const handleEdit = (affiliate) => {
    setForm({
      name: affiliate.name,
      affiliate_url: affiliate.affiliate_url,
      description: affiliate.description || '',
      active: affiliate.active ?? true
    });
    setEditingId(affiliate.id);
    setFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Eliminar este afiliado?")) return;
    await base44.entities.AffiliateProgram.delete(id);
    toast({ title: "Afiliado eliminado.", variant: "destructive" });
    fetchAffiliates();
  };

  const handleToggleActive = async (affiliate) => {
    await base44.entities.AffiliateProgram.update(affiliate.id, { active: !affiliate.active });
    fetchAffiliates();
  };

  const handleTestGeneration = async (affiliate) => {
    setTestingId(affiliate.id);
    try {
      const res = await base44.functions.invoke('automatedAffiliatePoster', { affiliateId: affiliate.id });
      toast({ title: `✅ Artigos gerados para ${affiliate.name}!`, description: `ES, PT e EN criados com sucesso.` });
    } catch (e) {
      toast({ title: "Erro na geração", description: e.message, variant: "destructive" });
    } finally {
      setTestingId(null);
      fetchAffiliates();
    }
  };

  const cancelForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormOpen(false);
  };

  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="flex justify-between items-center mb-10 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Gestão de Afiliados</h1>
          <p className="text-slate-500 mt-1 font-medium">Gerencie os links e automatize artigos patrocinados com IA</p>
        </div>
        <Button
          onClick={() => { setFormOpen(true); setEditingId(null); setForm(EMPTY_FORM); }}
          className="bg-slate-900 font-bold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo Afiliado
        </Button>
      </div>

      {formOpen && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 mb-10 shadow-sm">
          <h3 className="text-xl font-black mb-6">{editingId ? 'Editar Afiliado' : 'Novo Afiliado'}</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 block">Nome da Ferramenta *</label>
              <Input
                placeholder="Ex: ElevenLabs"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 block">Link de Afiliado *</label>
              <Input
                placeholder="https://..."
                value={form.affiliate_url}
                onChange={e => setForm({ ...form, affiliate_url: e.target.value })}
                className="bg-white"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 block">Descrição (ajuda a IA a escrever melhor)</label>
            <Input
              placeholder="Ex: Plataforma de clonagem de voz com IA, usada por criadores de conteúdo..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="bg-white"
            />
          </div>
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setForm({ ...form, active: !form.active })}
              className={`w-10 h-6 rounded-full transition-colors ${form.active ? 'bg-green-500' : 'bg-slate-300'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${form.active ? 'translate-x-4' : 'translate-x-0'}`}></div>
            </button>
            <span className="text-sm font-bold text-slate-600">{form.active ? 'Ativo' : 'Pausado'}</span>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={savingId === 'new'} className="bg-green-600 hover:bg-green-700 font-bold">
              {savingId === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingId ? 'Guardar Alterações' : 'Criar Afiliado'}
            </Button>
            <Button variant="outline" onClick={cancelForm}>
              <X className="w-4 h-4" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : affiliates.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-200 rounded-2xl text-slate-400 font-medium">
          Nenhum afiliado cadastrado. Clique em "Novo Afiliado" para começar.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500 text-xs">Nome</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500 text-xs">Link</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500 text-xs">Última Publicação</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500 text-xs">Status</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500 text-xs">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {affiliates.map(affiliate => (
                <tr key={affiliate.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-black text-slate-900">{affiliate.name}</div>
                    {affiliate.description && (
                      <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{affiliate.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={affiliate.affiliate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-green-600 font-bold hover:underline text-xs truncate max-w-[180px]"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {affiliate.affiliate_url}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium">
                    {affiliate.last_published
                      ? format(new Date(affiliate.last_published), 'dd/MM/yyyy HH:mm')
                      : <span className="text-slate-300 italic">Nunca</span>}
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleToggleActive(affiliate)}>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${affiliate.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {affiliate.active ? '● Ativo' : '○ Pausado'}
                      </span>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestGeneration(affiliate)}
                        disabled={testingId === affiliate.id}
                        className="border-purple-200 text-purple-700 hover:bg-purple-50 font-bold text-xs flex items-center gap-1.5"
                      >
                        {testingId === affiliate.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Zap className="w-3 h-3" />}
                        {testingId === affiliate.id ? 'Gerando...' : 'Testar'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(affiliate)} className="text-slate-600">
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(affiliate.id)} className="text-red-500 border-red-100 hover:bg-red-50">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}