import { openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import { connectionStatus } from './odoo';
import { orderService } from './odoo';

const DB_NAME = 'pos_orders';
const STORE_NAME = 'orders';
const DB_VERSION = 2;

// Initialize the database
const initDb = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Create the orders store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
        store.createIndex('syncStatus', 'syncStatus');
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('hasBeenRefunded', 'hasBeenRefunded');
        store.createIndex('isRefund', 'isRefund');
      } else if (oldVersion < 2) {
        // If upgrading from version 1 to 2, add new indexes
        const store = transaction.objectStore(STORE_NAME);
        if (!store.indexNames.contains('hasBeenRefunded')) {
          store.createIndex('hasBeenRefunded', 'hasBeenRefunded');
        }
        if (!store.indexNames.contains('isRefund')) {
          store.createIndex('isRefund', 'isRefund');
        }
      }
    },
  });
};

// Generate a unique local ID for orders


// Get all offline orders
const getAllOrders = async () => {
  const db = await initDb();
  return db.getAll(STORE_NAME);
};

// Get orders with a specific sync status


// Get pending orders (not synced or failed)
const getPendingOrders = async () => {
  try {
    console.log('[offlineOrderService] Getting pending orders...');
    const db = await initDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.store;
    const orders = await store.getAll();
    
    // Get orders that need sync: draft, pending, or failed
    const pendingOrders = orders.filter(order => 
      order.syncStatus === OFFLINE_ORDER_STATUS.DRAFT ||
      order.syncStatus === OFFLINE_ORDER_STATUS.PENDING ||
      order.syncStatus === OFFLINE_ORDER_STATUS.FAILED
    );
    
    console.log(`[offlineOrderService] Found ${pendingOrders.length} pending orders:`, 
      pendingOrders.map(o => ({
        id: o.localId,
        status: o.syncStatus,
        orderId: o.orderId
      }))
    );
    
    return pendingOrders;
  } catch (error) {
    console.error('[offlineOrderService] Error getting pending orders:', error);
    return [];
  }
};

// Get a specific order by its ID
const getOrderById = async (localId) => {
  const db = await initDb();
  return db.get(STORE_NAME, localId);
};

// Save a new order


// Update an existing order


// Update order sync status


// Delete an order


// Create a new order

// Offline order statuses
const OFFLINE_ORDER_STATUS = {
  DRAFT: 'draft',         // Order is created but not finalized
  PENDING: 'pending',     // Order is finalized but not synced
  SYNCING: 'syncing',     // Currently being sent to server
  SYNCED: 'synced',      // Successfully synced with server
  FAILED: 'failed'       // Failed to sync with server
};

// Service to handle offline orders
const offlineOrderService = {
  /**
   * Save order data to offline storage
   * @param {Object} orderData - The complete order data
   * @returns {Promise<Object>} The saved order with local ID
   */
  saveOrderOffline: async (orderData) => {
    try {
      const db = await initDb();
      
      // Generate a local ID for this offline order
      const localId = uuidv4();
      
      // Check if this is a refund order
      const isRefundOrder = orderData.id?.startsWith('REFUND-') || 
                           orderData.data?.is_refund || 
                           (orderData.data?.lines || []).some(line => 
                             line[2]?.qty < 0 || line[2]?.refund_orderline_id);
      
      // For refund orders, ensure pos_reference matches the refund order ID
      if (isRefundOrder && orderData.id && orderData.data) {
        console.log(`[offlineOrderService] Ensuring pos_reference matches refund order ID: ${orderData.id}`);
        orderData.data.pos_reference = orderData.id;
        
        // Get the original order ID if this is a refund
        const originalOrderId = orderData.data?.original_order_id || 
                               (orderData.id && orderData.id.startsWith('REFUND-') ? 
                                orderData.id.split('-')[1] : null);
        
        // If we have the original order ID, tag it as refunded
        if (originalOrderId) {
          console.log(`[offlineOrderService] Tagging original order ${originalOrderId} as refunded`);
          try {
            await offlineOrderService.tagOrderAsRefunded(originalOrderId, {
              refundOrderId: orderData.id,
              refundDate: new Date().toISOString(),
              refundAmount: orderData.data?.amount_total || 0
            });
          } catch (tagError) {
            console.warn(`[offlineOrderService] Could not tag original order as refunded:`, tagError);
          }
        }
      }
      
      const offlineOrder = {
        localId,
        orderId: orderData.id || orderData.data?.id,
        orderData,
        syncStatus: OFFLINE_ORDER_STATUS.DRAFT, // Start with DRAFT status
        timestamp: new Date().toISOString(),
        syncAttempts: 0,
        error: null,
        isRefund: isRefundOrder
      };
      
      await db.add(STORE_NAME, offlineOrder);
      console.log(`[offlineOrderService] Order saved locally with ID: ${localId}, status: ${offlineOrder.syncStatus}, isRefund: ${isRefundOrder}`);
      
      return offlineOrder;
    } catch (error) {
      console.error('[offlineOrderService] Error saving order offline:', error);
      throw error;
    }
  },
  
  /**
   * Get all offline orders
   * @param {string} status - Optional status filter
   * @returns {Promise<Array>} List of offline orders
   */
  getOfflineOrders: getAllOrders,
  
  /**
   * Get a specific order by its ID
   * @param {string} orderId - The order ID to look up
   * @returns {Promise<Object|null>} The order if found, null otherwise
   */
  getOrderById: async (orderId) => {
    try {
      console.log('[offlineOrderService] Getting order by ID:', orderId);
      const db = await initDb();
      const allOrders = await db.getAll(STORE_NAME);
      
      // First try to find by localId
      let order = await db.get(STORE_NAME, orderId);
      
      // If not found by localId, try to find by orderId in orderData
      if (!order) {
        order = allOrders.find(o => 
          o.orderId === orderId || 
          o.orderData?.id === orderId ||
          o.orderData?.data?.id === orderId
        );
      }
      
      console.log('[offlineOrderService] Found order:', order);
      return order;
    } catch (error) {
      console.error('[offlineOrderService] Error getting order by ID:', error);
      throw error;
    }
  },
  
  /**
   * Update order sync status
   * @param {string} orderId - The order ID to update
   * @param {string} syncStatus - The new sync status
   * @param {string} serverOrderId - Optional server-side order ID
   */
  updateOrderSyncStatus: async (orderId, syncStatus, serverOrderId = null) => {
    try {
      const order = await getOrderById(orderId);
      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // Log status transition
      console.log(`[offlineOrderService] Updating order ${orderId} status: ${order.syncStatus} -> ${syncStatus}`);

      const updatedOrder = {
        ...order,
        syncStatus,
        lastSyncAttempt: new Date().toISOString()
      };

      if (serverOrderId) {
        updatedOrder.serverOrderId = serverOrderId;
      }

      if (syncStatus === OFFLINE_ORDER_STATUS.FAILED) {
        updatedOrder.syncAttempts = (order.syncAttempts || 0) + 1;
        updatedOrder.error = 'Failed to sync with server';
      }

      if (syncStatus === OFFLINE_ORDER_STATUS.SYNCED) {
        updatedOrder.syncDate = new Date().toISOString();
        updatedOrder.error = null; // Clear any previous errors
      }

      const db = await initDb();
      await db.put(STORE_NAME, updatedOrder);
      return updatedOrder;
    } catch (error) {
      console.error('[offlineOrderService] Error updating order sync status:', error);
      throw error;
    }
  },
  
  /**
   * Delete an order from offline storage
   * @param {string} orderId - The order ID to delete
   */
  deleteOrder: async (orderId) => {
    try {
      const db = await initDb();
      await db.delete(STORE_NAME, orderId);
    } catch (error) {
      console.error('[offlineOrderService] Error deleting order:', error);
      throw error;
    }
  },
  
  /**
   * Sync a specific offline order
   * @param {string} localId - Local ID of the order
   * @returns {Promise<Object>} Result of the sync operation
   */
  syncOrder: async (localId) => {
    try {
      const db = await initDb();
      const offlineOrder = await db.get(STORE_NAME, localId);
      
      if (!offlineOrder) {
        throw new Error(`Order with local ID ${localId} not found`);
      }
      
      // Check connection first
      if (!connectionStatus.isOnline) {
        await connectionStatus.checkConnection();
        // If still not online after check, throw error
        if (!connectionStatus.isOnline) {
          throw new Error('Cannot sync order: no connection to server');
        }
      }
      
      // Update status to syncing
      await db.put(STORE_NAME, {
        ...offlineOrder,
        syncStatus: OFFLINE_ORDER_STATUS.SYNCING,
        syncAttempts: offlineOrder.syncAttempts + 1,
        lastSyncAttempt: new Date().toISOString()
      });
      
      // Double-check that refund orders have the correct pos_reference
      const isRefundOrder = offlineOrder.isRefund || 
                           offlineOrder.orderId?.startsWith('REFUND-') ||
                           offlineOrder.orderData?.id?.startsWith('REFUND-') ||
                           offlineOrder.orderData?.data?.is_refund;
                          
      if (isRefundOrder && offlineOrder.orderData?.data) {
        const refundOrderId = offlineOrder.orderId || offlineOrder.orderData?.id;
        console.log(`[offlineOrderService] Ensuring pos_reference matches refund order ID before sync: ${refundOrderId}`);
        // Make sure pos_reference matches refund order ID
        offlineOrder.orderData.data.pos_reference = refundOrderId;
        // Also set name to match
        offlineOrder.orderData.data.name = `Refund Order ${refundOrderId}`;
      }
      
      // Try to send to server
      console.log(`[offlineOrderService] Sending order ${localId} to server...`);
      const result = await orderService.createOrder(offlineOrder.orderData);
      
      if (result && result.success) {
        // Verify the sync was actually successful by checking server result
        if (!result.serverResult) {
          console.warn(`[offlineOrderService] Server didn't return result details for order ${localId}`);
        }
        
        // Update with success status and server data
        await db.put(STORE_NAME, {
          ...offlineOrder,
          syncStatus: OFFLINE_ORDER_STATUS.SYNCED,
          syncDate: new Date().toISOString(),
          serverOrderId: result.id,
          serverResponse: result
        });
        
        console.log(`[offlineOrderService] Order ${localId} successfully synced with server ID: ${result.id}`);
        return { success: true, serverOrderId: result.id, localId };
      } else {
        throw new Error('Server returned unsuccessful response');
      }
    } catch (error) {
      console.error(`[offlineOrderService] Error syncing order ${localId}:`, error);
      
      // Update with failed status
      try {
        const db = await initDb();
        const offlineOrder = await db.get(STORE_NAME, localId);
        
        if (offlineOrder) {
          await db.put(STORE_NAME, {
            ...offlineOrder,
            syncStatus: OFFLINE_ORDER_STATUS.FAILED,
            error: error.message || 'Unknown error',
            lastSyncAttempt: new Date().toISOString()
          });
        }
      } catch (dbError) {
        console.error('[offlineOrderService] Error updating order status:', dbError);
      }
      
      return { success: false, error: error.message, localId };
    }
  },
  
  /**
   * Sync all pending offline orders
   * @returns {Promise<Object>} Summary of sync operation
   */
  syncAllPendingOrders: async () => {
    try {
      // Check connection first
      if (!connectionStatus.isOnline) {
        await connectionStatus.checkConnection();
        // If still not online after check, throw error
        if (!connectionStatus.isOnline) {
          throw new Error('Cannot sync orders: no connection to server');
        }
      }
      
      const pendingOrders = await offlineOrderService.getPendingOrders();
      console.log(`[offlineOrderService] Starting sync for ${pendingOrders.length} pending orders`);
      
      const results = {
        total: pendingOrders.length,
        successful: 0,
        failed: 0,
        details: []
      };
      
      // Process each order sequentially (not in parallel)
      for (const order of pendingOrders) {
        try {
          console.log(`[offlineOrderService] Syncing order ${order.localId} (status: ${order.syncStatus})`);
          
          // Double-check with the database to ensure this order still needs syncing
          const db = await initDb();
          const freshOrderData = await db.get(STORE_NAME, order.localId);
          
          // Skip if not found or already synced (prevents race conditions)
          if (!freshOrderData) {
            console.log(`[offlineOrderService] Order ${order.localId} no longer exists in database, skipping`);
            continue;
          }
          
          if (freshOrderData.syncStatus === OFFLINE_ORDER_STATUS.SYNCED) {
            console.log(`[offlineOrderService] Order ${order.localId} is already synced, skipping`);
            continue;
          }
          
          // Log order data for debugging
          console.log(`[offlineOrderService] Order data for syncing:`, JSON.stringify({
            orderId: freshOrderData.orderId,
            paymentIds: freshOrderData.orderData?.data?.payment_ids
          }, null, 2));
          
          const syncResult = await offlineOrderService.syncOrder(order.localId);
          results.details.push({
            ...syncResult,
            localId: order.localId,
            previousStatus: order.syncStatus
          });
          
          if (syncResult.success) {
            results.successful++;
            console.log(`[offlineOrderService] Successfully synced order ${order.localId}`);
          } else {
            results.failed++;
            console.error(`[offlineOrderService] Failed to sync order ${order.localId}:`, syncResult.error);
          }
        } catch (error) {
          console.error(`[offlineOrderService] Error syncing order ${order.localId}:`, error);
          results.failed++;
          results.details.push({ 
            localId: order.localId, 
            success: false, 
            error: error.message,
            previousStatus: order.syncStatus
          });
        }
      }
      
      console.log(`[offlineOrderService] Sync completed. Success: ${results.successful}, Failed: ${results.failed}`);
      return results;
    } catch (error) {
      console.error('[offlineOrderService] Error syncing pending orders:', error);
      throw error;
    }
  },
  
  /**
   * Check if auto-sync should be performed
   * This can be called periodically to attempt syncing when connection is restored
   * @returns {Promise<Object>} Results of any sync attempt
   */
  checkAndSyncIfOnline: async () => {
    try {
      // Skip if already online or if no pending orders
      const pendingCount = await offlineOrderService.getPendingOrdersCount();
      
      if (pendingCount === 0) {
        return { 
          didSync: false, 
          reason: 'no_pending_orders' 
        };
      }
      
      // Check connection
      const isOnline = await connectionStatus.checkConnection();
      
      if (!isOnline) {
        return { 
          didSync: false, 
          reason: 'offline',
          pendingCount 
        };
      }
      
      // We're online and have pending orders, try to sync
      console.log(`[offlineOrderService] Connection is online. Attempting to sync ${pendingCount} pending orders...`);
      const syncResults = await offlineOrderService.syncAllPendingOrders();
      
      return {
        didSync: true,
        ...syncResults
      };
    } catch (error) {
      console.error('[offlineOrderService] Error in checkAndSyncIfOnline:', error);
      return {
        didSync: false,
        error: error.message,
        reason: 'error'
      };
    }
  },
  
  /**
   * Get the count of pending orders
   * @returns {Promise<number>} Count of pending orders
   */
  getPendingOrdersCount: async () => {
    try {
      console.log('[offlineOrderService] Counting pending orders...');
      
      // Use the getPendingOrders function to ensure consistent filtering
      const pendingOrders = await offlineOrderService.getPendingOrders();
      
      console.log(`[offlineOrderService] Found ${pendingOrders.length} pending orders to sync`);
      return pendingOrders.length;
    } catch (error) {
      console.error('[offlineOrderService] Error getting pending orders count:', error);
      return 0;
    }
  },

  /**
   * Finalize an order and mark it ready for sync
   * @param {string} orderId - The order ID to finalize
   */
  finalizeOrder: async (orderId) => {
    try {
      return await offlineOrderService.updateOrderSyncStatus(orderId, OFFLINE_ORDER_STATUS.PENDING);
    } catch (error) {
      console.error('[offlineOrderService] Error finalizing order:', error);
      throw error;
    }
  },

  /**
   * Get orders by sync status
   * @param {string} syncStatus - The sync status to filter by
   * @returns {Promise<Array>} List of orders with the specified status
   */
  getOrdersBySyncStatus: async (syncStatus) => {
    try {
      const db = await initDb();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const index = tx.store.index('syncStatus');
      return index.getAll(syncStatus);
    } catch (error) {
      console.error('[offlineOrderService] Error getting orders by status:', error);
      return [];
    }
  },

  /**
   * Get all pending orders that need to be synced
   * @returns {Promise<Array>} List of pending orders
   */
  getPendingOrders: async () => {
    try {
      console.log('[offlineOrderService] Getting pending orders for sync...');
      const orders = await getPendingOrders();
      
      // Additional check to ensure we don't include already synced orders
      const validPendingOrders = orders.filter(order => {
        const isValidStatus = order.syncStatus === OFFLINE_ORDER_STATUS.DRAFT ||
                            order.syncStatus === OFFLINE_ORDER_STATUS.PENDING ||
                            order.syncStatus === OFFLINE_ORDER_STATUS.FAILED;
        
        // Log any inconsistencies
        if (!isValidStatus && order.syncStatus !== OFFLINE_ORDER_STATUS.SYNCED) {
          console.warn(`[offlineOrderService] Order ${order.localId} has unexpected status: ${order.syncStatus}`);
        }
        
        return isValidStatus;
      });
      
      console.log(`[offlineOrderService] Found ${validPendingOrders.length} valid pending orders for sync`);
      return validPendingOrders;
    } catch (error) {
      console.error('[offlineOrderService] Error getting pending orders:', error);
      return [];
    }
  },

  /**
   * Check if an order needs to be synced
   * @param {string} orderId - The order ID to check
   * @param {boolean} forceCheck - Force server checking for orders marked as synced
   * @returns {Promise<boolean>} True if the order needs to be synced
   */
  needsSync: async (orderId, forceCheck = false) => {
    try {
      const order = await getOrderById(orderId);
      if (!order) return false;
      
      const needsSync = order.syncStatus === OFFLINE_ORDER_STATUS.DRAFT ||
                       order.syncStatus === OFFLINE_ORDER_STATUS.PENDING ||
                       order.syncStatus === OFFLINE_ORDER_STATUS.FAILED;
      
      // If the order is marked as synced but forceCheck is true, we'll still try to sync it again
      const forcedResync = forceCheck && order.syncStatus === OFFLINE_ORDER_STATUS.SYNCED;
      
      console.log(`[offlineOrderService] Order ${orderId} needs sync: ${needsSync || forcedResync} (status: ${order.syncStatus}, forced: ${forcedResync})`);
      
      if (forcedResync) {
        console.log(`[offlineOrderService] Order ${orderId} marked for forced resync`);
        // Update the status to make it eligible for syncing again
        await offlineOrderService.updateOrderSyncStatus(orderId, OFFLINE_ORDER_STATUS.PENDING);
        return true;
      }
      
      return needsSync;
    } catch (error) {
      console.error(`[offlineOrderService] Error checking sync status for order ${orderId}:`, error);
      return false;
    }
  },

  /**
   * Force resync of an order regardless of its current sync status
   * @param {string} orderId - The order ID to force sync
   * @returns {Promise<Object>} Result of the sync operation
   */
  forceResyncOrder: async (orderId) => {
    try {
      const order = await getOrderById(orderId);
      if (!order) {
        throw new Error(`Order with ID ${orderId} not found`);
      }
      
      console.log(`[offlineOrderService] Forcing resync of order ${orderId}, current status: ${order.syncStatus}`);
      
      // Reset the order status to pending
      await offlineOrderService.updateOrderSyncStatus(orderId, OFFLINE_ORDER_STATUS.PENDING);
      
      // Check connection first
      if (!connectionStatus.isOnline) {
        await connectionStatus.checkConnection();
        if (!connectionStatus.isOnline) {
          throw new Error('Cannot sync order: no connection to server');
        }
      }
      
      // Try to sync the order
      const syncResult = await offlineOrderService.syncOrder(order.localId);
      
      console.log(`[offlineOrderService] Force resync result for order ${orderId}:`, syncResult);
      return syncResult;
    } catch (error) {
      console.error(`[offlineOrderService] Error during forced resync for order ${orderId}:`, error);
      throw error;
    }
  },

  /**
   * Tag an order as having been refunded
   * @param {string} orderId - The original order ID that was refunded
   * @param {Object} refundDetails - Details about the refund
   * @returns {Promise<Object>} The updated order
   */
  tagOrderAsRefunded: async (orderId, refundDetails = {}) => {
    try {
      // Find the order first
      console.log(`[offlineOrderService] Looking for original order ${orderId} to tag as refunded`);
      const db = await initDb();
      const allOrders = await db.getAll(STORE_NAME);
      
      // Try to find the order by its ID (could be localId or orderId in data)
      let originalOrder = await db.get(STORE_NAME, orderId);
      
      // If not found by localId, search through all orders
      if (!originalOrder) {
        originalOrder = allOrders.find(o => 
          o.orderId === orderId || 
          o.orderData?.id === orderId ||
          o.orderData?.data?.id === orderId
        );
      }
      
      if (!originalOrder) {
        console.warn(`[offlineOrderService] Could not find original order ${orderId} to tag`);
        return null;
      }
      
      console.log(`[offlineOrderService] Found original order ${originalOrder.localId}, adding refund tag`);
      
      // Create refund history array if it doesn't exist
      const refundHistory = originalOrder.refundHistory || [];
      
      // Add this refund to history
      refundHistory.push({
        refundOrderId: refundDetails.refundOrderId || `REFUND-${orderId}`,
        refundDate: refundDetails.refundDate || new Date().toISOString(),
        refundAmount: refundDetails.refundAmount || 0,
      });
      
      // Update the order with refund flags and history
      const updatedOrder = {
        ...originalOrder,
        hasBeenRefunded: true,
        refundHistory,
        lastRefundDate: refundDetails.refundDate || new Date().toISOString()
      };
      
      // If this is the first refund, also add it to the order data
      if (!originalOrder.hasBeenRefunded && originalOrder.orderData?.data) {
        // Add refund flags to the order data too so they sync to server
        updatedOrder.orderData.data.has_been_refunded = true;
        updatedOrder.orderData.data.refund_history = JSON.stringify(refundHistory);
      }
      
      // Save the updated order
      await db.put(STORE_NAME, updatedOrder);
      console.log(`[offlineOrderService] Successfully tagged order ${originalOrder.localId} as refunded`);
      
      return updatedOrder;
    } catch (error) {
      console.error(`[offlineOrderService] Error tagging order as refunded:`, error);
      throw error;
    }
  },
  
  /**
   * Check if an order has been refunded
   * @param {string} orderId - The order ID to check
   * @returns {Promise<Object|null>} Refund information or null if not refunded
   */
  getOrderRefundInfo: async (orderId) => {
    try {
      const order = await offlineOrderService.getOrderById(orderId);
      if (!order) return null;
      
      if (order.hasBeenRefunded) {
        return {
          hasBeenRefunded: true,
          refundHistory: order.refundHistory || [],
          lastRefundDate: order.lastRefundDate
        };
      }
      
      return null;
    } catch (error) {
      console.error(`[offlineOrderService] Error getting refund info:`, error);
      return null;
    }
  },

  /**
   * Get all orders that have been refunded
   * @returns {Promise<Array>} List of orders that have been refunded
   */
  getRefundedOrders: async () => {
    try {
      console.log('[offlineOrderService] Getting all orders that have been refunded');
      const db = await initDb();
      
      // Try to get orders that have been refunded using the index
      try {
        const index = db.transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .index('hasBeenRefunded');
          
        const refundedOrders = await index.getAll(true);
        console.log(`[offlineOrderService] Found ${refundedOrders.length} refunded orders using index`);
        return refundedOrders;
      } catch (indexError) {
        console.warn('[offlineOrderService] Error using hasBeenRefunded index, falling back to full scan:', indexError);
        
        // Fall back to getting all orders and filtering
        const allOrders = await db.getAll(STORE_NAME);
        const refundedOrders = allOrders.filter(order => 
          order.hasBeenRefunded || 
          order.orderData?.data?.has_been_refunded
        );
        
        console.log(`[offlineOrderService] Found ${refundedOrders.length} refunded orders via full scan`);
        return refundedOrders;
      }
    } catch (error) {
      console.error('[offlineOrderService] Error getting refunded orders:', error);
      return [];
    }
  },
  
  /**
   * Get all refund orders (the actual refund transactions)
   * @returns {Promise<Array>} List of refund orders
   */
  getRefundOrders: async () => {
    try {
      console.log('[offlineOrderService] Getting all refund orders');
      const db = await initDb();
      
      // Try to get orders that are refunds using the index
      try {
        const index = db.transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .index('isRefund');
          
        const refundOrders = await index.getAll(true);
        console.log(`[offlineOrderService] Found ${refundOrders.length} refund orders using index`);
        return refundOrders;
      } catch (indexError) {
        console.warn('[offlineOrderService] Error using isRefund index, falling back to full scan:', indexError);
        
        // Fall back to getting all orders and filtering
        const allOrders = await db.getAll(STORE_NAME);
        const refundOrders = allOrders.filter(order => 
          order.isRefund || 
          order.orderData?.data?.is_refund ||
          order.orderData?.id?.startsWith('REFUND-')
        );
        
        console.log(`[offlineOrderService] Found ${refundOrders.length} refund orders via full scan`);
        return refundOrders;
      }
    } catch (error) {
      console.error('[offlineOrderService] Error getting refund orders:', error);
      return [];
    }
  }
};

export default offlineOrderService;
export { OFFLINE_ORDER_STATUS }; 