import { View, Text, StyleSheet } from "react-native";

export default function AppointmentsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Appointments</Text>
      {/* TODO: Today's schedule + walk-in queue */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  heading: { fontSize: 24, fontWeight: "bold", color: "#111827" },
});
