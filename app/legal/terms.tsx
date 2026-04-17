import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Términos y Condiciones</Text>
      <Text style={styles.updated}>Última actualización: abril 2026</Text>

      <Section title="1. Aceptación">
        Al crear una cuenta en Pulse, aceptas estos términos en su totalidad. Si no estás de acuerdo, no uses la aplicación.
      </Section>

      <Section title="2. Edad mínima">
        Pulse está destinada exclusivamente a personas de entre 13 y 19 años. Al registrarte declaras tener esa edad. Los menores de 14 años necesitan consentimiento parental.
      </Section>

      <Section title="3. Uso aceptable">
        Te comprometes a no compartir contenido ofensivo, violento o sexual. No acosar ni intimidar a otros usuarios. No compartir datos personales de terceros. No usar la app para actividades ilegales.
      </Section>

      <Section title="4. Conversaciones efímeras">
        Las conversaciones desaparecen automáticamente a las 72 horas si no se guarda el contacto. Esto es una característica del servicio.
      </Section>

      <Section title="5. Moderación">
        Pulse puede suspender o eliminar cuentas que violen estos términos sin previo aviso.
      </Section>

      <Section title="6. Propiedad intelectual">
        El contenido que compartes sigue siendo tuyo. Nos concedes una licencia limitada para procesarlo con el único fin de ofrecer el servicio.
      </Section>

      <Section title="7. Limitación de responsabilidad">
        Pulse no se hace responsable de las interacciones entre usuarios. La app es un medio de conexión, no un servicio de supervisión.
      </Section>

      <Section title="8. Contacto">
        Para cualquier consulta: hola@pulseapp.es
      </Section>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { padding: 24, paddingTop: 48, paddingBottom: 48 },
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 15, color: '#7F77DD' },
  title: { fontSize: 28, fontWeight: '500', color: '#F0F0EE', marginBottom: 4 },
  updated: { fontSize: 12, color: '#5F5E5A', marginBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '500', color: '#F0F0EE', marginBottom: 8 },
  sectionText: { fontSize: 14, color: '#888780', lineHeight: 22 },
});