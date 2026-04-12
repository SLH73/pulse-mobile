import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pulse</Text>
      <Text style={styles.subtitle}>Tu conexión llega a las 18:00</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0D0D0D',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 32, fontWeight: '500', color: '#F0F0EE', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#5F5E5A' },
});