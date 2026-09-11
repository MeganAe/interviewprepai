const p = "var(--primary)",
  ink = "var(--onPrimaryContainer)",
  paper = "var(--surface)",
  peach = "var(--primaryContainer)",
  sage = "var(--tertiaryContainer)",
  green = "var(--onTertiaryContainer)",
  sand = "var(--secondaryContainer)",
  muted = "var(--outline)";
const svg = (body: string, box = "0 0 120 110") =>
  `<svg viewBox="${box}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
export const heroArt = () =>
  svg(
    `
<path d="M51 316C1 237 23 137 92 72C161 7 288 18 343 93C391 158 393 280 344 327" fill="${sand}"/>
<path d="M71 74C61 88 54 102 49 119M45 132L42 145M337 45l8-16M353 54l19-4" stroke="${p}" stroke-width="2" stroke-linecap="round"/>
<circle cx="301" cy="80" r="37" fill="${sage}"/>
<path d="m287 80 10 10 21-22" stroke="${green}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<g transform="rotate(-8 96 149)"><rect x="35" y="118" width="99" height="61" rx="17" fill="${paper}" stroke="${ink}" stroke-width="1.5"/><path d="m59 175-8 16 28-12" fill="${paper}" stroke="${ink}" stroke-width="1.5"/><path d="M53 140h63m-63 14h40" stroke="${p}" stroke-width="3" stroke-linecap="round"/><circle cx="118" cy="126" r="13" fill="${p}"/><path d="m113 126 4 4 6-7" stroke="${paper}" stroke-width="2" stroke-linecap="round"/></g>
<path d="M184 223c-29 2-45 22-37 45l12 45h109l-11-60-27-36" fill="${p}" stroke="${ink}" stroke-width="2"/>
<path d="M174 265c-4 22-8 35-11 50m59-53 12 53" stroke="${ink}" stroke-width="2"/>
<path d="M203 127c-12-18-43-30-56-6-13 24-8 56-17 76-12 23-4 50 23 50 18 0 26-19 48-25 24-8 36-31 29-52-7-20-13-34-27-43" fill="${ink}"/>
<path d="M197 173v22l-22 10 37 26 28-27-22-16-1-22" fill="${peach}" stroke="${ink}" stroke-width="1.8"/>
<path d="M217 170c-10 12-18 11-25 5-10-7-13-18-13-31 13 0 21-8 25-17 5 11 15 15 24 17l-2 17-9 9Z" fill="${peach}" stroke="${ink}" stroke-width="1.8"/>
<path d="M219 148v8h5m-12 8c3 2 6 2 8-1" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/><circle cx="211" cy="149" r="1.8" fill="${ink}"/><path d="M187 150c-9-8-13 6-5 9" fill="${peach}" stroke="${ink}" stroke-width="1.7"/><circle cx="185" cy="162" r="3" fill="${p}"/>
<path d="M176 193c-19 7-30 20-33 38l-6 32c15 11 50 13 77 4l13-52-10-18c-11 13-26 13-41-4" fill="${paper}" stroke="${ink}" stroke-width="2"/>
<path d="M168 209c-4 13-2 27-4 36l45 5-1 12c-25 3-54 3-63-7m64-39 17 29 29 4" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
<path d="m207 249 17-3 12 6-3 8-26 2m43-15 17-5 17 9-2 6-29-1" fill="${peach}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M138 270c-8 21 12 27 40 24l51-3-7 43h30l16-51c5-17-5-24-25-24l-41 5" fill="${sage}" stroke="${ink}" stroke-width="2"/>
<path d="m174 283 21 4-2 45h28l12-52" fill="${sage}" stroke="${ink}" stroke-width="2"/>
<path d="M193 332h28l10 10h-44Zm29 1h29l13 9h-40" fill="${ink}"/>
<path d="M121 267h212" stroke="${ink}" stroke-width="6" stroke-linecap="round"/><path d="m133 270-12 75m199-75 12 75" stroke="${ink}" stroke-width="3"/>
<path d="M238 216h71l-14 46h-72z" fill="${p}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><path d="M214 263h82" stroke="${ink}" stroke-width="4" stroke-linecap="round"/><circle cx="267" cy="238" r="5" fill="${peach}"/>
<path d="M88 294c-1-22-6-50-16-64m17 51c3-25 15-40 23-45m-28 27c-10-21-24-23-34-22m34 49c-17-16-29-12-36-7" stroke="${green}" stroke-width="2"/>
<path d="M72 249c-16 0-23-13-21-21 16 1 24 8 21 21m22 15c-3-17 7-31 19-32 3 14-9 27-19 32m-14 13c-16 4-25-5-30-16 16-7 30 7 30 16" fill="${sage}" stroke="${green}" stroke-width="1.5"/>
<path d="M64 294h46l-7 43H73Z" fill="${paper}" stroke="${ink}" stroke-width="2"/><path d="M70 302h34" stroke="${ink}" stroke-width="1.5"/>
<path d="M52 344h299" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>
<path d="m302 171 5-12 5 12 12 5-12 5-5 12-5-12-12-5Z" fill="${p}"/>
`,
    "0 0 400 360",
  );
export const art = (kind: string) => {
  if (kind === "cv")
    return svg(
      `<path d="M19 81C5 61 21 28 52 22c33-7 59 13 53 44-6 29-66 43-86 15Z" fill="${peach}"/><g transform="rotate(9 64 55)"><rect x="37" y="16" width="53" height="70" rx="6" fill="${paper}" stroke="${ink}" stroke-width="1.7"/><circle cx="51" cy="34" r="7" fill="${sand}"/><path d="M47 35c0-7 8-7 8 0m-13 7c5-7 14-7 18 0M66 32h15m-15 7h10M46 52h35M46 60h29M46 68h23" stroke="${p}" stroke-width="2" stroke-linecap="round"/></g><path d="M17 57h29l8 7h40l-8 31H25Z" fill="${p}" stroke="${ink}" stroke-width="1.5"/><path d="M26 74h16" stroke="${peach}" stroke-width="2" stroke-linecap="round"/><circle cx="93" cy="32" r="13" fill="${sage}" stroke="${ink}" stroke-width="1.3"/><path d="m87 32 4 4 7-8" stroke="${green}" stroke-width="2" stroke-linecap="round"/>`,
    );
  if (kind === "practice")
    return svg(
      `<path d="M12 55C10 21 54 10 85 26c26 13 23 48-2 65C58 110 14 86 12 55" fill="${sage}"/><g transform="rotate(-9 53 43)"><rect x="18" y="24" width="63" height="44" rx="13" fill="${paper}" stroke="${ink}" stroke-width="1.6"/><path d="m29 67-1 12 16-10" fill="${paper}" stroke="${ink}" stroke-width="1.6"/><path d="M32 39h34m-34 12h22" stroke="${p}" stroke-width="2" stroke-linecap="round"/></g><path d="M59 57h32c9 0 13 6 13 14v11c0 7-4 12-12 12h-7l3 9-14-9H59c-8 0-12-5-12-12V70c0-8 4-13 12-13Z" fill="${p}" stroke="${ink}" stroke-width="1.5"/><circle cx="62" cy="75" r="2.5" fill="${paper}"/><circle cx="76" cy="75" r="2.5" fill="${paper}"/><circle cx="90" cy="75" r="2.5" fill="${paper}"/><path d="m92 16 1 8m8-3-5 6" stroke="${p}" stroke-width="2" stroke-linecap="round"/>`,
    );
  if (kind === "results")
    return svg(
      `<path d="M15 70C3 39 42 10 77 20c36 10 37 45 15 66-21 20-66 12-77-16Z" fill="${peach}"/><path d="M26 94V68h17v26M52 94V50h17v44M78 94V32h17v62" fill="${sage}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/><path d="M53 94V51h16v43" fill="${paper}" stroke="${ink}" stroke-width="1.6"/><path d="M79 94V33h16v61" fill="${p}" stroke="${ink}" stroke-width="1.6"/><path d="m25 49 20-18 14 4 21-21m-11 0h12v12" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 95h82" stroke="${ink}" stroke-width="2" stroke-linecap="round"/><path d="m101 15 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z" fill="${p}"/>`,
    );
  return svg(
    `<path d="M21 85C1 62 19 24 52 20c37-5 65 18 50 50C89 98 42 109 21 85Z" fill="${sand}"/><g transform="rotate(-8 61 59)"><rect x="30" y="24" width="57" height="72" rx="5" fill="${paper}" stroke="${ink}" stroke-width="1.7"/><path d="M40 25v70" stroke="${p}" stroke-width="1.5"/><path d="M48 44h28M48 55h28M48 66h19M48 77h23" stroke="${muted}" stroke-width="1.7" stroke-linecap="round"/><path d="M27 36h9m-9 15h9m-9 15h9m-9 15h9" stroke="${ink}" stroke-width="2" stroke-linecap="round"/></g><path d="m91 24 9 5-27 46-11 8 1-14Z" fill="${p}" stroke="${ink}" stroke-width="1.5"/><path d="m63 69 10 6-11 8Z" fill="${peach}" stroke="${ink}" stroke-width="1.5"/><path d="m80 21 2-9m-7 14-7-6" stroke="${p}" stroke-width="1.8" stroke-linecap="round"/>`,
  );
};
