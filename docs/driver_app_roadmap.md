# Driver Mobile App - React Native Development Roadmap
## Complete Feature Set with Location Tracking

---

## Project Overview

**Goal:** Build a production-ready React Native driver app that replaces Port Pro mobile app entirely, including location tracking capabilities.

**Timeline:** 10-12 weeks (2.5-3 months)  
**Approach:** Agile sprints (2-week cycles)  
**Platform:** iOS + Android (single codebase)

---

## Tech Stack

### Core Framework
```
React Native (Expo SDK 52+)
├── TypeScript (type safety)
├── Expo Router (file-based navigation)
├── Expo EAS (build & deployment)
└── Expo Go (development testing)
```

### State Management & Data
```
├── React Query / TanStack Query (server state)
├── Zustand (client state - simple, lightweight)
├── AsyncStorage (local persistence)
└── Realm or SQLite (offline-first database)
```

### UI & Styling
```
├── NativeWind (Tailwind for React Native)
├── React Native Paper or Tamagui (component library)
├── React Native Reanimated (smooth animations)
└── React Native Gesture Handler (touch interactions)
```

### Key Features
```
├── expo-location (GPS tracking)
├── expo-task-manager (background location)
├── expo-notifications (push notifications)
├── expo-camera (document scanning)
├── expo-document-picker (file uploads)
├── expo-file-system (file management)
├── expo-secure-store (sensitive data)
└── react-native-maps (map display)
```

### Backend Integration
```
├── Axios (HTTP client)
├── WebSocket (real-time messaging)
├── JWT (authentication)
└── REST API (your TMS backend)
```

---

## Sprint Structure (6 Sprints × 2 weeks)

### Sprint 0: Pre-Development (1 week)
**Setup & Planning**

#### Tasks:
- [ ] Install development environment
  - Node.js 18+
  - Expo CLI
  - iOS Simulator (Mac) / Android Studio
  - VS Code with extensions
  
- [ ] Create project structure
  ```bash
  npx create-expo-app@latest driver-app --template tabs
  cd driver-app
  npx expo install expo-router
  ```

- [ ] Set up version control
  ```bash
  git init
  git remote add origin [your-repo]
  ```

- [ ] Configure TypeScript
  ```json
  // tsconfig.json
  {
    "extends": "expo/tsconfig.base",
    "compilerOptions": {
      "strict": true,
      "paths": {
        "@/*": ["./src/*"]
      }
    }
  }
  ```

- [ ] Install core dependencies
  ```bash
  npx expo install expo-location expo-task-manager
  npx expo install expo-notifications 
  npx expo install expo-camera expo-document-picker
  npx expo install react-native-maps
  npm install zustand @tanstack/react-query
  npm install axios
  npm install nativewind
  npm install tailwindcss
  ```

- [ ] Set up project structure
  ```
  driver-app/
  ├── app/                    # Expo Router screens
  │   ├── (auth)/            # Auth screens
  │   │   ├── login.tsx
  │   │   └── _layout.tsx
  │   ├── (tabs)/            # Main app tabs
  │   │   ├── loads.tsx
  │   │   ├── time.tsx
  │   │   ├── pay.tsx
  │   │   ├── messages.tsx
  │   │   └── account.tsx
  │   └── _layout.tsx
  ├── src/
  │   ├── components/        # Reusable components
  │   ├── hooks/             # Custom hooks
  │   ├── services/          # API services
  │   ├── store/             # State management
  │   ├── types/             # TypeScript types
  │   ├── utils/             # Utilities
  │   └── constants/         # Constants & config
  ├── assets/                # Images, fonts
  └── app.json              # Expo config
  ```

- [ ] Design API contract with backend
  - Authentication endpoints
  - Load management endpoints
  - Time tracking endpoints
  - Payroll endpoints
  - Document upload endpoints
  - Messaging endpoints
  - Location tracking endpoints

- [ ] Create Figma/wireframes (optional but recommended)

**Deliverable:** Project setup complete, ready to code

---

### Sprint 1: Authentication & Core Navigation (2 weeks)

#### Week 1: Authentication System

**Goals:**
- Login/logout functionality
- JWT token management
- Secure credential storage
- Auto-login on app restart

**Tasks:**

1. **Build Auth Service**
```typescript
// src/services/auth.service.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const authService = {
  async login(username: string, password: string) {
    const response = await axios.post(`${API_URL}/auth/login`, {
      username,
      password,
    });
    
    const { token, user } = response.data;
    
    // Store token securely
    await SecureStore.setItemAsync('authToken', token);
    await SecureStore.setItemAsync('userData', JSON.stringify(user));
    
    return { token, user };
  },

  async logout() {
    await SecureStore.deleteItemAsync('authToken');
    await SecureStore.deleteItemAsync('userData');
  },

  async getStoredToken() {
    return await SecureStore.getItemAsync('authToken');
  },

  async getCurrentUser() {
    const userData = await SecureStore.getItemAsync('userData');
    return userData ? JSON.parse(userData) : null;
  },
};
```

2. **Create Auth Store**
```typescript
// src/store/auth.store.ts
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  
  login: async (username, password) => {
    const { token, user } = await authService.login(username, password);
    set({ user, token, isAuthenticated: true });
  },
  
  logout: async () => {
    await authService.logout();
    set({ user: null, token: null, isAuthenticated: false });
  },
  
  checkAuth: async () => {
    const token = await authService.getStoredToken();
    const user = await authService.getCurrentUser();
    
    set({
      token,
      user,
      isAuthenticated: !!token,
      isLoading: false,
    });
  },
}));
```

3. **Build Login Screen**
```typescript
// app/(auth)/login.tsx
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();

  const handleLogin = async () => {
    try {
      await login(username, password);
      router.replace('/(tabs)/loads');
    } catch (error) {
      Alert.alert('Login Failed', 'Invalid credentials');
    }
  };

  return (
    <View className="flex-1 justify-center p-6 bg-white">
      <Text className="text-3xl font-bold mb-8">Driver Login</Text>
      
      <TextInput
        className="border border-gray-300 rounded-lg p-4 mb-4"
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      
      <TextInput
        className="border border-gray-300 rounded-lg p-4 mb-6"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <TouchableOpacity
        className="bg-blue-600 rounded-lg p-4"
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text className="text-white text-center font-semibold">
          {isLoading ? 'Logging in...' : 'Login'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

4. **Set Up Auth Layout (Protected Routes)**
```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { Stack, Slot, router } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';

export default function RootLayout() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/(tabs)/loads');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <Slot />;
}
```

**Testing:**
- [ ] Login with valid credentials works
- [ ] Login with invalid credentials shows error
- [ ] Token persists after app restart
- [ ] Logout clears credentials
- [ ] Protected routes redirect to login when not authenticated

#### Week 2: Core Navigation & Tab Bar

**Tasks:**

1. **Create Tab Navigation**
```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Truck, Clock, DollarSign, MessageSquare, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="loads"
        options={{
          title: 'Loads',
          tabBarIcon: ({ color }) => <Truck size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="time"
        options={{
          title: 'Clock In',
          tabBarIcon: ({ color }) => <Clock size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pay"
        options={{
          title: 'Pay',
          tabBarIcon: ({ color }) => <DollarSign size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <MessageSquare size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Other',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

2. **Create Placeholder Screens**
- Empty state for each tab
- Basic navigation working
- Test tab switching

**Deliverable:** Auth flow complete, navigation working

---

### Sprint 2: Load Management (2 weeks)

#### Week 3: Loads List & Display

**Goals:**
- Display active and upcoming loads
- Load detail view
- Pull-to-refresh
- Empty states

**Tasks:**

1. **Create Load Service**
```typescript
// src/services/load.service.ts
import { apiClient } from './api.client';

export const loadService = {
  async getActiveLoads() {
    const response = await apiClient.get('/loads/active');
    return response.data;
  },

  async getUpcomingLoads() {
    const response = await apiClient.get('/loads/upcoming');
    return response.data;
  },

  async getLoadDetails(loadId: string) {
    const response = await apiClient.get(`/loads/${loadId}`);
    return response.data;
  },

  async updateLoadStatus(loadId: string, status: LoadStatus) {
    const response = await apiClient.patch(`/loads/${loadId}/status`, {
      status,
      timestamp: new Date().toISOString(),
    });
    return response.data;
  },
};
```

2. **Build Loads List Screen**
```typescript
// app/(tabs)/loads.tsx
import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { loadService } from '@/services/load.service';

type TabType = 'active' | 'upcoming';

export default function LoadsScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('active');

  const { data: loads, isLoading, refetch } = useQuery({
    queryKey: ['loads', activeTab],
    queryFn: () =>
      activeTab === 'active'
        ? loadService.getActiveLoads()
        : loadService.getUpcomingLoads(),
  });

  const renderLoadItem = ({ item }: { item: Load }) => (
    <TouchableOpacity
      className="bg-white p-4 mb-3 rounded-lg shadow-sm border border-gray-200"
      onPress={() => router.push(`/load/${item.id}`)}
    >
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-lg font-semibold">Load #{item.number}</Text>
        <View className={`px-3 py-1 rounded-full ${
          item.status === 'in_progress' ? 'bg-blue-100' : 'bg-green-100'
        }`}>
          <Text className={`text-xs font-medium ${
            item.status === 'in_progress' ? 'text-blue-700' : 'text-green-700'
          }`}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View className="space-y-2">
        <View className="flex-row">
          <Text className="text-gray-600 w-20">Pickup:</Text>
          <Text className="flex-1 font-medium">{item.pickup.location}</Text>
        </View>
        <View className="flex-row">
          <Text className="text-gray-600 w-20">Deliver:</Text>
          <Text className="flex-1 font-medium">{item.delivery.location}</Text>
        </View>
        <View className="flex-row">
          <Text className="text-gray-600 w-20">Due:</Text>
          <Text className="flex-1 text-red-600 font-medium">
            {formatDateTime(item.delivery.scheduledTime)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center p-8">
      <Truck size={64} color="#d1d5db" />
      <Text className="text-xl font-semibold text-gray-600 mt-4">
        {activeTab === 'active' 
          ? 'Ready for another Load?' 
          : 'No upcoming loads'}
      </Text>
      {activeTab === 'active' && (
        <TouchableOpacity
          className="mt-6 bg-blue-600 px-6 py-3 rounded-lg"
          onPress={() => setActiveTab('upcoming')}
        >
          <Text className="text-white font-semibold">Check Upcoming</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Tab Switcher */}
      <View className="flex-row bg-white p-2 shadow-sm">
        <TouchableOpacity
          className={`flex-1 py-3 rounded-lg ${
            activeTab === 'active' ? 'bg-blue-600' : 'bg-white'
          }`}
          onPress={() => setActiveTab('active')}
        >
          <Text className={`text-center font-semibold ${
            activeTab === 'active' ? 'text-white' : 'text-gray-600'
          }`}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 rounded-lg ${
            activeTab === 'upcoming' ? 'bg-blue-600' : 'bg-white'
          }`}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text className={`text-center font-semibold ${
            activeTab === 'upcoming' ? 'text-white' : 'text-gray-600'
          }`}>
            Upcoming
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loads List */}
      <FlatList
        data={loads}
        renderItem={renderLoadItem}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4"
        ListEmptyComponent={renderEmptyState}
        refreshing={isLoading}
        onRefresh={refetch}
      />
    </View>
  );
}
```

3. **Build Load Detail Screen**
```typescript
// app/load/[id].tsx
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import MapView, { Marker, Polyline } from 'react-native-maps';

export default function LoadDetailScreen() {
  const { id } = useLocalSearchParams();
  
  const { data: load } = useQuery({
    queryKey: ['load', id],
    queryFn: () => loadService.getLoadDetails(id as string),
  });

  const updateStatus = useMutation({
    mutationFn: (status: LoadStatus) => 
      loadService.updateLoadStatus(id as string, status),
    onSuccess: () => {
      // Refetch load details
      queryClient.invalidateQueries(['load', id]);
    },
  });

  if (!load) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen options={{ title: `Load #${load.number}` }} />
      
      <ScrollView className="flex-1 bg-white">
        {/* Map View */}
        <MapView
          className="h-64"
          initialRegion={{
            latitude: load.pickup.coordinates.lat,
            longitude: load.pickup.coordinates.lng,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          }}
        >
          <Marker
            coordinate={load.pickup.coordinates}
            title="Pickup"
            pinColor="green"
          />
          <Marker
            coordinate={load.delivery.coordinates}
            title="Delivery"
            pinColor="red"
          />
          <Polyline
            coordinates={[load.pickup.coordinates, load.delivery.coordinates]}
            strokeColor="#2563eb"
            strokeWidth={3}
          />
        </MapView>

        {/* Load Details */}
        <View className="p-4">
          <View className="bg-gray-50 p-4 rounded-lg mb-4">
            <Text className="text-sm text-gray-600 mb-1">Status</Text>
            <Text className="text-lg font-semibold">{load.status}</Text>
          </View>

          <View className="mb-4">
            <Text className="text-lg font-semibold mb-2">Pickup</Text>
            <Text className="text-gray-800">{load.pickup.location}</Text>
            <Text className="text-gray-600">{load.pickup.address}</Text>
            <Text className="text-gray-600 mt-1">
              {formatDateTime(load.pickup.scheduledTime)}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-lg font-semibold mb-2">Delivery</Text>
            <Text className="text-gray-800">{load.delivery.location}</Text>
            <Text className="text-gray-600">{load.delivery.address}</Text>
            <Text className="text-red-600 font-medium mt-1">
              Due: {formatDateTime(load.delivery.scheduledTime)}
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="space-y-3">
            {load.status === 'assigned' && (
              <TouchableOpacity
                className="bg-blue-600 py-4 rounded-lg"
                onPress={() => updateStatus.mutate('en_route_pickup')}
              >
                <Text className="text-white text-center font-semibold">
                  Start Trip
                </Text>
              </TouchableOpacity>
            )}
            
            {load.status === 'at_pickup' && (
              <TouchableOpacity
                className="bg-green-600 py-4 rounded-lg"
                onPress={() => updateStatus.mutate('en_route_delivery')}
              >
                <Text className="text-white text-center font-semibold">
                  Picked Up - En Route
                </Text>
              </TouchableOpacity>
            )}
            
            {load.status === 'at_delivery' && (
              <TouchableOpacity
                className="bg-green-600 py-4 rounded-lg"
                onPress={() => updateStatus.mutate('delivered')}
              >
                <Text className="text-white text-center font-semibold">
                  Mark Delivered
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </>
  );
}
```

**Testing:**
- [ ] Loads list displays correctly
- [ ] Tab switching works
- [ ] Pull-to-refresh works
- [ ] Load detail shows all information
- [ ] Status updates work

#### Week 4: Load Status Updates & Geofencing

**Tasks:**

1. **Implement Geofencing for Auto-Status Updates**
```typescript
// src/services/geofence.service.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const GEOFENCE_TASK = 'GEOFENCE_TASK';

// Define geofences for active load locations
export async function setupGeofences(load: Load) {
  await Location.startGeofencingAsync(GEOFENCE_TASK, [
    {
      identifier: `pickup-${load.id}`,
      latitude: load.pickup.coordinates.lat,
      longitude: load.pickup.coordinates.lng,
      radius: 100, // 100 meters
      notifyOnEnter: true,
      notifyOnExit: true,
    },
    {
      identifier: `delivery-${load.id}`,
      latitude: load.delivery.coordinates.lat,
      longitude: load.delivery.coordinates.lng,
      radius: 100,
      notifyOnEnter: true,
      notifyOnExit: true,
    },
  ]);
}

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Geofence error:', error);
    return;
  }
  
  if (data.eventType === Location.GeofencingEventType.Enter) {
    const { identifier } = data.region;
    
    // Auto-update load status
    if (identifier.startsWith('pickup-')) {
      const loadId = identifier.replace('pickup-', '');
      await loadService.updateLoadStatus(loadId, 'at_pickup');
      
      // Send notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Arrived at Pickup',
          body: 'You have arrived at the pickup location',
        },
        trigger: null,
      });
    }
    
    if (identifier.startsWith('delivery-')) {
      const loadId = identifier.replace('delivery-', '');
      await loadService.updateLoadStatus(loadId, 'at_delivery');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Arrived at Delivery',
          body: 'You have arrived at the delivery location',
        },
        trigger: null,
      });
    }
  }
});
```

2. **Add "Ping Dispatch" Button**
```typescript
// Component for sending message to dispatch
const PingDispatchButton = ({ loadId }: { loadId: string }) => {
  const pingDispatch = useMutation({
    mutationFn: () => messageService.pingDispatch(loadId),
    onSuccess: () => {
      Alert.alert('Success', 'Dispatch has been notified');
    },
  });

  return (
    <TouchableOpacity
      className="bg-orange-600 py-4 rounded-lg"
      onPress={() => pingDispatch.mutate()}
    >
      <Text className="text-white text-center font-semibold">
        Ping Dispatch
      </Text>
    </TouchableOpacity>
  );
};
```

**Deliverable:** Load management complete with status tracking

---

### Sprint 3: Location Tracking (2 weeks)

#### Week 5: GPS Tracking Setup

**Goals:**
- Request location permissions
- Foreground location tracking
- Background location tracking
- Location data sync to backend

**Tasks:**

1. **Request Location Permissions**
```typescript
// src/services/location.service.ts
import * as Location from 'expo-location';

export const locationService = {
  async requestPermissions() {
    const { status: foregroundStatus } = 
      await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      throw new Error('Foreground location permission denied');
    }

    const { status: backgroundStatus } = 
      await Location.requestBackgroundPermissionsAsync();
    
    if (backgroundStatus !== 'granted') {
      throw new Error('Background location permission denied');
    }

    return true;
  },

  async getCurrentLocation() {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: location.timestamp,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
    };
  },
};
```

2. **Background Location Tracking**
```typescript
// src/services/tracking.service.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

// Define background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location tracking error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    
    // Batch send location updates to backend
    try {
      await trackingService.sendLocationBatch(
        locations.map(loc => ({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: loc.timestamp,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
          heading: loc.coords.heading,
        }))
      );
    } catch (error) {
      console.error('Failed to send locations:', error);
      // Store locally for retry
      await storeLocationsBatch(locations);
    }
  }
});

export const trackingService = {
  async startTracking(loadId: string) {
    // Check if already tracking
    const isTracking = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME
    );

    if (!isTracking) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // 30 seconds
        distanceInterval: 100, // 100 meters
        foregroundService: {
          notificationTitle: 'Tracking Active',
          notificationBody: `Tracking load #${loadId}`,
          notificationColor: '#2563eb',
        },
        pausesUpdatesAutomatically: false,
      });
    }

    // Store active load ID
    await AsyncStorage.setItem('activeTrackingLoadId', loadId);
  },

  async stopTracking() {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME
    );

    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    await AsyncStorage.removeItem('activeTrackingLoadId');
  },

  async sendLocationBatch(locations: LocationPoint[]) {
    const loadId = await AsyncStorage.getItem('activeTrackingLoadId');
    
    if (!loadId) return;

    await apiClient.post(`/tracking/loads/${loadId}/locations`, {
      locations,
    });
  },

  async isTracking() {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  },
};
```

3. **Create Tracking Control UI**
```typescript
// components/TrackingControl.tsx
import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { MapPin } from 'lucide-react-native';

export function TrackingControl({ loadId }: { loadId: string }) {
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    checkTrackingStatus();
  }, []);

  const checkTrackingStatus = async () => {
    const tracking = await trackingService.isTracking();
    setIsTracking(tracking);
  };

  const toggleTracking = async () => {
    try {
      if (isTracking) {
        await trackingService.stopTracking();
        setIsTracking(false);
        Alert.alert('Tracking Stopped', 'Location tracking has been disabled');
      } else {
        // Request permissions if needed
        await locationService.requestPermissions();
        
        await trackingService.startTracking(loadId);
        setIsTracking(true);
        Alert.alert(
          'Tracking Started',
          'Your location is being tracked for this load'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle tracking');
    }
  };

  return (
    <View className="bg-blue-50 p-4 rounded-lg border border-blue-200">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <MapPin size={24} color="#2563eb" />
          <View className="ml-3">
            <Text className="font-semibold text-gray-900">
              Location Tracking
            </Text>
            <Text className="text-sm text-gray-600">
              {isTracking ? 'Active - updating every 30s' : 'Not tracking'}
            </Text>
          </View>
        </View>
        <Switch
          value={isTracking}
          onValueChange={toggleTracking}
          trackColor={{ false: '#d1d5db', true: '#2563eb' }}
        />
      </View>
    </View>
  );
}
```

**Testing:**
- [ ] Location permissions requested correctly
- [ ] Foreground tracking works
- [ ] Background tracking continues when app is closed
- [ ] Location data appears in backend

#### Week 6: Live Map & ETA

**Tasks:**

1. **Real-time Driver Location Map**
```typescript
// components/LiveLocationMap.tsx
import { useEffect, useState } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

export function LiveLocationMap({ load }: { load: Load }) {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [route, setRoute] = useState([]);

  useEffect(() => {
    // Subscribe to location updates
    const subscription = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 50,
      },
      (location) => {
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    );

    return () => {
      subscription.then(sub => sub.remove());
    };
  }, []);

  // Fetch route from API
  useEffect(() => {
    if (currentLocation) {
      fetchRoute(currentLocation, load.delivery.coordinates);
    }
  }, [currentLocation]);

  return (
    <MapView
      className="flex-1"
      region={{
        latitude: currentLocation?.latitude || load.pickup.coordinates.lat,
        longitude: currentLocation?.longitude || load.pickup.coordinates.lng,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }}
      showsUserLocation
      followsUserLocation
    >
      {currentLocation && (
        <Marker
          coordinate={currentLocation}
          title="Your Location"
          pinColor="blue"
        />
      )}
      
      <Marker
        coordinate={load.delivery.coordinates}
        title="Destination"
        pinColor="red"
      />

      {route.length > 0 && (
        <Polyline
          coordinates={route}
          strokeColor="#2563eb"
          strokeWidth={4}
        />
      )}
    </MapView>
  );
}
```

2. **ETA Calculation**
```typescript
// src/services/eta.service.ts
export const etaService = {
  async calculateETA(
    currentLocation: Coordinates,
    destination: Coordinates
  ): Promise<ETAInfo> {
    // Call your backend or Google Maps API
    const response = await apiClient.post('/eta/calculate', {
      origin: currentLocation,
      destination,
    });

    return {
      distanceMeters: response.data.distance,
      durationSeconds: response.data.duration,
      estimatedArrival: new Date(response.data.eta),
    };
  },
};
```

**Deliverable:** Complete location tracking system

---

### Sprint 4: Time Clock & Payroll (2 weeks)

#### Week 7: Time Tracking

**Goals:**
- Clock in/out functionality
- Track non-driving work time
- Time history view
- Submit time for approval

**Tasks:**

1. **Time Service**
```typescript
// src/services/time.service.ts
export const timeService = {
  async clockIn(type: 'driving' | 'loading' | 'warehouse' | 'other') {
    const location = await locationService.getCurrentLocation();
    
    const response = await apiClient.post('/time/clock-in', {
      type,
      timestamp: new Date().toISOString(),
      location,
    });

    return response.data;
  },

  async clockOut() {
    const location = await locationService.getCurrentLocation();
    
    const response = await apiClient.post('/time/clock-out', {
      timestamp: new Date().toISOString(),
      location,
    });

    return response.data;
  },

  async getTodayTime() {
    const response = await apiClient.get('/time/today');
    return response.data;
  },

  async getTimeHistory(startDate: Date, endDate: Date) {
    const response = await apiClient.get('/time/history', {
      params: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
    return response.data;
  },
};
```

2. **Clock In/Out Screen**
```typescript
// app/(tabs)/time.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';

export default function TimeScreen() {
  const { data: currentShift, refetch } = useQuery({
    queryKey: ['currentShift'],
    queryFn: timeService.getCurrentShift,
  });

  const { data: todayTime } = useQuery({
    queryKey: ['todayTime'],
    queryFn: timeService.getTodayTime,
  });

  const clockIn = useMutation({
    mutationFn: (type: string) => timeService.clockIn(type),
    onSuccess: () => refetch(),
  });

  const clockOut = useMutation({
    mutationFn: timeService.clockOut,
    onSuccess: () => refetch(),
  });

  const isClockedIn = currentShift?.status === 'active';

  return (
    <View className="flex-1 bg-white">
      {/* Timer Display */}
      <View className="items-center py-12 bg-gray-50">
        <Text className="text-6xl font-bold text-gray-900">
          {formatElapsedTime(currentShift?.elapsed || 0)}
        </Text>
        <Text className="text-lg text-gray-600 mt-2">
          {isClockedIn ? 'Clock In Time' : 'Not Clocked In'}
        </Text>
      </View>

      {/* Clock In/Out Button */}
      <View className="p-6">
        {!isClockedIn ? (
          <View>
            <Text className="text-lg font-semibold mb-4">
              Select Activity Type:
            </Text>
            <TouchableOpacity
              className="bg-blue-600 py-4 rounded-lg mb-3"
              onPress={() => clockIn.mutate('driving')}
            >
              <Text className="text-white text-center font-semibold">
                Driving
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-blue-600 py-4 rounded-lg mb-3"
              onPress={() => clockIn.mutate('loading')}
            >
              <Text className="text-white text-center font-semibold">
                Loading/Unloading
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-blue-600 py-4 rounded-lg mb-3"
              onPress={() => clockIn.mutate('warehouse')}
            >
              <Text className="text-white text-center font-semibold">
                Warehouse Work
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-blue-600 py-4 rounded-lg"
              onPress={() => clockIn.mutate('other')}
            >
              <Text className="text-white text-center font-semibold">
                Other
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            className="bg-red-600 py-4 rounded-lg"
            onPress={() => clockOut.mutate()}
          >
            <Text className="text-white text-center font-semibold text-lg">
              Clock Out
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Today's Summary */}
      <View className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <Text className="text-lg font-semibold mb-3">Today's Time</Text>
        <View className="flex-row justify-between">
          <Text className="text-gray-600">Total Hours:</Text>
          <Text className="font-semibold">
            {(todayTime?.totalMinutes / 60).toFixed(2)} hrs
          </Text>
        </View>
      </View>
    </View>
  );
}
```

**Testing:**
- [ ] Clock in works with location capture
- [ ] Clock out works
- [ ] Time accumulates correctly
- [ ] Today's time displays accurately

#### Week 8: Payroll View

**Goals:**
- Display pay periods
- Show pay breakdowns
- Generate PDF pay stubs
- View payment history

**Tasks:**

1. **Pay Service**
```typescript
// src/services/pay.service.ts
export const payService = {
  async getPayPeriods() {
    const response = await apiClient.get('/payroll/periods');
    return response.data;
  },

  async getPayPeriodDetails(periodId: string) {
    const response = await apiClient.get(`/payroll/periods/${periodId}`);
    return response.data;
  },

  async generatePayStubPDF(periodId: string) {
    const response = await apiClient.get(
      `/payroll/periods/${periodId}/pdf`,
      { responseType: 'blob' }
    );
    return response.data;
  },
};
```

2. **Pay Screen**
```typescript
// app/(tabs)/pay.tsx
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function PayScreen() {
  const { data: payPeriods } = useQuery({
    queryKey: ['payPeriods'],
    queryFn: payService.getPayPeriods,
  });

  const renderPayPeriod = ({ item }: { item: PayPeriod }) => (
    <TouchableOpacity
      className="bg-white p-4 mb-3 rounded-lg shadow-sm border border-gray-200"
      onPress={() => router.push(`/pay/${item.id}`)}
    >
      <Text className="text-lg font-semibold mb-2">
        {formatDateRange(item.startDate, item.endDate)}
      </Text>
      
      <View className="space-y-1">
        <View className="flex-row justify-between">
          <Text className="text-gray-600">Total Load Pay</Text>
          <Text className="font-medium">${item.loadPay.toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-600">Total Deductions</Text>
          <Text className="font-medium text-red-600">
            -${item.deductions.toFixed(2)}
          </Text>
        </View>
        <View className="flex-row justify-between pt-2 border-t border-gray-200">
          <Text className="font-semibold">Net Pay</Text>
          <Text className="text-lg font-bold text-green-600">
            ${item.netPay.toFixed(2)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white p-4 border-b border-gray-200">
        <Text className="text-sm text-gray-600">Current Period</Text>
        <Text className="text-2xl font-bold">
          {formatMonthYear(new Date())}
        </Text>
      </View>

      <FlatList
        data={payPeriods}
        renderItem={renderPayPeriod}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4"
      />
    </View>
  );
}
```

3. **Pay Period Detail Screen**
```typescript
// app/pay/[id].tsx
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

export default function PayPeriodDetailScreen() {
  const { id } = useLocalSearchParams();
  
  const { data: period } = useQuery({
    queryKey: ['payPeriod', id],
    queryFn: () => payService.getPayPeriodDetails(id as string),
  });

  const downloadPDF = useMutation({
    mutationFn: () => payService.generatePayStubPDF(id as string),
    onSuccess: async (pdfBlob) => {
      const fileUri = `${FileSystem.documentDirectory}paystub-${id}.pdf`;
      await FileSystem.writeAsStringAsync(
        fileUri,
        pdfBlob,
        { encoding: FileSystem.EncodingType.Base64 }
      );
      
      await Sharing.shareAsync(fileUri);
    },
  });

  if (!period) return <LoadingSpinner />;

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-4">
        {/* Summary Card */}
        <View className="bg-gray-50 p-4 rounded-lg mb-6">
          <Text className="text-2xl font-bold text-center mb-2">
            ${period.netPay.toFixed(2)}
          </Text>
          <Text className="text-center text-gray-600">Net Pay</Text>
        </View>

        {/* Approved Loads */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-3">Approved</Text>
          {period.approvedLoads.map((load) => (
            <View
              key={load.id}
              className="bg-white border border-gray-200 rounded-lg p-3 mb-2"
            >
              <View className="flex-row justify-between">
                <Text>Load #{load.number}</Text>
                <Text className="font-semibold">
                  ${load.pay.toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Deductions */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-3">Deductions</Text>
          {period.deductions.map((deduction) => (
            <View
              key={deduction.id}
              className="flex-row justify-between mb-2"
            >
              <Text className="text-gray-600">{deduction.description}</Text>
              <Text className="text-red-600">
                -${deduction.amount.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View className="space-y-3">
          <TouchableOpacity
            className="bg-blue-600 py-4 rounded-lg"
            onPress={() => downloadPDF.mutate()}
          >
            <Text className="text-white text-center font-semibold">
              Save PDF
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className="bg-gray-200 py-4 rounded-lg"
            onPress={() => {/* Email PDF */}}
          >
            <Text className="text-gray-800 text-center font-semibold">
              Email PDF
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
```

**Deliverable:** Time tracking and payroll viewing complete

---

### Sprint 5: Documents & Messaging (2 weeks)

#### Week 9: Document Management

**Goals:**
- Photo capture for PODs/documents
- Document upload to backend
- View uploaded documents
- Manage driver qualifications

**Tasks:**

1. **Document Service**
```typescript
// src/services/document.service.ts
import * as FileSystem from 'expo-file-system';

export const documentService = {
  async uploadDocument(
    file: { uri: string; type: string; name: string },
    category: DocumentCategory,
    metadata?: any
  ) {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);
    formData.append('category', category);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await apiClient.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  async getDocuments(category?: DocumentCategory) {
    const response = await apiClient.get('/documents', {
      params: { category },
    });
    return response.data;
  },

  async deleteDocument(documentId: string) {
    await apiClient.delete(`/documents/${documentId}`);
  },
};
```

2. **Document Capture Component**
```typescript
// components/DocumentCapture.tsx
import * as Camera from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export function DocumentCapture({
  onCapture,
  category,
}: {
  onCapture: (file: DocumentFile) => void;
  category: DocumentCategory;
}) {
  const [cameraPermission, requestCameraPermission] = 
    Camera.useCameraPermissions();

  const takePhoto = async () => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Camera access is needed');
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled) {
      onCapture({
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: `${category}-${Date.now()}.jpg`,
      });
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
    });

    if (result.type === 'success') {
      onCapture({
        uri: result.uri,
        type: result.mimeType || 'application/octet-stream',
        name: result.name,
      });
    }
  };

  return (
    <View className="flex-row space-x-3">
      <TouchableOpacity
        className="flex-1 bg-blue-600 py-3 rounded-lg flex-row items-center justify-center"
        onPress={takePhoto}
      >
        <Camera size={20} color="white" />
        <Text className="text-white font-semibold ml-2">Take Picture</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        className="flex-1 bg-gray-600 py-3 rounded-lg flex-row items-center justify-center"
        onPress={pickDocument}
      >
        <Upload size={20} color="white" />
        <Text className="text-white font-semibold ml-2">Upload</Text>
      </TouchableOpacity>
    </View>
  );
}
```

3. **Equipment & Documents Screen** (in Account tab)
```typescript
// app/(tabs)/account.tsx (Equipment section)
<View className="bg-white p-4 rounded-lg mb-4">
  <Text className="text-lg font-semibold mb-4">My Equipment</Text>
  
  <View className="space-y-3">
    <View>
      <Text className="text-gray-600 text-sm">Assigned Truck</Text>
      <Text className="font-semibold">Truck #42</Text>
    </View>
    
    <TouchableOpacity
      className="bg-gray-100 p-3 rounded-lg"
      onPress={() => router.push('/equipment')}
    >
      <Text className="text-center font-semibold">View Equipment Details</Text>
    </TouchableOpacity>
  </View>
</View>

<View className="bg-white p-4 rounded-lg mb-4">
  <Text className="text-lg font-semibold mb-4">Documents</Text>
  
  <View className="space-y-2">
    <View className="flex-row justify-between">
      <Text className="text-gray-600">License Exp:</Text>
      <Text className={documentExpirationClass(driver.licenseExp)}>
        {formatDate(driver.licenseExp)}
      </Text>
    </View>
    <View className="flex-row justify-between">
      <Text className="text-gray-600">Medical Exp:</Text>
      <Text className={documentExpirationClass(driver.medicalExp)}>
        {formatDate(driver.medicalExp)}
      </Text>
    </View>
  </View>
  
  <DocumentCapture
    category="license"
    onCapture={handleDocumentUpload}
  />
</View>
```

**Testing:**
- [ ] Camera opens and captures photos
- [ ] File picker works
- [ ] Documents upload successfully
- [ ] Uploaded documents appear in list

#### Week 10: Messaging System

**Goals:**
- Real-time messaging with dispatch
- Group messages
- Push notifications for new messages
- Message history

**Tasks:**

1. **Set Up WebSocket Connection**
```typescript
// src/services/websocket.service.ts
import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
  private messageCallbacks: Array<(message: Message) => void> = [];

  connect(token: string) {
    this.socket = io(process.env.EXPO_PUBLIC_WS_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('message', (message: Message) => {
      this.messageCallbacks.forEach(cb => cb(message));
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
  }

  disconnect() {
    this.socket?.disconnect();
  }

  sendMessage(to: string, content: string, type: 'chat' | 'group') {
    this.socket?.emit('message', {
      to,
      content,
      type,
      timestamp: new Date().toISOString(),
    });
  }

  onMessage(callback: (message: Message) => void) {
    this.messageCallbacks.push(callback);
  }
}

export const wsService = new WebSocketService();
```

2. **Messages Screen**
```typescript
// app/(tabs)/messages.tsx
import { View, Text, FlatList, TouchableOpacity } from 'react-native';

export default function MessagesScreen() {
  const [activeTab, setActiveTab] = useState<'chats' | 'groups'>('chats');

  const { data: chats } = useQuery({
    queryKey: ['chats'],
    queryFn: messageService.getChats,
  });

  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      className="bg-white p-4 border-b border-gray-200 flex-row"
      onPress={() => router.push(`/chat/${item.id}`)}
    >
      <View className="flex-1">
        <View className="flex-row justify-between mb-1">
          <Text className="font-semibold">{item.name}</Text>
          <Text className="text-xs text-gray-500">
            {formatTime(item.lastMessage.timestamp)}
          </Text>
        </View>
        <Text className="text-gray-600" numberOfLines={1}>
          {item.lastMessage.content}
        </Text>
      </View>
      {item.unreadCount > 0 && (
        <View className="bg-blue-600 rounded-full w-6 h-6 items-center justify-center ml-2">
          <Text className="text-white text-xs font-semibold">
            {item.unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-white">
      {/* Tab Switcher */}
      <View className="flex-row bg-white border-b border-gray-200">
        <TouchableOpacity
          className={`flex-1 py-3 ${
            activeTab === 'chats' ? 'border-b-2 border-blue-600' : ''
          }`}
          onPress={() => setActiveTab('chats')}
        >
          <Text className={`text-center font-semibold ${
            activeTab === 'chats' ? 'text-blue-600' : 'text-gray-600'
          }`}>
            Chats
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 ${
            activeTab === 'groups' ? 'border-b-2 border-blue-600' : ''
          }`}
          onPress={() => setActiveTab('groups')}
        >
          <Text className={`text-center font-semibold ${
            activeTab === 'groups' ? 'text-blue-600' : 'text-gray-600'
          }`}>
            Groups
          </Text>
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
}
```

3. **Chat Detail Screen**
```typescript
// app/chat/[id].tsx
import { GiftedChat, IMessage } from 'react-native-gifted-chat';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<IMessage[]>([]);

  const { data: chatHistory } = useQuery({
    queryKey: ['chatHistory', id],
    queryFn: () => messageService.getChatHistory(id as string),
  });

  useEffect(() => {
    // Subscribe to new messages
    const unsubscribe = wsService.onMessage((message) => {
      if (message.chatId === id) {
        setMessages(prev => GiftedChat.append(prev, [
          {
            _id: message.id,
            text: message.content,
            createdAt: new Date(message.timestamp),
            user: {
              _id: message.senderId,
              name: message.senderName,
            },
          },
        ]));
      }
    });

    return unsubscribe;
  }, [id]);

  const onSend = useCallback((messages: IMessage[]) => {
    const message = messages[0];
    wsService.sendMessage(id as string, message.text, 'chat');
    setMessages(prev => GiftedChat.append(prev, messages));
  }, [id]);

  return (
    <GiftedChat
      messages={messages}
      onSend={onSend}
      user={{
        _id: currentUserId,
      }}
    />
  );
}
```

4. **Push Notifications for Messages**
```typescript
// src/services/notification.service.ts
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  async registerForPushNotifications() {
    const { status: existingStatus } = 
      await Notifications.getPermissionsAsync();
    
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      throw new Error('Push notification permission denied');
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    
    // Send token to backend
    await apiClient.post('/notifications/register', { token });
    
    return token;
  },

  async scheduleLocalNotification(title: string, body: string) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
      },
      trigger: null,
    });
  },
};
```

**Deliverable:** Documents and messaging complete

---

### Sprint 6: Polish & Production (2 weeks)

#### Week 11: Bug Fixes & Performance

**Tasks:**

1. **Offline Functionality**
```typescript
// src/services/offline.service.ts
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const offlineService = {
  async queueRequest(request: QueuedRequest) {
    const queue = await this.getQueue();
    queue.push(request);
    await AsyncStorage.setItem('requestQueue', JSON.stringify(queue));
  },

  async processQueue() {
    const isConnected = await NetInfo.fetch().then(
      state => state.isConnected
    );

    if (!isConnected) return;

    const queue = await this.getQueue();
    
    for (const request of queue) {
      try {
        await this.executeRequest(request);
        // Remove from queue
        await this.removeFromQueue(request.id);
      } catch (error) {
        console.error('Failed to process queued request:', error);
      }
    }
  },

  async getQueue(): Promise<QueuedRequest[]> {
    const queue = await AsyncStorage.getItem('requestQueue');
    return queue ? JSON.parse(queue) : [];
  },
};
```

2. **Performance Optimization**
- Implement React.memo for list items
- Add FlatList optimization props
- Optimize image loading
- Reduce re-renders

3. **Error Handling**
- Global error boundary
- API error interceptor
- User-friendly error messages
- Retry logic

4. **Loading States**
- Skeleton screens
- Loading indicators
- Pull-to-refresh

**Testing:**
- [ ] App works offline
- [ ] Queued requests send when back online
- [ ] No crashes or errors
- [ ] Smooth performance

#### Week 12: App Store Preparation

**Tasks:**

1. **Build Production App**
```bash
# Configure app.json
{
  "expo": {
    "name": "YourCompany Driver",
    "slug": "yourcompany-driver",
    "version": "1.0.0",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "bundleIdentifier": "com.yourcompany.driver",
      "buildNumber": "1"
    },
    "android": {
      "package": "com.yourcompany.driver",
      "versionCode": 1,
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    }
  }
}

# Build for iOS
eas build --platform ios

# Build for Android  
eas build --platform android
```

2. **App Store Assets**
- App icon (1024x1024)
- Screenshots (all required sizes)
- App description
- Keywords
- Privacy policy URL
- Support URL

3. **TestFlight Beta**
- Upload to TestFlight
- Invite 5-10 drivers for beta testing
- Collect feedback
- Fix critical bugs

4. **Submit to App Stores**
- iOS App Store submission
- Google Play Store submission
- Wait for approval (2-7 days for iOS, few hours for Android)

**Deliverable:** App live on App Store and Google Play

---

## Post-Launch: Maintenance & Iteration

### Week 13+: Ongoing

**Tasks:**
- Monitor crash reports (Sentry/Bugsnag)
- Collect driver feedback
- Fix bugs
- Add requested features
- Performance monitoring
- Update dependencies

**Feature Roadmap (Future):**
- [ ] Route optimization suggestions
- [ ] Voice commands
- [ ] Biometric login (Face ID/Touch ID)
- [ ] Offline maps
- [ ] Driver performance dashboard
- [ ] Gamification (badges, achievements)
- [ ] Social features (driver chat)
- [ ] Integration with fuel card apps
- [ ] Maintenance reminders
- [ ] Weather alerts on route

---

## Risk Management

### Potential Blockers & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Location tracking drains battery | High | Implement adaptive tracking intervals, allow manual control |
| Background location permission denied on iOS | High | Clear user education, show benefits, request only when needed |
| Backend API delays | Medium | Build offline-first, queue operations |
| App Store rejection | Medium | Follow guidelines strictly, have backup plan |
| Driver adoption resistance | High | Involve drivers early, listen to feedback, smooth UX |
| Push notification reliability | Medium | Implement polling as backup, local notifications |

---

## Success Metrics

### Key Performance Indicators (KPIs)

**Technical:**
- App crash rate: <1%
- Average load time: <2 seconds
- Offline success rate: >95%
- Location accuracy: Within 50 meters
- Battery drain: <15% per hour active use

**User Adoption:**
- 80% of drivers installed within 30 days
- 90% weekly active users
- 4+ star rating on app stores
- <5% uninstall rate

**Business:**
- 50% reduction in "where's my driver" calls
- 30% faster load status updates
- 90% on-time delivery improvement
- 25% reduction in paperwork processing time

---

## Budget Estimate

### Development Costs (If Outsourced)

| Item | Cost |
|------|------|
| React Native Developer (12 weeks) | $12,000 - $24,000 |
| UI/UX Designer (2 weeks) | $2,000 - $4,000 |
| Backend API Development | Included (you're building) |
| Expo EAS Build (Pro plan) | $29/month |
| Apple Developer Account | $99/year |
| Google Play Developer Account | $25 one-time |
| Push Notification Service | Free (Expo) |
| **Total** | **$14,153 - $28,153** |

### DIY Cost (Your Time)

**Your time:** 10-12 weeks × 30-40 hours/week = 300-480 hours

**Actual costs:**
- Expo EAS: $29/month
- Apple: $99/year
- Google: $25 one-time
- **Total: ~$500/year**

---

## Next Steps

1. **This Week:**
   - [ ] Run `npx create-expo-app driver-app`
   - [ ] Set up project structure
   - [ ] Install core dependencies
   - [ ] Create API contract document

2. **Next Week:**
   - [ ] Start Sprint 1: Authentication
   - [ ] Build login screen
   - [ ] Set up navigation

3. **Get Help:**
   - Expo docs: https://docs.expo.dev
   - React Native docs: https://reactnative.dev
   - Stack Overflow when stuck
   - Expo Discord for quick questions

---

## Conclusion

This roadmap gives you a production-ready driver app in **10-12 weeks** that:

✅ Replaces Port Pro completely  
✅ Includes full GPS tracking  
✅ Works offline  
✅ Handles all driver workflows  
✅ Scales to your fleet  
✅ Can be white-labeled for customers  

The key is to **start simple** (Sprint 0-1) and **iterate quickly** (2-week sprints). Don't try to build everything perfectly from day one.

**Ready to start? Let me know if you want me to generate any of the code files to get you going!**
