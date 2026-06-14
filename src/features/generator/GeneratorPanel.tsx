import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_GENERATOR_OPTIONS,
  estimateStrength,
  generatePassword,
  type GeneratorOptions,
} from "./generator";
import { Button } from "@/ui/Button";
import { copyToClipboard } from "@/lib/clipboard";

interface Props {
  onUse?: (password: string) => void;
  seed?: string;
}

const toggles: Array<{ key: keyof GeneratorOptions; label: string }> = [
  { key: "uppercase", label: "Uppercase (A-Z)" },
  { key: "lowercase", label: "Lowercase (a-z)" },
  { key: "numbers", label: "Numbers (0-9)" },
  { key: "symbols", label: "Symbols (!@#…)" },
  { key: "avoidAmbiguous", label: "Avoid ambiguous" },
];

export function GeneratorPanel({ onUse }: Props) {
  const [opts, setOpts] = useState<GeneratorOptions>(DEFAULT_GENERATOR_OPTIONS);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  function regenerate(next: GeneratorOptions = opts) {
    setPassword(generatePassword(next));
  }

  useEffect(() => {
    setPassword(generatePassword(DEFAULT_GENERATOR_OPTIONS));
  }, []);

  const strength = useMemo(() => estimateStrength(password, opts), [password, opts]);

  function update(patch: Partial<GeneratorOptions>) {
    const next = { ...opts, ...patch };
    // Ensure at least one character class stays enabled.
    if (!next.uppercase && !next.lowercase && !next.numbers && !next.symbols) return;
    setOpts(next);
    regenerate(next);
  }

  async function copy() {
    if (!password) return;
    await copyToClipboard(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-[16px] rounded-[16px] border border-hairline bg-surface-soft p-[16px]">
      <div className="flex items-center gap-[12px] rounded-[12px] bg-canvas p-[12px]">
        <code className="tabular min-w-0 flex-1 break-all text-[16px] text-ink">{password}</code>
        <button
          type="button"
          onClick={() => regenerate()}
          aria-label="Regenerate"
          className="rounded-[100px] px-[10px] py-[6px] text-[13px] font-semibold text-primary hover:bg-surface-soft"
        >
          ↻
        </button>
      </div>

      <div className="flex items-center justify-between text-[13px]">
        <span className="font-semibold text-muted">Length: {opts.length}</span>
        <span
          className={
            strength.label === "Strong"
              ? "text-semantic-up"
              : strength.label === "Weak"
                ? "text-semantic-down"
                : "text-body"
          }
        >
          {strength.label} · {strength.bits} bits
        </span>
      </div>
      <input
        type="range"
        min={8}
        max={64}
        value={opts.length}
        onChange={(e) => update({ length: Number(e.target.value) })}
        className="w-full accent-primary"
        aria-label="Password length"
      />

      <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
        {toggles.map((t) => (
          <label key={t.key} className="flex items-center gap-[8px] text-[14px] text-ink">
            <input
              type="checkbox"
              className="h-[18px] w-[18px] accent-primary"
              checked={Boolean(opts[t.key])}
              onChange={(e) => update({ [t.key]: e.target.checked } as Partial<GeneratorOptions>)}
            />
            {t.label}
          </label>
        ))}
      </div>

      <div className="flex gap-[12px]">
        <Button variant="outline" block onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        {onUse && (
          <Button block onClick={() => onUse(password)}>
            Use password
          </Button>
        )}
      </div>
    </div>
  );
}
