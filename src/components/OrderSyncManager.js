import { useEffect, useRef, useState } from 'react';
import { useToast } from '@chakra-ui/react';
import offlineOrderService from '../api/offlineOrderService';
import { connectionStatus } from '../api/odoo';

// This component doesn't render anything, it just manages offline order syncing
const OrderSyncManager = (props) => {
  const toast = useToast();
  const syncIntervalRef = useRef(null);
  const [syncStats, setSyncStats] = useState({
    lastCheck: null,
    lastSync: null,
    pendingOrders: 0,
    isChecking: false
  });

  // Function to check and try to sync offline orders
  const checkAndSync = async () => {
    if (syncStats.isChecking) return; // Prevent overlapping checks
    
    try {
      setSyncStats(prev => ({ ...prev, isChecking: true }));
      
      // Count pending orders
      const pendingCount = await offlineOrderService.getPendingOrdersCount();
      
      if (pendingCount === 0) {
        // No pending orders, just update stats
        setSyncStats(prev => ({
          ...prev,
          lastCheck: new Date(),
          pendingOrders: 0,
          isChecking: false
        }));
        return;
      }
      
      // Update pending count
      setSyncStats(prev => ({
        ...prev,
        pendingOrders: pendingCount,
        lastCheck: new Date()
      }));
      
      // Check connection status
      const isOnline = await connectionStatus.checkConnection();
      
      if (!isOnline) {
        console.log(`[OrderSyncManager] Device is offline. ${pendingCount} orders waiting to sync.`);
        setSyncStats(prev => ({ ...prev, isChecking: false }));
        return;
      }
      
      // We're online and have pending orders, try to sync
      console.log(`[OrderSyncManager] Device is online. Attempting to sync ${pendingCount} pending orders...`);
      
      const syncResults = await offlineOrderService.syncAllPendingOrders();
      
      if (syncResults.successful > 0) {
        // Show toast if orders were synced
        toast({
          title: 'Orders Synced',
          description: `${syncResults.successful} order(s) have been synced with the server.`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        
        // Update stats
        setSyncStats(prev => ({
          ...prev,
          lastSync: new Date(),
          pendingOrders: pendingCount - syncResults.successful,
          isChecking: false
        }));
      } else if (syncResults.failed > 0) {
        // Show toast for failed syncs
        toast({
          title: 'Sync Issues',
          description: `${syncResults.failed} order(s) failed to sync. Will retry later.`,
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
        
        setSyncStats(prev => ({ ...prev, isChecking: false }));
      } else {
        // Just update checking status
        setSyncStats(prev => ({ ...prev, isChecking: false }));
      }
    } catch (error) {
      console.error('[OrderSyncManager] Error during sync check:', error);
      setSyncStats(prev => ({ ...prev, isChecking: false }));
    }
  };
  
  // Set up interval to periodically check for and sync offline orders
  useEffect(() => {
    // Do an initial check on component mount
    checkAndSync();
    
    // Set up interval (every 2 minutes)
    syncIntervalRef.current = setInterval(checkAndSync, 120000);
    
    // Set up connection status change listener
    const handleConnectionChange = (isOnline) => {
      if (isOnline) {
        console.log('[OrderSyncManager] Connection restored. Checking for pending orders...');
        setTimeout(checkAndSync, 5000); // Wait 5 seconds after connection restored
      }
    };
    
    connectionStatus.addListener(handleConnectionChange);
    
    // Clean up on unmount
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      connectionStatus.removeListener(handleConnectionChange);
    };
  }, []);
  
  // Also check when online status changes
  useEffect(() => {
    const handleOnlineStatusChange = () => {
      if (navigator.onLine) {
        console.log('[OrderSyncManager] Browser reports online status. Checking for pending orders...');
        setTimeout(checkAndSync, 5000);
      }
    };
    
    window.addEventListener('online', handleOnlineStatusChange);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
    };
  }, []);
  
  // Expose manual sync function for other components to use
  const manualSync = async () => {
    console.log('[OrderSyncManager] Manual sync triggered');
    return await checkAndSync();
  };

  // Expose this component's functions to parent via a ref if provided
  useEffect(() => {
    if (props.syncRef) {
      props.syncRef.current = {
        checkAndSync: manualSync
      };
    }
  }, [props.syncRef]);
  
  // This component doesn't render anything
  return null;
};

export default OrderSyncManager; 