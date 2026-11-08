import * as FS from "expo-file-system";
import { MODEL_CATALOG, downloadModel, isDownloaded, deleteModel, modelPath } from "./models";
import { engine } from "./llm";

export interface ShellLine {
  id: number;
  text: string;
  kind: "cmd" | "out" | "err";
}

const HOME = FS.documentDirectory + "home/";

async function ensureHome(): Promise<void> {
  const info = await FS.getInfoAsync(HOME);
  if (!info.exists) {
    await FS.makeDirectoryAsync(HOME, { intermediates: true });
    await FS.writeAsStringAsync(
      HOME + "welcome.txt",
      "Welcome to PocketAgent Pro shell! Type 'help'.\n"
    );
  }
}

let onPrint: (line: Omit<ShellLine, "id">) => void = () => {};

export function setShellPrinter(fn: (line: Omit<ShellLine, "id">) => void): void {
  onPrint = fn;
}

export function print(text: string, kind: ShellLine["kind"] = "out"): void {
  text.split("\n").forEach((l) => onPrint({ text: l, kind }));
}

export async function runCommand(raw: string): Promise<void> {
  await ensureHome();
  const input = raw.trim();
  if (!input) return;
  const parts = input.split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  try {
    switch (cmd) {
      case "help":
        print([
          "PocketAgent Pro shell — app sandbox terminal",
          "",
          "  help                 show this help",
          "  ls                   list files",
          "  cat <file>           print file contents",
          "  echo <text>          print text",
          "  touch <file>         create empty file",
          "  write <file> <text>  write text to file",
          "  rm <file>            delete file",
          "  clear                clear screen",
          "  models              list AI models",
          "  download <model-id>  download a GGUF model",
          "  load <model-id>      load model into llama.cpp",
          "  unload               free model memory",
          "  whoami / pwd / date  basics",
          "  ai <question>        ask the on-device model",
        ].join("\n"));
        break;
      case "ls": {
        const files = (await FS.readDirectoryAsync(HOME)).sort();
        print(files.length ? files.join("\n") : "(empty)");
        break;
      }
      case "cat": {
        if (!args[0]) throw new Error("usage: cat <file>");
        print((await FS.readAsStringAsync(HOME + args[0])).replace(/\n$/, ""));
        break;
      }
      case "echo":
        print(args.join(" "));
        break;
      case "touch":
        if (!args[0]) throw new Error("usage: touch <file>");
        await FS.writeAsStringAsync(HOME + args[0], "");
        break;
      case "write": {
        if (args.length < 2) throw new Error("usage: write <file> <text>");
        await FS.writeAsStringAsync(HOME + args[0], args.slice(1).join(" "));
        break;
      }
      case "rm":
        if (!args[0]) throw new Error("usage: rm <file>");
        await FS.deleteAsync(HOME + args[0], { idempotent: true });
        break;
      case "clear":
        onPrint({ text: "__CLEAR__", kind: "out" });
        break;
      case "models": {
        for (const m of MODEL_CATALOG) {
          const dl = await isDownloaded(m);
          print((dl ? "[v]" : "[ ]") + " " + m.id + " — " + m.name + " (~" + m.sizeMB + "MB)");
        }
        print(engine.isLoaded ? "Model loaded: YES" : "Model loaded: no");
        break;
      }
      case "download": {
        const spec = MODEL_CATALOG.find((m) => m.id === args[0]);
        if (!spec) throw new Error("unknown model: " + args[0]);
        print("Downloading " + spec.name + "…");
        await downloadModel(spec, () => {});
        print("Done: " + spec.name);
        break;
      }
      case "load": {
        const spec = MODEL_CATALOG.find((m) => m.id === args[0]);
        if (!spec) throw new Error("unknown model: " + args[0]);
        if (!(await isDownloaded(spec))) throw new Error("not downloaded — run: download " + spec.id);
        print("Loading " + spec.name + "…");
        await engine.load(modelPath(spec));
        print("Model ready.");
        break;
      }
      case "unload":
        await engine.unload();
        print("Model unloaded.");
        break;
      case "whoami":
        print("u0_a<pocketagent> — app sandbox user");
        break;
      case "pwd":
        print(HOME);
        break;
      case "date":
        print(new Date().toString());
        break;
      case "ai": {
        if (!engine.isLoaded) throw new Error("no model loaded — run: load <model-id>");
        const q = args.join(" ");
        if (!q) throw new Error("usage: ai <question>");
        for await (const tok of engine.chat([
          { role: "system", content: "You are a helpful offline assistant. Be brief." },
          { role: "user", content: q },
        ])) {
          print(tok);
        }
        break;
      }
      default:
        print("command not found: " + cmd + " — try 'help'", "err");
    }
  } catch (e: any) {
    print("error: " + (e?.message || String(e)), "err");
  }
}
