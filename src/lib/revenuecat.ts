// src/lib/revenuecat.ts
// Wrapper de RevenueCat para gestión de suscripciones Pulse Deep
// ────────────────────────────────────────────────────────────

import Purchases, {
  PurchasesOffering,
  CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';

// ────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────

const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
const RC_IOS_KEY     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';

export const ENTITLEMENT_ID  = 'pulse_deep';
export const OFFERING_ID     = 'default';

// ────────────────────────────────────────────────────────────
// Inicialización (llamar en app/_layout.tsx)
// ────────────────────────────────────────────────────────────

export async function initRevenueCat(userId: string): Promise<void> {
  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
    await Purchases.configure({ apiKey, appUserID: userId });

  } catch (error) {
    console.error('[revenuecat] Error inicializando:', error);
  }
}

// ────────────────────────────────────────────────────────────
// Estado de suscripción
// ────────────────────────────────────────────────────────────

export async function getIsDeep(): Promise<boolean> {
  try {
    const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error) {
    console.error('[revenuecat] Error comprobando suscripción:', error);
    return false;
  }
}

// ────────────────────────────────────────────────────────────
// Obtener oferta actual
// ────────────────────────────────────────────────────────────

export async function getOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (error) {
    console.error('[revenuecat] Error obteniendo oferta:', error);
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Comprar suscripción mensual
// ────────────────────────────────────────────────────────────

export async function purchaseDeep(): Promise<{
  success: boolean;
  isDeep: boolean;
  error?: string;
}> {
  try {
    const offering = await getOffering();
    if (!offering) {
      return { success: false, isDeep: false, error: 'No hay ofertas disponibles' };
    }

    // Obtener el paquete mensual
    const monthly = offering.monthly;
    if (!monthly) {
      return { success: false, isDeep: false, error: 'Suscripcion mensual no disponible' };
    }

    const { customerInfo } = await Purchases.purchasePackage(monthly);
    const isDeep = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;

    return { success: true, isDeep };

  } catch (error: any) {
    // El usuario canceló — no es un error real
    if (error.userCancelled) {
      return { success: false, isDeep: false };
    }
    console.error('[revenuecat] Error en compra:', error);
    return { success: false, isDeep: false, error: error.message ?? 'Error desconocido' };
  }
}

// ────────────────────────────────────────────────────────────
// Restaurar compras
// ────────────────────────────────────────────────────────────

export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error) {
    console.error('[revenuecat] Error restaurando compras:', error);
    return false;
  }
}
