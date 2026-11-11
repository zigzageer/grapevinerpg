/** The standalone demo supplies embedded art; the website uses normal static assets. */
export function characterArtUrl(name: string): string {
  const embedded = (globalThis as { __MINT_ART__?: Record<string, string> })
    .__MINT_ART__;
  return embedded?.[name] || `/characters/${name}.png`;
}
