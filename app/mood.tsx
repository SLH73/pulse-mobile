import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../src/lib/supabase';

type Mood = 'listen' | 'talk' | 'rest';

interface MoodOption {
  key: Mood;
  icon: string;
  label: string;
  sublabel: string;
  color: string;
  bg: string;
}

const OPTIONS: MoodOption[] = [
  {
    key:      'listen',
    icon:     '👂',
    label:    'Necesito escuchar',
    sublabel: 'Quiero que alguien me cuente algo',
    color:    '#7F77DD',
    bg:       '#1D1D3A',
  },
  {
    key:      'talk',
    icon:     '💬',
    label:    'Quiero hablar',
    sublabel: 'Tengo ganas de contar cosas',
    color:    '#1D9E75',
    bg:       '#1A2A1A',
  },
  {
    key:      'rest',
    icon:     '🌙',
    label:    'Solo estar',
    sublabel: 'Sin presion, lo que salga',
    color:    '#8F8E8A',
    bg:       '#1A1A18',
  },
];

export default function MoodScreen() {
  const router   = useRouter();
  const [selected, setSelected] = useState<Mood | null>(null);
  const [saving, setSaving]     = useState(false);
  const [checking, setChecking] = useState(true);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    checkMoodToday();
  }, []);

  // ✅ FIX BUG-006: Verificar si ya se seleccionó mood hoy antes de mostrar la pantalla
  const checkMoodToday = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/home'); return; }

      const { data } = await supabase
        .from('users')
        .select('mood_updated_at')
        .eq('id', user.id)
        .single();

      if (data?.mood_updated_at) {
        const moodDate = new Date(data.mood_updated_at);
        const today    = new Date();

        const isSameDay =
          moodDate.getFullYear() === today.getFullYear() &&
          moodDate.getMonth()    === today.getMonth()    &&
          moodDate.getDate()     === today.getDate();

        if (isSameDay) {
          // Ya seleccionó mood hoy — ir directo a home
          router.replace('/home');
          return;
        }
      }
    } catch (e) {
      console.error('Error comprobando mood:', e);
    } finally {
      setChecking(false);
    }

    // Animar entrada solo si debe mostrarse
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const selectMood = async (mood: Mood) => {
    if (saving) return;
    setSelected(mood);
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/home'); return; }

    await supabase.rpc('set_daily_mood', {
      p_user_id: user.id,
      p_mood:    mood,
    });

    setTimeout(() => {
      router.replace('/home');
    }, 600);
  };

  // Guardar mood 'rest' al saltar para que home no redirija de vuelta a mood
  const skip = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.rpc('set_daily_mood', { p_user_id: user.id, p_mood: 'rest' });
    }
    router.replace('/home');
  };

  // Mostrar nada mientras comprueba para evitar flash de pantalla
  if (checking) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Antes de tu Pulse de hoy</Text>
          <Text style={styles.title}>Como estas hoy?</Text>
          <Text style={styles.subtitle}>
            Te conectaremos con alguien que complementa tu energia del momento.
          </Text>
        </View>

        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const isSelected = selected === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.option,
                  { backgroundColor: option.bg, borderColor: option.color },
                  isSelected && styles.optionSelected,
                  saving && !isSelected && styles.optionDisabled,
                ]}
                onPress={() => selectMood(option.key)}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={styles.optionIcon}>{option.icon}</Text>
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, { color: option.color }]}>
                    {option.label}
                  </Text>
                  <Text style={styles.optionSublabel}>{option.sublabel}</Text>
                </View>
                {isSelected && (
                  <Text style={[styles.checkmark, { color: option.color }]}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {!saving && (
          <TouchableOpacity style={styles.skipBtn} onPress={skip}>
            <Text style={styles.skipText}>Saltar por hoy</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    padding: 24,
  },
  content:        { gap: 32 },
  header:         { gap: 8 },
  eyebrow:        { fontSize: 13, color: '#5F5E5A', letterSpacing: 0.5 },
  title:          { fontSize: 28, fontWeight: '500', color: '#F0F0EE' },
  subtitle:       { fontSize: 15, color: '#8F8E8A', lineHeight: 22 },
  options:        { gap: 12 },
  option: {
    flexDirection: 'row', alignItems: 'center',
    gap: 16, padding: 18, borderRadius: 16, borderWidth: 1,
  },
  optionSelected: { borderWidth: 2 },
  optionDisabled: { opacity: 0.4 },
  optionIcon:     { fontSize: 28 },
  optionText:     { flex: 1, gap: 2 },
  optionLabel:    { fontSize: 16, fontWeight: '500' },
  optionSublabel: { fontSize: 13, color: '#8F8E8A' },
  checkmark:      { fontSize: 18, fontWeight: '600' },
  skipBtn:        { alignItems: 'center', paddingVertical: 8 },
  skipText:       { fontSize: 14, color: '#444441' },
});
