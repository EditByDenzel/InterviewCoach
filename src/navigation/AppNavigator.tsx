// ============================================================
// src/navigation/AppNavigator.tsx
// Stack navigator with MD3-themed header
// ============================================================

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from 'react-native-paper';
import { easeOut, useMotion } from '../components/Motion';
import ConversationScreen from '../screens/ConversationScreen';

import { RootStackParamList } from '../types';
import HomeScreen from '../screens/HomeScreen';
import InterviewScreen from '../screens/InterviewScreen';
import SummaryScreen from '../screens/SummaryScreen';
import SettingsScreen, { PreferencesScreen } from '../screens/SettingsScreen';

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const theme = useTheme();
  const {reduced}=useMotion();

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
          animationEnabled: !reduced,
          transitionSpec: {open:{animation:'timing',config:{duration:240,easing:easeOut}},close:{animation:'timing',config:{duration:180,easing:easeOut}}},
          cardStyleInterpolator: ({current})=>({cardStyle:{opacity:current.progress,transform:[{translateX:current.progress.interpolate({inputRange:[0,1],outputRange:[reduced?0:24,0]})}]}}),
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
        <Stack.Screen name="Conversation" component={ConversationScreen} options={{title:'Saved conversation'}}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
