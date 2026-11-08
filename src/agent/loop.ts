import { engine } from "../llm";
import { TOOLS } from "./tools";
import { broadcast } from "./event-bus";
import { observeTermuxOutput } from "./saf-bridge";

export interface AgentStep {
  kind: "thought" | "action" | "observation" | "answer" | "error";
  text: string;
}

const SYSTEM_PROMPT = "You are an autonomous AI agent running on an Android phone with a Termux Linux environment.\n\n" +
  "Available tools:\n" + TOOLS.map((t) => "- " + t.name + ": " + t.desc).join("\n") + "\n\n" +
  "At every step respond in EXACTLY this format:\n" +
  "Thought: <your reasoning>\n" +
  "Action: <one tool name>\n" +
  "Action Input: <input for that tool>\n\n" +
  "You will then receive:\n" +
  "Observation: <tool result>\n\n" +
  "When the task is fully complete, respond with:\n" +
  "Thought: I now know the final answer\n" +
  "Final Answer: <answer for the user>\n\n" +
  "Rules:\n" +
  "- One action per step. Wait for the Observation.\n" +
  "- If an Observation contains an error, do NOT give up. Think about the cause, fix the script with write_file, and run it again.\n" +
  "- For coding tasks: write_file the script, then run_termux to install deps and execute.\n" +
  "- run_termux has python and pip. pip install any package you need first.\n" +
  "- Keep answers concise.";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runAgent(
  task: string,
  onStep: (step: AgentStep) => void,
  opts: { maxSteps?: number } = {}
): Promise<void> {
  const maxSteps = opts.maxSteps ?? 12;
  const transcript: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: "Task: " + task },
  ];

  for (let step = 0; step < maxSteps; step++) {
    let reply = "";
    for await (const tok of engine.chat(transcript)) reply += tok;
    transcript.push({ role: "assistant", content: reply });

    const thought = reply.match(/Thought:\s*([\s\S]*?)(?=\nAction:|\nFinal Answer:|$)/)?.[1]?.trim();
    if (thought) onStep({ kind: "thought", text: thought });

    const finalMatch = reply.match(/Final Answer:\s*([\s\S]*)/);
    if (finalMatch) {
      onStep({ kind: "answer", text: finalMatch[1].trim() });
      broadcast("✅ FINAL: " + finalMatch[1].trim().slice(0, 200));
      return;
    }

    const actionMatch = reply.match(/Action:\s*(\S+)[\s\S]*?Action Input:\s*([\s\S]*?)$/);
    if (!actionMatch) {
      onStep({ kind: "error", text: "Model ne format follow nahi kiya — nudging." });
      broadcast("❌ parse fail, nudging model", "err");
      transcript.push({
        role: "user",
        content: "Invalid format. Respond ONLY with:\nThought: ...\nAction: ...\nAction Input: ...",
      });
      continue;
    }

    const toolName = actionMatch[1].replace(/:$/, "").trim();
    const rawInput = actionMatch[2].trim();
    const tool = TOOLS.find((t) => t.name === toolName);
    if (!tool) {
      onStep({ kind: "error", text: "Unknown tool: " + toolName });
      transcript.push({
        role: "user",
        content: "Observation: Unknown tool '" + toolName + "'. Use one of: " + TOOLS.map((t) => t.name).join(", "),
      });
      continue;
    }

    onStep({ kind: "action", text: toolName + ": " + rawInput.slice(0, 150) });
    broadcast("⚡ " + toolName + " " + rawInput.slice(0, 100), "cmd");

    let observation: string;
    try {
      observation = await tool.run(rawInput);
    } catch (e: any) {
      observation = "Tool error: " + (e?.message || String(e));
    }

    if (toolName === "run_termux") {
      onStep({ kind: "observation", text: "waiting for output…" });
      broadcast("⏳ waiting for termux output…");
      observation = "";
      for (let i = 0; i < 10; i++) {
        await sleep(3000);
        observation = await observeTermuxOutput();
        if (observation.indexOf("__EXIT_CODE__") !== -1) break;
      }
    }

    onStep({ kind: "observation", text: observation.slice(0, 300) });
    broadcast("👁 " + observation.slice(0, 150));
    transcript.push({ role: "user", content: "Observation: " + observation });
  }

  onStep({ kind: "error", text: "Max steps reached." });
  broadcast("❌ max steps reached", "err");
}
