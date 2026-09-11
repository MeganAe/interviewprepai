// Pure typographic identity. No symbol, medallion, AI badge, or outlined pictogram.
export function brandMark() {
  return `<span class="brand-text" data-brand="typographic">Interview Prep AI</span>`;
}
export function wordmark(href = "#welcome", extra = "") {
  return `<a class="wordmark ${extra}" href="${href}" aria-label="Interview Prep AI — accueil">${brandMark()}</a>`;
}
