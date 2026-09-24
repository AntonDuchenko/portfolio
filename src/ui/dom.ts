const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
};

export const el = {
  scene: $('scene'), vignette: $('vignette'), portal: $('portal'), pane: $('pane'),
  poster: $('poster'), site: $('site'),
  line: $('line'), skip: $('skip'), tune: $<HTMLDetailsElement>('tune'), again: $('again'),
  gate: $('gate'), enter: $<HTMLButtonElement>('enter')
};
