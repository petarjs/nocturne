export type MdToken = { text: string; bold?: boolean; em?: boolean };

/**
 * The `text` preset takes "md-lite" (§7.3): bold/italic only, hand-rolled so
 * we don't pull in a markdown dependency for two inline markers.
 */
export function parseMdLite(md: string): MdToken[] {
  const tokens: MdToken[] = [];
  const words = md.split(/\s+/).filter(Boolean);
  let bold = false;
  let em = false;

  for (let word of words) {
    while (word.startsWith("**")) {
      bold = !bold;
      word = word.slice(2);
    }
    while (word.startsWith("*") && !word.startsWith("**")) {
      em = !em;
      word = word.slice(1);
    }

    let trailingBold = false;
    let trailingEm = false;
    while (word.endsWith("**")) {
      trailingBold = true;
      word = word.slice(0, -2);
    }
    while (!word.endsWith("**") && word.endsWith("*")) {
      trailingEm = true;
      word = word.slice(0, -1);
    }

    tokens.push({ text: word, bold: bold || trailingBold, em: em || trailingEm });
    if (trailingBold) bold = false;
    if (trailingEm) em = false;
  }

  return tokens;
}
