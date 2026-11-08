import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { ShellLine, setShellPrinter, runCommand } from "./shell";
import { subscribe } from "./agent/event-bus";

let idCounter = 0;

export default function TerminalScreen() {
  const [lines, setLines] = useState<ShellLine[]>([
    { id: 0, text: "PocketAgent Pro terminal — 'help'", kind: "out" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setShellPrinter((line) => {
      setLines((prev) => {
        if (line.text === "__CLEAR__") return [];
        return [...prev, { ...line, id: ++idCounter }];
      });
    });
    const unsub = subscribe((line, kind) => {
      setLines((prev) => [...prev, { id: ++idCounter, text: line, kind }]);
    });
    return () => { unsub(); };
  }, []);

  const exec = useCallback(async () => {
    const cmd = input.trim();
    if (!cmd || busy) return;
    setInput("");
    setHistory((h) => [cmd, ...h].slice(0, 50));
    setHistIdx(-1);
    setLines((prev) => [...prev, { id: ++idCounter, text: "$ " + cmd, kind: "cmd" }]);
    setBusy(true);
    try { await runCommand(cmd); } finally { setBusy(false); }
  }, [input, busy]);

  return (
    <View style={styles.root}>
      <ScrollView ref={scrollRef} style={styles.term}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        {lines.map((l) => (
          <Text key={l.id} style={[styles.line, l.kind === "cmd" && styles.cmdLine, l.kind === "err" && styles.errLine]}>
            {l.text}
          </Text>
        ))}
        {busy && <Text style={styles.line}>…</Text>}
      </ScrollView>
      <View style={styles.inputRow}>
        <Pressable onPress={() => {
          const idx = Math.min(histIdx + 1, history.length - 1);
          if (history[idx] !== undefined) { setHistIdx(idx); setInput(history[idx]); }
        }} style={styles.histBtn}>
          <Text style={styles.histText}>↑</Text>
        </Pressable>
        <TextInput style={styles.input} value={input} onChangeText={setInput}
          placeholder="~ $" placeholderTextColor="#444" onSubmitEditing={exec}
          autoCapitalize="none" autoCorrect={false} />
        <Pressable style={styles.runBtn} onPress={exec} disabled={busy}>
          <Text style={styles.runText}>⏎</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  term: { flex: 1, paddingHorizontal: 10, paddingTop: 8 },
  line: { color: "#33ff66", fontFamily: "monospace", fontSize: 13, lineHeight: 19 },
  cmdLine: { color: "#e6edf3", fontWeight: "700" },
  errLine: { color: "#ff5555" },
  inputRow: { flexDirection: "row", alignItems: "center", padding: 8, gap: 8, borderTopWidth: 1, borderTopColor: "#1b1f27", backgroundColor: "#0a0d12" },
  histBtn: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#161b22", borderRadius: 8 },
  histText: { color: "#33ff66", fontSize: 15 },
  input: { flex: 1, color: "#33ff66", backgroundColor: "#161b22", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontFamily: "monospace", fontSize: 14 },
  runBtn: { backgroundColor: "#238636", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  runText: { color: "#fff", fontWeight: "700" },
});
