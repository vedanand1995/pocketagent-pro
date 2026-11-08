import React, { useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { engine } from "./llm";

interface Msg { role: "user" | "assistant"; content: string; }

export default function ChatScreen({ loadedModel }: { loadedModel: string | null }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef({ aborted: false });
  const listRef = useRef<FlatList<Msg>>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    abortRef.current = { aborted: false };
    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    let acc = "";
    try {
      for await (const tok of engine.chat(
        history.map((m) => ({ role: m.role, content: m.content })),
        abortRef.current
      )) {
        acc += tok;
        setMessages([...history, { role: "assistant", content: acc }]);
      }
    } catch (e: any) {
      setMessages([...history, { role: "assistant", content: "Error: " + (e?.message || e) }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.aiBubble]}>
            <Text style={styles.bubbleText}>{item.content}</Text>
          </View>
        )}
        ListHeaderComponent={
          <Text style={styles.header}>{loadedModel ?? "Pehle Models tab me model load karo"}</Text>
        }
        ListEmptyComponent={<Text style={styles.empty}>On-device chat — fully offline.</Text>}
      />
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={input} onChangeText={setInput}
          placeholder="Message…" placeholderTextColor="#666" editable={!busy} multiline />
        <Pressable style={[styles.sendBtn, busy && styles.sendBtnBusy]}
          onPress={busy ? () => { abortRef.current.aborted = true; } : send}>
          <Text style={styles.sendText}>{busy ? "Stop" : "Send"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d1117" },
  header: { color: "#58a6ff", fontSize: 12, textAlign: "center", padding: 8 },
  bubble: { margin: 8, marginHorizontal: 12, padding: 12, borderRadius: 14, maxWidth: "85%" },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#1f6feb" },
  aiBubble: { alignSelf: "flex-start", backgroundColor: "#161b22" },
  bubbleText: { color: "#e6edf3", fontSize: 15 },
  empty: { color: "#666", textAlign: "center", marginTop: 40, paddingHorizontal: 30 },
  inputRow: { flexDirection: "row", padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: "#21262d" },
  input: { flex: 1, color: "#e6edf3", backgroundColor: "#161b22", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120 },
  sendBtn: { backgroundColor: "#238636", borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" },
  sendBtnBusy: { backgroundColor: "#da3633" },
  sendText: { color: "#fff", fontWeight: "700" },
});
