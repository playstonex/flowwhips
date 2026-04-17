import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useConnectionStore } from '../src/stores/connection';
import { wsService } from '../src/services/websocket';
import { loadCredentials } from '../src/services/secure-storage';

export default function RootLayout() {
  const { setCredentials, setConnected } = useConnectionStore();

  useEffect(() => {
    (async () => {
      const saved = await loadCredentials();
      if (saved) {
        setCredentials(saved);
        wsService.configure(saved);
        wsService.connect();
      }
    })();

    const unsub = wsService.on('_state', () => {
      setConnected(wsService.connected);
    });

    return unsub;
  }, [setCredentials, setConnected]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="terminal/[sessionId]" options={{ title: 'Terminal' }} />
      <Stack.Screen name="agent/[sessionId]" options={{ title: 'Agent Detail' }} />
    </Stack>
  );
}
