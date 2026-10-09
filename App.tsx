// ============================================================
// App.tsx — Root entry point
// Wraps app in react-native-paper Provider (MD3 theme)
// + GestureHandlerRootView + NavigationContainer (via AppNavigator)
// ============================================================
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { AppTheme } from './src/theme';
import { useFonts } from 'expo-font';
import { MotionProvider } from './src/components/Motion';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'), Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'), Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf') });
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={AppTheme}>
        <StatusBar style="light" backgroundColor={AppTheme.colors.background} />
        <MotionProvider><AppNavigator /></MotionProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
