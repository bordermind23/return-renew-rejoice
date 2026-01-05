import { useState, useEffect, useCallback } from "react";

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export function useCameraPermission() {
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [isChecking, setIsChecking] = useState(false);

  const checkPermission = useCallback(async (): Promise<PermissionState> => {
    setIsChecking(true);
    try {
      // Check if permissions API is supported
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ 
          name: 'camera' as PermissionName 
        });
        const state = result.state as PermissionState;
        setPermissionState(state);
        
        // Listen for permission changes
        result.onchange = () => {
          setPermissionState(result.state as PermissionState);
        };
        
        setIsChecking(false);
        return state;
      }
      
      // Fallback: try to detect by checking if getUserMedia exists
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        setPermissionState('prompt');
        setIsChecking(false);
        return 'prompt';
      }
      
      setPermissionState('unknown');
      setIsChecking(false);
      return 'unknown';
    } catch (error) {
      console.log('Permission check not supported:', error);
      setPermissionState('unknown');
      setIsChecking(false);
      return 'unknown';
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Immediately stop the stream, we just needed to trigger permission request
      stream.getTracks().forEach(track => track.stop());
      setPermissionState('granted');
      return true;
    } catch (error) {
      console.error('Camera permission denied:', error);
      setPermissionState('denied');
      return false;
    }
  }, []);

  // Pre-request permission on mount if state is unknown or prompt
  const preRequestIfNeeded = useCallback(async () => {
    const state = await checkPermission();
    if (state === 'granted') {
      // Already have permission, no need to do anything
      return true;
    }
    // Don't auto-request, just check the state
    return false;
  }, [checkPermission]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return { 
    permissionState, 
    isChecking, 
    checkPermission, 
    requestPermission,
    preRequestIfNeeded,
    isGranted: permissionState === 'granted',
    isDenied: permissionState === 'denied',
    needsPrompt: permissionState === 'prompt' || permissionState === 'unknown'
  };
}
