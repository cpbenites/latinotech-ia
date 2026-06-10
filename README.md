# LatinoTech IA — Plataforma de Jornalismo Digital com Inteligência Artificial

> Sistema automatizado de produção, curadoria e publicação de conteúdo tecnológico em múltiplos idiomas.

---

## Visão Geral

**LatinoTech IA** é uma plataforma de jornalismo digital de alta performance, desenvolvida para agregar, processar e publicar notícias de tecnologia em Português, Espanhol e Inglês de forma automatizada. O sistema combina fontes RSS curadas, modelos de linguagem avançados e otimização SEO para entregar conteúdo editorial de qualidade em escala.

A plataforma opera como uma redação digital autônoma: captura notícias de fontes confiáveis, gera artigos completos com IA, traduz o conteúdo para três idiomas e disponibiliza o material para revisão editorial antes da publicação.

---

## Funcionalidades Principais

### Geração de Conteúdo com IA
- Processamento de feeds RSS de fontes internacionais de tecnologia
- Geração de artigos completos (mínimo 600 palavras) com estrutura jornalística profissional
- Produção simultânea em Português (BR), Espanhol (LATAM) e Inglês (US)
- Geração automática de imagens editoriais com IA
- Criação de roteiros virais para vídeo a partir de artigos publicados

### Otimização para Motores de Busca
- Geração automática de slugs SEO-friendly para cada artigo
- Extração de palavras-chave relevantes por artigo
- Envio automático de URLs ao Google Indexing API após publicação
- Sitemap XML dinâmico atualizado em tempo real
- Integração com Google Search Console

### Painel Editorial
- Revisão e aprovação de artigos antes da publicação
- Edição inline de título, resumo e conteúdo
- Descarte individual ou em massa de artigos pendentes
- Gerenciamento de fontes RSS (ativação, pausa, categorização)
- Dashboard de audiência com métricas de visitantes em tempo real

### Distribuição Multicanal
- Publicação automática no Telegram (3 canais: ES, PT, EN)
- Sistema de newsletter com envio segmentado por idioma
- Suporte a programas de afiliados com rotação de conteúdo patrocinado

### Controle de Qualidade
- Limite diário configurável de artigos por idioma (padrão: 3 por idioma)
- Verificação de duplicatas por URL de origem
- Detecção de bots e honeypot anti-spam
- Sistema de logs de visitantes com geolocalização

---

## Arquitetura Técnica

### Frontend
- **React 18** com roteamento dinâmico via React Router
- **Tailwind CSS** com sistema de design tokens
- **Suporte multilíngue** com rotas dedicadas: `/` (ES), `/br/` (PT), `/en/` (EN)
- Carregamento lazy de páginas e imagens com Intersection Observer
- Design responsivo otimizado para mobile e desktop

### Backend (Funções Serverless)
| Função | Descrição |
|--------|-----------|
| `processFeeds` | Núcleo de geração: lê RSS, chama LLM, salva artigos nos 3 idiomas |
| `submitToGoogleIndexing` | Envia URLs para indexação imediata no Google |
| `sitemap` | Gera sitemap XML dinâmico com todos os artigos publicados |
| `generateVideoScript` | Cria roteiros virais para redes sociais a partir de artigos |
| `weeklyNewsletterSender` | Dispara newsletter semanal segmentada por idioma |
| `automatedAffiliatePoster` | Publica conteúdo de afiliados automaticamente |

### Entidades de Dados
| Entidade | Descrição |
|----------|-----------|
| `NewsArticle` | Artigos com título, conteúdo, idioma, status e metadados SEO |
| `RssFeed` | Fontes RSS configuradas por categoria |
| `Subscriber` | Lista de assinantes da newsletter por idioma |
| `VisitorLog` | Logs de acesso com geolocalização e tipo de dispositivo |
| `AffiliateProgram` | Programas de afiliados ativos |
| `NewsletterDraft` | Rascunhos de newsletter em múltiplos idiomas |

---

## Fluxo de Produção de Conteúdo

```
Feed RSS → Seleção de item novo → Contexto via Jina AI
    → LLM (Claude): artigo mestre em PT
    → Tradução paralela ES + EN
    → Geração de imagem editorial
    → Salvamento como "pendente"
    → Revisão editorial (painel admin)
    → Aprovação → Publicação + Google Indexing + Telegram
```

---

## Categorias de Conteúdo

- **IA** — Inteligência Artificial e Machine Learning
- **Gadgets** — Hardware e dispositivos
- **Software** — Aplicações e ferramentas
- **Startups** — Empreendedorismo e inovação
- **Gaming** — Jogos e entretenimento digital
- **Tech** — Tecnologia geral
- **Tutoriales** — Guias e tutoriais

---

## Configuração de Ambiente

As seguintes variáveis de ambiente são necessárias para operação completa:

| Variável | Descrição |
|----------|-----------|
| `G_PROJECT_ID` | ID do projeto Google Cloud |
| `G_CLIENT_EMAIL` | E-mail da conta de serviço Google |
| `G_PRIVATE_KEY` | Chave privada da conta de serviço Google |
| `JINA_API_KEY` | Chave da API Jina para extração de conteúdo |
| `TELEGRAM_BOT_TOKEN` | Token do bot Telegram para distribuição |
| `TELEGRAM_CHAT_ID` | ID do canal Telegram principal (ES) |

---

## Canais de Distribuição

| Canal | Idioma | Handle |
|-------|--------|--------|
| Telegram ES | Espanhol | @latinotech |
| Telegram PT | Português | @latinotechbr |
| Telegram EN | Inglês | @latinotechen |
| Website ES | Espanhol | latinotechia.com |
| Website PT | Português | latinotechia.com/br |
| Website EN | Inglês | latinotechia.com/en |

---

## Desenvolvido com

- [Base44](https://base44.com) — Plataforma de desenvolvimento de aplicações com IA
- [React](https://react.dev) — Interface de utilizador
- [Tailwind CSS](https://tailwindcss.com) — Estilização
- [Claude (Anthropic)](https://anthropic.com) — Geração de conteúdo editorial
- [Jina AI](https://jina.ai) — Extração de conteúdo web
- [Google Indexing API](https://developers.google.com/search/apis/indexing-api) — SEO e indexação

---

*LatinoTech IA — Jornalismo de tecnologia em escala, potenciado por inteligência artificial.*
