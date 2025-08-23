import { useState, useEffect } from 'react';
import { connectionStatus } from '../api/odoo';

/**
 * Hook to monitor connection status
 * 
 * This hook provides real-time connection status information
 * and updates when connection changes are detected.
 * 
 * @returns {Object} Connection status data
 */
export const useConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(connectionStatus.isOnline);
  const [lastCheck, setLastCheck] = useState(connectionStatus.lastCheck);
  const [isChecking, setIsChecking] = useState(false);
  
  // Listen for connection status changes
  useEffect(() => {
    const handleStatusChange = (newStatus, timestamp) => {
      setIsOnline(newStatus);
      setLastCheck(timestamp);
    };
    
    // Register listener
    connectionStatus.addListener(handleStatusChange);
    
    // Initial check
    checkConnection();
    
    // Periodic check every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    // Clean up
    return () => {
      connectionStatus.removeListener(handleStatusChange);
      clearInterval(interval);
    };
  }, []);
  
  // Manual connection check
  const checkConnection = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      const status = await connectionStatus.checkConnection();
      setIsOnline(status);
      setLastCheck(connectionStatus.lastCheck);
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setIsChecking(false);
    }
  };
  
  return {
    isOnline,
    lastCheck,
    isChecking,
    checkConnection
  };
};

export default useConnectionStatus; 