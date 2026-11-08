# PocketAgent Pro 🤖

On-device AI + built-in terminal + autonomous agent. No server, no API keys —
inference runs locally via llama.cpp (llama.rn).

## Modes
- 💬 Chat — streaming AI chat, fully offline
- 🤖 Agent — ReAct loop: think, search internet, write code, run in Termux, observe, self-fix
- ⌨ Terminal — app-sandbox shell + live agent actions
- 📦 Models — GGUF model manager (download / load / delete)
- 📎 Files — upload and analyze files with the model

## One-time phone setup
1. Install Termux + Termux:API (F-Droid)
2. Termux drawer, Settings, Allow external commands ON
3. In Termux: termux-setup-storage and pkg install python
4. App, Models, download Qwen2.5 3B, LOAD
5. Agent tab, Grant Output Access, pick the PocketAgent folder

## First test task
python script banao jo 1 se 10 tak print kare

## Build
Push to main, Actions, download pocketagent-pro-apk artifact.
