import { Tabs } from 'expo-router';
import { Text, View, StyleSheet, Platform } from 'react-native';

// ── Design tokens (user-specified palette) ──────────────────────────────────
const PRIMARY = '#2563EB';
const PRIMARY_LIGHT = '#DBEAFE';
const SURFACE = '#F8FAFC';
const TEXT_PRIMARY = '#0F172A';
const TEXT_DISABLED = '#94A3B8';
const BORDER_LIGHT = '#F1F5F9';
const WHITE = '#FFFFFF';

/**
 * TabIcon — uses Unicode/emoji glyphs so zero icon packages are needed.
 * A tinted circle highlights the active tab.
 */
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={[iconStyles.wrap, focused && iconStyles.wrapFocused]}>
      <Text style={iconStyles.emoji}>{emoji}</Text>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapFocused: {
    backgroundColor: PRIMARY_LIGHT,
  },
  emoji: {
    fontSize: 20,
  },
});

export default function PatientTabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: TEXT_DISABLED,
        tabBarStyle: {
          backgroundColor: WHITE,
          borderTopWidth: 1,
          borderTopColor: BORDER_LIGHT,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 6,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: -2,
        },
        headerStyle: {
          backgroundColor: PRIMARY,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: WHITE,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'CliniqAI',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: 'Records',
          headerTitle: 'Health Records',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: 'Book',
          headerTitle: 'Book Appointment',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          title: 'Medicines',
          headerTitle: 'My Medications',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'My Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
