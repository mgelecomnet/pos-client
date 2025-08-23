import { useState, useEffect, useCallback } from 'react';
import { productService, categoryService, orderService } from '../api/odoo';
import { db, productsDB, categoriesDB, ordersDB, configDB } from '../services/db';

/**
 * Hook for syncing data between Odoo and local database
 * @returns {Object} Sync functionality and state
 */
export const useSyncData = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  // Load last sync time from IndexedDB
  useEffect(() => {
    const loadLastSync = async () => {
      try {
        const lastSyncTime = await configDB.get('lastSync');
        if (lastSyncTime) {
          setLastSync(new Date(lastSyncTime));
        }
      } catch (err) {
        console.error('Error loading last sync time:', err);
      }
    };

    loadLastSync();
  }, []);

  /**
   * Sync all data from Odoo to local database
   */
  const syncAll = useCallback(async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    setError(null);
    setProgress(0);
    
    try {
      // Sync products
      setProgress(10);
      const products = await productService.getProducts();
      await productsDB.bulkUpsert(products);
      setProgress(40);
      
      // Sync categories
      const categories = await categoryService.getCategories();
      await categoriesDB.bulkUpsert(categories);
      setProgress(70);
      
      // Sync pending orders
      const pendingOrders = await ordersDB.getPendingOrders();
      for (const order of pendingOrders) {
        try {
          const lines = await db.orderLines.where('order_id').equals(order.id).toArray();
          const orderData = {
            ...order,
            lines,
          };
          
          const result = await orderService.createOrder(orderData);
          if (result) {
            await ordersDB.markAsSynced(order.id);
          }
        } catch (err) {
          console.error(`Error syncing order ${order.id}:`, err);
        }
      }
      
      // Update last sync time
      const now = new Date();
      await configDB.set('lastSync', now.toISOString());
      setLastSync(now);
      setProgress(100);
    } catch (err) {
      console.error('Sync error:', err);
      setError(err.message || 'An error occurred during synchronization');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  /**
   * Sync only product data
   */
  const syncProducts = useCallback(async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    setError(null);
    
    try {
      const products = await productService.getProducts();
      await productsDB.bulkUpsert(products);
      
      const now = new Date();
      await configDB.set('lastProductSync', now.toISOString());
    } catch (err) {
      console.error('Product sync error:', err);
      setError(err.message || 'An error occurred during product synchronization');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  /**
   * Sync pending orders to Odoo
   */
  const syncOrders = useCallback(async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    setError(null);
    
    try {
      const pendingOrders = await ordersDB.getPendingOrders();
      for (const order of pendingOrders) {
        try {
          const lines = await db.orderLines.where('order_id').equals(order.id).toArray();
          const orderData = {
            ...order,
            lines,
          };
          
          const result = await orderService.createOrder(orderData);
          if (result) {
            await ordersDB.markAsSynced(order.id);
          }
        } catch (err) {
          console.error(`Error syncing order ${order.id}:`, err);
        }
      }
    } catch (err) {
      console.error('Order sync error:', err);
      setError(err.message || 'An error occurred during order synchronization');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return {
    syncAll,
    syncProducts,
    syncOrders,
    isSyncing,
    lastSync,
    error,
    progress
  };
};

export default useSyncData; 