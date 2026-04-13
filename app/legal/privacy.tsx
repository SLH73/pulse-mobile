import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Política de Privacidad</Text>
      <Text style={styles.updated}>Última actualización: abril 2026</Text>

      <Section title="1. Quién somos">
        Pulse es una aplicación móvil para adolescentes de 13 a 19 años que facilita conexiones interpersonales basadas en compatibilidad de identidad. El responsable del tratamiento de datos es Pulse App (en adelante, Pulse), con domicilio en Madrid, España.
      </Section>

      <Section title="2. Datos que recopilamos">
        Recopilamos los siguientes datos personales:{'\n\n'}
        - Dirección de correo electrónico (para autenticación){'\n'}
        - Año de nacimiento (para verificación de edad){'\n'}
        - Respuestas al onboarding (5 preguntas anonimizadas){'\n'}
        - Ciudad de residencia (opcional){'\n'}
        - Mensajes intercambiados en la app (efímeros, se eliminan a las 72 horas){'\n'}
        - Token de notificaciones push (para enviar alertas diarias)
      </Section>

      <Section title="3. Cómo usamos tus datos">
        Usamos tus datos exclusivamente para:{'\n\n'}
        - Autenticarte en la aplicación{'\n'}
        - Calcular tu compatibilidad con otros usuarios mediante un algoritmo anonimizado{'\n'}
        - Enviarte la notificación diaria de tu Pulse del día{'\n'}
        - Generar tu cápsula semanal visual (sin texto de conversaciones){'\n\n'}
        Nunca vendemos ni compartimos tus datos con terceros con fines comerciales.
      </Section>

      <Section title="4. Base legal del tratamiento">
        El tratamiento de tus datos se basa en:{'\n\n'}
        - Tu consentimiento expreso al registrarte{'\n'}
        - La ejecución del contrato de servicio (términos y condiciones){'\n'}
        - El cumplimiento de obligaciones legales aplicables
      </Section>

      <Section title="5. Menores de edad">
        Pulse esta diseñada exclusivamente para usuarios de 13 a 19 años. Los usuarios menores de 14 años necesitan el consentimiento verificable de sus padres o tutores legales, conforme a la LOPD española.{'\n\n'}
        Si eres padre o tutor y crees que tu hijo ha creado una cuenta sin tu consentimiento, contacta con nosotros en privacidad@pulseapp.es para eliminar la cuenta inmediatamente.
      </Section>

      <Section title="6. Retención de datos">
        - Mensajes: se eliminan automáticamente a las 72 horas{'\n'}
        - Vectores de identidad: anonimizados y cifrados{'\n'}
        - Datos de cuenta: se conservan mientras la cuenta esté activa{'\n'}
        - Al eliminar tu cuenta: todos tus datos se borran permanentemente en 30 días
      </Section>

      <Section title="7. Tus derechos (RGPD y LOPD)">
        Tienes derecho a:{'\n\n'}
        - Acceder a tus datos personales{'\n'}
        - Rectificar datos incorrectos{'\n'}
        - Solicitar la eliminación de tus datos{'\n'}
        - Oponerte al tratamiento{'\n'}
        - Solicitar la portabilidad de tus datos{'\n'}
        - Retirar tu consentimiento en cualquier momento{'\n\n'}
        Para ejercer estos derechos, contacta con nosotros en privacidad@pulseapp.es o usa el botón "Eliminar mi cuenta" en tu perfil.
      </Section>

      <Section title="8. Seguridad">
        Implementamos medidas técnicas y organizativas para proteger tus datos:{'\n\n'}
        - Cifrado de vectores de identidad{'\n'}
        - Políticas de acceso restringido (RLS) en base de datos{'\n'}
        - Transmisión cifrada mediante HTTPS/TLS{'\n'}
        - Privacidad diferencial en el algoritmo de matching
      </Section>

      <Section title="9. Transferencias internacionales">
        Tus datos se almacenan en servidores dentro de la Unión Europea (Supabase EU). El motor de matching se ejecuta en servidores de Railway (EE.UU.) bajo las garantías del Marco de Privacidad UE-EE.UU.
      </Section>

      <Section title="10. Cambios en esta política">
        Te notificaremos de cualquier cambio significativo en esta política mediante una notificación en la app o por email. El uso continuado de Pulse tras los cambios implica su aceptación.
      </Section>

      <Section title="11. Contacto">
        Para cualquier consulta sobre privacidad:{'\n\n'}
        Email: privacidad@pulseapp.es{'\n'}
        Dirección: Madrid, Espana{'\n\n'}
        También puedes presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) en www.aepd.es
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