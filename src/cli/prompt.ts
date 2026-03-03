import { createInterface } from "node:readline/promises";

const ESC = "\x1b[";
const RESET = "\x1b[0m";

const c = {
  cyan: `${ESC}36m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  gray: `${ESC}90m`,
  red: `${ESC}31m`,
  bold: `${ESC}1m`,
};

function paint(text: string, code: string): string {
  return `${code}${text}${RESET}`;
}

export const fmt = {
  question: (s: string) => `${paint("?", c.cyan)} ${paint(s, c.bold)}`,
  success: (s: string) => `${paint("✓", c.green)} ${s}`,
  hint: (s: string) => paint(s, c.gray),
  error: (s: string) => paint(s, c.red),
  item: (n: number, s: string) => `  ${paint(String(n), c.yellow)}. ${s}`,
  header: (s: string) => `\n${paint(s, c.bold)}`,
};

export function createPrompt() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  async function ask(question: string, defaultValue?: string): Promise<string> {
    const hint = defaultValue !== undefined ? ` ${fmt.hint(`(${defaultValue})`)}` : "";
    const answer = await rl.question(`${fmt.question(question)}${hint}: `);
    return answer.trim() || defaultValue || "";
  }

  async function askNumber(question: string, defaultVal: number): Promise<number> {
    while (true) {
      const raw = await ask(question, String(defaultVal));
      const num = Number.parseInt(raw);
      if (!Number.isNaN(num) && num > 0) return num;
      console.log(`  ${fmt.error("Please enter a valid positive number.")}`);
    }
  }

  async function askChoice(question: string, choices: string[]): Promise<string> {
    console.log(fmt.question(question));
    choices.forEach((ch, i) => console.log(fmt.item(i + 1, ch)));
    while (true) {
      const raw = (await rl.question(`  Choose (1-${choices.length}): `)).trim();
      const num = Number.parseInt(raw);
      // bounds-checked above — safe to assert
      if (num >= 1 && num <= choices.length) return choices[num - 1] as string;
      console.log(`  ${fmt.error(`Enter a number between 1 and ${choices.length}.`)}`);
    }
  }

  async function askBoolean(question: string, defaultVal = false): Promise<boolean> {
    const hint = defaultVal ? "Y/n" : "y/N";
    const raw = await ask(`${question} [${hint}]`);
    if (!raw) return defaultVal;
    return raw.toLowerCase().startsWith("y");
  }

  function close() {
    rl.close();
  }

  return { ask, askNumber, askChoice, askBoolean, close };
}
