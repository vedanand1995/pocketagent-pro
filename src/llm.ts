import { initLlama } from "llama.rn";
import type { LlamaContext } from "llama.rn";
import * as FS from "expo-file-system";

export interface LlmConfig {
  n_ctx: number;
  n_batch: number;
  n_threads: number;
  n_gpu_layers: number;
  max_tokens: number;
}

export const DEFAULT_CONFIG: LlmConfig = {
  n_ctx: 1536,
  n_batch: 512,
  n_threads: 4,
  n_gpu_layers: 0,
  max_tokens: 256,
};

export class LlmEngine {
  private ctx: LlamaContext | null = null;
  private config: LlmConfig = DEFAULT_CONFIG;

  get isLoaded(): boolean {
    return this.ctx !== null;
  }

  async load(modelPathWithUri: string): Promise<void> {
    await this.unload();

    // llama.rn native code needs a plain filesystem path, not a file:// URI
    const modelPath = modelPathWithUri.replace(/^file:\/\//, "");

    // sanity check: file must exist and be a plausible GGUF size
    const info = await FS.getInfoAsync("file://" + modelPath);
    if (!info.exists || typeof (info as any).size !== "number" || (info as any).size < 50 * 1024 * 1024) {
      throw new Error("Model file missing or too small — DELETE and re-download the model.");
    }

    this.ctx = await initLlama({
      model: modelPath,
      n_ctx: this.config.n_ctx,
      n_batch: this.config.n_batch,
      n_threads: this.config.n_threads,
      n_gpu_layers: this.config.n_gpu_layers,
      isVerbose: true,
    });
  }

  async unload(): Promise<void> {
    try { await this.ctx?.free(); } catch {}
    this.ctx = null;
  }

  async *chat(
    messages: { role: string; content: string }[],
    signal?: { aborted: boolean }
  ): AsyncGenerator<string> {
    if (!this.ctx) throw new Error("Model not loaded");
    for await (const chunk of this.ctx.completion({
      messages,
      n_predict: this.config.max_tokens,
      n_threads: this.config.n_threads,
    })) {
      if (signal?.aborted) break;
      if (typeof chunk === "string" && chunk.length > 0) yield chunk;
    }
  }
}

export const engine = new LlmEngine();
