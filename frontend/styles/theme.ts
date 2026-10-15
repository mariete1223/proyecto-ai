import { Platform } from "react-native";

export const theme = {
  colors: {
    bgApp: "#0f172a", // Deep midnight slate
    bgCard: "#1e293b", // Dark slate card
    bgCardGlass: "rgba(30, 41, 59, 0.85)", // Sleek dark glassmorphic surface
    bgSurface: "#1e293b",
    primary: "#3b82f6",
    primaryHover: "#2563eb",
    primaryGradientStart: "#3b82f6",
    primaryGradientEnd: "#6366f1",
    secondary: "#64748b",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    purple: "#8b5cf6",
    accent: "#8b5cf6",
    textPrimary: "#f8fafc", // Crisp white
    textSecondary: "#94a3b8", // Muted slate blue
    textLight: "#cbd5e1",
    textWhite: "#ffffff",
    borderLight: "rgba(255, 255, 255, 0.12)",
    borderGlow: "rgba(56, 189, 248, 0.35)",
  },
  shadows: {
    glass: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 6,
    },
    card: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 4,
    },
    glow: {
      shadowColor: "#38bdf8",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
};

// Inject custom sleek dark glassmorphic scrollbar for Web
if (Platform.OS === "web" && typeof document !== "undefined") {
  const styleId = "custom-dark-scrollbar-style";
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = `
      /* Custom Dark Glassmorphic Scrollbar */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: #0f172a;
      }
      ::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #38bdf8;
      }
      /* Firefox */
      * {
        scrollbar-width: thin;
        scrollbar-color: #334155 #0f172a;
      }
    `;
    document.head.appendChild(styleEl);
  }
}
