import { Tabs } from 'expo-router';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { Typography, Radius, Spacing } from '../../src/constants/theme';
import { useThemeColors } from '../../src/hooks/useThemeColors';

const TAB_ITEMS = [
  { name: 'index', label: 'Agents', icon: '\u{1F9E0}', title: 'Dashboard' },
  { name: 'files', label: 'Files', icon: '\u{1F4C2}', title: 'Files' },
  { name: 'pipelines', label: 'Pipelines', icon: '\u{1F500}', title: 'Pipelines' },
  { name: 'settings', label: 'Settings', icon: '\u2699\uFE0F', title: 'Settings' },
] as const;

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: 52,
        minHeight: 42,
      }}
    >
      <View
        style={{
          minWidth: 42,
          minHeight: 34,
          borderRadius: Radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? 'rgba(59,130,246,0.14)' : 'transparent',
          borderWidth: focused ? 1 : 0,
          borderColor: focused ? 'rgba(59,130,246,0.26)' : 'transparent',
        }}
      >
        <Text
          style={{
            fontSize: focused ? 22 : 20,
            opacity: focused ? 1 : 0.48,
            lineHeight: 24,
            textAlign: 'center',
          }}
        >
          {icon}
        </Text>
      </View>
      {focused ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            width: 18,
            height: 3,
            borderRadius: Radius.full,
            backgroundColor: '#3b82f6',
          }}
        />
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  const c = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.textPrimary,
        tabBarInactiveTintColor: c.textTertiary,
        tabBarStyle: {
          backgroundColor: c.glassBg,
          borderTopColor: c.glassBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 94 : 72,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: Spacing.sm,
          paddingHorizontal: Spacing.sm,
          position: 'absolute',
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.02,
          marginTop: Platform.OS === 'ios' ? 0 : 2,
        },
        headerStyle: {
          backgroundColor: c.bg,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomColor: c.glassBorder,
          borderBottomWidth: StyleSheet.hairlineWidth,
          height: 52,
        },
        headerTitleStyle: {
          ...Typography.lg,
          fontWeight: '700',
          color: c.textPrimary,
          letterSpacing: -0.02,
        },
        headerShadowVisible: false,
        headerTintColor: c.textPrimary,
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 0,
          height: 42,
          width: 52,
        },
        tabBarAllowFontScaling: false,
      }}
    >
      {TAB_ITEMS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarLabel: tab.label,
            tabBarIcon: ({ focused }) => <TabIcon icon={tab.icon} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}
