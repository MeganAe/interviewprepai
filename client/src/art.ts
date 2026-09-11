import { interviewArt } from "./interview-art";
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
export const heroArt = () => interviewArt();
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
