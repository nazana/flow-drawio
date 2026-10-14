export const editorUrl = '/drawio/index.html?embed=1&proto=json&offline=1&stealth=1&libraries=1&noSaveBtn=1&saveAndExit=0&noExitBtn=1&spin=1&lang=ko&ui=kennedy';
export function postEditorMessage(frame: Window | null | undefined, message: unknown) {
  frame?.postMessage(JSON.stringify(message), window.location.origin);
}
export function parseEditorMessage(raw: unknown): Record<string, any> | null {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return value && typeof value === 'object' && typeof value.event === 'string' ? value : null;
  } catch { return null; }
}
