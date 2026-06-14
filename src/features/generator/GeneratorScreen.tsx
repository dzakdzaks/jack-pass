import { GeneratorPanel } from "./GeneratorPanel";

export function GeneratorScreen() {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-[24px] p-[24px]">
      <div>
        <h1 className="text-[24px] font-normal tracking-[-0.4px] text-ink">Password generator</h1>
        <p className="mt-[4px] text-[15px] text-body">
          Generate a strong random password. Nothing is stored until you save it on a credential.
        </p>
      </div>
      <GeneratorPanel />
    </div>
  );
}
