import * as Location from 'expo-location';
import { supabase } from './supabase';

export async function detectAndSaveCity(userId: string): Promise<string | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const coords = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const [place] = await Location.reverseGeocodeAsync({
      latitude: coords.coords.latitude,
      longitude: coords.coords.longitude,
    });

    const city = place?.city || place?.subregion || place?.region || null;
    if (!city) return null;

    await supabase.from('users').update({ city }).eq('id', userId);
    return city;
  } catch {
    return null;
  }
}
