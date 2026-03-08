import { Stack } from "expo-router";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { KioskThemeProvider } from "@/contexts/KioskThemeContext";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { loadServerUrl, hasSavedServerUrl, loadRestaurantId } from "@/utils/serverConfig";
import ServerSetup from "@/components/ServerSetup";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    async function init() {
      const hasUrl = await hasSavedServerUrl();
      await loadServerUrl();
      await loadRestaurantId();
      if (!hasUrl) {
        setNeedsSetup(true);
      }
      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#756fbf" />
      </View>
    );
  }

  if (needsSetup) {
    return (
      <ServerSetup
        onConfigured={() => setNeedsSetup(false)}
      />
    );
  }

  return (
    <KioskThemeProvider>
      <LanguageProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)"/>
          <Stack.Screen name="(order)"/>
          <Stack.Screen name="index"/>
          <Stack.Screen name="+not-found" />
        </Stack>
      </LanguageProvider>
    </KioskThemeProvider>
  );
}
