import { Stack } from "expo-router";
import { LanguageProvider } from "@/contexts/LanguageContext";

export default function RootLayout() {
  return (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)"/>
        <Stack.Screen name="(order)"/>
        <Stack.Screen name="index"/>
        <Stack.Screen name="+not-found" />
      </Stack>
    </LanguageProvider>
  );
}