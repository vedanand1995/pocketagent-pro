import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { runAgent, AgentStep } from "./agent/loop";
import { requestAccess, hasAccess } from "./agent/saf-bridge";
import { engine } from "./llm";

export default function AgentScreen() {
  const [task, setTask] = useState("");
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState(hasAccess());

  async function grantAccess() {
    setAccess(await requestAccess());
  }

  async function start() {
    if (!task.trim() || busy || !engine.isLoaded) return;
    setSteps([]);
    setBusy(true);
    try {
      await runAgent(task.trim(), (s) => setSteps((prev) => [...prev, s]));
    } finally { setBusy(false); }
  }

  return (
    <View style={styles.root}>
      <View style={styles.accessRow}>
        <Pressable style={[styles.grantBtn, access && styles.granted]} onPress={grantAccess}>
          <Text style={styles.grantText}>{access ? "✓ Output access" : "Grant Output Access"}</Text>
        </Pressable>
        {!engine.isLoaded && <Text style={styles.warn}>Pehle model load karo (3B recommended)</Text>}
      </View>
      <ScrollView style={styles.log}>
        {steps.map((s, i) => (
          <View key={i} style={[styles.stepRow, s.kind === "observation" && styles.obs, s.kind === "error" && styles.errRow, s.kind === "answer" && styles.ansRow]}>
            <Text style={styles.kind}>{s.kind === "thought" ? "🧠" : s.kind === "action" ? "⚡" : s.kind === "observation" ? "👁" : s.kind === "error" ? "❌" : "✅"}</Text>
            <Text style={styles.stepText}>{s.text}</Text>
          </View>
        ))}
        {steps.length === 0 && !busy && (
          <Text style={styles.placeholder}>Task do — jaise: "python script banao jo 1 se 10 print kare"</Text>
        )}
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={task} onChangeText={setTask}
          placeholder="Task likho…" placeholderTextColor="#555" multiline editable={!busy} />
        <Pressable style={[styles.goBtn, busy && styles.goBusy]} onPress={busy ? () => {} : start}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.goText}>▶</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d1117" },
  accessRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  grantBtn: { backgroundColor: "#9e6a03", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  granted: { backgroundColor: "#238636" },
  grantText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  warn: { color: "#f0883e", fontSize: 11, flex: 1 },
  log: { flex: 1, paddingHorizontal: 10 },
  stepRow: { flexDirection: "row", gap: 8, padding: 8, borderRadius: 8, marginBottom: 6, backgroundColor: "#161b22" },
  obs: { backgroundColor: "#0f1a2e" },
  errRow: { backgroundColor: "#2d1214" },
  ansRow: { backgroundColor: "#12261e", borderWidth: 1, borderColor: "#238636" },
  kind: { fontSize: 14 },
  stepText: { color: "#e6edf3", fontSize: 13, flex: 1 },
  placeholder: { color: "#666", textAlign: "center", marginTop: 30, paddingHorizontal: 24, lineHeight: 22 },
  inputRow: { flexDirection: "row", padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: "#21262d" },
  input: { flex: 1, color: "#e6edf3", backgroundColor: "#161b22", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100 },
  goBtn: { backgroundColor: "#8957e5", borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" },
  goBusy: { opacity: 0.5 },
  goText: { color: "#fff", fontSize: 18, fontWeight: "800" },
});
