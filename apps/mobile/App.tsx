import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  assessUseCase,
  deriveServiceEndpoints,
  formatScore,
  probeEngines,
  probeGateway,
  safetySignals,
  sdgPriorities,
  useCases,
  type EngineProbeResult,
  type GatewayProbeResult,
} from "@iatg/shared";

const env = ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {});
const apiBaseURL = env.EXPO_PUBLIC_API_BASE_URL ?? env.NEXT_PUBLIC_API_BASE_URL ?? "";
const apiKey = env.EXPO_PUBLIC_API_KEY ?? env.NEXT_PUBLIC_API_KEY ?? "dev-key";
// Engine URLs: explicit env override wins; otherwise derived siblings when
// apiBaseURL points at the web deployment's /api/gateway proxy.
const derived = deriveServiceEndpoints(apiBaseURL);
const admBaseURL = env.EXPO_PUBLIC_ADM_API_BASE_URL ?? derived.adm;
const erhBaseURL = env.EXPO_PUBLIC_ERH_API_BASE_URL ?? derived.erh;

export default function App() {
  const [apiResults, setApiResults] = useState<GatewayProbeResult[]>([]);
  const [engineResults, setEngineResults] = useState<EngineProbeResult[]>([]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!apiBaseURL) return;
    let cancelled = false;
    setChecking(true);
    const probes: Promise<unknown>[] = [
      probeGateway({ baseURL: apiBaseURL, apiKey }, useCases[0]).then((results) => {
        if (!cancelled) setApiResults(results);
      }),
    ];
    if (admBaseURL || erhBaseURL) {
      probes.push(
        probeEngines({ admBaseURL, erhBaseURL }, useCases[0]).then((results) => {
          if (!cancelled) setEngineResults(results);
        }),
      );
    }
    Promise.allSettled(probes).finally(() => {
      if (!cancelled) setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>2026 Presidential Hackathon - International Track</Text>
        <Text style={styles.title}>Inclusive AI Trust Gateway</Text>
        <ApiStatus results={apiResults} checking={checking} />
        <EngineStatus results={engineResults} />
        <SdgPriorities />
        {useCases.map((useCase) => {
          const assessment = assessUseCase(useCase, safetySignals);
          return (
            <View key={useCase.id} style={styles.card}>
              <Text style={styles.domain}>{useCase.domain}</Text>
              <Text style={styles.cardTitle}>{useCase.name}</Text>
              <Text style={styles.summary}>{useCase.summary}</Text>
              <View style={styles.metrics}>
                <Metric label="Inclusion" value={formatScore(assessment.inclusionScore)} />
                <Metric label="Fairness" value={assessment.fairnessRisk} />
                <Metric label="Open data" value={formatScore(assessment.openDataReadiness)} />
                <Metric label="Agent safety" value={formatScore(assessment.agentSafetyReadiness)} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SdgPriorities() {
  const top = sdgPriorities.filter((item) => item.priority === "P0" || item.priority === "P1");

  return (
    <View style={styles.apiPanel}>
      <Text style={styles.panelTitle}>SDG Priority List</Text>
      {top.map((item) => (
        <View key={item.sdg} style={styles.sdgRow}>
          <Text style={styles.apiLabel}>
            {item.priority} - {item.sdg}
          </Text>
          <Text style={styles.apiValue}>{item.name}</Text>
          <Text style={styles.apiDetail}>{item.repoCanDo}</Text>
        </View>
      ))}
    </View>
  );
}

function ApiStatus({ results, checking }: { results: GatewayProbeResult[]; checking: boolean }) {
  if (!apiBaseURL) {
    return (
      <View style={styles.apiPanel}>
        <Text style={styles.panelTitle}>Gateway APIs</Text>
        <Text style={styles.summary}>
          Offline demo mode. Set EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_API_KEY to connect mobile to the gateway.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.apiPanel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Gateway APIs</Text>
        <Pressable onPress={() => Linking.openURL(`${apiBaseURL.replace(/\/+$/, "")}/docs`)}>
          <Text style={styles.docsLink}>Swagger</Text>
        </Pressable>
      </View>
      {checking && results.length === 0 ? <Text style={styles.summary}>Checking gateway APIs...</Text> : null}
      {results.map((result) => (
        <View key={result.surface} style={[styles.apiRow, result.ok ? styles.apiOk : styles.apiFail]}>
          <Text style={styles.apiLabel}>{result.label}</Text>
          <Text style={styles.apiValue}>{result.ok ? "Connected" : "Check required"}</Text>
          <Text style={styles.apiDetail}>{result.detail}</Text>
        </View>
      ))}
    </View>
  );
}

function EngineStatus({ results }: { results: EngineProbeResult[] }) {
  if (!apiBaseURL || results.length === 0) return null;
  return (
    <View style={styles.apiPanel}>
      <Text style={styles.panelTitle}>Engines (ADM + ERH)</Text>
      {results.map((result) => (
        <View key={result.label} style={[styles.apiRow, result.ok ? styles.apiOk : styles.apiFail]}>
          <Text style={styles.apiLabel}>{result.label}</Text>
          <Text style={styles.apiValue}>{result.ok ? "Connected" : "Check required"}</Text>
          <Text style={styles.apiDetail}>{result.detail}</Text>
        </View>
      ))}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef3f2" },
  scroll: { padding: 20, paddingTop: 64, gap: 12 },
  eyebrow: { fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#4a6367" },
  title: { fontSize: 26, fontWeight: "700", color: "#1b2528", marginBottom: 8 },
  apiPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  panelTitle: { fontSize: 18, fontWeight: "700", color: "#1b2528", marginBottom: 8 },
  docsLink: { color: "#0d5d4e", fontWeight: "800" },
  apiRow: { borderRadius: 10, padding: 12, marginTop: 8 },
  apiOk: { backgroundColor: "#edf8f5" },
  apiFail: { backgroundColor: "#fff5f1" },
  apiLabel: { fontSize: 11, color: "#4a6367", textTransform: "uppercase", fontWeight: "700" },
  apiValue: { fontSize: 15, color: "#1b2528", fontWeight: "700", marginTop: 3 },
  apiDetail: { fontSize: 12, color: "#3c4a4d", marginTop: 3 },
  sdgRow: { borderRadius: 10, padding: 12, marginTop: 8, backgroundColor: "#f8fbfa" },
  card: { backgroundColor: "#ffffff", borderRadius: 14, padding: 16, marginBottom: 12 },
  domain: { fontSize: 12, textTransform: "uppercase", color: "#4a6367" },
  cardTitle: { fontSize: 18, fontWeight: "600", color: "#1b2528", marginVertical: 4 },
  summary: { fontSize: 14, color: "#3c4a4d", marginBottom: 12 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { backgroundColor: "#eef3f2", borderRadius: 10, padding: 10, minWidth: 80 },
  metricLabel: { fontSize: 11, color: "#4a6367" },
  metricValue: { fontSize: 15, fontWeight: "700", color: "#1b2528" },
});
