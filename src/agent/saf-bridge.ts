import * as FS from "expo-file-system";

const SAF = (FS as any).StorageAccessFramework;
let dirUri: string | null = null;

export async function requestAccess(): Promise<boolean> {
  try {
    const perms = await SAF.requestDirectoryPermissionsAsync();
    if (perms && perms.granted && perms.directoryUri) {
      dirUri = perms.directoryUri;
      return true;
    }
  } catch {}
  return false;
}

export function hasAccess(): boolean {
  return dirUri !== null;
}

export async function observeTermuxOutput(): Promise<string> {
  if (!dirUri) return "No output access. Tap 'Grant Output Access' once.";
  try {
    const entries: any[] = await SAF.readDirectoryAsync(dirUri);
    const files = entries.map((e) =>
      typeof e === "string" ? { uri: e, name: (e.split("/").pop() || "") } : e
    );
    const target = files.find((f) => String(f.name).indexOf("agent_out.txt") !== -1);
    if (!target) return "(output file not found yet — command still running?)";
    const content = await SAF.readAsStringAsync(target.uri, {
      encoding: FS.EncodingType.UTF8,
    });
    return (content || "(empty output)").slice(0, 2000);
  } catch (e: any) {
    return "Read error: " + (e?.message || String(e));
  }
}
