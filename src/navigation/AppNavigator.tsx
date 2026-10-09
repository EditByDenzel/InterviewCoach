// ============================================================
// src/navigation/AppNavigator.tsx
// Stack navigator with MD3-themed header
// ============================================================

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from 'react-native-paper';

import { RootStackParamList } from '../types';
import HomeScreen from '../screens/HomeScreen';
import InterviewScreen from '../screens/InterviewScreen';
import SummaryScreen from '../screens/SummaryScreen';
import SettingsScreen, { PreferencesScreen } from '../screens/SettingsScreen';

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const theme = useTheme();

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerTintColor: theme.colors.onSurface,
          headerTitleStyle: {
            fontWeight: 'bold',
            color: theme.colors.primary,
          },
          cardStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Coachie', headerShown: false }}
        />
        <Stack.Screen
          name="Interview"
          component={InterviewScreen}
          options={{
            title: 'Live Interview',
            headerShown: false,
            headerLeft: () => null,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="Summary"
          component={SummaryScreen}
          options={{
            title: 'Session Summary',
            headerLeft: () => null,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
        <Stack.Screen name="Preferences" component={PreferencesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
