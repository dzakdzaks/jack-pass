// Clipboard copy — must be triggered by an explicit user action by the caller.

function execCommandCopy(text: string): boolean {
  if (!document.queryCommandSupported?.("copy")) return false;
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.cssText =
    "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none";
  document.body.appendChild(el);
  el.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(el);
  }
}

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    if (!execCommandCopy(text)) {
      throw new Error("Could not copy to clipboard.");
    }
  }
}
