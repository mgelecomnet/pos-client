import axios from 'axios';
import odooApi, { odooConfig } from './odooApi';
import offlineOrderService from './offlineOrderService';

// Helper functions to replace missing getConfig and getSession
const getConfig = () => {
  
  return {
    apiUrl: process.env.REACT_APP_ODOO_API_URL || odooConfig?.apiUrl,
    db: process.env.REACT_APP_ODOO_DB || odooConfig?.db
  };
};

const getSession = () => {
  try {
    // Try to get user data from localStorage
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    if (userData && userData.session_id) {
      return {
        id: userData.session_id,
        uid: userData.uid,
        pos_session_id: userData.pos_session_id
      };
    }
  } catch (error) {
    console.error('Error retrieving session:', error);
  }
  return null;
};

// Get an order by ID - works for both online and offline orders
export const getOrderById = async (orderId) => {
  // Check if this is an offline order first
  const offlineOrder = await offlineOrderService.getOrderById(orderId);
  if (offlineOrder) {
    return formatOfflineOrder(offlineOrder);
  }

  // If not found offline, try to get from Odoo
  try {
    const { apiUrl, db } = getConfig();
    const session = getSession();

    if (!session || !session.uid) {
      throw new Error('No active session');
    }

    const response = await axios.post(
      `${apiUrl}/web/dataset/call_kw/pos.order/get_order_details`,
      {
        params: {
          model: 'pos.order',
          method: 'get_order_details',
          args: [orderId],
          kwargs: {},
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Openerp-Session-Id': session.id,
        },
      }
    );

    if (response.data.error) {
      throw new Error(response.data.error.data.message || 'Failed to get order');
    }

    return response.data.result;
  } catch (error) {
    console.error('Error fetching order:', error);
    throw error;
  }
};

// Sync a specific order to Odoo
export const syncOrderById = async (orderId) => {
  // Get the offline order
  const order = await offlineOrderService.getOrderById(orderId);
  
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.sync_status === 'synced') {
    return { success: true, message: 'Order already synced' };
  }

  try {
    const { apiUrl, db } = getConfig();
    const session = getSession();

    if (!session || !session.uid) {
      throw new Error('No active session');
    }

    // Prepare order data for syncing
    const orderData = {
      ...order,
      session_id: session.pos_session_id,
      user_id: session.uid,
    };

    // Send to Odoo
    const response = await axios.post(
      `${apiUrl}/web/dataset/call_kw/pos.order/create_from_ui`,
      {
        params: {
          model: 'pos.order',
          method: 'create_from_ui',
          args: [[orderData]],
          kwargs: {},
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Openerp-Session-Id': session.id,
        },
      }
    );

    if (response.data.error) {
      throw new Error(response.data.error.data.message || 'Failed to sync order');
    }

    // Update local order status to synced
    await offlineOrderService.updateOrderSyncStatus(orderId, 'synced', response.data.result[0]);
    
    return { 
      success: true, 
      message: 'Order synced successfully',
      odooId: response.data.result[0]
    };
  } catch (error) {
    console.error('Error syncing order:', error);
    
    // Update local order sync status to failed
    await offlineOrderService.updateOrderSyncStatus(orderId, 'failed');
    
    throw error;
  }
};

// Fetch all orders for the current POS session
export const getAllOrders = async (options = {}) => {
  const { limit = 50, offset = 0, includeOffline = true } = options;
  
  try {
    // Get online orders
    const { apiUrl, db } = getConfig();
    const session = getSession();

    if (!session || !session.uid) {
      // If no session, only return offline orders
      if (includeOffline) {
        const offlineOrders = await offlineOrderService.getAllOrders();
        return offlineOrders.map(formatOfflineOrder);
      }
      return [];
    }

    const response = await axios.post(
      `${apiUrl}/web/dataset/call_kw/pos.order/get_session_orders`,
      {
        params: {
          model: 'pos.order',
          method: 'get_session_orders',
          args: [session.pos_session_id],
          kwargs: {
            limit,
            offset,
          },
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Openerp-Session-Id': session.id,
        },
      }
    );

    if (response.data.error) {
      throw new Error(response.data.error.data.message || 'Failed to get orders');
    }

    let orders = response.data.result || [];

    // Include offline orders if requested
    if (includeOffline) {
      const offlineOrders = await offlineOrderService.getAllOrders();
      const formattedOfflineOrders = offlineOrders.map(formatOfflineOrder);
      
      // Merge and sort by creation date descending
      orders = [...orders, ...formattedOfflineOrders]
        .sort((a, b) => new Date(b.create_date) - new Date(a.create_date));
    }

    return orders;
  } catch (error) {
    console.error('Error fetching orders:', error);
    
    // If API call fails, still try to return offline orders
    if (includeOffline) {
      const offlineOrders = await offlineOrderService.getAllOrders();
      return offlineOrders.map(formatOfflineOrder);
    }
    
    throw error;
  }
};

// Format offline order to match Odoo order structure
const formatOfflineOrder = (offlineOrder) => {
  console.log('Formatting offline order:', offlineOrder);
  
  // Extract order data, handling different possible structures
  const orderData = offlineOrder.orderData?.data || {};
  
  // Calculate tax amount if not directly available
  let amountTax = orderData.amount_tax || 0;
  const amountTotal = orderData.amount_total || 0;
  
  // Extract payment information
  const paymentIds = [];
  if (orderData.payment_ids && Array.isArray(orderData.payment_ids)) {
    // Process payment data from different possible structures
    orderData.payment_ids.forEach(payment => {
      if (Array.isArray(payment) && payment.length > 2) {
        // Handle [0, 0, {...}] format
        const paymentData = payment[2] || {};
        paymentIds.push({
          id: paymentData.id || `payment_${paymentIds.length + 1}`,
          amount: paymentData.amount || 0,
          payment_method_id: {
            id: paymentData.payment_method_id || 0,
            name: paymentData.payment_method_name || 'Unknown'
          },
          payment_date: paymentData.payment_date || orderData.date_order
        });
      } else if (typeof payment === 'object' && payment !== null) {
        // Handle direct object format
        paymentIds.push({
          id: payment.id || `payment_${paymentIds.length + 1}`,
          amount: payment.amount || 0,
          payment_method_id: {
            id: payment.payment_method_id || 0,
            name: payment.payment_method_name || 'Unknown'
          },
          payment_date: payment.payment_date || orderData.date_order
        });
      }
    });
  }
  
  // If no payment data found but there's a payment_method_id, create a default payment
  if (paymentIds.length === 0 && (orderData.payment_method_id || orderData.amount_paid)) {
    paymentIds.push({
      id: 'default_payment',
      amount: orderData.amount_paid || orderData.amount_total || 0,
      payment_method_id: {
        id: Array.isArray(orderData.payment_method_id) ? 
             orderData.payment_method_id[0] : 
             (orderData.payment_method_id || 0),
        name: orderData.payment_method_name || 'Default Payment'
      },
      payment_date: orderData.date_order
    });
  }
  
  // Extract lines from the order data
  const rawLines = orderData.lines || [];
  const items = [];
  
  // Process order lines
  if (Array.isArray(rawLines) && rawLines.length > 0) {
    // Handle different possible data structures for order items
    for (const line of rawLines) {
      if (Array.isArray(line) && line.length > 2) {
        const lineData = line[2] || {};
        items.push({
          product_id: {
            id: lineData.product_id || lineData.id,
            name: lineData.full_product_name || lineData.name || 'Unknown Product'
          },
          qty: lineData.qty || lineData.quantity || 0,
          quantity: lineData.qty || lineData.quantity || 0,
          price_unit: lineData.price_unit || 0,
          price_subtotal: lineData.price_subtotal || 0,
          price_subtotal_incl: lineData.price_subtotal_incl || 0,
          tax_ids: lineData.tax_ids || [],
          tax_amount: lineData.tax_amount || 0,
          note: lineData.note || ''
        });
        
        // If tax amount not set at order level, sum from line items
        if (amountTax === 0 && lineData.tax_amount) {
          amountTax += lineData.tax_amount;
        }
      }
    }
  } else if (offlineOrder.items && Array.isArray(offlineOrder.items)) {
    // Handle case where items are in a simpler format
    for (const item of offlineOrder.items) {
      items.push({
        product_id: {
          id: item.id || item.productId,
          name: item.name
        },
        qty: item.quantity || item.qty || 0,
        quantity: item.quantity || item.qty || 0,
        price_unit: item.price || 0,
        price_subtotal: (item.price * (item.quantity || 1) * (1 - (item.discount || 0) / 100)),
        price_subtotal_incl: (item.price * (item.quantity || 1) * (1 - (item.discount || 0) / 100) * 1.15),
        tax_ids: item.tax_ids || [],
        tax_amount: item.tax_amount || 0,
        note: item.note || ''
      });
      
      // Add to total tax amount
      if (amountTax === 0 && item.tax_amount) {
        amountTax += item.tax_amount;
      }
    }
  }
  
  // If we still don't have a tax amount, estimate it as 15% of the subtotal
  if (amountTax === 0 && amountTotal > 0) {
    // Estimate subtotal as total / 1.15 for 15% tax
    const estimatedSubtotal = amountTotal / 1.15;
    amountTax = amountTotal - estimatedSubtotal;
  }
  
  // Calculate subtotal if not available
  const amountUntaxed = orderData.amount_untaxed || (amountTotal - amountTax);

  return {
    ...offlineOrder,
    id: offlineOrder.localId,
    name: orderData.name || orderData.pos_reference || `Local/${offlineOrder.localId}`,
    state: mapOfflineOrderStatus(offlineOrder.syncStatus),
    sync_status: offlineOrder.syncStatus || 'pending',
    lines: items,
    payment_ids: paymentIds,
    amount_total: amountTotal,
    amount_tax: amountTax,
    amount_untaxed: amountUntaxed,
    create_date: offlineOrder.timestamp || orderData.date_order,
    order_type: orderData.order_type || orderData.orderType || 'dine_in',
    partner_id: orderData.partner_id ? {
      id: Array.isArray(orderData.partner_id) ? orderData.partner_id[0] : orderData.partner_id,
      name: orderData.partner_name || 'Customer'
    } : false,
    payment_method_id: orderData.payment_method_id ? {
      id: Array.isArray(orderData.payment_method_id) ? orderData.payment_method_id[0] : orderData.payment_method_id,
      name: orderData.payment_method_name || 'Payment'
    } : false,
    source: 'offline'
  };
};

// Map offline order status to Odoo status
const mapOfflineOrderStatus = (status) => {
  const statusMap = {
    'draft': 'draft',
    'pending': 'draft',
    'paid': 'paid',
    'done': 'done',
    'cancelled': 'cancelled'
  };
  return statusMap[status] || 'draft';
};

// Sync all pending offline orders to Odoo
export const syncAllPendingOrders = async () => {
  const pendingOrders = await offlineOrderService.getPendingOrders();
  
  if (pendingOrders.length === 0) {
    return { success: true, message: 'No pending orders to sync', synced: 0 };
  }
  
  const results = [];
  let successCount = 0;
  
  for (const order of pendingOrders) {
    try {
      const result = await syncOrderById(order.localId);
      results.push({ id: order.localId, success: true });
      successCount++;
    } catch (error) {
      results.push({ id: order.localId, success: false, error: error.message });
    }
  }
  
  return {
    success: true,
    message: `Synced ${successCount} out of ${pendingOrders.length} orders`,
    synced: successCount,
    total: pendingOrders.length,
    results
  };
}; 