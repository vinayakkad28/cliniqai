import { View, Text, StyleSheet } from "react-native";

export default function PatientsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Patients</Text>
      {/* TODO: Patient list with search */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  heading: { fontSize: 24, fontWeight: "bold", color: "#111827" },
});
