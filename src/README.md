# LatinoTech IA

**Plataforma inteligente de notícias de tecnologia em português, espanhol e inglês**

Uma aplicação web moderna que agrega, gera e distribui conteúdo de tecnologia de alta qualidade para o público latino-americano, utilizando inteligência artificial para otimização de SEO e geração automática de artigos.

## 🎯 Visão Geral

LatinoTech IA é um sistema completo de jornalismo digital assistido por IA que:

- 🤖 **Gera artigos automaticamente** via LLM (Claude Sonnet) a partir de feeds RSS
- 🌐 **Publica em 3 idiomas** (Português, Espanhol, Inglês) simultaneamente
- 📊 **Otimiza SEO** com palavras-chave automáticas e integração com Google Search Console
- 📱 **Interface responsiva** para desktop, tablet e mobile
- 📧 **Newsletter automática** com distribuição por idioma
- 👥 **Painel administrativo** para revisão, aprovação e edição de conteúdo
- 📈 **Análise de audiência** com tracking de visitantes e dados geográficos
- 🔗 **Afiliação integrada** com suporte a múltiplos programas

## 🚀 Tecnologias

### Frontend
- **React 18** com React Router v6
- **Tailwind CSS** para estilização
- **TypeScript** para type safety
- **Shadcn/UI** para componentes reutilizáveis
- **Recharts** para visualização de dados
- **React Query** para gerenciamento de estado assíncrono

### Backend
- **Deno Runtime** para serverless functions
- **Google APIs** (Search Console, Indexing, Custom Search)
- **Claude AI** para geração de conteúdo
- **RSS Parser** para agregação de feeds
- **Jina AI** para extração de contexto de artigos

### Infraestrutura
- **Base de dados relacional** com suporte a RLS (Row Level Security)
- **Autenticação e autorização** multi-role (admin/user)
- **API REST** para integração com serviços externos

## 📋 Funcionalidades Principais

### Para Visitantes
- 🔍 Navegação por categorias (IA, Gadgets, Software, Startups, Gaming, Tech, Tutoriales)
- 📰 Leitura de artigos em múltiplos idiomas
- 📧 Inscrição em newsletter
- 🌍 Suporte geolocalizado automático

### Para Administradores
- ✏️ Painel editorial com edição inline de artigos
- 🔄 Gerenciamento de feeds RSS (adicionar, ativar, pausar)
- 🎬 Geração automática de scripts para vídeos virais
- 📊 Dashboard de audiência com métricas por país
- 🚀 Automação de publicação em Google Search Console
- 📱 Integração com Telegram para notificações

## 🏗️ Arquitetura

```
src/
├── pages/              # Páginas principais (Home, Category, Article, Admin)
├── components/         # Componentes reutilizáveis
│   ├── layout/        # Layout principal
│   ├── admin/         # Componentes do painel admin
│   └── ui/            # Componentes de UI (buttons, inputs, etc)
├── functions/         # Backend functions (Deno serverless)
├── entities/          # Schemas de dados (RSS feeds, Articles, Subscribers)
├── lib/               # Utilitários e contextos
└── utils/             # Funções auxiliares
```

## 🔧 Setup Local

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação

```bash
# Clonar repositório
git clone <seu-repo>
cd latinotech-ia

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

## 📡 Variáveis de Ambiente

Configure as seguintes variáveis no dashboard ou arquivo `.env`:

```
# Google APIs
G_PROJECT_ID=seu-project-id
G_CLIENT_EMAIL=seu-email-service-account
G_PRIVATE_KEY=sua-chave-privada

# APIs Externas
JINA_API_KEY=sua-chave-jina
EXA_API_KEY=sua-chave-exa (opcional)

# Telegram (para notificações)
TELEGRAM_BOT_TOKEN=seu-token-telegram
TELEGRAM_CHAT_ID=seu-chat-id
```

## 🎬 Fluxos Principais

### 1. Geração Automática de Artigos
```
RSS Feed → Fetch → Contexto (Jina) → Claude IA → Tradução (3 idiomas)
  ↓
Imagem gerada → Slug único → BD (pending)
  ↓
Notificação Telegram
```

### 2. Revisão Editorial
```
Artigo pendente → Admin revisa/edita → Aprova
  ↓
Google Search Console indexation → Publicado
```

### 3. Newsletter
```
Artigos publicados (últimos 7 dias) → Resumo por idioma
  ↓
Envio para subscribers ativos
```

## 📊 Estrutura de Dados

### NewsArticle
- `title`, `summary`, `content` (markdown)
- `category`, `language`, `status` (pending/published/rejected)
- `image_url`, `seo_keywords`
- `original_url` (fonte original)

### RssFeed
- `url`, `name`, `category`
- `is_active` (ativa/pausada)

### Subscriber
- `email`, `language`, `active`

### VisitorLog
- Tracking de visitantes: IP, país, dispositivo, referrer
- Análise de audiência e tráfego

## 🔐 Segurança

- **Row Level Security (RLS)** - apenas admins veem dados sensíveis
- **Autenticação JWT** - proteção de endpoints admin
- **CORS** configurado para origem específica
- **Rate limiting** em operações em batch para evitar throttling

## 📈 Performance

- **Lazy loading** de imagens com Intersection Observer
- **Paginação** de artigos (20 por página)
- **Caching** com React Query
- **Otimização de bundles** via Vite

## 🚀 Deploy

A aplicação está pronta para deploy em plataformas serverless que suportam Node.js/Deno.

### Checklist pré-produção:
- [ ] Configurar variáveis de ambiente
- [ ] Testar feeds RSS
- [ ] Validar templates de email
- [ ] Configurar domínio customizado
- [ ] Ativar HTTPS
- [ ] Configurar backup de BD

## 📝 Licença

Projeto privado

## 👤 Autor

Desenvolvido como projeto de portfólio para demonstrar expertise em:
- Full-stack development
- Automação e IA
- Infraestrutura serverless
- Otimização SEO
- Gestão de conteúdo em escala

---

**Links úteis:**
- [Documentação React](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Google Search Console API](https://developers.google.com/webmaster-tools)