import * as FS from "expo-file-system";
import { sendToTermux } from "../App";
import { MODEL_CATALOG, downloadModel, isDownloaded } from "../models";
import { broadcast } from "./event-bus";
import { observeTermuxOutput } from "./saf-bridge";

export interface Tool {
  name: string;
  desc: string;
  run: (input: string) => Promise<string>;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();
}

async function webSearch(query: string): Promise<string> {
  try {
    const res = await fetch(
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query),
      { headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14)" } }
    );
    const html = await res.text();
    const titles = [...html.matchAll(/class="result__a"[^>]*>([^<]+)</a>/g)].map((m) => stripTags(m[1]));
    const snips = [...html.matchAll(/class="result__snippet"[^>]*>(.*?)</a>/gs)].map((m) => stripTags(m[1]));
    const results: string[] = [];
    for (let i = 0; i < Math.min(5, titles.length); i++) {
      results.push((i + 1) + ". " + titles[i] + " — " + (snips[i] || ""));
    }
    return results.length ? results.join("\n") : "No results found.";
  } catch (e: any) {
    return "Search error: " + (e?.message || e) + " (check internet)";
  }
}

const HOME = FS.documentDirectory + "home/";

async function ensureHome(): Promise<void> {
  const info = await FS.getInfoAsync(HOME);
  if (!info.exists) {
    await FS.makeDirectoryAsync(HOME, { intermediates: true });
  }
}

export async function runTermux(cmd: string): Promise<string> {
  const wrapped =
    "mkdir -p ~/storage/shared/PocketAgent && cd ~/storage/shared/PocketAgent && " +
    "{ " + cmd + "; echo __EXIT_CODE__:$?; } > agent_out.txt 2>&1";
  await sendToTermux(wrapped);
  return "Command sent to Termux.";
}

export const TOOLS: Tool[] = [
  { name: "search", desc: "Search the internet. Input: search query.", run: webSearch },
  {
    name: "write_file",
    desc: "Create/overwrite a file in the app home. Input: filename, then a line with only ---, then the full file content.",
    run: async (input) => {
      await ensureHome();
      const sep = input.indexOf("\n---\n");
      if (sep === -1) return "Invalid format. Use: filename\n---\ncontent";
      const name = input.slice(0, sep).trim().replace(/\.\.\//g, "");
      const content = input.slice(sep + 5);
      await FS.writeAsStringAsync(HOME + name, content);
      return "Wrote " + content.length + " chars to " + name;
    },
  },
  {
    name: "read_file",
    desc: "Read a file from the app home. Input: filename.",
    run: async (name) => {
      try {
        const c = await FS.readAsStringAsync(HOME + name.trim().replace(/\.\.\//g, ""));
        return c.slice(0, 3000);
      } catch {
        return "File not found: " + name;
      }
    },
  },
  {
    name: "run_termux",
    desc: "Run a shell/Python command in Termux (real Linux, has pip). Input: the command. Output is checked automatically.",
    run: runTermux,
  },
  {
    name: "read_output",
    desc: "Read the latest output of the last Termux command. Input: (ignored).",
    run: () => observeTermuxOutput(),
  },
  {
    name: "download_model",
    desc: "Download an AI model. Input: model id (see models).",
    run: async (id) => {
      const spec = MODEL_CATALOG.find((m) => m.id === id.trim());
      if (!spec) return "Unknown model. Options: " + MODEL_CATALOG.map((m) => m.id).join(", ");
      if (await isDownloaded(spec)) return spec.name + " already downloaded.";
      await downloadModel(spec, (f) =>
        broadcast("downloading " + spec.id + ": " + Math.round(f * 100) + "%")
      );
      return "Downloaded: " + spec.name;
    },
  },
];
