import React, { useEffect, useState } from "react";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { StatusBar, SafeAreaView, View, Text, Pressable, StyleSheet } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import ChatScreen from "./ChatScreen";
import TerminalScreen from "./TerminalScreen";
import ModelsScreen from "./ModelsScreen";
import AgentScreen from "./AgentScreen";
import FileAnalysisScreen from "./FileAnalysisScreen";
import { engine } from "./llm";

type Tab = "chat" | "terminal" | "models" | "agent" | "files";

export async function sendToTermux(command: string): Promise<void> {
  await IntentLauncher.startActivityAsync("com.termux.RUN_COMMAND", {
    extra: {
      "com.termux.RUN_COMMAND_PATH": "/data/data/com.termux/files/usr/bin/bash",
      "com.termux.RUN_COMMAND_ARGUMENTS": JSON.stringify(["-c", command]),
    },
  } as any);
}

export default function App() {
  const [tab, setTab] = useState<Tab>("models");
  const [loadedModel, setLoadedModel] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      engine.unload();
    };
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "chat", label: "\u{1F4AC}" },
    { id: "agent", label: "\u{1F916}" },
    { id: "terminal", label: "\u{2328}" },
    { id: "models", label: "\u{1F4E6}" },
    { id: "files", label: "\u{1F4CE}" },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <ExpoStatusBar style="light" />
      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <Pressable key={t.id} style={[styles.tab, tab === t.id && styles.tabActive]} onPress={() => setTab(t.id)}>
            <Text style={styles.tabText}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.body}>
        {tab === "chat" && <ChatScreen loadedModel={loadedModel} />}
        {tab === "terminal" && <TerminalScreen />}
        {tab === "models" && (
          <ModelsScreen
            loadedModel={loadedModel}
            onModelLoaded={(name) => { setLoadedModel(name); setTab("chat"); }}
          />
        )}
        {tab === "agent" && <AgentScreen />}
        {tab === "files" && <FileAnalysisScreen />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0d1117",
    paddingTop: StatusBar.currentHeight || 24,
  },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#21262d" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#238636" },
  tabText: { fontSize: 18 },
  body: { flex: 1 },
});
