import { Tabs } from 'expo-router';
import { Text, Platform } from 'react-native';
import { colors } from '../../theme';

export default function PatientTabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.text.disabled,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.borderLight,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 88 : 65,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: colors.primary[600],
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'CliniqAI',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: 'Records',
          headerTitle: 'Health Records',
          tabBarIcon: ({ color }) => <TabIcon name="records" color={color} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: 'Book',
          headerTitle: 'Book Appointment',
          tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          title: 'Medicines',
          headerTitle: 'My Medications',
          tabBarIcon: ({ color }) => <TabIcon name="pill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'My Profile',
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color }: { name: string; color: string }) {
  const icons: Record<string, string> = {
    home: '🏠',
    records: '📋',
    calendar: '📅',
    pill: '💊',
    profile: '👤',
  };
  return <Text style={{ fontSize: 22 }}>{icons[name] || '📌'}</Text>;
}
