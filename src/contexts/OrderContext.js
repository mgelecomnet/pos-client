import React, { createContext, useState, useContext, useEffect } from 'react';
import { useToast } from '@chakra-ui/react';

// Create the context
const OrderContext = createContext();

// Order provider component
export const OrderProvider = ({ children }) => {
  const [openOrders, setOpenOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const toast = useToast();

  // Load orders from localStorage on first render
  useEffect(() => {
    try {
      const savedOrders = localStorage.getItem('pos_orders');
      const savedActiveOrderId = localStorage.getItem('pos_active_order_id');
      
      if (savedOrders) {
        const parsedOrders = JSON.parse(savedOrders);
        setOpenOrders(parsedOrders);
        
        if (savedActiveOrderId && parsedOrders.some(order => order.id === savedActiveOrderId)) {
          setActiveOrderId(savedActiveOrderId);
        } else if (parsedOrders.length > 0) {
          setActiveOrderId(parsedOrders[0].id);
        }
      } else if (openOrders.length === 0) {
        // If no saved orders, create a default one
        createNewOrder();
      }
    } catch (error) {
      console.error('Error loading orders from localStorage:', error);
      if (openOrders.length === 0) {
        createNewOrder();
      }
    }
  }, []);

  // Save orders to localStorage whenever they change
  useEffect(() => {
    if (openOrders.length > 0) {
      localStorage.setItem('pos_orders', JSON.stringify(openOrders));
    }
    if (activeOrderId) {
      localStorage.setItem('pos_active_order_id', activeOrderId);
    }
  }, [openOrders, activeOrderId]);

  // Get the active order data
  const getActiveOrder = () => {
    return openOrders.find(order => order.id === activeOrderId) || null;
  };

  // Create a new order
  const createNewOrder = () => {
    const newId = `POS-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newOrder = {
      id: newId,
      time,
      customer: null,
      cart: [],
      note: '',
      created: now.toISOString()
    };
    
    const updatedOrders = [
      ...openOrders.map(order => ({ ...order })),
      newOrder
    ];
    
    setOpenOrders(updatedOrders);
    setActiveOrderId(newId);
    
    return newId;
  };

  // Switch to a specific order
  const switchToOrder = (orderId) => {
    const orderExists = openOrders.some(order => order.id === orderId);
    
    if (orderExists) {
      setActiveOrderId(orderId);
      return true;
    }
    
    return false;
  };

  // Close/remove an order
  const closeOrder = (orderId) => {
    const orderToClose = openOrders.find(order => order.id === orderId);
    
    if (!orderToClose) {
      return false;
    }
    
    // Check if cart is not empty
    if (orderToClose.cart.length > 0) {
      // Show confirmation from calling component
      return { requiresConfirmation: true, order: orderToClose };
    }
    
    // Proceed with removing the order
    const updatedOrders = openOrders.filter(order => order.id !== orderId);
    
    if (updatedOrders.length === 0) {
      // If no orders left, create a new one
      localStorage.removeItem('pos_orders');
      localStorage.removeItem('pos_active_order_id');
      setOpenOrders([]);
      createNewOrder();
      return true;
    }
    
    // If we're closing the active order, activate another one if available
    if (orderId === activeOrderId) {
      setActiveOrderId(updatedOrders[0].id);
    }
    
    setOpenOrders(updatedOrders);
    return true;
  };

  // Force close an order (even with items in cart)
  const forceCloseOrder = (orderId) => {
    const updatedOrders = openOrders.filter(order => order.id !== orderId);
    
    if (updatedOrders.length === 0) {
      // If no orders left, create a new one
      localStorage.removeItem('pos_orders');
      localStorage.removeItem('pos_active_order_id');
      setOpenOrders([]);
      createNewOrder();
      return true;
    }
    
    // If we're closing the active order, activate another one if available
    if (orderId === activeOrderId) {
      setActiveOrderId(updatedOrders[0].id);
    }
    
    setOpenOrders(updatedOrders);
    return true;
  };

  // Update cart for the active order
  const updateCart = (cart) => {
    if (!activeOrderId) return false;
    
    const updatedOrders = openOrders.map(order => {
      if (order.id === activeOrderId) {
        return { ...order, cart };
      }
      return order;
    });
    
    setOpenOrders(updatedOrders);
    return true;
  };

  // Add an item to the active order's cart
  const addToCart = (product, quantity = 1) => {
    if (!activeOrderId) return false;
    
    const activeOrder = getActiveOrder();
    if (!activeOrder) return false;
    
    const existingItem = activeOrder.cart.find(item => item.id === product.id);
    let updatedCart;
    
    if (existingItem) {
      // Update quantity if item exists
      updatedCart = activeOrder.cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + quantity } 
          : item
      );
    } else {
      // Add new item
      updatedCart = [...activeOrder.cart, { ...product, quantity }];
    }
    
    const updatedOrders = openOrders.map(order => {
      if (order.id === activeOrderId) {
        return { ...order, cart: updatedCart };
      }
      return order;
    });
    
    setOpenOrders(updatedOrders);
    return true;
  };

  // Remove an item from the active order's cart
  const removeFromCart = (productId) => {
    if (!activeOrderId) return false;
    
    const activeOrder = getActiveOrder();
    if (!activeOrder) return false;
    
    const updatedCart = activeOrder.cart.filter(item => item.id !== productId);
    
    const updatedOrders = openOrders.map(order => {
      if (order.id === activeOrderId) {
        return { ...order, cart: updatedCart };
      }
      return order;
    });
    
    setOpenOrders(updatedOrders);
    return true;
  };

  // Update quantity of an item in the active order's cart
  const updateQuantity = (productId, quantity) => {
    if (!activeOrderId || quantity < 1) return false;
    
    const activeOrder = getActiveOrder();
    if (!activeOrder) return false;
    
    const updatedCart = activeOrder.cart.map(item => 
      item.id === productId ? { ...item, quantity } : item
    );
    
    const updatedOrders = openOrders.map(order => {
      if (order.id === activeOrderId) {
        return { ...order, cart: updatedCart };
      }
      return order;
    });
    
    setOpenOrders(updatedOrders);
    return true;
  };

  // Set customer for the active order
  const setCustomer = (customer) => {
    if (!activeOrderId) return false;
    
    const updatedOrders = openOrders.map(order => {
      if (order.id === activeOrderId) {
        return { ...order, customer };
      }
      return order;
    });
    
    setOpenOrders(updatedOrders);
    return true;
  };

  // Get cart total for the active order
  const getCartTotal = () => {
    const activeOrder = getActiveOrder();
    if (!activeOrder) return 0;
    
    return activeOrder.cart.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  };

  // Get cart item count for the active order
  const getCartItemCount = () => {
    const activeOrder = getActiveOrder();
    if (!activeOrder) return 0;
    
    return activeOrder.cart.reduce((count, item) => {
      return count + item.quantity;
    }, 0);
  };

  // Clear the cart of the active order
  const clearCart = () => {
    if (!activeOrderId) return false;
    
    const updatedOrders = openOrders.map(order => {
      if (order.id === activeOrderId) {
        return { ...order, cart: [] };
      }
      return order;
    });
    
    setOpenOrders(updatedOrders);
    return true;
  };

  // The context value object
  const value = {
    openOrders,
    activeOrderId,
    getActiveOrder,
    createNewOrder,
    switchToOrder,
    closeOrder,
    forceCloseOrder,
    updateCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    setCustomer,
    getCartTotal,
    getCartItemCount,
    clearCart
  };

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
};

// Custom hook to use the order context
export const useOrder = () => {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrder must be used within an OrderProvider');
  }
  return context;
};

export default OrderContext; 