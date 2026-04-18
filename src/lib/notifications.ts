// src/lib/notifications.ts
// Registro de token push y permisos
// ────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configurar cómo se muestran las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ────────────────────────────────────────────────────────────
// Registrar token de push
// ────────────────────────────────────────────────────────────

export async function registerPushToken(userId: string): Promise<void> {
  try {
    // Solo funciona en dispositivo real
    if (!Device.isDevice) {
      console.log('[notifications] Emulador detectado — push no disponible');
      return;
    }

    // Pedir permisos
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[notifications] Permisos de push denegados');
      return;
    }

    // Obtener token de Expo
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    const token = tokenData.data;
    if (__DEV__) console.log('[notifications] Token registrado:', token.slice(0, 20) + '...');

    // Guardar en Supabase
    await supabase.rpc('save_push_token', {
      p_user_id: userId,
      p_token:   token,
    });

    // Android: crear canal de notificaciones
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('pulse', {
        name:             'Pulse del día',
        importance:       Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#7F77DD',
      });
    }

  } catch (error) {
    console.error('[notifications] Error registrando token:', error);
  }
}
