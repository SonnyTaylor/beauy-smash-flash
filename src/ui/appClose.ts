/** Close the Tauri window when running as a desktop app. Returns false in browser dev. */
export async function closeApplicationWindow(): Promise<boolean> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
    return true;
  } catch {
    return false;
  }
}
