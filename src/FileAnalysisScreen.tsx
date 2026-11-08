import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Image, StyleSheet } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FS from "expo-file-system";
import { engine } from "./llm";
import { broadcast } from "./agent/event-bus";

export default function FileAnalysisScreen() {
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");

  async function pick() {
    const res = await DocumentPicker.getDocumentAsync({});
    if (!res.canceled && res.assets && res.assets[0]) {
      setFile(res.assets[0]);
      setAnalysis("");
    }
  }

  async function analyze() {
    if (!file || busy || !engine.isLoaded) return;
    setBusy(true);
    broadcast("📎 analyzing " + file.name);
    try {
      let content = "";
      if (file.mimeType && file.mimeType.indexOf("image/") === 0) {
        const b64 = await FS.readAsStringAsync(file.uri, { encoding: FS.EncodingType.Base64 });
        content = "[IMAGE attached: " + file.name + ", base64 size " + b64.length + " — needs a VISION model]";
      } else {
        const raw = await FS.readAsStringAsync(file.uri);
        content = raw.slice(0, 6000);
      }
      let acc = "";
      for await (const tok of engine.chat([
        { role: "system", content: "You analyze files for the user. Be concise and factual." },
        { role: "user", content: "Analyze this file (" + file.name + "):\n\n" + content + "\n\n" + (question ? "Question: " + question : "Give a summary and key findings.") },
      ])) {
        acc += tok;
        setAnalysis(acc);
      }
      broadcast("✅ analysis done");
    } catch (e: any) {
      setAnalysis("Error: " + (e?.message || String(e)));
      broadcast("❌ analysis failed", "err");
    } finally { setBusy(false); }
  }

  return (
    <View style={styles.root}>
      <Pressable style={styles.pickBtn} onPress={pick}>
        <Text style={styles.pickText}>{file ? "📄 " + file.name : "📎 File Choose Karo"}</Text>
      </Pressable>
      {file && file.mimeType && file.mimeType.indexOf("image/") === 0 && (
        <Image source={{ uri: file.uri }} style={styles.preview} resizeMode="contain" />
      )}
      <TextInput
        style={styles.qInput}
        value={question}
        onChangeText={setQuestion}
        placeholder="Kuch specific poochna hai? (optional)"
        placeholderTextColor="#555"
      />
      <Pressable style={[styles.analyzeBtn, (busy || !file) && styles.disabled]} disabled={busy || !file} onPress={analyze}>
        <Text style={styles.pickText}>{busy ? "Analyzing…" : "🔍 Analyze"}</Text>
      </Pressable>
      <ScrollView style={styles.out}>
        {analysis ? <Text style={styles.outText}>{analysis}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d1117", padding: 14 },
  pickBtn: { backgroundColor: "#161b22", borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#21262d" },
  pickText: { color: "#e6edf3", fontWeight: "600" },
  preview: { height: 180, borderRadius: 12, marginTop: 12 },
  qInput: { color: "#e6edf3", backgroundColor: "#161b22", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  analyzeBtn: { backgroundColor: "#8957e5", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 12 },
  disabled: { opacity: 0.4 },
  out: { flex: 1, backgroundColor: "#161b22", borderRadius: 12, padding: 14, marginTop: 12 },
  outText: { color: "#e6edf3", fontSize: 14, lineHeight: 21 },
});
