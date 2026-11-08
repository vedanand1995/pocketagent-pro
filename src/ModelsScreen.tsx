import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { MODEL_CATALOG, ModelSpec, downloadModel, isDownloaded, deleteModel, modelPath } from "./models";
import { engine } from "./llm";

export default function ModelsScreen({ loadedModel, onModelLoaded }: {
  loadedModel: string | null; onModelLoaded: (name: string) => void;
}) {
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const states: Record<string, boolean> = {};
    for (const m of MODEL_CATALOG) states[m.id] = await isDownloaded(m);
    setDownloaded(states);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleDownload(spec: ModelSpec) {
    setProgress((p) => ({ ...p, [spec.id]: 0 }));
    try {
      await downloadModel(spec, (f) => setProgress((p) => ({ ...p, [spec.id]: f })));
      await refresh();
    } finally {
      setProgress((p) => { const n = { ...p }; delete n[spec.id]; return n; });
    }
  }

  async function handleLoad(spec: ModelSpec) {
    setLoading(true);
    try {
      await engine.load(modelPath(spec));
      onModelLoaded(spec.name);
    } finally { setLoading(false); }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Model Manager</Text>
      <Text style={styles.sub}>Models download separately — APK stays small.</Text>
      <FlatList
        data={MODEL_CATALOG}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => {
          const isDown = downloaded[item.id];
          const isDownloading = progress[item.id] !== undefined;
          const isLoaded = loadedModel === item.name;
          return (
            <View style={styles.card}>
              <Text style={styles.modelName}>{item.name}</Text>
              <Text style={styles.modelNote}>{item.note} · ~{item.sizeMB} MB</Text>
              {isDownloading ? (
                <View style={styles.row}>
                  <ActivityIndicator size="small" color="#58a6ff" />
                  <Text style={styles.progressText}>{Math.round((progress[item.id] || 0) * 100)}%</Text>
                </View>
              ) : isDown ? (
                <View style={styles.row}>
                  <Pressable style={[styles.btn, styles.loadBtn, (isLoaded || loading) && styles.disabled]}
                    disabled={isLoaded || loading} onPress={() => handleLoad(item)}>
                    <Text style={styles.btnText}>{isLoaded ? "LOADED" : loading ? "LOADING…" : "LOAD"}</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.delBtn]} onPress={() => deleteModel(item).then(refresh)}>
                    <Text style={styles.btnText}>DELETE</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={[styles.btn, styles.loadBtn]} onPress={() => handleDownload(item)}>
                  <Text style={styles.btnText}>DOWNLOAD</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d1117", padding: 14 },
  heading: { color: "#e6edf3", fontSize: 22, fontWeight: "700", marginTop: 10 },
  sub: { color: "#666", marginBottom: 12 },
  card: { backgroundColor: "#161b22", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#21262d" },
  modelName: { color: "#e6edf3", fontSize: 16, fontWeight: "600" },
  modelNote: { color: "#666", marginTop: 4, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  btn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  loadBtn: { backgroundColor: "#238636" },
  delBtn: { backgroundColor: "#da3633" },
  disabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  progressText: { color: "#58a6ff", marginLeft: 8 },
});
