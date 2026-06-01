/** Close the Tauri window when running as a desktop app. Returns false in browser dev. */
export async function closeApplicationWindow(): Promise<boolean> {
  try {
    const [{ getCurrentWindow }, { exit }] = await Promise.all([
      import('@tauri-apps/api/window'),
      import('@tauri-apps/plugin-process'),
    ]);
    await getCurrentWindow().close();
    await exit(0);
    return true;
  } catch {
    return false;
  }
}
