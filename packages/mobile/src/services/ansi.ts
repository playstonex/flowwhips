// Ported from packages/daemon/src/parser/ansi.ts

const OSC_REGEX = /\x1b\][^\x07]*\x07/g;
const CSI_REGEX = /\x1b\[[^@-~]*[@-~]/g;
const SGR_REGEX = /\x1b\[[\d;]*m/g;

export function stripAnsi(text: string): string {
  return text
    .replace(OSC_REGEX, '')
    .replace(CSI_REGEX, '')
    .replace(SGR_REGEX, '')
    .replace(/\x1b[^[\]]/g, '');
}
