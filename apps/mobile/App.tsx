// Mobile scaffold (ships post-submission, per plan D3): a read-only trust
// overview backed by the same @iatg/shared scoring the web app uses. The
// gateway API client is wired in the finals milestone.

import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { assessUseCase, formatScore, safetySignals, useCases } from "@iatg/shared";

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>2026 Presidential Hackathon - International Track</Text>
        <Text style={styles.title}>Inclusive AI Trust Gateway</Text>
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
  card: { backgroundColor: "#ffffff", borderRadius: 14, padding: 16, marginBottom: 12 },
  domain: { fontSize: 12, textTransform: "uppercase", color: "#4a6367" },
  cardTitle: { fontSize: 18, fontWeight: "600", color: "#1b2528", marginVertical: 4 },
  summary: { fontSize: 14, color: "#3c4a4d", marginBottom: 12 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { backgroundColor: "#eef3f2", borderRadius: 10, padding: 10, minWidth: 80 },
  metricLabel: { fontSize: 11, color: "#4a6367" },
  metricValue: { fontSize: 15, fontWeight: "700", color: "#1b2528" },
});
