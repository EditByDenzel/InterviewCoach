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

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={AppTheme}>
        <StatusBar style="light" backgroundColor={AppTheme.colors.background} />
        <AppNavigator />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
