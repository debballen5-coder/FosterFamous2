import { Tabs } from 'expo-router';
import { CalendarCheck, House, Menu, PawPrint, Sparkles } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

import { colors, fonts } from '@/lib/theme';

export const unstable_settings = {
  initialRouteName: 'home',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.semibold,
          fontSize: 11,
          marginTop: 2,
        },
        tabBarItemStyle: { paddingTop: 2 },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <House size={23} color={color} strokeWidth={2.1} />,
        }}
      />
      <Tabs.Screen
        name="fosters"
        options={{
          title: 'Fosters',
          tabBarIcon: ({ color }) => <PawPrint size={23} color={color} strokeWidth={2.1} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => <Sparkles size={23} color={color} strokeWidth={2.1} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color }) => <CalendarCheck size={23} color={color} strokeWidth={2.1} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <Menu size={23} color={color} strokeWidth={2.1} />,
        }}
      />
    </Tabs>
  );
}
