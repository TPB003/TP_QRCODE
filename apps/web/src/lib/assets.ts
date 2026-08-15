/**
 * Reproducible, source-owned visual placeholders. The open repository does
 * not depend on generated or unlicensed bitmap files; runtime uploads are
 * served from the private R2 binding instead.
 */
function svgData(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const paperTexture = svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" stitchTiles="stitch"/></filter><rect width="240" height="240" fill="#f2efe8"/><rect width="240" height="240" filter="url(#n)" opacity=".045"/></svg>`);
const industrialPlaceholder = svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#172033"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><rect width="1200" height="720" fill="url(#g)"/><path d="M0 560h1200v160H0z" fill="#0b1220" opacity=".65"/><path d="M180 510V240h260v270M440 510V310h250v200M690 510V200h310v310" fill="none" stroke="#dbeafe" stroke-width="18" opacity=".65"/><circle cx="310" cy="300" r="48" fill="none" stroke="#14b8a6" stroke-width="14"/><circle cx="310" cy="300" r="13" fill="#14b8a6"/></svg>`);
const detailPlaceholder = svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700"><rect width="900" height="700" fill="#e8eef8"/><rect x="90" y="90" width="720" height="520" rx="28" fill="#f8fafc" stroke="#2563eb" stroke-width="10"/><circle cx="450" cy="350" r="170" fill="#dbeafe" stroke="#2563eb" stroke-width="14"/><path d="M450 350 450 205M450 350 555 405" stroke="#0f172a" stroke-width="18" stroke-linecap="round"/><circle cx="450" cy="350" r="20" fill="#14b8a6"/></svg>`);

export const generatedAssets = {
  archivalPaperTexture: paperTexture,
  equipmentCompressor: industrialPlaceholder,
  industrialCover: industrialPlaceholder,
  submissionCompressor: detailPlaceholder,
  submissionGauge: detailPlaceholder,
} as const;
