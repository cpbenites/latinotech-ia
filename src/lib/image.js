// Otimiza imagens do storage: redimensiona para a largura exibida e converte para WebP.
// Reduz drasticamente o peso (ex.: PNG de 240 KB -> WebP de ~70 KB).
export const optimizeImage = (url, width = 800) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('media.base44.com')) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=webp&q=72`;
};