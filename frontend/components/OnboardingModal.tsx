import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

export interface OnboardingStep {
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  tip: string;
  icon: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    badge: "🎙️ DICTADO INTELIGENTE",
    badgeColor: "#38BDF8",
    icon: "🎤",
    title: "Captura rápida con tu voz",
    description:
      "Dicta libremente lo que necesitas registrar. El sistema interpreta en lenguaje natural si es una tarea, nota o evento, detectando fechas, horas y etiquetas. Recuerda que puedes crear todas las categorías y etiquetas que necesites a tu medida.",
    tip: "💡 Prueba diciendo: 'tarea comprar pan para mañana con prioridad alta'",
  },
  {
    badge: "🏷️ CATEGORÍAS Y ETIQUETAS",
    badgeColor: "#EC4899",
    icon: "🏷️",
    title: "Crea las categorías y etiquetas que necesites",
    description:
      "Organiza tu información a tu manera: puedes crear tantas categorías y etiquetas como necesites. Personalízalas con tus propios colores, nombres y comandos de voz únicos para dictar.",
    tip: "💡 Gestiona y añade tus categorías y etiquetas en cualquier momento desde la pestaña 'Explorador'.",
  },
  {
    badge: "📅 CALENDARIO Y AGENDA",
    badgeColor: "#10B981",
    icon: "🗓️",
    title: "Visualiza todo tu mes",
    description:
      "Tus tareas y eventos se ubican automáticamente en su fecha. Si no especificas fecha al dictar una tarea, se programa automáticamente para hoy.",
    tip: "💡 Toca cualquier día para ver sus entradas o añadir algo rápidamente.",
  },
  {
    badge: "✅ TAREAS Y PRIORIDADES",
    badgeColor: "#F59E0B",
    icon: "📋",
    title: "Control total de tus pendientes",
    description:
      "Clasifica por prioridades Alta, Media o Baja. Marca tareas completadas con un solo toque y consulta pendientes en cualquier momento.",
    tip: "💡 Usa la pestaña 'Pendientes' para ver lo que requiere tu atención inmediata.",
  },
  {
    badge: "🔔 AVISOS Y NOTIFICACIONES",
    badgeColor: "#818CF8",
    icon: "🔔",
    title: "Nunca olvides un compromiso",
    description:
      "Programa avisos a la hora exacta o con antelación calculada (15 min antes, 1h antes). Recibe alertas incluso con la app cerrada.",
    tip: "💡 Concede los permisos de notificaciones del navegador para recibir avisos.",
  },
];

export function getOnboardingStorageKey(userId?: string): string {
  return `onboarding_completed_${userId || "default"}`;
}

export function isOnboardingCompleted(userId?: string): boolean {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      return (
        window.localStorage.getItem(getOnboardingStorageKey(userId)) === "true"
      );
    } catch {
      return false;
    }
  }
  return false;
}

export function setOnboardingCompleted(userId?: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(getOnboardingStorageKey(userId), "true");
    } catch {
      // Ignorar fallback
    }
  }
}

export interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
  userId?: string;
}

export function OnboardingModal({
  visible,
  onClose,
  userId,
}: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 500;

  if (!visible) return null;

  const step = ONBOARDING_STEPS[currentStep];

  const handleFinish = () => {
    setOnboardingCompleted(userId);
    setCurrentStep(0);
    onClose();
  };

  const handleSkip = () => {
    setOnboardingCompleted(userId);
    setCurrentStep(0);
    onClose();
  };

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
      testID="onboarding-modal"
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            isSmallScreen ? styles.cardSmall : styles.cardLarge,
          ]}
          testID="onboarding-card"
        >
          {/* Header con Saltar */}
          <View style={styles.header}>
            <View
              style={[
                styles.badge,
                {
                  borderColor: step.badgeColor,
                  backgroundColor: `${step.badgeColor}18`,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: step.badgeColor }]}>
                {step.badge}
              </Text>
            </View>

            <Pressable
              onPress={handleSkip}
              testID="btn-skip-onboarding"
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel="Saltar tutorial"
            >
              <Text style={styles.skipText}>Saltar</Text>
            </Pressable>
          </View>

          {/* Aviso para volver a consultar la guía arriba */}
          <View style={styles.revisitBanner} testID="onboarding-revisit-banner">
            <Text style={styles.revisitBannerText}>
              💡 Podrás volver a consultar esta guía siempre que quieras desde
              el botón{" "}
              <Text style={styles.revisitBannerHighlight}>💡 Guía</Text> arriba
              en la barra superior.
            </Text>
          </View>

          {/* Icono central */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>{step.icon}</Text>
          </View>

          {/* Contenido del paso */}
          <View style={styles.body}>
            <Text style={styles.title} testID="onboarding-step-title">
              {step.title}
            </Text>
            <Text style={styles.description} testID="onboarding-step-desc">
              {step.description}
            </Text>

            <View style={styles.tipBox}>
              <Text style={styles.tipText}>{step.tip}</Text>
            </View>
          </View>

          {/* Indicadores de paginación */}
          <View style={styles.paginationRow} testID="onboarding-pagination">
            {ONBOARDING_STEPS.map((_, idx) => (
              <Pressable
                key={idx}
                onPress={() => setCurrentStep(idx)}
                testID={`pagination-dot-${idx}`}
                style={[
                  styles.dot,
                  idx === currentStep ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* Barra de botones de navegación */}
          <View style={styles.footer}>
            {currentStep > 0 ? (
              <Pressable
                onPress={handlePrev}
                testID="btn-prev-onboarding"
                style={styles.navButtonSecondary}
                accessibilityRole="button"
              >
                <Text style={styles.navButtonSecondaryText}>Anterior</Text>
              </Pressable>
            ) : (
              <View style={styles.placeholderButton} />
            )}

            {currentStep < ONBOARDING_STEPS.length - 1 ? (
              <Pressable
                onPress={handleNext}
                testID="btn-next-onboarding"
                style={styles.navButtonPrimary}
                accessibilityRole="button"
              >
                <Text style={styles.navButtonPrimaryText}>Siguiente →</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleFinish}
                testID="btn-finish-onboarding"
                style={styles.navButtonFinish}
                accessibilityRole="button"
              >
                <Text style={styles.navButtonFinishText}>¡Comenzar! 🚀</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  cardSmall: {
    width: "100%",
    maxWidth: "100%",
  },
  cardLarge: {
    width: "100%",
    maxWidth: 460,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  revisitBanner: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  revisitBannerText: {
    color: "#94A3B8",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  revisitBannerHighlight: {
    color: "#38BDF8",
    fontWeight: "700",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginVertical: 12,
  },
  iconText: {
    fontSize: 34,
  },
  body: {
    alignItems: "center",
    marginVertical: 8,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 14,
  },
  tipBox: {
    width: "100%",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
    padding: 12,
  },
  tipText: {
    color: "#E2E8F0",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontStyle: "italic",
  },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginVertical: 18,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: "#38BDF8",
  },
  dotInactive: {
    width: 8,
    backgroundColor: "#475569",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  placeholderButton: {
    width: 90,
  },
  navButtonSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  navButtonSecondaryText: {
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: "600",
  },
  navButtonPrimary: {
    backgroundColor: "#0284C7",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  navButtonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  navButtonFinish: {
    backgroundColor: "#10B981",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  navButtonFinishText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
