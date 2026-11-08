import * as FS from "expo-file-system";

export interface ModelSpec {
  id: string;
  name: string;
  repo: string;
  file: string;
  sizeMB: number;
  note: string;
}

export const MODEL_CATALOG: ModelSpec[] = [
  {
    id: "qwen2.5-0.5b-q4",
    name: "Qwen2.5 0.5B Instruct Q4",
    repo: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
    file: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    sizeMB: 400,
    note: "FASTEST — basic chat only",
  },
  {
    id: "qwen2.5-3b-q4",
    name: "Qwen2.5 3B Instruct Q4",
    repo: "Qwen/Qwen2.5-3B-Instruct-GGUF",
    file: "qwen2.5-3b-instruct-q4_k_m.gguf",
    sizeMB: 2000,
    note: "AGENT GRADE — required for tool use",
  },
  {
    id: "llama3.2-1b-q4",
    name: "Llama 3.2 1B Instruct Q4",
    repo: "bartowski/Llama-3.2-1B-Instruct-GGUF",
    file: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    sizeMB: 810,
    note: "Better quality, slower",
  },
];

const DIR = FS.documentDirectory + "models/";

export async function ensureDir(): Promise<void> {
  const info = await FS.getInfoAsync(DIR);
  if (!info.exists) await FS.makeDirectoryAsync(DIR, { intermediates: true });
}

export function modelPath(spec: ModelSpec): string {
  return DIR + spec.id + ".gguf";
}

export async function isDownloaded(spec: ModelSpec): Promise<boolean> {
  const info = await FS.getInfoAsync(modelPath(spec));
  return info.exists;
}

export async function downloadModel(
  spec: ModelSpec,
  onProgress: (fraction: number) => void
): Promise<string> {
  await ensureDir();
  const url = "https://huggingface.co/" + spec.repo + "/resolve/main/" + spec.file;
  const target = modelPath(spec);
  const existing = await FS.getInfoAsync(target);
  if (existing.exists) return target;

  return new Promise((resolve, reject) => {
    const download = FS.createDownloadResumable(url, target, {}, (dl: any) => {
      if (dl.totalBytesExpectedToWrite > 0) {
        onProgress(dl.totalBytesWritten / dl.totalBytesExpectedToWrite);
      }
    });
    download.downloadAsync().then((res: any) => {
      if (res && res.status === 200) resolve(res.uri);
      else reject(new Error("Download failed: " + (res && res.status)));
    }).catch(reject);
  });
}

export async function deleteModel(spec: ModelSpec): Promise<void> {
  await FS.deleteAsync(modelPath(spec), { idempotent: true });
}
