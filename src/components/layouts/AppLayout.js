import React, { useState, useEffect, useCallback } from 'react';
import { Box, Flex, VStack, HStack, Text, Icon, useDisclosure, IconButton, Avatar, InputGroup, InputLeftElement, Input, Badge, CloseButton, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, Button, useToast, Menu, MenuButton, MenuList, MenuItem, Heading, Divider } from '@chakra-ui/react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ConnectionStatus from '../ConnectionStatus';
import PendingOrdersBadge from '../PendingOrdersBadge';
import ProductManagementModal from '../ProductManagementModal';
import CategoryManagementModal from '../CategoryManagementModal';

// Icons (Replace with actual icons if needed)
import { FiMenu, FiShoppingCart, FiBox, FiUsers, FiSettings, FiLogOut, FiCpu, FiSearch, FiPlus, FiFileText, FiPackage, FiList, FiTag } from 'react-icons/fi';



const OrderTab = ({ id, time, name, isActive, onClick, onClose }) => {
  // Check if this is a refund order
  const isRefundOrder = id.startsWith('REFUND-');
  
  // Format time properly - handle both ISO strings and HH:MM format
  const formattedTime = (() => {
    if (!time) return '';
    
    // If it's an ISO string (contains T and possibly Z)
    if (typeof time === 'string' && (time.includes('T') || time.includes('Z'))) {
      try {
        const date = new Date(time);
        return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
      } catch (e) {
        return time; // Fallback to original if parsing fails
      }
    }
    
    return time; // Already in desired format
  })();
  
  return (
    <Flex
      align="center"
      h="100%"
      px="3"
      py="1"
      mr="1"
      borderRadius="md"
      cursor="pointer"
      bg={isActive ? 'green.500' : isRefundOrder ? 'orange.100' : 'gray.200'}
      color={isActive ? 'white' : isRefundOrder ? 'orange.800' : 'gray.700'}
      borderBottom={isActive ? '3px solid' : 'none'}
      borderColor={isActive ? 'green.700' : 'transparent'}
      onClick={onClick}
      position="relative"
    >
      {isRefundOrder ? (
        <>
          <Badge colorScheme="orange" mr="1" size="sm">بازگشت</Badge>
          <Text fontSize="sm" fontWeight="medium">#{id.replace('REFUND-', '')}</Text>
        </>
      ) : (
      <Text fontSize="sm" fontWeight="medium">#{id}</Text>
      )}
      <Text fontSize="xs" ml="2" opacity="0.8">{formattedTime}</Text>
      <CloseButton 
        size="sm" 
        ml="1" 
        onClick={(e) => {
          e.stopPropagation();
          onClose(id);
        }}
      />
    </Flex>
  );
};

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [posSidebarOpen, setPOSSidebarOpen] = useState(false);
  const [headerSearchText, setHeaderSearchText] = useState('');

  const toast = useToast();
  
  // Auth logout function reference
  const { logout } = useAuth();
  
  // Orders state (tabs)
  const [orders, setOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  
  // Current user
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  
  // Check if current page is the POS page
  const isPOSPage = location.pathname === '/pos';
  
  // Load orders from localStorage on mount
  useEffect(() => {
    if (isPOSPage) {
      try {
        const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        const savedActiveId = localStorage.getItem('pos_active_order_id');
        
        console.log('[AppLayout] Loading saved orders:', savedOrders.length);
        
        if (savedOrders.length > 0) {
          // Filter out duplicates by ID
          const uniqueOrders = [];
          const seenIds = new Set();
          
          for (const order of savedOrders) {
            if (!seenIds.has(order.id)) {
              seenIds.add(order.id);
              uniqueOrders.push(order);
            } else {
              console.log('[AppLayout] Removing duplicate order with ID:', order.id);
            }
          }
          
          setOrders(uniqueOrders);
          
          // Set active order - either the saved one or the first available
          if (savedActiveId && uniqueOrders.some(order => order.id === savedActiveId)) {
            setActiveOrderId(savedActiveId);
          } else {
            setActiveOrderId(uniqueOrders[0].id);
            localStorage.setItem('pos_active_order_id', uniqueOrders[0].id);
          }
        } else {
          // No orders - create first one
          createNewOrder();
        }
      } catch (error) {
        console.error('[AppLayout] Error loading orders:', error);
        // On error, create a fresh order
        createNewOrder();
      }
    }
  }, [isPOSPage]);
  
  // Save orders to localStorage on change
  useEffect(() => {
    if (orders.length > 0) {
      // Filter out any duplicates before saving
      const uniqueOrders = [];
      const seenIds = new Set();
      
      for (const order of orders) {
        if (!seenIds.has(order.id)) {
          seenIds.add(order.id);
          uniqueOrders.push(order);
        }
      }
      
      // Only save if we have different orders
      if (uniqueOrders.length !== orders.length) {
        console.log('[AppLayout] Filtered out duplicate orders before saving');
        setOrders(uniqueOrders);
        return;
      }
      
      localStorage.setItem('pos_orders', JSON.stringify(orders));
      
      if (activeOrderId) {
        localStorage.setItem('pos_active_order_id', activeOrderId);
      }
      
      console.log('[AppLayout] Saved', orders.length, 'orders to localStorage');
    }
  }, [orders, activeOrderId]);
  
  // Create a new order
  const createNewOrder = useCallback(() => {
    const newId = String(Math.floor(1000 + Math.random() * 9000));
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newOrder = {
      id: newId,
      time,
      cart: [],
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    console.log('[AppLayout] Creating new order:', newId);
    
    // Save to state
    setOrders(prevOrders => [...prevOrders, newOrder]);
    
    // If switching from an existing order, notify about the change
    if (activeOrderId) {
      console.log('[AppLayout] Switching from order', activeOrderId, 'to', newId);
      
      // Dispatch event to notify POSPage about tab change
      window.dispatchEvent(new CustomEvent('pos_order_tab_changed', { 
        detail: { orderId: newId, previousOrderId: activeOrderId, isNewOrder: true } 
      }));
    }
    
    // Set as active
    setActiveOrderId(newId);
    
    return newId;
  }, [activeOrderId]);
  
  // Handle order tab click with improved state management
  const handleOrderClick = useCallback((orderId) => {
    if (orderId === activeOrderId) return; // Already active
    
    console.log('[AppLayout] Changing active order to:', orderId);
    
    // Notify POSPage to save current cart and load the new one
    window.dispatchEvent(new CustomEvent('pos_order_tab_changed', { 
      detail: { orderId, previousOrderId: activeOrderId } 
    }));
    
    // Update active order
    setActiveOrderId(orderId);
  }, [activeOrderId]);
  
  // Handle closing an order
  const handleCloseOrder = useCallback((orderId) => {
    // Find all orders with this ID (to handle duplicates)
    const ordersToClose = orders.filter(order => order.id === orderId);
    
    if (ordersToClose.length === 0) {
      console.warn('[AppLayout] Attempted to close non-existent order:', orderId);
      return;
    }
    
    // Check if any order has items
    const hasItems = ordersToClose.some(order => order.cart && order.cart.length > 0);
    
    // If order has items, confirm before closing
    if (hasItems) {
      console.log('[AppLayout] Order has items, confirming before close:', orderId);
      setOrderToConfirmClose(ordersToClose[0]);
      onConfirmOpen();
      return;
    }
    
    // No items, close directly
    closeOrderById(orderId);
  }, [orders]);
  
  // Close order by ID (without confirmation)
  const closeOrderById = useCallback((orderId, options = {}) => {
    const isRefundOrder = options.isRefundOrder || orderId.startsWith('REFUND-');
    
    console.log('[AppLayout] Closing order:', orderId, {
      ...options, 
      isRefundOrder,
      source: 'closeOrderById'
    });
    
    // Notify POSPage that the order is being closed
    window.dispatchEvent(new CustomEvent('pos_order_tab_closed', {
      detail: { 
        closedOrderId: orderId,
        isRefundOrder
      }
    }));
    
    // Remove all instances of the order with this ID from state
    const updatedOrders = orders.filter(order => order.id !== orderId);
    setOrders(updatedOrders);
    
    // DIRECT APPROACH: Immediately remove the order from localStorage
    try {
      console.log('[AppLayout] Starting direct localStorage cleanup for order:', orderId);
      
      // 1. Remove cart data
      const cartKey = `pos_cart_${orderId}`;
      localStorage.removeItem(cartKey);
      console.log('[AppLayout] Removed cart data for order:', orderId);
      
      // 2. Remove any refund-specific markers
      if (isRefundOrder) {
        localStorage.removeItem(`completed_refund_${orderId}`);
      }
      
      // 3. Remove from pos_orders
      // Get current orders directly from localStorage
      let savedOrders = [];
      try {
        savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        console.log('[AppLayout] Current orders in localStorage:', savedOrders.length, 
                    'IDs:', savedOrders.map(o => o.id).join(', '));
                    
        // Check if the order exists in localStorage before trying to filter
        const orderExists = savedOrders.some(order => order.id === orderId);
        if (orderExists) {
          console.log('[AppLayout] Order', orderId, 'found in localStorage, removing it');
          
          // Filter the order out
          const filteredOrders = savedOrders.filter(order => order.id !== orderId);
          
          // Save filtered orders back to localStorage
          localStorage.setItem('pos_orders', JSON.stringify(filteredOrders));
          
          console.log('[AppLayout] Removed order from pos_orders. Before:', savedOrders.length, 
                      'After:', filteredOrders.length);
          
          // Verify removal
          const verificationOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
          const stillExists = verificationOrders.some(order => order.id === orderId);
          
          if (stillExists) {
            console.error('[AppLayout] CRITICAL: Order still exists in localStorage after removal attempt!');
            
            // More aggressive approach - get all orders again and filter once more
            const lastAttempt = verificationOrders.filter(order => order.id !== orderId);
            localStorage.setItem('pos_orders', JSON.stringify(lastAttempt));
            
            console.log('[AppLayout] Forced second removal attempt for order:', orderId);
          } else {
            console.log('[AppLayout] Order successfully removed from localStorage');
          }
        } else {
          console.log('[AppLayout] Order', orderId, 'not found in localStorage, nothing to remove');
        }
      } catch (ordersError) {
        console.error('[AppLayout] Error removing order from pos_orders:', ordersError);
      }
    } catch (error) {
      console.error('[AppLayout] Error during localStorage cleanup:', error);
    }
    
    // If closing the active order, switch to another or create new
    if (orderId === activeOrderId) {
      if (updatedOrders.length > 0) {
        const newActiveId = updatedOrders[0].id;
        console.log('[AppLayout] Switching active to:', newActiveId);
        
        // Notify POSPage about the change
        window.dispatchEvent(new CustomEvent('pos_order_tab_changed', { 
          detail: { orderId: newActiveId, previousOrderId: orderId } 
        }));
        
        setActiveOrderId(newActiveId);
      } else if (!options.isFromOrderCompletion) {
        // Only create a new order if this wasn't triggered by handleOrderCompleted
        // which handles its own new order creation
        console.log('[AppLayout] No orders left, creating new after a short delay (from closeOrderById)');
        
        // Add a delay before creating a new order to avoid race conditions
        setTimeout(() => {
          console.log('[AppLayout] Now creating the new order after close');
        createNewOrder();
        }, 300);
      }
    }
  }, [orders, activeOrderId, createNewOrder]);
  
  // State for confirmation dialog
  const [orderToConfirmClose, setOrderToConfirmClose] = useState(null);
  const { isOpen: isConfirmOpen, onOpen: onConfirmOpen, onClose: onConfirmClose } = useDisclosure();
  const cancelRef = React.useRef();
  
  // Handle confirmed order closing
  const handleForceCloseOrder = useCallback(() => {
    if (orderToConfirmClose) {
      closeOrderById(orderToConfirmClose.id);
      
      toast({
        title: 'Order Closed',
        description: `Order #${orderToConfirmClose.id} has been closed.`,
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      
      setOrderToConfirmClose(null);
      onConfirmClose();
    }
  }, [orderToConfirmClose, closeOrderById, toast, onConfirmClose]);
  
  const menuItems = [
    { name: 'Products', icon: FiBox, path: '/products' },
    { name: 'POS', icon: FiShoppingCart, path: '/pos' },
    { 
      name: 'Orders', 
      icon: FiFileText, 
      path: '/orders', 
      description: 'Manage all sales orders',
      onClick: (navigate) => {
        if (location.pathname === '/pos') {
          // If on POS page, open as modal
          navigate('/pos?showOrdersModal=true');
        } else {
          // Otherwise navigate to orders page
          navigate('/orders');
        }
      }
    },
    {
      name: 'Customers (Odoo 18)',
      icon: FiUsers,
      path: '#customers',
      description: 'Manage customers',
      onClick: (navigate) => {
        // Dispatch event to open customer management dialog
        window.dispatchEvent(new CustomEvent('pos_open_customer_management'));
      }
    },
    { name: 'Settings', icon: FiSettings, path: '/settings', disabled: true },
    { name: 'POS Data Test', icon: FiCpu, path: '/pos-data-test' }
  ];
  
  const handleNavigate = (path, item) => {
    if (item && item.onClick) {
      // Pass only navigate since we no longer have onClose
      item.onClick(navigate);
    } else {
      navigate(path);
    }
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // ========== LISTEN FOR ORDER COMPLETED EVENT ==========
  // Listen for order completed events from POSPage
  useEffect(() => {
    const handleOrderCompleted = (event) => {
      const { completedOrderId, serverOrderId, forceRemove, isRefundOrder } = event.detail;
      
      if (!completedOrderId) return;
      
      console.log('[AppLayout] Order completed event received. Client ID:', completedOrderId, 
                  'Server ID:', serverOrderId, 
                  'Type:', isRefundOrder ? 'REFUND' : 'NORMAL',
                  forceRemove ? '(with forceRemove)' : '');
      
      // Close the completed order
      if (forceRemove) {
        // Flag to track if we need to create a new order
        let needNewOrder = orders.length <= 1;
        
        // For refund orders, we need to be extra aggressive
        if (isRefundOrder) {
          console.log('[AppLayout] Processing refund order completion - performing immediate localStorage cleanup');
          
          try {
            // 1. Try to get orders directly from localStorage
            const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
            
            // 2. Check if the order exists
            const orderExists = savedOrders.some(order => order.id === completedOrderId);
            if (orderExists) {
              console.log('[AppLayout] Refund order found in localStorage, forcing immediate removal');
              
              // 3. Filter it out
              const filteredOrders = savedOrders.filter(order => order.id !== completedOrderId);
              
              // 4. Save back to localStorage
              localStorage.setItem('pos_orders', JSON.stringify(filteredOrders));
              
              console.log('[AppLayout] Refund order removed from localStorage. Before:', savedOrders.length, 'After:', filteredOrders.length);
            }
            
            // 5. Also clean up the cart data
            const cartKey = `pos_cart_${completedOrderId}`;
            localStorage.removeItem(cartKey);
          } catch (error) {
            console.error('[AppLayout] Error cleaning up refund order in localStorage:', error);
          }
        }
        
        // Use client order ID to close the tab, since that's what we use for tabs
        // Pass isFromOrderCompletion: true to prevent closeOrderById from creating a new order
        closeOrderById(completedOrderId, { isFromOrderCompletion: true, isRefundOrder });
        
        // Double-check if the order was successfully removed from localStorage
        setTimeout(() => {
          try {
            const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
            const orderStillExists = savedOrders.some(order => order.id === completedOrderId);
            
            if (orderStillExists) {
              console.error('[AppLayout] Order still exists in localStorage after completion! Forcing removal again.');
              
              // Directly filter it out and save
              const cleanedOrders = savedOrders.filter(order => order.id !== completedOrderId);
              localStorage.setItem('pos_orders', JSON.stringify(cleanedOrders));
              
              console.log('[AppLayout] Forced cleanup completed. Before:', savedOrders.length, 'After:', cleanedOrders.length);
            } else {
              console.log('[AppLayout] Order successfully removed from localStorage after completion.');
            }
          } catch (error) {
            console.error('[AppLayout] Error checking for lingering order:', error);
          }
        }, 300);
        
        // Only create a new order if no orders exist after closing the completed one
        // and if we determined earlier that we need to create one (to prevent double creation)
        if (needNewOrder && orders.filter(o => o.id !== completedOrderId).length === 0) {
          // Small delay to prevent race conditions
          setTimeout(() => {
            console.log('[AppLayout] Creating a single new order after payment completion');
            createNewOrder();
          }, 400);
        }
      } else {
        // Just mark as completed without removing
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === completedOrderId 
              ? { 
                  ...order, 
                  status: 'completed', 
                  completedAt: new Date().toISOString(),
                  serverOrderId: serverOrderId // Store server order ID for reference
                }
              : order
          )
        );
      }
    };
    
    window.addEventListener('pos_order_completed', handleOrderCompleted);
    return () => {
      window.removeEventListener('pos_order_completed', handleOrderCompleted);
    };
  }, [orders, closeOrderById, createNewOrder]);

  // ========== LISTEN FOR NEW ORDER CREATED EVENT ==========
  // Listen for order created events from POSPage, especially for refund orders
  useEffect(() => {
    const handleOrderCreated = (event) => {
      const { order, shouldActivate } = event.detail;
      
      if (!order || !order.id) {
        console.warn('[AppLayout] Received order created event with invalid order data');
        return;
      }
      
      console.log('[AppLayout] Order created event received:', order);
      
      // Check if this order already exists
      const existingOrderIndex = orders.findIndex(o => o.id === order.id);
      
      if (existingOrderIndex >= 0) {
        console.log('[AppLayout] Order already exists, updating:', order.id);
        
        // Update the existing order
        setOrders(prevOrders => 
          prevOrders.map(o => o.id === order.id ? order : o)
        );
        
        // Activate it if requested
        if (shouldActivate) {
          setActiveOrderId(order.id);
        }
      } else {
        console.log('[AppLayout] Adding new order to tabs:', order.id);
        
        // Add the new order
        setOrders(prevOrders => [...prevOrders, order]);
        
        // Activate it if requested
        if (shouldActivate) {
          setActiveOrderId(order.id);
        }
      }
    };
    
    window.addEventListener('pos_order_created', handleOrderCreated);
    return () => {
      window.removeEventListener('pos_order_created', handleOrderCreated);
    };
  }, [orders, setActiveOrderId]);

  // ========== LISTEN FOR REFUND ORDER CREATED EVENT ==========
  // این یک رویداد ویژه است که در صورت نیاز به بازگشت سفارش (ریفاند) ارسال می‌شود
  useEffect(() => {
    const handleRefundOrderCreated = (event) => {
      const { id, title, orderId, isRefund } = event.detail;
      
      if (!id || !orderId) {
        console.warn('[AppLayout] Received refund order event with invalid data');
        return;
      }
      
      console.log('[AppLayout] Refund order event received:', { id, title, orderId, isRefund });
      
      // First, remove any existing orders with this ID
      const existingOrders = orders.filter(order => order.id === id);
      if (existingOrders.length > 0) {
        console.log('[AppLayout] Removing existing refund orders with ID:', id);
        setOrders(prevOrders => prevOrders.filter(order => order.id !== id));
      }
      
      // Short delay to ensure state is updated before adding the new order
      setTimeout(() => {
        // با توجه به اینکه این سفارش خاصی است، یک تب جدید ایجاد می‌کنیم
        const newOrder = {
          id,
          name: title || `بازگشت سفارش ${orderId}`,
          time: new Date().toISOString(),
          status: 'active',
          isRefund: true,
          originalOrderId: orderId
        };
        
        // اضافه کردن به لیست سفارش‌ها
        setOrders(prevOrders => [...prevOrders, newOrder]);
        
        // فعال کردن این سفارش
        setActiveOrderId(id);
        
        console.log('[AppLayout] Added refund order to tabs:', id);
      }, 10);
    };
    
    window.addEventListener('pos_refund_order_created', handleRefundOrderCreated);
    return () => {
      window.removeEventListener('pos_refund_order_created', handleRefundOrderCreated);
    };
  }, [orders, setOrders, setActiveOrderId]);

  // Add debug helper to window object for clearing orders
  useEffect(() => {
    window.clearPOSOrders = () => {
      try {
        // Get existing orders
        const existingOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        console.log('[Debug] Found ' + existingOrders.length + ' orders in localStorage before clearing');
        console.log('[Debug] Order IDs:', existingOrders.map(o => o.id).join(', '));
        
        // Remove each cart individually
        existingOrders.forEach(order => {
          const cartKey = `pos_cart_${order.id}`;
          localStorage.removeItem(cartKey);
          console.log('[Debug] Removed cart for order:', order.id);
        });
        
        // Clear pos_orders array
        localStorage.removeItem('pos_orders');
        console.log('[Debug] Cleared pos_orders localStorage array');
        
        // Check if cleared successfully
        const afterClear = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        console.log('[Debug] Orders after clearing:', afterClear.length);
        
        return `Successfully cleared ${existingOrders.length} orders from localStorage`;
      } catch (error) {
        console.error('[Debug] Error clearing orders:', error);
        return 'Error clearing orders: ' + error.message;
      }
    };
    
    // Add function to display current orders
    window.showPOSOrders = () => {
      try {
        const existingOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        console.log('[Debug] Current orders in localStorage:', existingOrders.length);
        
        if (existingOrders.length > 0) {
          existingOrders.forEach((order, index) => {
            console.log(`[Debug] Order ${index + 1}:`, {
              id: order.id,
              status: order.status,
              createdAt: order.createdAt,
              cartSize: order.cart?.length || 0,
              isRefund: order.isRefund
            });
          });
          
          // Also check for cart data
          existingOrders.forEach(order => {
            const cartKey = `pos_cart_${order.id}`;
            const cartData = localStorage.getItem(cartKey);
            if (cartData) {
              try {
                const cartItems = JSON.parse(cartData);
                console.log(`[Debug] Cart for order ${order.id}:`, 
                            cartItems?.length || 0, 'items');
              } catch (e) {
                console.log(`[Debug] Error parsing cart for order ${order.id}:`, e.message);
              }
            } else {
              console.log(`[Debug] No cart data found for order ${order.id}`);
            }
          });
        }
        
        return `Found ${existingOrders.length} orders in localStorage`;
      } catch (error) {
        console.error('[Debug] Error showing orders:', error);
        return 'Error showing orders: ' + error.message;
      }
    };
    
    // Add function to fix orphaned orders in localStorage
    window.fixPOSOrdersStorage = () => {
      try {
        console.log('[Debug] Starting deep cleanup of localStorage orders...');
        
        // Step 1: Check for problems in orders array
        let savedOrders = [];
        try {
          savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
          
          // Check for duplicates by ID
          const uniqueOrders = [];
          const seen = new Set();
          
          savedOrders.forEach(order => {
            if (!seen.has(order.id)) {
              seen.add(order.id);
              uniqueOrders.push(order);
            } else {
              console.log('[Debug] Found duplicate order:', order.id);
            }
          });
          
          if (uniqueOrders.length !== savedOrders.length) {
            console.log('[Debug] Removed', savedOrders.length - uniqueOrders.length, 'duplicate orders');
            localStorage.setItem('pos_orders', JSON.stringify(uniqueOrders));
            savedOrders = uniqueOrders;
          }
        } catch (error) {
          console.error('[Debug] Error parsing orders:', error);
          // If parsing fails, reset the orders
          localStorage.setItem('pos_orders', '[]');
          savedOrders = [];
        }
        
        // Step 2: Scan localStorage for orphaned cart data
        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          allKeys.push(localStorage.key(i));
        }
        
        // Find all cart keys
        const cartKeys = allKeys.filter(key => key.startsWith('pos_cart_'));
        console.log('[Debug] Found', cartKeys.length, 'cart entries in localStorage');
        
        // Get order IDs from cart keys
        const cartOrderIds = cartKeys.map(key => key.replace('pos_cart_', ''));
        
        // Find orphaned cart entries (no matching order)
        const savedOrderIds = savedOrders.map(order => order.id);
        const orphanedCartIds = cartOrderIds.filter(id => !savedOrderIds.includes(id));
        
        console.log('[Debug] Found', orphanedCartIds.length, 'orphaned cart entries');
        
        // Remove orphaned cart entries
        orphanedCartIds.forEach(id => {
          const cartKey = `pos_cart_${id}`;
          localStorage.removeItem(cartKey);
          console.log('[Debug] Removed orphaned cart:', id);
        });
        
        // Step 3: Also check for other order-related data
        const refundKeys = allKeys.filter(key => key.startsWith('completed_refund_'));
        if (refundKeys.length > 0) {
          console.log('[Debug] Found', refundKeys.length, 'leftover refund markers');
          refundKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log('[Debug] Removed refund marker:', key);
          });
        }
        
        // Return summary
        return `Fixed localStorage orders: Removed ${savedOrders.length - uniqueOrders.length} duplicates, ${orphanedCartIds.length} orphaned carts, and ${refundKeys.length} refund markers`;
      } catch (error) {
        console.error('[Debug] Error fixing orders storage:', error);
        return 'Error fixing orders: ' + error.message;
      }
    };
    
    return () => {
      // Clean up
      delete window.clearPOSOrders;
      delete window.showPOSOrders;
      delete window.fixPOSOrdersStorage;
    };
  }, []);

  // Product Management Modal state
  const { isOpen: isProductManagementOpen, onOpen: onProductManagementOpen, onClose: onProductManagementClose } = useDisclosure();
  
  // Category Management Modal state
  const { isOpen: isCategoryManagementOpen, onOpen: onCategoryManagementOpen, onClose: onCategoryManagementClose } = useDisclosure();

  return (
    <Flex h="100vh" flexDirection="column">
      {/* Top header */}
      <Flex
        as="header"
        align="center"
        justify="space-between"
        py="1"
        px="4"
        bg="white"
        borderBottomWidth="1px"
        borderColor="gray.200"
        h="10"
      >
        <HStack spacing="2" flex="1" overflowX="auto" css={{
          '&::-webkit-scrollbar': { height: '6px' },
          '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '3px' }
        }}>
          {/* Show menu button - only uses POS sidebar now */}
          <IconButton
            display="flex"
            onClick={() => setPOSSidebarOpen(!posSidebarOpen)}
            variant="ghost"
            aria-label="toggle menu"
            icon={<FiMenu />}
            size="md"
            colorScheme="primary"
            minW="10"
            flexShrink={0}
          />
          
          {/* Remove horizontal navigation as we're using the sidebar again */}
          
          {/* Open orders/invoices tabs - only show on POS page */}
          {isPOSPage && orders.map(order => (
            <OrderTab 
              key={order.id}
              id={order.id}
              time={order.time}
              name={order.name}
              isActive={order.id === activeOrderId}
              onClick={() => handleOrderClick(order.id)}
              onClose={handleCloseOrder}
            />
          ))}
          
          {/* Only show new order button on POS page */}
          {isPOSPage && (
            <IconButton
              icon={<FiPlus />}
              size="sm"
              variant="ghost"
              colorScheme="green"
              aria-label="New order"
              onClick={createNewOrder}
              flexShrink={0}
            />
          )}
        </HStack>
        
        <HStack spacing="4" flexShrink={0}>
          {/* Search input - only show on POS page */}
          {isPOSPage && (
            <InputGroup size="sm" width="200px" mr="2">
              <InputLeftElement pointerEvents="none">
                <Icon as={FiSearch} color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search products..."
                value={headerSearchText}
                onChange={(e) => setHeaderSearchText(e.target.value)}
                borderRadius="md"
                bg="gray.100"
              />
            </InputGroup>
          )}
          
          {/* Pending Orders Badge */}
          <PendingOrdersBadge />
          
          {/* Connection status indicator */}
          <ConnectionStatus size="sm" showText={false} />
          
          {/* User info and logout button */}
          <HStack>
            <Badge colorScheme="green" p="1" borderRadius="md">
              <Text fontSize="xs">Cashier</Text>
              <Text fontSize="sm" fontWeight="bold">{currentUser?.name || 'Gabriel'}</Text>
            </Badge>
            
            <Menu>
              <MenuButton as={Avatar} size="sm" name={currentUser?.name || 'Gabriel'} src={currentUser?.image_128} cursor="pointer" />
              <MenuList>
                <MenuItem icon={<FiCpu />} onClick={() => navigate('/pos?openSessionManager=true')}>
                  مدیریت سشن
                </MenuItem>
                <MenuItem icon={<FiLogOut />} onClick={handleLogout}>
                  Logout
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </HStack>
      </Flex>

      <Flex flex="1" overflow="hidden">
        {/* Main content */}
        <Box flex="1" p="2" overflow="hidden" bg="gray.200">
          <Outlet context={{ 
            posSidebarOpen, 
            setPOSSidebarOpen,
            headerSearchText,
            setHeaderSearchText,
            // Pass order management context to children
            activeOrderId,
            createNewOrder
          }} />
        </Box>
      </Flex>
      
      {/* POS Sidebar - only visible on POS page */}
      {isPOSPage && posSidebarOpen && (
        <Box
          position="fixed"
          top="10"
          left="0"
          width="250px"
          height="calc(100vh - 10px)"
          bg="white"
          boxShadow="lg"
          zIndex="5"
          p={4}
          transition="0.3s"
          overflowY="auto"
        >
          <VStack align="stretch" spacing={4}>
            <Heading size="md">POS Menu</Heading>
            <Divider />
            <Button
              w="full"
              colorScheme={location.pathname === '/pos' ? "primary" : "gray"}
              variant="ghost"
              justifyContent="flex-start"
              leftIcon={<Icon as={FiShoppingCart} />}
              onClick={() => navigate('/pos')}
              mb={2}
            >
              POS
            </Button>
            <Button
              w="full"
              colorScheme={location.pathname === '/orders' ? "primary" : "gray"}
              variant="ghost"
              justifyContent="flex-start"
              leftIcon={<Icon as={FiFileText} />}
              onClick={() => {
                if (isPOSPage) {
                  // If on POS page, open as modal similar to session manager
                  navigate('/pos?showOrdersModal=true');
                } else {
                  // Otherwise navigate to orders page
                  navigate('/orders');
                }
              }}
              mb={2}
            >
              مدیریت سفارشات
            </Button>
            <Button
              w="full"
              colorScheme="blue"
              variant="ghost"
              justifyContent="flex-start"
              leftIcon={<Icon as={FiPackage} />}
              onClick={() => {
                onProductManagementOpen();
                // Close sidebar after clicking
                setPOSSidebarOpen(false);
              }}
              mb={2}
            >
              مدیریت محصولات
            </Button>
            <Button
              w="full"
              colorScheme="teal"
              variant="ghost"
              justifyContent="flex-start"
              leftIcon={<Icon as={FiTag} />}
              onClick={() => {
                onCategoryManagementOpen();
                // Close sidebar after clicking
                setPOSSidebarOpen(false);
              }}
              mb={2}
            >
              مدیریت دسته‌بندی‌ها
            </Button>
            <Button
              w="full"
              colorScheme="gray"
              variant="ghost"
              justifyContent="flex-start"
              leftIcon={<Icon as={FiUsers} />}
              onClick={() => {
                // Dispatch event to open customer management dialog
                window.dispatchEvent(new CustomEvent('pos_open_customer_management'));
                // Close sidebar after clicking
                setPOSSidebarOpen(false);
              }}
              mb={2}
            >
              مدیریت مشتریان
            </Button>
            <Divider />
            <Button 
              leftIcon={<FiCpu />} 
              variant="ghost" 
              justifyContent="flex-start"
              onClick={() => navigate('/pos?openSessionManager=true')}
            >
              مدیریت صندوق
            </Button>
            <Button leftIcon={<FiLogOut />} variant="ghost" justifyContent="flex-start" colorScheme="red" onClick={handleLogout}>
              خروج
            </Button>
          </VStack>
        </Box>
      )}

      {/* Backdrop for POS sidebar - closes sidebar when clicked */}
      {isPOSPage && posSidebarOpen && (
        <Box
          position="fixed"
          top="10"
          left="0"
          width="100vw"
          height="calc(100vh - 10px)"
          bg="blackAlpha.300"
          zIndex="4"
          onClick={() => setPOSSidebarOpen(false)}
        />
      )}
      
      {/* Confirmation Dialog for closing order with items */}
      <AlertDialog
        isOpen={isConfirmOpen}
        leastDestructiveRef={cancelRef}
        onClose={onConfirmClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Close Order with Items
            </AlertDialogHeader>

            <AlertDialogBody>
              This order contains {orderToConfirmClose?.cart?.length || 0} items. 
              Are you sure you want to close it? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onConfirmClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleForceCloseOrder} ml={3}>
                Close Order
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Product Management Modal */}
      <ProductManagementModal isOpen={isProductManagementOpen} onClose={onProductManagementClose} />
      
      {/* Category Management Modal */}
      <CategoryManagementModal isOpen={isCategoryManagementOpen} onClose={onCategoryManagementClose} />
    </Flex>
  );
};

export default AppLayout; 