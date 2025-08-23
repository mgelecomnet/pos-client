import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Box,
  Grid,
  GridItem,
  Flex,
  Text,
  Button,
  Input,
  SimpleGrid,
  Badge,
  HStack,
  VStack,
  Tabs,
  TabList,
  Tab,
  IconButton,
  Spinner,
  Heading,
  Divider,
  useToast,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  InputGroup,
  InputLeftElement,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { 
  FiSearch, 
  FiUser, 
  FiShoppingBag, 
  FiDollarSign, 
  FiX, 
  FiLogOut, 
  FiSettings, 
  FiChevronDown, 
  FiList, 
  FiRefreshCw,
  FiFileText,
  FiUsers,
  FiAlertCircle
} from 'react-icons/fi';
import { authService, productService, categoryService, orderService } from '../api/odoo';
import sessionManager from '../api/sessionManager';
import CategoryManagementModal from '../components/CategoryManagementModal';
import CustomerManagementModal from '../components/CustomerManagementModal';
import CustomerSelectorModal from '../components/CustomerSelectorModal';
import ProductManagementModal from '../components/ProductManagementModal';
import ProductItem from '../components/ProductItem';
import CartItem from '../components/CartItem';
import PaymentScreen from '../components/PaymentScreen';
import OrderComplete from '../components/OrderComplete/index';
import { loadPOSData, getLocalPOSData, inspectDatabase } from '../api/odooApi';
import OrderType from '../components/OrderType';
import { refundLog, refundLogError, logCartChange } from '../utils/logger';


// Main POS page component
const POSPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { posSidebarOpen, setPOSSidebarOpen, headerSearchText } = useOutletContext();
  
  // State for products data
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [orderId, setOrderId] = useState(null);
  const [orderType, setOrderType] = useState('dine_in');
  
  // Selected customer state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activePOSSession, setActivePOSSession] = useState(null);
  const [posConfigs, setPosConfigs] = useState([]);

  const [selectedConfig, setSelectedConfig] = useState(null);
  const toast = useToast();
  const { isOpen: isSessionModalOpen, onOpen: onSessionModalOpen, onClose: onSessionModalClose } = useDisclosure();
  const { isOpen: isCategoriesModalOpen, onOpen: onCategoriesModalOpen, onClose: onCategoriesModalClose } = useDisclosure();
  const { isOpen: isCustomersModalOpen, onOpen: onCustomersModalOpen, onClose: onCustomersModalClose } = useDisclosure();
  const { isOpen: isCustomerSelectorOpen, onOpen: onCustomerSelectorOpen, onClose: onCustomerSelectorClose } = useDisclosure();
  const { isOpen: isProductsModalOpen, onOpen: onProductsModalOpen, onClose: onProductsModalClose } = useDisclosure();
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionActionInProgress, setSessionActionInProgress] = useState(false);
  const [categoryColors, setCategoryColors] = useState({});

 

  
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);


  
  const cancelRef = React.useRef();
  // برای جلوگیری از فراخوانی مکرر fetchActiveSessions
  const loadedSessions = useRef(false);

  // Add a ref to track cart
  const cartRef = useRef([]);
  
  // Add a ref for the tab manager
  const tabManagerRef = useRef(null);
  
  // Update ref whenever cart changes
  useEffect(() => {
    cartRef.current = cart;
    
    // Log cart changes using the refund logger
    if (cart && cart.length > 0) {
      const isRefundCart = cart.some(item => item.isRefund || item.quantity < 0);
      if (isRefundCart) {
        try {
          logCartChange('updated', cart, 'cartRef effect');
        } catch (err) {
          console.log('Cart updated:', cart.length, 'items');
        }
      }
    }
  }, [cart]);
  
  // Check if posTabManager is available
  useEffect(() => {
    // Check if posTabManager is available in window object
    if (window.posTabManager) {
      console.log('✅ posTabManager found in window object');
      tabManagerRef.current = window.posTabManager;
    } else {
      console.log('⚠️ posTabManager not found in window object');
      
      // Set up a listener for when it might become available
      const checkTabManager = () => {
        if (window.posTabManager && !tabManagerRef.current) {
          console.log('✅ posTabManager has become available');
          tabManagerRef.current = window.posTabManager;
        }
      };
      
      // Check periodically
      const intervalId = setInterval(checkTabManager, 1000);
      
      // Clean up
      return () => clearInterval(intervalId);
    }
  }, []);

  // Helper function to save cart to localStorage
  const saveCartToLocalStorage = useCallback((orderIdToSave, cartData) => {
    if (!orderIdToSave) {
      console.warn('[POSPage] Cannot save cart: No order ID provided');
      return;
    }
    
    try {
      // Check if this is a refund order based on ID first (most reliable)
      const isRefundOrderById = orderIdToSave.startsWith('REFUND-');
      
      // Also check cart contents for refund items as fallback
      const hasRefundItems = Array.isArray(cartData) && cartData.some(item => item.isRefund || item.quantity < 0);
      
      // If either condition is true, treat as refund cart
      const isRefundCart = isRefundOrderById || hasRefundItems;
      
      if (isRefundCart) {
        refundLog('Attempting to save refund cart to localStorage', { 
          orderId: orderIdToSave, 
          cartSize: cartData?.length || 0,
          isRefundOrderById,
          hasRefundItems
        });
        
        // Special handling for refund carts
        // Make sure all refund items have the isRefund flag and negative quantities
        const processedCart = cartData.map(item => {
          // For refund orders, ALWAYS mark all items as refunds
          if (isRefundOrderById || item.isRefund || item.quantity < 0) {
            return {
              ...item,
              isRefund: true,
              quantity: item.quantity < 0 ? item.quantity : -Math.abs(item.quantity)
            };
          }
          return item;
        });
        
        // Now save to localStorage with explicit string conversion
        const cartKey = `pos_cart_${orderIdToSave}`;
        const cartJson = JSON.stringify(processedCart || []);
        localStorage.setItem(cartKey, cartJson);
        
        // Verify the save operation worked
        const savedData = localStorage.getItem(cartKey);
        if (!savedData) {
          refundLog('Warning: Failed to save refund cart - verification check failed', null, 'WARNING');
        } else {
          try {
            const parsedSavedCart = JSON.parse(savedData);
            refundLog('Successfully saved and verified refund cart', { 
              orderId: orderIdToSave, 
              savedItems: parsedSavedCart.length,
              firstItem: parsedSavedCart[0] ? {
                id: parsedSavedCart[0].id,
                name: parsedSavedCart[0].name,
                quantity: parsedSavedCart[0].quantity,
                isRefund: parsedSavedCart[0].isRefund
              } : null
            });
          } catch (parseError) {
            refundLog('Warning: Saved refund cart could not be parsed', { error: parseError.message }, 'WARNING');
          }
        }
        
        console.log('[POSPage] Saved refund cart to localStorage for order:', orderIdToSave, 'Items:', processedCart?.length || 0);
      } else {
        // Regular non-refund cart saving logic
        const cartKey = `pos_cart_${orderIdToSave}`;
        localStorage.setItem(cartKey, JSON.stringify(cartData || []));
        console.log('[POSPage] Saved cart to localStorage for order:', orderIdToSave, 'Items:', cartData?.length || 0);
      }
      
      // Also update the cart in the pos_orders array
      try {
        const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        let updated = false;
        
        const updatedOrders = savedOrders.map(order => {
          if (order.id === orderIdToSave) {
            updated = true;
            return {
              ...order,
              cart: cartData || []
            };
          }
          return order;
        });
        
        if (updated) {
          localStorage.setItem('pos_orders', JSON.stringify(updatedOrders));
          if (isRefundCart) {
            refundLog('Updated refund order in pos_orders', { orderId: orderIdToSave });
          }
        }
      } catch (ordersError) {
        console.error('[POSPage] Error updating orders in localStorage:', ordersError);
        if (isRefundCart) {
          refundLogError('Error updating refund order in pos_orders', ordersError);
        }
      }
    } catch (error) {
      console.error('[POSPage] Error saving cart to localStorage:', error);
      if (Array.isArray(cartData) && cartData.some(item => item.isRefund || item.quantity < 0)) {
        refundLogError('Error saving refund cart to localStorage', error);
      }
    }
  }, []);

  // Helper function to load cart from localStorage
  const loadCartFromLocalStorage = useCallback((orderIdToLoad) => {
    if (!orderIdToLoad) {
      console.warn('[POSPage] Cannot load cart: No order ID provided');
      return [];
    }
    
    try {
      // Check if this might be a refund order based on the ID
      const isRefundOrder = orderIdToLoad && orderIdToLoad.startsWith('REFUND-');
      
      if (isRefundOrder) {
        refundLog('Attempting to load refund cart from localStorage', { orderId: orderIdToLoad });
      }
      
      const cartKey = `pos_cart_${orderIdToLoad}`;
      const savedCartData = localStorage.getItem(cartKey);
      
      if (!savedCartData) {
        console.log('[POSPage] No cart data found for order:', orderIdToLoad);
        
        if (isRefundOrder) {
          refundLog('No refund cart data found in localStorage', { orderId: orderIdToLoad }, 'WARNING');
          
          // For refund orders, as a fallback, try to retrieve cart from the pos_orders array
          try {
            const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
            const order = savedOrders.find(o => o.id === orderIdToLoad);
            
            if (order && order.cart && order.cart.length > 0) {
              refundLog('Found refund cart in pos_orders as fallback', { 
                orderId: orderIdToLoad,
                cartSize: order.cart.length
              });
              
              // Save this cart to the proper cartKey for future use
              localStorage.setItem(cartKey, JSON.stringify(order.cart));
              
              return order.cart;
            } else {
              refundLog('No refund cart found in pos_orders either', { orderId: orderIdToLoad }, 'ERROR');
            }
          } catch (e) {
            refundLogError('Error trying to find refund cart in pos_orders', e);
          }
        }
        
        return [];
      }
      
      const parsedCart = JSON.parse(savedCartData);
      
      if (isRefundOrder) {
        // Verify that the loaded cart contains refund items
        const hasRefundItems = Array.isArray(parsedCart) && parsedCart.some(item => item.isRefund || item.quantity < 0);
        
        if (!hasRefundItems && parsedCart.length > 0) {
          refundLog('Warning: Loaded refund cart but it contains no refund items', {
            orderId: orderIdToLoad,
            cartSize: parsedCart.length,
            firstItem: parsedCart[0]
          }, 'WARNING');
          
          // Fix the cart by marking all items as refund items with negative quantities
          const fixedCart = parsedCart.map(item => ({
            ...item,
            isRefund: true,
            quantity: item.quantity < 0 ? item.quantity : -Math.abs(item.quantity)
          }));
          
          refundLog('Fixed refund cart by marking all items as refund items', {
            orderId: orderIdToLoad,
            before: parsedCart,
            after: fixedCart
          });
          
          // Save the fixed cart back to localStorage
          localStorage.setItem(cartKey, JSON.stringify(fixedCart));
          
          console.log('[POSPage] Fixed refund cart and saved it back to localStorage');
          return fixedCart;
        } else if (hasRefundItems) {
          refundLog('Successfully loaded refund cart', {
            orderId: orderIdToLoad,
            cartSize: parsedCart.length,
            refundItems: parsedCart.filter(item => item.isRefund || item.quantity < 0).length
          });
        }
      }
      
      console.log('[POSPage] Loaded cart from localStorage for order:', orderIdToLoad, 'Items:', parsedCart.length);
      return Array.isArray(parsedCart) ? parsedCart : [];
    } catch (error) {
      console.error('[POSPage] Error loading cart from localStorage:', error);
      
      if (orderIdToLoad && orderIdToLoad.startsWith('REFUND-')) {
        refundLogError('Error loading refund cart from localStorage', error);
      }
      
      return [];
    }
  }, []);
  
  // Load active order from localStorage on mount
  useEffect(() => {
    try {
      const savedActiveId = localStorage.getItem('pos_active_order_id');
      const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
      
      if (savedActiveId && savedOrders.length > 0) {
        const activeOrder = savedOrders.find(order => order.id === savedActiveId);
        if (activeOrder) {
          setOrderId(activeOrder.id);
          setCart(activeOrder.cart || []);
        }
      }
    } catch (error) {
      console.error('Error loading active order:', error);
    }
  }, []);
  
  // Watch for localStorage changes to sync active order across tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'pos_active_order') {
        try {
          // Save current cart before switching to new order
          if (activePOSSession?.id) {
            saveCartToLocalStorage(activePOSSession.id, cart);
          }
          
          const newActiveOrder = JSON.parse(e.newValue || 'null');
          
          if (newActiveOrder && newActiveOrder.id !== activePOSSession?.id) {
            setActivePOSSession(newActiveOrder);
            
            // Load the cart for the new active order
            const newCart = loadCartFromLocalStorage(newActiveOrder.id);
            setCart(newCart);
            
            console.log('Active order changed from localStorage:', newActiveOrder);
          }
        } catch (error) {
          console.error('Error handling storage change:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activePOSSession, cart, saveCartToLocalStorage, loadCartFromLocalStorage]);
  
  // Helper function to save the current cart

  // Add a ref to track orders that are being closed
  const closingOrdersRef = useRef(new Set());
  
  // Listen for order tab closing to ensure localStorage is cleaned up and track closed orders
  useEffect(() => {
    const handleOrderTabClosed = (e) => {
      try {
        const { closedOrderId } = e.detail;
        
        if (!closedOrderId) return;
        
        console.log('[POSPage] Order tab closed event received for order:', closedOrderId);
        
        // Mark this order as being closed to prevent saving its cart later
        closingOrdersRef.current.add(closedOrderId);
        console.log('[POSPage] Marked order as closing:', closedOrderId);
        
        // Check if the order still exists in localStorage and remove it if it does
        const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        const orderExists = savedOrders.some(order => order.id === closedOrderId);
        
        if (orderExists) {
          console.log('[POSPage] Found closed order still in localStorage, forcing removal');
          
          // Remove from pos_orders array
          const updatedOrders = savedOrders.filter(order => order.id !== closedOrderId);
          localStorage.setItem('pos_orders', JSON.stringify(updatedOrders));
          
          // Also remove cart data
          const cartKey = `pos_cart_${closedOrderId}`;
          localStorage.removeItem(cartKey);
          
          console.log('[POSPage] Successfully removed closed order from localStorage');
        }
        
        // Schedule removal of the closing flag after a delay
        setTimeout(() => {
          if (closingOrdersRef.current.has(closedOrderId)) {
            closingOrdersRef.current.delete(closedOrderId);
            console.log('[POSPage] Cleared closing flag for order:', closedOrderId);
          }
        }, 1000);
      } catch (error) {
        console.error('[POSPage] Error handling order tab closed event:', error);
      }
    };
    
    window.addEventListener('pos_order_tab_closed', handleOrderTabClosed);
    
    return () => {
      window.removeEventListener('pos_order_tab_closed', handleOrderTabClosed);
    };
  }, []);

  // Listen for order tab change events dispatched from AppLayout
  useEffect(() => {
    const handleOrderChange = (e) => {
      try {
        const { orderId: newOrderId, previousOrderId } = e.detail;
        console.log('[POSPage] Order tab changed event received:', newOrderId, 'from', previousOrderId);
        
        // Check if this is a refund order change
        const isRefundOrder = newOrderId?.startsWith('REFUND-');
        if (isRefundOrder) {
          refundLog('Order tab changed event for refund order', {
            newOrderId,
            previousOrderId,
            isRefundOrder
          });
        }
        
        // Save the current cart when changing orders, but only if the previous order is NOT being closed
        if (previousOrderId && !closingOrdersRef.current.has(previousOrderId)) {
          console.log('[POSPage] Saving current cart for previous order:', previousOrderId, 'Items:', cart.length);
          
          // Create a copy of the cart to avoid reference issues
          const cartToSave = [...cart];
          
          // Log refund cart save on tab change
          if (cartToSave.some(item => item.isRefund || item.quantity < 0)) {
            refundLog('Saving refund cart for previous order on tab change', {
              previousOrderId,
              itemCount: cartToSave.length,
              items: cartToSave.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                isRefund: !!item.isRefund || item.quantity < 0
              }))
            });
          }
          
          // Force immediate save without debounce
          saveCartToLocalStorage(previousOrderId, cartToSave);
          
          // Also update in pos_orders directly
          try {
            const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
            const updatedOrders = savedOrders.map(order => 
              order.id === previousOrderId 
                ? { ...order, cart: cartToSave } 
                : order
            );
            localStorage.setItem('pos_orders', JSON.stringify(updatedOrders));
            console.log(`[POSPage] Updated orders in localStorage for order ${previousOrderId} in tab change`);
          } catch (error) {
            console.error('[POSPage] Error updating orders in localStorage during tab change:', error);
          }
        } else if (previousOrderId && closingOrdersRef.current.has(previousOrderId)) {
          console.log(`[POSPage] Skipping cart save for order ${previousOrderId} because it is being closed`);
        }
        
        // Then update order ID
        setOrderId(newOrderId);
        
        // Finally load the new cart
        const newCart = loadCartFromLocalStorage(newOrderId);
        console.log('[POSPage] Loaded cart for new order:', newOrderId, 'Items:', newCart?.length || 0);
        
        // Log refund cart load on tab change
        if (isRefundOrder) {
          refundLog('Loaded cart for refund order on tab change', {
            newOrderId,
            loadedItems: newCart?.length || 0,
            items: newCart?.map(item => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              isRefund: !!item.isRefund || item.quantity < 0
            }))
          });
        }
        
        // When loading the new order's cart
        if (newCart && newCart.length > 0) {
          console.log(`[POSPage] Setting cart with ${newCart.length} items for order ${newOrderId}`);
          setCart(newCart);
        } else {
          console.log(`[POSPage] No items found for order ${newOrderId}, setting empty cart`);
          // It's safer to explicitly set an empty cart than leaving the previous one
          setCart([]);
        }
      } catch (error) {
        console.error('[POSPage] Error handling order change:', error);
        refundLogError('Error handling order change', error);
      }
    };

    // Register the event listener
    window.addEventListener('pos_order_tab_changed', handleOrderChange);
    
    // Clean up function
    return () => {
      window.removeEventListener('pos_order_tab_changed', handleOrderChange);
    };
  }, [cart, saveCartToLocalStorage, loadCartFromLocalStorage]);
  
  // Separate effect to save cart changes to localStorage
  useEffect(() => {
    if (orderId) {
      // Create a debounce function to avoid too many localStorage updates
      const timeoutId = setTimeout(() => {
        // Use helper function to save cart
        console.log('Auto-saving cart for order:', orderId, 'Items:', cart.length);
        saveCartToLocalStorage(orderId, cart);
      }, 500); // 500ms debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [cart, orderId, saveCartToLocalStorage]);

  // Use the headerSearchText as our search text
  const searchText = headerSearchText;

  // Function to fetch active sessions
  const fetchActiveSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      const activeSessions = await sessionManager.getAllActiveSessions();
      setSessions(activeSessions);
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch active sessions',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoadingSessions(false);
    }
  }, [toast]);

  // Check URL params for session manager
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('openSessionManager') === 'true') {
      // Remove parameter from URL to avoid reopening on refresh
      navigate('/pos', { replace: true });
      // Open session manager
      fetchActiveSessions();
      onSessionModalOpen();
    }
  }, [location, navigate, onSessionModalOpen, fetchActiveSessions]);

  // Check if there's an active session before showing POS UI
  useEffect(() => {
    if (activePOSSession) {
      setShowPOSUI(true);
    } else {
      setShowPOSUI(false);
      // فقط یکبار سشن‌ها را بارگیری می‌کنیم
      if (sessions.length === 0 && !loadingSessions && !loadedSessions.current) {
        loadedSessions.current = true;
        fetchActiveSessions();
      }
    }
  }, [activePOSSession]);  // فقط به تغییرات activePOSSession واکنش نشان می‌دهیم

  // Define a memoized fetchData function with useCallback
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Step 1: Get POS configs first (needed for session search)
      let configsData = [];
      try {
        console.log('Fetching POS configs...');
        configsData = await orderService.getPOSConfigs();
        console.log(`Received ${configsData.length} POS configs`, configsData);
        setPosConfigs(configsData);
        if (configsData.length > 0) {
          setSelectedConfig(configsData[0].id);
        }
      } catch (error) {
        console.error('Error fetching POS configs:', error);
        toast({
          title: 'Error',
          description: 'Failed to load POS configs',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      }
      
      // Step 2: Check for existing sessions
      let existingSession = null;
      try {
        // First check active sessions
        console.log('Fetching active POS sessions...');
        const sessions = await orderService.getPOSSession();
        
        if (sessions && sessions.length > 0) {
          console.log('Using active POS session:', sessions[0]);
          existingSession = sessions[0];
          setActivePOSSession(existingSession);
        } 
        // If no active session found via general search, try to find one for each specific config
        else if (configsData.length > 0) {
          console.log('No active session found directly, checking each config...');
          
          // Try each config in order
          for (const config of configsData) {
            console.log(`Checking for existing session for config ${config.name} (${config.id})...`);
            const foundSession = await sessionManager.getExistingSessionByConfig(config.id);
            
            if (foundSession) {
              console.log(`Found existing session for config ${config.name}:`, foundSession);
              existingSession = foundSession;
              setActivePOSSession(foundSession);
              
              toast({
                title: 'Session Found',
                description: `Using existing session: ${foundSession.name}`,
                status: 'success',
                duration: 3000,
                isClosable: true,
              });
              
              break;
            }
          }
          
          if (!existingSession) {
            console.warn('No active or existing POS session found after checking all configs');
            toast({
              title: 'No Active Session',
              description: 'No active POS session found. You will need to create a new session.',
              status: 'warning',
              duration: 5000,
              isClosable: true,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching POS sessions:', error);
      }
      
      // Step 3: Get categories
      try {
        console.log('Fetching POS categories from local IndexedDB...');
        // Use only the local database function 
        const localCategories = await getLocalPOSData.getCategories();
        
        if (localCategories && localCategories.length > 0) {
          console.log(`Found ${localCategories.length} POS categories in local database`);
          setCategories(localCategories);
        } else {
          console.warn('No categories found in local database');
          // Not falling back to server anymore
          setCategories([]);
          toast({
            title: 'No Categories Found',
            description: 'No categories found in local database. Please load data first.',
            status: 'warning',
            duration: 3000,
            isClosable: true,
          });
        }
      } catch (error) {
        console.error('Error fetching POS categories from local database:', error);
        toast({
          title: 'Error',
          description: 'Failed to load POS categories from local database',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      }
      
      // Step 4: Get products (only if we have a session)
      if (existingSession) {
        try {
          console.log('Fetching products using active session...');
          const productsData = await productService.getProducts();
          console.log(`Received ${productsData.length} products`, productsData);
          setProducts(productsData);
          setFilteredProducts(productsData);
        } catch (error) {
          console.error('Error fetching products:', error);
          toast({
            title: 'Error',
            description: 'Failed to load products',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      }
    } catch (error) {
      console.error('General error in fetchData:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, orderService, sessionManager, getLocalPOSData, productService]);
  
  // Load products, categories and active POS session on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Watch for changes in activePOSSession and force reload UI if needed
  useEffect(() => {
    console.log('Active POS session changed:', activePOSSession);
    
    // If we have a session but no products, reload products
    if (activePOSSession) {
      // Fetch categories as soon as we have an active session
      if (categories.length === 0) {
        console.log('Categories not loaded yet, fetching them now...');
        fetchCategories();
      }
      
      if (!products || products.length === 0) {
        const loadProducts = async () => {
          try {
            console.log('Loading products ONLY from local IndexedDB database');
            setIsLoading(true);
            
            // Get products with retry to ensure they load
            const productsData = await getLocalPOSData.getProductsWithRetry(3, 500);
            
            if (productsData && productsData.length > 0) {
              console.log(`Found ${productsData.length} products in local database`);
              
              // Filter products to only include those with pos_categ_ids field
              const filteredProducts = productsData.filter(product => {
                return product && product.pos_categ_ids && Array.isArray(product.pos_categ_ids) && product.pos_categ_ids.length > 0;
              });
              
              console.log(`Filtered to ${filteredProducts.length} products with pos_categ_ids`);
              
              setProducts(filteredProducts);
              setFilteredProducts(filteredProducts);
            } else {
              console.warn('No products found in local database');
              setProducts([]);
              setFilteredProducts([]);
              
              toast({
                title: 'No Products Available',
                description: 'No products found in local database. Make sure data is loaded properly.',
                status: 'warning',
                duration: 5000,
                isClosable: true,
              });
            }
          } catch (error) {
            console.error('Error loading products from local database:', error);
            setProducts([]);
            setFilteredProducts([]);
            
            toast({
              title: 'Error Loading Products',
              description: 'Could not load products from local database.',
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
          } finally {
            setIsLoading(false);
          }
        };
        
        loadProducts();
      }
    }
  }, [activePOSSession, categories.length]);

  // Add an effect to reload products with a delay after loading data
  useEffect(() => {
    if (activePOSSession) {
      // Schedule a delayed reload of products to ensure IndexedDB is ready
      const timer = setTimeout(async () => {
        console.log('Delayed reload of products from IndexedDB...');
        
        try {
          const productsData = await getLocalPOSData.getProducts();
          
          if (productsData && productsData.length > 0) {
            console.log(`Found ${productsData.length} products in delayed reload`);
            
            // Filter products to only include those with pos_categ_ids field
            const filteredProducts = productsData.filter(product => {
              return product && product.pos_categ_ids && Array.isArray(product.pos_categ_ids) && product.pos_categ_ids.length > 0;
            });
            
            console.log(`Filtered to ${filteredProducts.length} products with pos_categ_ids in delayed reload`);
            
            setProducts(filteredProducts);
            setFilteredProducts(filteredProducts);
            
            // Also check if we need to fetch categories
            if (categories.length === 0) {
              console.log('Categories still not loaded in delayed reload, fetching them now...');
              await fetchCategories();
            }
          } else {
            console.warn('No products found in delayed reload');
          }
        } catch (error) {
          console.error('Error in delayed reload of products:', error);
        }
      }, 1000); // 1 second delay
      
      return () => clearTimeout(timer);
    }
  }, [activePOSSession, categories.length]);

  // Create a new POS session

  // Filter products based on search and category
  useEffect(() => {
    let filtered = [...products];
    
    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        product => 
          product.name.toLowerCase().includes(searchLower) || 
          (product.default_code && product.default_code.toLowerCase().includes(searchLower)) ||
          (product.barcode && product.barcode.toLowerCase().includes(searchLower))
      );
    }
    
    // Filter by category
    if (selectedCategory) {
      console.log('Filtering by category:', selectedCategory);
      filtered = filtered.filter(product => {
        // Check if product has the selected category in pos_categ_ids array
        if (product && product.pos_categ_ids && Array.isArray(product.pos_categ_ids)) {
          const hasCategory = product.pos_categ_ids.includes(selectedCategory);
          console.log('Product:', product.name, 'pos_categ_ids:', product.pos_categ_ids, 'has category:', hasCategory);
          return hasCategory;
        }
        return false;
      });
      console.log('Filtered products count:', filtered.length);
    }
    
    setFilteredProducts(filtered);
  }, [products, searchText, selectedCategory, categories]);

  // Handler for adding a product to cart
  const handleAddToCart = (product) => {
    // Only add to cart if we have an active order
    if (!orderId) {
      toast({
        title: 'No Active Order',
        description: 'Please select or create an order first',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }
    
    console.log(`[POSPage] Adding product to cart: ${product.name} (ID: ${product.id})`);
    
    // Create a variable to track if this is a new item or existing one
    let isNewItem = false;
    let updatedCart = [];
    let existingQuantity = 0;
    
    // Use setCart with function form to ensure we're working with the latest state
    setCart(currentCart => {
      // Check if product already exists in the cart
      const existingItem = currentCart.find(item => item.id === product.id);
      
      if (existingItem) {
        existingQuantity = existingItem.quantity;
        console.log(`[POSPage] Product already exists in cart, increasing quantity from ${existingItem.quantity} to ${existingItem.quantity + 1}`);
        updatedCart = currentCart.map(item => 
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        console.log(`[POSPage] Adding new product to cart: ${product.name}`);
        isNewItem = true;
        updatedCart = [...currentCart, {
          id: product.id,
          name: product.name,
          price: product.list_price || product.lst_price || 0,
          quantity: 1,
          product_id: product.id,
        }];
      }
      
      // Important: Save to localStorage BEFORE updating React state
      if (orderId) {
        console.log(`[POSPage] Saving updated cart to localStorage for order ${orderId}`);
        saveCartToLocalStorage(orderId, updatedCart);
        
        // Also update any saved orders in localStorage
        try {
          const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
          const updatedOrders = savedOrders.map(order => 
            order.id === orderId 
              ? { ...order, cart: updatedCart } 
              : order
          );
          localStorage.setItem('pos_orders', JSON.stringify(updatedOrders));
        } catch (error) {
          console.error('[POSPage] Error updating orders in localStorage:', error);
        }
      }
      
      // Return the updated cart to set as the new state
      return updatedCart;
    });
    
    // Set focus on this item using the new function after a small delay
    // to ensure DOM is updated with the new cart item
    setTimeout(() => {
      if (window.focusCartItem) {
        window.focusCartItem(product.id);
        console.log(`[CART] Setting focus on product ID: ${product.id}, isNewItem: ${isNewItem}`);
      }
    }, 100);
    
    toast({
      title: isNewItem ? 'Added to Cart' : 'Updated Quantity',
      description: isNewItem 
        ? `${product.name} has been added to Order #${orderId}` 
        : `${product.name} quantity increased (${existingQuantity} → ${existingQuantity + 1})`,
      status: 'success',
      duration: 1500,
      isClosable: true,
    });
  };

  // Add a ref to track in-progress updates to prevent race conditions
  const updatingQuantityRef = useRef({});
  
  // Handler for updating item quantity in cart
  const handleUpdateQuantity = (itemId, newQuantity) => {
    // Check if we're already processing an update for this item
    if (updatingQuantityRef.current[itemId]) {
      console.log(`[POSPage] Skipping duplicate quantity update for ${itemId} to ${newQuantity}`);
      return;
    }
    
    // Mark this item as being updated
    updatingQuantityRef.current[itemId] = true;
    
    console.log(`[POSPage] START updating quantity for item ${itemId} to ${newQuantity}`);
    
    // First find the current item
    const currentItem = cart.find(item => item.id === itemId);
    if (!currentItem) {
      console.warn(`[POSPage] Item ${itemId} not found in cart, cannot update quantity`);
      updatingQuantityRef.current[itemId] = false;
      return;
    }
    
    // Check if this is a refund item
    const isRefundItem = currentItem.isRefund || currentItem.quantity < 0;
    
    // For regular items: remove if quantity <= 0
    // For refund items: keep even if quantity is 0 (don't remove)
    if (!isRefundItem && newQuantity <= 0) {
      refundLog(`Removing item due to zero/negative quantity`, {
        itemId,
        isRefundItem,
        currentQuantity: currentItem.quantity,
        newQuantity,
      });
      
      handleRemoveItem(itemId);
      updatingQuantityRef.current[itemId] = false;
      return;
    }
    
    // Log refund item updates
    if (isRefundItem) {
      refundLog('Updating quantity for refund item', {
        itemId,
        currentQuantity: currentItem.quantity,
        newQuantity,
        item: currentItem
      });
    }
    
    console.log(`[POSPage] Current quantity for ${itemId}: ${currentItem.quantity}, new: ${newQuantity}`);
    
    // Skip if there's no actual change
    if (currentItem.quantity === newQuantity) {
      console.log(`[POSPage] No change in quantity for ${itemId}, skipping update`);
      updatingQuantityRef.current[itemId] = false;
      return;
    }
    
    // For refund items, ensure the quantity is always negative and doesn't exceed original quantity
    let adjustedQuantity = newQuantity;
    if (isRefundItem) {
      // For refund items with 0 quantity, keep them at 0 instead of removing
      if (newQuantity === 0) {
        adjustedQuantity = 0;
      }
      // First make it negative if it's positive (but not if it's 0)
      else if (newQuantity > 0) {
        adjustedQuantity = -Math.abs(newQuantity);
        refundLog('Converted positive quantity to negative for refund item', {
          itemId,
          originalQuantity: newQuantity,
          adjustedQuantity
        });
      }
      
      // Now check if it exceeds original quantity limits
      if (currentItem.originalQuantity && Math.abs(adjustedQuantity) > currentItem.originalQuantity) {
        // Cap at original quantity
        adjustedQuantity = -Math.abs(currentItem.originalQuantity);
        
        // Log that we capped the quantity
        refundLog('Capped refund quantity to original order quantity', {
          itemId,
          requestedQuantity: newQuantity,
          originalOrderQuantity: currentItem.originalQuantity,
          adjustedQuantity
        });
        
        // Show toast to user using existing toast instance
        toast({
          title: "حداکثر مقدار مجاز",
          description: `نمی‌توانید بیش از تعداد اصلی (${currentItem.originalQuantity}) را بازگردانید.`,
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
      }
    }
    
    // First create the updated cart
    const updatedCart = cart.map(item => 
      item.id === itemId
        ? { ...item, quantity: isRefundItem ? adjustedQuantity : newQuantity }
        : item
    );
    
    // If this is a refund cart, log the updated cart
    if (updatedCart.some(item => item.isRefund || item.quantity < 0)) {
      logCartChange('quantity updated', updatedCart, 'handleUpdateQuantity');
    }
    
    // Save to localStorage BEFORE updating state to ensure it's saved
    if (orderId) {
      console.log(`[POSPage] DIRECT saving of cart with updated quantity (${newQuantity}) for order ${orderId}`);
      saveCartToLocalStorage(orderId, updatedCart);
      
      // For refund items, also log the localStorage save operation
      if (isRefundItem) {
        refundLog('Saved refund cart to localStorage', {
          orderId,
          cartSize: updatedCart.length,
          updatedItemId: itemId,
          newQuantity: isRefundItem ? adjustedQuantity : newQuantity
        });
      }
    } else {
      console.warn('[POSPage] Cannot save cart: No order ID available');
    }
    
    // Now update the state
    setCart(updatedCart);
    
    // Also update any saved orders in localStorage
    try {
      const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
      const updatedOrders = savedOrders.map(order => {
        if (order.id === orderId) {
          return {
            ...order,
            cart: updatedCart
          };
        }
        return order;
      });
      
      localStorage.setItem('pos_orders', JSON.stringify(updatedOrders));
      console.log(`[POSPage] Updated orders in localStorage for order ${orderId}`);
      
      // For refund orders, log the saved orders update
      if (isRefundItem) {
        refundLog('Updated saved orders with refund cart', {
          orderId,
          orders: updatedOrders.map(o => ({
            id: o.id,
            cartSize: o.cart?.length || 0,
            isRefundOrder: o.isRefund,
            originalOrderId: o.originalOrderId
          }))
        });
      }
    } catch (error) {
      console.error('[POSPage] Error updating orders in localStorage:', error);
      if (isRefundItem) {
        refundLogError('Error updating saved orders with refund cart', error);
      }
    }
    
    console.log(`[POSPage] COMPLETE updating quantity for item ${itemId} to ${newQuantity}`);
    
    // Clear the updating flag with a very small delay to prevent race conditions
    setTimeout(() => {
      updatingQuantityRef.current[itemId] = false;
    }, 50);
  };

  // Handler for removing item from cart
  const handleRemoveItem = (itemId) => {
    // Before removing, find the current index of the item
    const currentIndex = cart.findIndex(item => item.id === itemId);
    let nextFocusId = null;
    
    // If this is the only item, no need to change focus
    if (cart.length > 1) {
      // Determine which item to focus next (prefer previous item)
      if (currentIndex > 0) {
        // Focus the previous item
        nextFocusId = cart[currentIndex - 1].id;
      } else if (currentIndex === 0 && cart.length > 1) {
        // If it's the first item, focus the next one
        nextFocusId = cart[1].id;
      }
    }
    
    // Remove the item from cart
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
    
    // Set focus on the determined item after a short delay to allow DOM update
    if (nextFocusId) {
      setTimeout(() => {
        if (window.cartState && typeof window.cartState.focusedItemId !== 'undefined') {
          window.cartState.focusedItemId = nextFocusId;
          // Trigger focus change event
          window.dispatchEvent(new CustomEvent('cartItemFocus'));
        }
      }, 50);
    }
    
    toast({
      title: 'Item Removed',
      description: 'Item has been removed from cart',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  // Handler for updating discount on cart item
  const handleUpdateDiscount = (itemId, newDiscount) => {
    setCart(prevCart => {
      const updatedCart = prevCart.map(item => 
        item.id === itemId
          ? { ...item, discount: newDiscount }
          : item
      );
      
      // Save to localStorage immediately
      if (orderId) {
        saveCartToLocalStorage(orderId, updatedCart);
      }
      
      return updatedCart;
    });
  };

  // Calculate cart total with support for negative quantities (refunds)
  const cartTotal = cart.reduce(
    (total, item) => {
      const priceAfterDiscount = item.price * (1 - (item.discount || 0) / 100);
      return total + (priceAfterDiscount * item.quantity);
    },
    0
  );
  
  // Calculate total discount
  const totalDiscount = cart.reduce((total, item) => {
    return total + (item.price * item.quantity * (item.discount || 0) / 100);
  }, 0);
  
  // Calculate tax amount (15% tax rate)
  const taxAmount = parseFloat((cartTotal * 0.15).toFixed(2));
  
  // Calculate final total
  const finalTotal = parseFloat((cartTotal + taxAmount).toFixed(2));
  
  // Add this variable to track if this is a refund order
  const isRefundOrder = cart.some(item => item.isRefund || item.quantity < 0);

  // آپدیت کردن تابع handleCreateOrder برای استفاده از مشتری انتخاب شده

  // Function to close a specific session
  const handleCloseSession = async (sessionId) => {
    try {
      setSessionActionInProgress(true);
      const result = await sessionManager.closeSession(sessionId);
      
      if (result) {
        toast({
          title: 'موفقیت',
          description: `سشن با موفقیت بسته شد`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh sessions list
        fetchActiveSessions();
        
        // If the closed session was the active one, clear active session
        if (activePOSSession && activePOSSession.id === sessionId) {
          setActivePOSSession(null);
        }
      } else {
        toast({
          title: 'خطا',
          description: 'بستن سشن با خطا مواجه شد',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error closing session:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در بستن سشن. ممکن است شما اجازه بستن این سشن را نداشته باشید.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSessionActionInProgress(false);
    }
  };
  
  // Function to close all sessions
  const handleCloseAllSessions = async () => {
    try {
      setSessionActionInProgress(true);
      const results = await sessionManager.closeAllSessions();
      
      // اگر پیام خاصی وجود داشت
      if (results.message) {
        toast({
          title: 'اطلاعات',
          description: results.message,
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      if (results.closed > 0) {
        toast({
          title: 'سشن‌ها بسته شدند',
          description: `تعداد ${results.closed} سشن با موفقیت بسته شد.`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // اگر سشن فعال بسته شد، آن را پاک کنیم
        if (activePOSSession && results.sessionDetails && 
            results.sessionDetails.some(s => s.id === activePOSSession.id && s.success)) {
          setActivePOSSession(null);
        }
      }
      
      if (results.failed > 0) {
        toast({
          title: 'هشدار',
          description: `تعداد ${results.failed} سشن را نتوانستیم ببندیم.`,
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      }
      
      // Refresh sessions list
      fetchActiveSessions();
    } catch (error) {
      console.error('Error closing all sessions:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در بستن سشن‌ها',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSessionActionInProgress(false);
    }
  };

  // Session management modal
  const SessionManagementModal = ({ isOpen, onClose }) => {
    // Handler to auto-connect to existing session
    const handleAutoConnect = async () => {
      try {
        setSessionActionInProgress(true);
        
        // Try to find the first available POS config
        if (posConfigs.length === 0) {
          toast({
            title: 'خطا',
            description: 'هیچ پیکربندی POS در دسترس نیست',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          return;
        }
        
        // Try each config in order
        for (const config of posConfigs) {
          const existingSession = await sessionManager.getExistingSessionByConfig(config.id);
          if (existingSession) {
            console.log(`Auto-connecting to existing session for config ${config.name}:`, existingSession);
            setActivePOSSession(existingSession);
            toast({
              title: 'اتصال موفق',
              description: `اتصال به سشن موجود: ${existingSession.name}`,
              status: 'success',
              duration: 3000,
              isClosable: true,
            });
            
            onClose();
            return;
          }
        }
        
        toast({
          title: 'سشنی یافت نشد',
          description: 'هیچ سشن موجودی برای کاربر فعلی یافت نشد',
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
        
      } catch (error) {
        console.error('Error auto-connecting to session:', error);
        toast({
          title: 'خطا',
          description: error.message || 'خطا در اتصال به سشن موجود',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setSessionActionInProgress(false);
      }
    };
    
    // Get current user info to determine ownership
    
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>مدیریت سشن‌ها</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Button
                colorScheme="blue"
                leftIcon={<FiSettings />}
                onClick={handleAutoConnect}
                isLoading={sessionActionInProgress}
                isDisabled={sessionActionInProgress}
              >
                اتصال خودکار به سشن موجود
              </Button>
              
              <Divider />
              
              <Heading size="sm">سشن‌های فعال</Heading>
              {loadingSessions ? (
                <Flex justify="center" p={4}>
                  <Spinner size="md" />
                </Flex>
              ) : sessions.length > 0 ? (
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>نام</Th>
                      <Th>پیکربندی POS</Th>
                      <Th>وضعیت</Th>
                      <Th>مالک</Th>
                      <Th>عملیات</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {sessions.map(session => (
                      <Tr key={session.id} bg={session.isOwnedByCurrentUser ? "blue.50" : undefined}>
                        <Td>{session.name}</Td>
                        <Td>{session.config_id ? session.config_id[1] : 'نامشخص'}</Td>
                        <Td>
                          <Badge
                            colorScheme={
                              session.state === 'opened' ? 'green' : 
                              session.state === 'opening_control' ? 'blue' : 
                              session.state === 'closing_control' ? 'orange' : 'gray'
                            }
                          >
                            {session.state === 'opened' ? 'باز' : 
                             session.state === 'opening_control' ? 'در حال باز شدن' :
                             session.state === 'closing_control' ? 'در حال بسته شدن' : session.state}
                          </Badge>
                        </Td>
                        <Td>
                          {session.isOwnedByCurrentUser ? 
                            <Badge colorScheme="green">شما</Badge> : 
                            <Badge>کاربر دیگر</Badge>
                          }
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            <Button
                              size="xs"
                              colorScheme="blue"
                              onClick={() => {
                                // Only allow using own sessions
                                if (session.isOwnedByCurrentUser) {
                                  setActivePOSSession(session);
                                  onClose();
                                  toast({
                                    title: 'سشن انتخاب شد',
                                    description: `استفاده از سشن: ${session.name}`,
                                    status: 'success',
                                    duration: 3000,
                                    isClosable: true,
                                  });
                                } else {
                                  toast({
                                    title: 'خطا',
                                    description: 'شما فقط می‌توانید از سشن‌های خودتان استفاده کنید',
                                    status: 'error',
                                    duration: 3000,
                                    isClosable: true,
                                  });
                                }
                              }}
                              isDisabled={!session.isOwnedByCurrentUser}
                            >
                              استفاده
                            </Button>
                            <Button
                              size="xs"
                              colorScheme="red"
                              onClick={() => handleCloseSession(session.id)}
                              isDisabled={sessionActionInProgress || !session.isOwnedByCurrentUser}
                            >
                              بستن
                            </Button>
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              ) : (
                <Text>هیچ سشن فعالی یافت نشد</Text>
              )}
              
              <Divider />
              
              <HStack spacing={4}>
                <Button
                  colorScheme="blue"
                  leftIcon={<FiSettings />}
                  onClick={fetchActiveSessions}
                  isLoading={loadingSessions}
                  isDisabled={sessionActionInProgress}
                >
                  بارگذاری مجدد سشن‌ها
                </Button>
                
                <Button 
                  colorScheme="red" 
                  onClick={handleCloseAllSessions}
                  isLoading={sessionActionInProgress}
                  isDisabled={sessionActionInProgress || !sessions.some(s => s.isOwnedByCurrentUser)}
                  title={sessions.some(s => s.isOwnedByCurrentUser) ? 
                    "بستن همه سشن‌های متعلق به شما" : 
                    "شما هیچ سشن فعالی ندارید که بتوانید ببندید"}
                >
                  بستن سشن‌های من
                </Button>
              </HStack>
              
              <Box mt={2} p={3} bg="yellow.50" borderRadius="md">
                <Text fontSize="sm" fontWeight="bold">راهنما:</Text>
                <Text fontSize="sm">• سشن‌های با زمینه آبی متعلق به شما هستند</Text>
                <Text fontSize="sm">• فقط می‌توانید از سشن‌های خودتان استفاده کنید</Text>
                <Text fontSize="sm">• فقط می‌توانید سشن‌های خودتان را ببندید</Text>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>بستن</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  };

  // Generate consistent colors for categories
  useEffect(() => {
    if (categories.length > 0) {
      const colors = {};
      const colorPalette = {
        // Using more vibrant colors for categories
        "Upper body": "rgba(255, 153, 102, 0.5)",  // Bright orange
        "Lower body": "rgba(102, 204, 153, 0.5)",  // Bright green
        "Others": "rgba(179, 179, 179, 0.5)",      // Gray
        // Fallback colors for other categories - more vibrant
        "default": [
          "rgba(255, 204, 0, 0.5)",    // Bright yellow
          "rgba(51, 153, 255, 0.5)",   // Bright blue
          "rgba(204, 102, 255, 0.5)",  // Bright purple
          "rgba(255, 102, 102, 0.5)",  // Bright red
          "rgba(102, 255, 153, 0.5)",  // Bright mint green
          "rgba(255, 102, 204, 0.5)",  // Bright pink
          "rgba(0, 204, 204, 0.5)"     // Bright cyan
        ]
      };
      
      categories.forEach((category, index) => {
        // Try to match category by name first
        const categoryName = category.name || '';
        if (Object.keys(colorPalette).includes(categoryName)) {
          colors[category.id] = colorPalette[categoryName];
        } else {
          // Use default color palette
          colors[category.id] = colorPalette.default[index % colorPalette.default.length];
        }
        
        // Store color in the category's own color field if it exists
        if (category.color) {
          try {
            // If the category already has a color defined in the database, use that
            const colorValue = parseInt(category.color);
            if (!isNaN(colorValue) && colorValue > 0) {
              // Convert Odoo numeric color to a hex color - simplified approach
              const hue = (colorValue % 10) * 36; // 0-9 mapped to 0-324 degrees
              colors[category.id] = `hsla(${hue}, 70%, 60%, 0.5)`;
            }
          } catch (e) {
            console.log('Error parsing category color:', e);
          }
        }
      });
      
      console.log('Setting category colors:', colors);
      setCategoryColors(colors);
    }
  }, [categories]);

  // Determine product category color
  const getProductCategoryColor = (product) => {
    if (!product) return "white";
    
    // Use pos_categ_ids (new field) instead of categ_id
    if (product.pos_categ_ids && Array.isArray(product.pos_categ_ids) && product.pos_categ_ids.length > 0) {
      const categoryId = product.pos_categ_ids[0];
      const color = categoryColors[categoryId] || "white";
      
      // Debug info
      if (process.env.NODE_ENV === 'development') {
        // console.log(`Product ${product.name} (ID: ${product.id}) has POS category ID ${categoryId} with color ${color}`);
      }
      
      return color;
    }
    
    // Fallback to white if no pos_categ_ids
    return "white";
  };

  // Get current user from localStorage for the header
  
  // Category Management Functions

  // به‌روزرسانی دسته‌بندی

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      setIsDeletingCategory(true);
      
      // Still need to call server API to delete the category
      const result = await categoryService.deleteCategory(categoryToDelete.id);
      
      if (result) {
        // First reload data to IndexedDB to ensure it's up-to-date
        const sessionId = localStorage.getItem('current_session_id');
        if (sessionId) {
          // Only reload the pos.category model
          await loadPOSData(sessionId, true, 'pos.category');
          console.log('Reloaded category data from server to IndexedDB after deletion');
        }
        
        // Now refresh categories from local database
        await fetchCategories();
        
        toast({
          title: 'موفقیت',
          description: 'دسته‌بندی با موفقیت حذف شد',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Reset state
        setCategoryToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: 'خطا',
        description: error.message || 'حذف دسته‌بندی با خطا مواجه شد',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeletingCategory(false);
    }
  };

  // Categories Management Modal component

  // Delete Category Confirmation
  const DeleteCategoryConfirmation = () => {
    return (
      <AlertDialog
        isOpen={!!categoryToDelete}
        leastDestructiveRef={cancelRef}
        onClose={() => setCategoryToDelete(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              حذف دسته‌بندی
            </AlertDialogHeader>

            <AlertDialogBody>
              آیا از حذف دسته‌بندی &quot;categoryToDelete?.name&#125&quot; اطمینان دارید؟
              {products.filter(p => p.categ_id && p.categ_id[0] === categoryToDelete?.id).length > 0 && (
                <Text color="red.500" mt={2}>
                  هشدار: این دسته‌بندی دارای محصول است و حذف آن ممکن است باعث مشکل در محصولات شود.
                </Text>
              )}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setCategoryToDelete(null)}>
                انصراف
              </Button>
              <Button colorScheme="red" onClick={handleDeleteCategory} ml={3} isLoading={isDeletingCategory}>
                حذف
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    );
  };

  // Function to export the order as JSON

  // Add new state to track if we're showing POS UI or session selection
  const [showPOSUI, setShowPOSUI] = useState(false);
  // State to track which config a session is being created for
  const [creatingSessionForConfig, setCreatingSessionForConfig] = useState(null);
  
  // Session selection component
  const SessionSelectionScreen = () => {
    // State محلی برای لودینگ و سشن‌ها
    const [localLoading, setLocalLoading] = useState(false);
    
    // Get current user info to determine ownership
    
    // تابع بارگذاری سشن‌ها به صورت محلی
    const loadSessions = async () => {
      try {
        setLocalLoading(true);
        await fetchActiveSessions();
      } catch (error) {
        console.error('Error loading sessions in selection screen:', error);
      } finally {
        setLocalLoading(false);
      }
    };
    
    // UseEffect برای loading اولیه سشن‌ها
    useEffect(() => {
      if (sessions.length === 0 && !loadingSessions && !loadedSessions.current) {
        loadedSessions.current = true;
        loadSessions();
      }
    }, []);
    
    return (
      <Box p={4} maxW="100%" mx="auto" h="calc(100vh - 36px)" overflow="hidden" display="flex" flexDirection="column">
        <Heading mb={2} size="lg">Point of Sale</Heading>
        
        {/* Search bar */}
        <InputGroup mb={3} maxW="600px" mx="auto">
          <InputLeftElement pointerEvents="none">
            <FiSearch color="gray.300" />
          </InputLeftElement>
          <Input placeholder="جستجوی صندوق..." />
          <Text position="absolute" right={4} top="50%" transform="translateY(-50%)">Q</Text>
        </InputGroup>
        
        {/* Page indicator */}
        <HStack justify="flex-end" mb={1}>
          <Text>1-2 / 2</Text>
          <IconButton icon={<FiChevronDown transform="rotate(90deg)" />} aria-label="Previous page" variant="ghost" />
          <IconButton icon={<FiChevronDown transform="rotate(-90deg)" />} aria-label="Next page" variant="ghost" />
          <Text>⇧+V</Text>
        </HStack>
        
        <Box flex="1" overflowY="auto" mb={2}>
          {loadingSessions || localLoading ? (
            <Flex justify="center" align="center" p={10}>
              <Spinner size="xl" color="blue.500" />
            </Flex>
          ) : (
            <SimpleGrid columns={{ base: 2, sm: 3, md: 5, lg: 7, xl: 10 }} spacing={3}>
              {posConfigs.map(config => {
                // Find if there's an existing session for this config
                const configSession = sessions.find(s => s.config_id && s.config_id[0] === config.id);
                const isOwnedByOther = configSession && !configSession.isOwnedByCurrentUser;
                
                return (
                  <Box 
                    key={config.id} 
                    borderWidth="1px" 
                    borderRadius="md" 
                    p={4}
                    bg={configSession?.isOwnedByCurrentUser ? "blue.50" : "white"}
                  >
                    <Heading size="md" mb={4}>{config.name}</Heading>
                    
                    <Flex justify="flex-end" mb={4}>
                      <Box textAlign="right">
                        <Text>Closing</Text>
                        <Text>Balance</Text>
                        <Text>$ 0.00</Text>
                      </Box>
                    </Flex>
                    
                    <Button
                      colorScheme="purple"
                      size="md"
                      onClick={() => handleOpenSession(config.id)}
                      isLoading={creatingSessionForConfig === config.id}
                      isDisabled={isOwnedByOther || creatingSessionForConfig !== null}
                      width="fit-content"
                    >
                      Open Register
                    </Button>
                    
                    {isOwnedByOther && (
                      <Text color="red.500" fontSize="sm" mt={2}>
                        در حال استفاده توسط کاربر دیگر
                      </Text>
                    )}
                    
                    {configSession && (
                      <Badge
                        mt={2}
                        colorScheme={
                          configSession.state === 'opened' ? 'green' : 
                          configSession.state === 'opening_control' ? 'blue' : 
                          configSession.state === 'closing_control' ? 'orange' : 'gray'
                        }
                      >
                        {configSession.state === 'opened' ? 'باز' : 
                        configSession.state === 'opening_control' ? 'در حال باز شدن' :
                        configSession.state === 'closing_control' ? 'در حال بستن' : configSession.state}
                      </Badge>
                    )}
                  </Box>
                );
              })}
            </SimpleGrid>
          )}
        </Box>
        
        {/* دکمه برای بارگذاری مجدد سشن‌ها */}
        <Button
          mt={1}
          colorScheme="blue"
          leftIcon={<FiRefreshCw />}
          onClick={() => {
            loadedSessions.current = false;
            loadSessions();
          }}
          isLoading={loadingSessions || localLoading}
        >
          بارگذاری مجدد سشن‌ها
        </Button>
      </Box>
    );
  };

  // Add the handleLogout function
  const handleLogout = async () => {
    try {
      // Show loading toast
      toast({
        title: 'خروج از حساب کاربری',
        description: 'در حال خروج...',
        status: 'info',
        duration: 2000,
        isClosable: true,
      });

      // First clear all localStorage items related to sessions and authentication
      const itemsToRemove = [
        'user',
        'token',
        'session_id',
        'pos_active_order_id',
        'pos_orders',
        'current_session',
        'odoo_session',
        'auth_token'
      ];
      
      itemsToRemove.forEach(item => localStorage.removeItem(item));
      
      // Call the auth service logout to properly terminate the Odoo session
      try {
        console.log('Calling authService.logout()...');
        await authService.logout();
      } catch (logoutError) {
        console.error('Error during logout from server:', logoutError);
      }
      
      // Navigate to login page
      navigate('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      toast({
        title: 'خطا',
        description: 'خطا در خروج از حساب کاربری',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Open or create a session for a specific config
  const handleOpenSession = async (configId) => {
    if (creatingSessionForConfig !== null) {
      // اگر در حال ایجاد سشن برای کانفیگ دیگری هستیم، اجازه ندهیم
      console.log('Already creating session for config:', creatingSessionForConfig);
      return;
    }

    // ابتدا وضعیت loading را تنظیم می‌کنیم
    setCreatingSessionForConfig(configId);
    
    try {
      // First check if there's an existing session for this config
      console.log('Checking for existing session for config:', configId);
      const existingSession = await sessionManager.getExistingSessionByConfig(configId);
                        
      if (existingSession) {
        console.log('Found existing session:', existingSession);
        
        // Call the setOpeningControl method to notify the server about opening control
        try {
          console.log('Notifying server about opening control for existing session...');
          const success = await sessionManager.setOpeningControl(existingSession.id, 0, "");
          if (success) {
            console.log('Successfully notified server about opening control');
          } else {
            console.warn('Server notification about opening control returned false');
          }
        } catch (error) {
          // Catch shouldn't be reached with our improved error handling, but just in case
          console.error('Error notifying server about opening control:', error);
        }
        
        // Continue with session usage regardless of notification success
        localStorage.setItem('current_session_id', existingSession.id.toString());
        
        // Show a different message based on the session state
        const stateMessages = {
          'opened': 'استفاده از سشن فعال موجود',
          'opening_control': 'اتصال به سشن موجود در حالت کنترل باز شدن',
          'closing_control': 'اتصال به سشن موجود در حالت کنترل بستن'
        };
        
        const message = stateMessages[existingSession.state] || 'اتصال به سشن موجود';
        
        // Load POS data from server to IndexedDB BEFORE setting active session
        try {
          setIsLoading(true);
          console.log('Loading POS data for session:', existingSession.id);
          const posData = await loadPOSData(existingSession.id);
          console.log('POS data loaded and stored in IndexedDB:', posData);
          
          // Add a small delay to ensure IndexedDB operations have completed
          console.log('Waiting for IndexedDB operations to complete...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Now we can load products from the local database ONLY
          console.log('Loading products ONLY from local IndexedDB database');
          
          // Verify data exists in IndexedDB first
          const dataExists = await getLocalPOSData.checkDataExists();
          if (!dataExists) {
            console.warn('Data verification failed - reloading data');
            await loadPOSData(existingSession.id, true);
            await new Promise(resolve => setTimeout(resolve, 800));
          }
          
          const localProducts = await getLocalPOSData.getProductsWithRetry(5, 800);
          
          if (localProducts && localProducts.length > 0) {
            console.log(`Found ${localProducts.length} products in local database`);
            setProducts(localProducts);
            setFilteredProducts(localProducts);
            
            // Fetch categories immediately after loading products
            console.log('Fetching categories immediately after loading products...');
            await fetchCategories();
            
            // Now set the active session AFTER data is loaded
            setActivePOSSession(existingSession);
            
            toast({
              title: 'اتصال موفق',
              description: `${message}: ${existingSession.name} - داده‌های فروشگاه بارگیری شد`,
              status: 'success',
              duration: 3000,
              isClosable: true,
            });
          } else {
            console.warn('No products found in local database');
            throw new Error('No products found in local database after loading');
          }
        } catch (error) {
          console.error('Error loading POS data or products:', error);
          
          toast({
            title: 'هشدار',
            description: 'بارگذاری داده‌ها با خطا مواجه شد. در حال تلاش مجدد...',
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
          
          // Try one more time with a direct load and longer timeout
          try {
            console.log('Retrying data load - forced reload with delay');
            await loadPOSData(existingSession.id, true); // Force reload
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Try to inspect the database to see if data exists
            await inspectDatabase();
            
            const retryProducts = await productService.getProducts();
            if (retryProducts && retryProducts.length > 0) {
              console.log(`Retry successful! Found ${retryProducts.length} products through API`);
              setProducts(retryProducts);
              setFilteredProducts(retryProducts);
              
              // Fetch categories immediately after loading products in retry path
              console.log('Fetching categories after retry...');
              await fetchCategories();
              
              // Set active session on retry success
              setActivePOSSession(existingSession);
              
              toast({
                title: 'اتصال موفق',
                description: `${message}: ${existingSession.name} - داده‌ها با تلاش مجدد بارگیری شدند`,
                status: 'success',
                duration: 3000,
                isClosable: true,
              });
            } else {
              throw new Error('Retry failed - still no products found');
            }
          } catch (retryError) {
            console.error('Error in retry attempt:', retryError);
            setProducts([]);
            setFilteredProducts([]);
            
            toast({
              title: 'خطا',
              description: 'بارگذاری داده‌ها با خطا مواجه شد. لطفا صفحه را رفرش کنید.',
              status: 'error', 
              duration: 5000,
              isClosable: true,
            });
          }
        } finally {
          setIsLoading(false);
        }
        
        return;
      }
      
      // If no existing session, create a new one
      console.log('No existing session found, creating new POS session for config:', configId);
      
      // Use sessionManager which uses the current user
      const session = await sessionManager.createSession(configId);
      
      if (session) {
        console.log('Session created successfully:', session);
        
        // Call the setOpeningControl method to notify the server about opening control
        try {
          console.log('Notifying server about opening control for new session...');
          const success = await sessionManager.setOpeningControl(session.id, 0, "");
          if (success) {
            console.log('Successfully notified server about opening control');
          } else {
            console.warn('Server notification about opening control returned false');
          }
        } catch (error) {
          // Catch shouldn't be reached with our improved error handling, but just in case
          console.error('Error notifying server about opening control:', error);
        }
        
        // Continue with session usage regardless of notification success
        localStorage.setItem('current_session_id', session.id.toString());
        
        try {
          // Load POS data from server to IndexedDB BEFORE setting active session
          setIsLoading(true);
          console.log('Loading POS data for new session:', session.id);
          const posData = await loadPOSData(session.id);
          console.log('POS data loaded and stored in IndexedDB:', posData);
          
          // Add a small delay to ensure IndexedDB operations have completed
          console.log('Waiting for IndexedDB operations to complete...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Now we can load products from the local database ONLY
          console.log('Loading products ONLY from local IndexedDB database');
          
          // Verify data exists in IndexedDB first
          const dataExists = await getLocalPOSData.checkDataExists();
          if (!dataExists) {
            console.warn('Data verification failed - reloading data');
            await loadPOSData(session.id, true);
            await new Promise(resolve => setTimeout(resolve, 800));
          }
          
          const localProducts = await getLocalPOSData.getProductsWithRetry(5, 800);
          
          if (localProducts && localProducts.length > 0) {
            console.log(`Found ${localProducts.length} products in local database`);
            setProducts(localProducts);
            setFilteredProducts(localProducts);
            
            // Fetch categories immediately after loading products in new session
            console.log('Fetching categories for new session...');
            await fetchCategories();
            
            // Now set the active session AFTER data is loaded
            setActivePOSSession(session);
            
            toast({
              title: 'موفقیت',
              description: 'سشن POS با موفقیت ایجاد و داده‌ها بارگیری شد',
              status: 'success',
              duration: 3000,
              isClosable: true,
            });
          } else {
            console.warn('No products found in local database');
            throw new Error('No products found in local database after loading');
          }
        } catch (error) {
          console.error('Error loading POS data or products:', error);
          
          toast({
            title: 'هشدار',
            description: 'بارگذاری داده‌ها با خطا مواجه شد. در حال تلاش مجدد...',
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
          
          // Try one more time with a direct load and longer timeout
          try {
            console.log('Retrying data load - forced reload with delay');
            await loadPOSData(session.id, true); // Force reload
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Try to inspect the database to see if data exists
            await inspectDatabase();
            
            const retryProducts = await productService.getProducts();
            if (retryProducts && retryProducts.length > 0) {
              console.log(`Retry successful! Found ${retryProducts.length} products through API`);
              setProducts(retryProducts);
              setFilteredProducts(retryProducts);
              
              // Fetch categories immediately after loading products in new session retry path
              console.log('Fetching categories after new session retry...');
              await fetchCategories();
              
              // Set active session on retry success
              setActivePOSSession(session);
              
              toast({
                title: 'موفقیت',
                description: 'داده‌ها با تلاش مجدد بارگیری شدند',
                status: 'success',
                duration: 3000,
                isClosable: true,
              });
            } else {
              throw new Error('Retry failed - still no products found');
            }
          } catch (retryError) {
            console.error('Error in retry attempt:', retryError);
            setProducts([]);
            setFilteredProducts([]);
            
            toast({
              title: 'خطا',
              description: 'بارگذاری داده‌ها با خطا مواجه شد. لطفا صفحه را رفرش کنید.',
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
          }
        } finally {
          setIsLoading(false);
        }
      } else {
        console.error('Failed to create session');
        toast({
          title: 'خطا',
          description: 'ایجاد سشن با خطا مواجه شد',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error creating session or opening existing session:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در ایجاد یا اتصال به سشن',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      // در نهایت، وضعیت loading را پاک می‌کنیم
      setCreatingSessionForConfig(null);
    }
  };

  // تبدیل فایل تصویر به فرمت base64
  
  // Function to fetch categories from local database only
  const fetchCategories = async () => {
    try {
      console.log('Fetching categories ONLY from local IndexedDB database');
      
      // Get categories directly from the IndexedDB database
      const localCategories = await getLocalPOSData.getCategories();
      
      if (localCategories && localCategories.length > 0) {
        console.log(`Found ${localCategories.length} categories in local database`);
        setCategories(localCategories);
        return localCategories;
      } else {
        console.warn('No categories found in local database');
        setCategories([]);
        
        toast({
          title: 'No Categories Available',
          description: 'No categories found in local database. Categories will be loaded when session data is refreshed.',
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
        return [];
      }
    } catch (error) {
      console.error('Error fetching categories from local database:', error);
      setCategories([]);
      return [];
    }
  };

  // We'll keep this function for handling the sidebar category button
  const handleCategoriesClick = () => {
    onCategoriesModalOpen();
    setPOSSidebarOpen(false);
  };
  
  const handleSettingsClick = () => {
    toast({
      title: "تنظیمات",
      description: "این بخش در حال توسعه است.",
      status: "info",
      duration: 3000,
      isClosable: true,
    });
    setPOSSidebarOpen(false);
  };
  
  // اضافه کردن تابع برای باز کردن مودال مشتریان و بستن ساید بار
  const handleCustomersClick = () => {
    onCustomersModalOpen();
    setPOSSidebarOpen(false);
  };
  
  // اضافه کردن تابع برای باز کردن مودال محصولات و بستن ساید بار
  const handleProductsClick = () => {
    onProductsModalOpen();
    setPOSSidebarOpen(false);
  };
  
  // مدیریت انتخاب مشتری
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    toast({
      title: 'مشتری انتخاب شد',
      description: `مشتری ${customer.name} برای فاکتور انتخاب شد`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  // Handle removing a customer
  const handleRemoveCustomer = () => {
    setSelectedCustomer(null);
  };
  
  // Handle order type change
  const handleOrderTypeChange = (type) => {
    setOrderType(type);
    
    // Store order type in the active order
    try {
      const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
      const updatedOrders = savedOrders.map(order => 
        order.id === orderId 
          ? { ...order, orderType: type } 
          : order
      );
      localStorage.setItem('pos_orders', JSON.stringify(updatedOrders));
    } catch (error) {
      console.error('Error saving order type:', error);
    }
  };
  
  // State for payment screen
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [isOrderCompleteOpen, setIsOrderCompleteOpen] = useState(false);
  
  // Handle opening payment screen
  const handleOpenPaymentScreen = () => {
    if (cart.length === 0) {
      toast({
        title: 'Empty Cart',
        description: 'Please add products to cart before processing payment',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    console.log('[POSPage] Opening payment screen:');
    console.log(`- Cart Total: $${cartTotal.toFixed(2)}`);
    console.log(`- Tax Amount: $${taxAmount.toFixed(2)}`);
    console.log(`- Discount: $${totalDiscount.toFixed(2)}`);
    console.log(`- Final Total: $${finalTotal.toFixed(2)}`);
    
    // Use the current orderId, don't generate a new one here
    // This ensures we are still working with the same order during payment
    setIsPaymentModalOpen(true);
  };
  
  // Handle payment completion
  const handlePaymentComplete = (orderData) => {
    setIsPaymentModalOpen(false);
    
    // Add order type and refund info to order data
    const orderContainsRefund = cart.some(item => item.isRefund || item.quantity < 0);
    const orderDataWithType = {
      ...orderData,
      orderType: orderType,
      isRefund: orderContainsRefund,
      cart: [...cart], // Add a copy of the current cart
      // Add exact totals for receipt display
      amount_total: finalTotal,
      amount_tax: taxAmount,
      amount_subtotal: cartTotal,
      totalDiscount: totalDiscount,
      refundData: orderContainsRefund ? {
        originalOrderId: cart[0]?.originalOrderId || 'unknown',
        refundItems: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: Math.abs(item.quantity),
          price: item.price,
          discount: item.discount || 0
        }))
      } : null
    };
    
    setCompletedOrder(orderDataWithType);
    setIsOrderCompleteOpen(true);
    
    console.log('[POSPage] Payment completed for order:', orderId);
    console.log('[POSPage] Order data:', orderDataWithType);
    console.log('[POSPage] Order type:', orderType);
    console.log('[POSPage] Is refund:', orderContainsRefund);
    
    try {
      // Get sync status from the order data
      const syncStatus = orderData.syncStatus || 'pending';
      const isOffline = orderData.isOffline || false;
      const offlineId = orderData.offlineId;
      const serverOrderId = orderData.serverOrderId;
      
      // For refund orders, mark them to be completely removed after processing
      if (orderContainsRefund) {
        console.log('[POSPage] This is a refund order that should be completely removed after processing');
        
        // We'll set a special flag to ensure it gets fully removed
        localStorage.setItem(`completed_refund_${orderId}`, 'true');
      }
      
      // Mark the current order as completed in localStorage with appropriate status
      const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
      const updatedOrders = savedOrders.map(order => 
        order.id === orderId 
          ? { 
              ...order, 
              cart: [], // Empty the cart
              status: 'completed', 
              completedAt: new Date().toISOString(),
              syncStatus: syncStatus,
              paymentData: orderDataWithType, // Store payment details with order type
              serverOrderId: serverOrderId, // Store the server's order ID if available
              offlineId: offlineId, // Store offline reference
              orderType: orderType, // Store order type
              isRefund: orderContainsRefund, // Store refund status
              originalOrderId: orderContainsRefund ? cart[0]?.originalOrderId : null, // Store original order ID for refunds
              shouldRemove: orderContainsRefund // Mark for removal if refund
            } 
          : order
      );
      
      localStorage.setItem('pos_orders', JSON.stringify(updatedOrders));
      
      // Clear the current cart
      setCart([]);
      
      // Show appropriate toast based on sync status and refund status
      let statusMessage;
      let statusType;
      
      if (orderContainsRefund) {
        if (syncStatus === 'synced') {
          statusMessage = `بازگشت برای سفارش #${cart[0]?.originalOrderId || 'نامشخص'} با موفقیت پردازش و با سرور همگام‌سازی شد`;
        } else {
          statusMessage = `بازگشت برای سفارش #${cart[0]?.originalOrderId || 'نامشخص'} پردازش شد اما با سرور همگام‌سازی نشد. بعداً تلاش مجدد خواهد شد.`;
        }
        statusType = 'info';
      } else {
        if (syncStatus === 'synced') {
          statusMessage = `سفارش #${orderId} با موفقیت پردازش و با سرور همگام‌سازی شد`;
          statusType = 'success';
        } else {
          if (isOffline) {
            statusMessage = `سفارش #${orderId} در حالت آفلاین پردازش شد. پس از برقراری اتصال، همگام‌سازی خواهد شد.`;
          } else {
            statusMessage = `سفارش #${orderId} پردازش شد اما با سرور همگام‌سازی نشد. بعداً تلاش مجدد خواهد شد.`;
          }
          statusType = 'info';
        }
      }
      
      toast({
        title: orderContainsRefund ? 'بازگشت کامل شد' : 'سفارش کامل شد',
        description: statusMessage,
        status: statusType,
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('[POSPage] Error updating order status:', error);
      toast({
        title: 'هشدار',
        description: 'سفارش پردازش شد اما خطایی در به‌روزرسانی داده‌های محلی رخ داد',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Close the completed order modal and notify AppLayout
  const handleOrderCompleteClose = () => {
    setIsOrderCompleteOpen(false);
    
    // Get the completed order ID from server response, or fall back to local ID
    // This is crucial for ensuring we close the right tab
    const serverOrderId = completedOrder?.id;
    const clientOrderId = orderId;
    
    console.log('[POSPage] Order complete dialog closed. Server order ID:', serverOrderId, 'Client order ID:', clientOrderId);
    
    // For refund orders, do an additional check to fully remove from localStorage
    const isRefundOrder = completedOrder?.isRefund || 
                          localStorage.getItem(`completed_refund_${clientOrderId}`) === 'true';
    
    if (isRefundOrder) {
      console.log('[POSPage] Processing complete for refund order, ensuring complete removal from localStorage');
      
      try {
        // Make sure it's completely removed from localStorage
        const cartKey = `pos_cart_${clientOrderId}`;
        localStorage.removeItem(cartKey);
        
        // Also remove from pos_orders array
        const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        const filteredOrders = savedOrders.filter(order => order.id !== clientOrderId);
        
        if (savedOrders.length !== filteredOrders.length) {
          localStorage.setItem('pos_orders', JSON.stringify(filteredOrders));
          console.log('[POSPage] Successfully removed refund order from localStorage');
        }
        
        // Clean up refund flag
        localStorage.removeItem(`completed_refund_${clientOrderId}`);
      } catch (error) {
        console.error('[POSPage] Error cleaning up refund order:', error);
      }
    }
    
    // Dispatch an event to notify AppLayout that the order is completed
    // First close the client-side order (the tab)
    window.dispatchEvent(new CustomEvent('pos_order_completed', {
      detail: { 
        completedOrderId: clientOrderId,
        serverOrderId: serverOrderId,
        forceRemove: true,
        isRefundOrder: isRefundOrder
      }
    }));
    
    setCompletedOrder(null);
    
    // Create a new order tab after completing payment
    // Let AppLayout handle this based on the event
  };
  
  // ... existing code ...
  
  // ... existing code ...

  // Debug keyboard navigation test helper
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Add test function to window object
      window.testCartNavigation = () => {
        console.log('=== TESTING CART NAVIGATION ===');
        
        // Step 1: Log DOM structure
        const cartItems = document.querySelectorAll('[data-cart-item="true"]');
        console.log(`Found ${cartItems.length} cart items`);
        
        if (cartItems.length === 0) {
          console.log('No cart items found. Please add some products to cart first.');
          return;
        }
        
        // Log each cart item
        Array.from(cartItems).forEach((el, idx) => {
          const itemId = el.dataset.itemId;
          const name = el.innerText.split('\n')[0]; // First line is usually the name
          console.log(`Item ${idx}: ID=${itemId}, Name=${name}`);
        });
        
        // Step 2: Try focusing the first item
        console.log('\nTrying to focus the first item...');
        const firstItem = cartItems[0];
        const firstItemId = firstItem.dataset.itemId;
        
        if (window.cartState) {
          console.log(`Setting focusedItemId to ${firstItemId}`);
          window.cartState.focusedItemId = firstItemId;
          
          console.log('Dispatching cartItemFocus event');
          window.dispatchEvent(new CustomEvent('cartItemFocus'));
          
          console.log(`Current focused item: ${window.cartState.focusedItemId}`);
          
          // Step 3: Create synthetic keyboard events
          console.log('\nTesting keyboard events:');
          
          // Wait a bit then simulate DOWN arrow press
          setTimeout(() => {
            console.log('\nSimulating DOWN arrow key...');
            const downEvent = new KeyboardEvent('keydown', {
              key: 'ArrowDown',
              code: 'ArrowDown',
              keyCode: 40,
              which: 40,
              bubbles: true
            });
            
            document.dispatchEvent(downEvent);
            console.log(`After DOWN, focused item: ${window.cartState.focusedItemId}`);
            
            // Wait a bit then simulate UP arrow press
            setTimeout(() => {
              console.log('\nSimulating UP arrow key...');
              const upEvent = new KeyboardEvent('keydown', {
                key: 'ArrowUp',
                code: 'ArrowUp',
                keyCode: 38,
                which: 38,
                bubbles: true
              });
              
              document.dispatchEvent(upEvent);
              console.log(`After UP, focused item: ${window.cartState.focusedItemId}`);
              
              console.log('\n=== TEST COMPLETE ===');
              console.log('If the focusedItemId did not change after UP/DOWN key presses, there is a problem with the keyboard navigation.');
              console.log('Look for any console errors or check if event listeners are properly registered.');
              console.log('\nTo enable detailed debug mode, click the small bug icon on any cart item.');
            }, 500);
          }, 500);
        } else {
          console.log('window.cartState is not defined. Navigation cannot work.');
        }
      };
      
      console.log('Cart navigation test helper added. Run window.testCartNavigation() in console to test.');
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        // Remove test function when component unmounts
        delete window.testCartNavigation;
      }
    };
  }, []);

  // Add isRefundOrder calculation here
  // Use the existing isRefundOrder variable defined above (line 753)

  // Define handleCreateOrder with useCallback to avoid dependency issues
  const handleCreateOrder = useCallback((options = {}) => {
    console.log('🔶 handleCreateOrder called with options:', options);
    refundLog('handleCreateOrder called', options);
    
    if (!activePOSSession) {
      console.log('❌ No active POS session, cannot create order');
      refundLog('No active POS session, cannot create order', null, 'WARNING');
      toast({
        title: 'خطا',
        description: 'برای ایجاد سفارش باید ابتدا یک سشن POS فعال داشته باشید.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    // Generate a new unique order ID - for refunds, create a more traceable ID
    let newOrderId;
    if (options.isRefund && options.originalOrderId) {
      // Format: REFUND-{original_order_id} - simplified ID without timestamp
      newOrderId = `REFUND-${options.originalOrderId}`;
    } else {
      newOrderId = options.id || `${activePOSSession.id}-${Date.now()}`;
    }
    
    console.log('🆔 Generated new order ID:', newOrderId);
    refundLog('Generated new order ID', { newOrderId, isRefund: options.isRefund });
    setOrderId(newOrderId);
    
    // Create a new empty order or with provided items
    const newOrder = {
      id: newOrderId,
      sessionId: activePOSSession.id,
      name: options.isRefund 
        ? `بازگشت سفارش #${options.originalOrderId}` 
        : (options.name || `سفارش ${newOrderId}`),
      createdAt: new Date().toISOString(),
      status: 'active',
      cart: options.cart || [],
      customer: selectedCustomer,
      orderType: orderType,
      isRefund: options.isRefund || false,
      originalOrderId: options.originalOrderId || null
    };
    
    console.log('📝 Created new order object:', newOrder);
    if (options.isRefund) {
      refundLog('Created new refund order', {
        order: newOrder,
        cartItems: newOrder.cart.length,
        cartDetails: newOrder.cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          isRefund: !!item.isRefund || item.quantity < 0
        }))
      });
    }
    
    // Save the new order to localStorage
    const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    localStorage.setItem('pos_orders', JSON.stringify([...savedOrders, newOrder]));
    
    // Set the active order ID
    localStorage.setItem('pos_active_order_id', newOrderId);
    
    // For refund orders, explicitly create a tab in the header
    if (options.isRefund) {
      try {
        refundLog('Setting up refund order in UI', { newOrderId, originalOrderId: options.originalOrderId });
        
        // First notify AppLayout about new order
        window.dispatchEvent(new CustomEvent('pos_order_created', {
          detail: { 
            order: newOrder,
            shouldActivate: true // This will make it the active tab
          }
        }));
        
        // Then directly create and activate a tab for this order through the global posTabManager
        // First try our saved ref
        if (tabManagerRef.current && typeof tabManagerRef.current.addTab === 'function') {
          console.log('🧩 Creating new tab in header via tabManagerRef');
          refundLog('Creating new tab for refund via tabManagerRef');
          tabManagerRef.current.addTab({
            id: newOrderId,
            title: `بازگشت سفارش #${options.originalOrderId}`,
            type: 'pos_order',
            data: { orderId: newOrderId, isRefund: true },
            active: true
          });
        } 
        // Fall back to window.posTabManager
        else if (window.posTabManager && typeof window.posTabManager.addTab === 'function') {
          console.log('🧩 Creating new tab in header via window.posTabManager');
          refundLog('Creating new tab for refund via window.posTabManager');
          window.posTabManager.addTab({
            id: newOrderId,
            title: `بازگشت سفارش #${options.originalOrderId}`,
            type: 'pos_order',
            data: { orderId: newOrderId, isRefund: true },
            active: true
          });
          
          // Update our ref while we're at it
          tabManagerRef.current = window.posTabManager;
        } else {
          console.log('⚠️ posTabManager not available or missing addTab method');
          refundLog('posTabManager not available, using fallback event', null, 'WARNING');
          
          // Send a special event that AppLayout might be listening for
          window.dispatchEvent(new CustomEvent('pos_refund_order_created', {
            detail: { 
              id: newOrderId,
              title: `بازگشت سفارش #${options.originalOrderId}`,
              orderId: newOrderId,
              isRefund: true
            }
          }));
        }
      } catch (error) {
        console.error('❌ Error creating header tab for refund order:', error);
        refundLogError('Error creating header tab for refund order', error);
      }
    }
    
    // Update cart if items are provided
    if (options.cart && options.cart.length > 0) {
      console.log('🛒 Setting cart with provided items:', options.cart.length);
      if (options.isRefund) {
        refundLog('Setting cart with refund items', {
          itemCount: options.cart.length,
          items: options.cart.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            isRefund: !!item.isRefund || item.quantity < 0
          }))
        });
        
        // Save cart to localStorage immediately for refund orders
        saveCartToLocalStorage(newOrderId, options.cart);
      }
      setCart(options.cart);
    }
    
    toast({
      title: options.isRefund ? 'بازگشت آماده شد' : 'سفارش جدید ایجاد شد',
      description: options.isRefund 
        ? `بازگشت برای سفارش ${options.originalOrderId || 'نامشخص'} آماده شد`
        : `سفارش جدید با شناسه ${newOrderId} ایجاد شد`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
    
    console.log('✅ Order creation complete:', newOrderId);
    refundLog('Order creation complete', { newOrderId, isRefund: options.isRefund });
    return newOrderId;
  }, [activePOSSession, toast, setOrderId, selectedCustomer, orderType, setCart, tabManagerRef, saveCartToLocalStorage]);

  // Now add the useEffect for refund handling
  useEffect(() => {
    console.log('⚡ Refund check useEffect triggered');
    refundLog('Refund check useEffect triggered');
    
    // Check for refund items in localStorage
    try {
      const refundItemsJson = localStorage.getItem('refund_items');
      const refundOrderId = localStorage.getItem('refund_order_id');
      
      console.log('🔍 Checking localStorage for refund data:', { refundItemsJson: !!refundItemsJson, refundOrderId });
      refundLog('Checking localStorage for refund data', { hasRefundItems: !!refundItemsJson, refundOrderId });
      
      if (refundItemsJson && refundOrderId) {
        const refundItems = JSON.parse(refundItemsJson);
        
        console.log('📦 Parsed refund items:', refundItems);
        refundLog('Parsed refund items from localStorage', { itemCount: refundItems?.length, refundItems });
        
        if (refundItems && refundItems.length > 0) {
          console.log('✅ Valid refund items found:', refundItems.length);
          refundLog('Valid refund items found', { count: refundItems.length });
          
          // Clear the localStorage items after loading
          localStorage.removeItem('refund_items');
          localStorage.removeItem('refund_order_id');
          
          console.log('🧹 Cleared localStorage refund data');
          refundLog('Cleared localStorage refund data');
          
          // Create a new order for the refund if no active order exists or we have an active POS session
          console.log('💻 Active POS session:', !!activePOSSession, activePOSSession);
          refundLog('Active POS session status', { isActive: !!activePOSSession, sessionId: activePOSSession?.id });
          
          if (activePOSSession) {
            console.log('🛒 Creating refund order with handleCreateOrder');
            refundLog('Creating refund order with handleCreateOrder');
            
            // Create a deep copy of refund items to avoid any reference issues
            const refundItemsCopy = JSON.parse(JSON.stringify(refundItems));
            
            // Make sure all items have the isRefund flag and preserve originalQuantity 
            // Items may start with quantity 0 now, but we make sure quantity is negative
            const processedRefundItems = refundItemsCopy.map(item => ({
              ...item,
              isRefund: true,
              // If quantity is already negative, keep it, otherwise make it negative or start at 0
              quantity: item.quantity < 0 ? item.quantity : (item.quantity === 0 ? 0 : -Math.abs(item.quantity)),
              // Always preserve originalQuantity for validation
              originalQuantity: item.originalQuantity || Math.abs(item.quantity || 1)
            }));
            
            refundLog('Processed refund items before creating order', { 
              originalItems: refundItems.length,
              processedItems: processedRefundItems.length,
              items: processedRefundItems
            });
            
            // Create a new refund order with the processed items
            handleCreateOrder({
              name: `بازگشت برای سفارش #${refundOrderId}`,
              isRefund: true,
              originalOrderId: refundOrderId,
              cart: processedRefundItems
            });
            
            // Show toast
            toast({
              title: 'بازگشت آماده شد',
              description: `اقلام سفارش #${refundOrderId} برای بازگشت آماده شدند. لطفا پرداخت را پردازش کنید.`,
              status: 'info',
              duration: 5000,
              isClosable: true,
            });
          } else {
            console.log('⚠️ No active session, storing items for later');
            refundLog('No active session, storing refund items for later', null, 'WARNING');
            
            // Store the items for later when we have a session
            localStorage.setItem('pending_refund_items', refundItemsJson);
            localStorage.setItem('pending_refund_order_id', refundOrderId);
            
            toast({
              title: 'نیاز به سشن فعال',
              description: 'برای بازگشت سفارش باید ابتدا یک سشن POS فعال ایجاد کنید.',
              status: 'warning',
              duration: 5000,
              isClosable: true,
            });
          }
        } else {
          console.log('❌ No valid refund items found in parsed data');
          refundLog('No valid refund items found in parsed data', null, 'WARNING');
        }
      } else {
        console.log('❌ No refund data in localStorage');
        refundLog('No refund data in localStorage', null, 'DEBUG');
      }
    } catch (error) {
      console.error('❌ Error loading refund items:', error);
      refundLogError('Error loading refund items', error);
    }
  }, [activePOSSession, toast, handleCreateOrder]);

  // Add another effect to handle pending refunds when a session becomes active
  useEffect(() => {
    if (activePOSSession) {
      // Check for pending refund items
      try {
        const pendingRefundItemsJson = localStorage.getItem('pending_refund_items');
        const pendingRefundOrderId = localStorage.getItem('pending_refund_order_id');
        
        refundLog('Checking for pending refund items with active session', {
          hasItems: !!pendingRefundItemsJson,
          pendingRefundOrderId
        });
        
        if (pendingRefundItemsJson && pendingRefundOrderId) {
          const pendingRefundItems = JSON.parse(pendingRefundItemsJson);
          
          if (pendingRefundItems && pendingRefundItems.length > 0) {
            console.log('Found pending refund items in localStorage:', pendingRefundItems);
            refundLog('Found pending refund items', { 
              count: pendingRefundItems.length,
              items: pendingRefundItems
            });
            
            // Clear the localStorage items after loading
            localStorage.removeItem('pending_refund_items');
            localStorage.removeItem('pending_refund_order_id');
            
            // Create a deep copy to avoid reference issues
            const refundItemsCopy = JSON.parse(JSON.stringify(pendingRefundItems));
            
            // Make sure all items have the isRefund flag and negative quantities
            const processedRefundItems = refundItemsCopy.map(item => ({
              ...item,
              isRefund: true,
              quantity: item.quantity < 0 ? item.quantity : -Math.abs(item.quantity)
            }));
            
            refundLog('Processing pending refund items', {
              processedItems: processedRefundItems
            });
            
            // Create a new refund order
            handleCreateOrder({
              isRefund: true,
              originalOrderId: pendingRefundOrderId,
              cart: processedRefundItems
            });
            
            // Show toast
            toast({
              title: 'بازگشت آماده شد',
              description: `اقلام سفارش #${pendingRefundOrderId} برای بازگشت آماده شدند. لطفا پرداخت را پردازش کنید.`,
              status: 'info',
              duration: 5000,
              isClosable: true,
            });
          }
        }
      } catch (error) {
        console.error('Error handling pending refund items:', error);
        refundLogError('Error handling pending refund items', error);
      }
    }
  }, [activePOSSession, toast, handleCreateOrder]);

  // Add this effect to run once on component mount to check for refund data in localStorage
  useEffect(() => {
    console.log('🔄 Initial component mount check for refund data');
    
    try {
      // Check localStorage directly for refund items
      const refundItemsJson = localStorage.getItem('refund_items');
      const refundOrderId = localStorage.getItem('refund_order_id');
      
      console.log('🔍 Initial localStorage check:', { 
        refundItemsExists: !!refundItemsJson, 
        refundOrderId,
        activeSession: !!activePOSSession
      });
      
      if (refundItemsJson && refundOrderId) {
        // Found refund data in localStorage, process it
        console.log('✅ Found refund data in localStorage on initial mount');
        
        // Parse the refund items
        const refundItems = JSON.parse(refundItemsJson);
        
        if (refundItems && refundItems.length > 0) {
          console.log('📦 Parsed refund items on mount:', refundItems);
          
          // Clear localStorage to prevent duplicate processing
          localStorage.removeItem('refund_items');
          localStorage.removeItem('refund_order_id');
          
          // If we have an active session, create the refund order
          if (activePOSSession) {
            console.log('💼 Creating refund order with active session');
            // Short delay to ensure components are fully mounted
            setTimeout(() => {
              handleCreateOrder({
                name: `بازگشت برای سفارش #${refundOrderId}`,
                isRefund: true,
                originalOrderId: refundOrderId,
                cart: refundItems
              });
              
              toast({
                title: 'بازگشت آماده شد',
                description: `اقلام سفارش #${refundOrderId} برای بازگشت آماده شدند. لطفا پرداخت را پردازش کنید.`,
                status: 'info',
                duration: 5000,
                isClosable: true,
              });
            }, 500);
          } else {
            console.log('⚠️ No active session, storing for later');
            // Store for when session becomes active
            localStorage.setItem('pending_refund_items', refundItemsJson);
            localStorage.setItem('pending_refund_order_id', refundOrderId);
            
            toast({
              title: 'نیاز به سشن فعال',
              description: 'برای بازگشت سفارش باید ابتدا یک سشن POS فعال ایجاد کنید.',
              status: 'warning',
              duration: 5000,
              isClosable: true,
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Error processing refund data on mount:', error);
    }
  }, [activePOSSession, handleCreateOrder, toast]);

  // Add a separate useEffect to detect changes in localStorage for refund items
  useEffect(() => {
    const checkForRefundItems = () => {
      try {
        const refundItemsJson = localStorage.getItem('refund_items');
        const refundOrderId = localStorage.getItem('refund_order_id');
        
        refundLog('Regular check for refund items in localStorage', { 
          hasRefundItems: !!refundItemsJson,
          refundOrderId 
        });
    
        if (refundItemsJson && refundOrderId) {
          // Parse the refund items
          const parsedRefundItems = JSON.parse(refundItemsJson);
          
          if (!Array.isArray(parsedRefundItems)) {
            refundLog('Invalid refund items format', { refundItemsJson }, 'ERROR');
            return;
          }
          
          // Check if refund cart already exists
          const refundOrderKey = `REFUND-${refundOrderId}`;
          const existingRefundCart = localStorage.getItem(`pos_cart_${refundOrderKey}`);
          
          if (existingRefundCart) {
            refundLog('Refund cart already exists for this order, skipping creation', {
              refundOrderId,
              refundOrderKey,
              existingCart: existingRefundCart.substring(0, 100) + '...' // Show truncated cart data
            }, 'WARNING');
            
            // Still remove the temporary items to avoid duplication
            localStorage.removeItem('refund_items');
            localStorage.removeItem('refund_order_id');
            return;
          }
          
          // Log what we found before processing
          refundLog('Found refund items in localStorage', { 
            refundOrderId,
            itemCount: parsedRefundItems.length,
            items: parsedRefundItems
          });
          
          if (parsedRefundItems && parsedRefundItems.length > 0) {
            console.log('✅ Found refund items in localStorage after navigation');
            
            // Create a deep copy to avoid reference issues
            const refundItemsCopy = JSON.parse(JSON.stringify(parsedRefundItems));
            
            // Ensure all items are properly marked as refund items with negative quantities
            const processedItems = refundItemsCopy.map(item => ({
              ...item,
              isRefund: true,
              quantity: item.quantity < 0 ? item.quantity : -Math.abs(item.quantity),
              // Add a special flag to help troubleshoot
              _processedAt: new Date().toISOString()
            }));
            
            refundLog('Processed refund items', { 
              refundOrderId,
              originalItems: parsedRefundItems.length,
              processedItems: processedItems.length,
              beforeProcessing: parsedRefundItems[0],
              afterProcessing: processedItems[0]
            });
            
            // Clear localStorage - we'll use our own memory and storage
            localStorage.removeItem('refund_items');
            localStorage.removeItem('refund_order_id');
            
            refundLog('Cleared original refund items from localStorage');
            
            if (activePOSSession) {
              // Create a refund order with slight delay to ensure state is ready
              setTimeout(() => {
                refundLog('Creating refund order after slight delay');
                
                // Double check there's no existing cart for this order again
                // (race condition protection)
                if (localStorage.getItem(`pos_cart_${refundOrderKey}`)) {
                  refundLog('Refund cart created by another process, skipping duplicate creation', {
                    refundOrderKey
                  }, 'WARNING');
                  return;
                }
                
                // First save these items directly to localStorage with the correct key
                // This ensures they're available even if handleCreateOrder fails
                const refundCartKey = `pos_cart_${refundOrderKey}`;
                const cartJson = JSON.stringify(processedItems);
                localStorage.setItem(refundCartKey, cartJson);
                
                // Verify the cart was saved correctly
                const savedCart = localStorage.getItem(refundCartKey);
                if (!savedCart) {
                  refundLog('Failed to save refund cart to localStorage', {
                    refundOrderKey,
                    refundCartKey,
                    itemCount: processedItems.length
                  }, 'ERROR');
                } else {
                  refundLog('Proactively saved refund cart to localStorage', {
                    refundOrderKey,
                    refundCartKey,
                    itemCount: processedItems.length,
                    savedSizeBytes: savedCart.length
                  });
                }
                
                // Now create the order
                handleCreateOrder({
                  isRefund: true,
                  originalOrderId: refundOrderId,
                  cart: processedItems,
                  id: refundOrderKey  // Force the exact ID we want
                });
                
                // Show a more prominent notification
                toast({
                  title: 'بازگشت آماده شد',
                  description: `اقلام سفارش #${refundOrderId} برای بازگشت آماده شدند. لطفا پرداخت را پردازش کنید.`,
                  status: 'info',
                  duration: 5000,
                  position: 'top',
                  isClosable: true,
                });
              }, 300);
            } else {
              // Store for when session becomes active
              refundLog('No active session, storing refund items for later', { refundOrderId });
              localStorage.setItem('pending_refund_items', JSON.stringify(processedItems));
              localStorage.setItem('pending_refund_order_id', refundOrderId);
              
              toast({
                title: 'نیاز به سشن فعال',
                description: 'برای بازگشت سفارش باید ابتدا یک سشن POS فعال ایجاد کنید.',
                status: 'warning',
                duration: 5000,
                isClosable: true,
              });
            }
          }
        }
      } catch (error) {
        console.error('❌ Error checking for refund items:', error);
        refundLogError('Error checking for refund items', error);
      }
    };
    
    // Run once on component mount
    checkForRefundItems();
    
    // Also set up an interval to check periodically (useful when navigating between pages)
    const interval = setInterval(checkForRefundItems, 1000);
    
    // Clean up the interval when component unmounts
    return () => clearInterval(interval);
  }, [activePOSSession, handleCreateOrder, toast]);

  // Listen for clicks on the cart area to save quantities
  useEffect(() => {
    const handleCartClick = (event) => {
      // Don't trigger for clicks on the cart items themselves
      // Check if the click is on a cart item or input field
      const clickedOnCartItem = event.target.closest('[data-cart-item="true"]');
      const clickedOnInput = event.target.tagName === 'INPUT';
      const clickedOnQuantityButton = event.target.closest('[data-quantity-button="true"]');
      const clickedOnProductItem = event.target.closest('[data-product-item="true"]');
      
      // Only force save if clicked outside of cart items OR clicked on a quantity button
      // This prevents constant resets when adding products or interacting with cart items
      if ((!clickedOnCartItem && !clickedOnProductItem) || clickedOnQuantityButton) {
        console.log(`[POSPage] Cart click - outside item or on quantity button - checking for modified inputs`);
        
        // Force save only modified cart quantities
        if (typeof window.dispatchEvent === 'function') {
          // Get all cart items that have been explicitly marked as modified
          const modifiedInputs = document.querySelectorAll('[data-quantity-modified="true"]');
          
          if (modifiedInputs && modifiedInputs.length > 0) {
            console.log(`[POSPage] Saving ${modifiedInputs.length} modified quantity inputs`);
            
            modifiedInputs.forEach(inputEl => {
              const itemId = inputEl.dataset.itemId;
              if (itemId) {
                console.log(`[POSPage] Saving modified quantity for item ${itemId}`);
                window.dispatchEvent(new CustomEvent('forceSaveQuantity', {
                  detail: { itemId: itemId, forceSync: true }
                }));
                
                // Clear the modified flag
                inputEl.removeAttribute('data-quantity-modified');
              }
            });
          }
        }
      }
    };
    
    // Find cart container
    const cartContainer = document.querySelector('[data-cart-container="true"]');
    if (cartContainer) {
      cartContainer.addEventListener('click', handleCartClick);
      
      return () => {
        cartContainer.removeEventListener('click', handleCartClick);
      };
    }
  }, []);

  // State for refund debugging
  const { isOpen: isRefundDebuggerOpen, onOpen: onRefundDebuggerOpen, onClose: onRefundDebuggerClose } = useDisclosure();

  useEffect(() => {
    // Fetch data when component mounts
    fetchData();
    
    // Listen for POS session updates
    const handlePOSSessionUpdate = (e) => {
      // This is triggered when closing a POS session or changing sessions
      if (e.detail && e.detail.session) {
        setActivePOSSession(e.detail.session);
      }
    };
    
    window.addEventListener('pos_session_update', handlePOSSessionUpdate);
    
    // Listen for customer management modal open event
    const handleOpenCustomerManagement = () => {
      console.log('[POSPage] Received event to open customer management');
      onCustomersModalOpen();
    };
    
    window.addEventListener('pos_open_customer_management', handleOpenCustomerManagement);
    
    return () => {
      window.removeEventListener('pos_session_update', handlePOSSessionUpdate);
      window.removeEventListener('pos_open_customer_management', handleOpenCustomerManagement);
    };
  }, [fetchData, onCustomersModalOpen]);

  return (
    <Box bg="gray.50" h="100vh" overflow="hidden" position="relative">
      {isLoading ? (
      <Flex height="100vh" alignItems="center" justifyContent="center">
        <VStack spacing={4}>
          <Spinner size="xl" thickness="4px" speed="0.65s" color="blue.500" />
            <Text>Loading data, please wait...</Text>
        </VStack>
      </Flex>
      ) : showPOSUI ? (
      <Grid
          templateColumns={{ base: "1fr", md: "3fr 1fr" }}
        gap={2}
        p={2}
          h="calc(100vh - 5px)"
          overflow="hidden"
          position="absolute"
          top="5px"
          left="0"
          right="0"
          bottom="0"
      >
        {/* Products section */}
          <GridItem bg="white" p={3} borderRadius="md" shadow="sm" display="flex" flexDirection="column" overflow="hidden">
            {/* Category selection with horizontal scroll */}
            <Box mb={1} overflow="hidden">
              <Box overflowX="auto" pb={1}>
                <Tabs variant="soft-rounded" colorScheme="blue" size="sm">
                  <TabList whiteSpace="nowrap" width="max-content" minWidth="100%">
                    <Tab onClick={() => setSelectedCategory(null)}>All</Tab>
                    {categories.map(category => (
                      <Tab 
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        bg={selectedCategory === category.id ? "blue.100" : categoryColors[category.id] || undefined}
                        _hover={{ bg: selectedCategory === category.id ? "blue.100" : "gray.100" }}
                      >
                        {category.name}
                      </Tab>
                    ))}
                  </TabList>
                </Tabs>
              </Box>
            </Box>
            
            {/* Products grid */}
            <Box flex="1" overflowY="auto">
            {isLoading ? (
                <Flex justify="center" align="center" h="200px">
                  <Spinner size="xl" color="blue.500" />
              </Flex>
            ) : filteredProducts.length > 0 ? (
                <SimpleGrid columns={{ base: 2, sm: 3, md: 5, lg: 7, xl: 10 }} spacing={3}>
                {filteredProducts.map(product => (
                  <ProductItem
                    key={product.id}
                    product={product}
                    onSelect={handleAddToCart}
                    categoryColor={getProductCategoryColor(product)}
                  />
                ))}
              </SimpleGrid>
            ) : (
              <Flex justify="center" align="center" h="100px">
                <Text color="gray.500">No products found</Text>
              </Flex>
            )}
          </Box>
        </GridItem>
        
        {/* Cart section - with adjusted height for header */}
        <GridItem bg="white" p={4} borderRadius="md" shadow="sm" display="flex" flexDirection="column" h="calc(100vh - 48px)" overflow="hidden">
          {/* Cart header */}
          <Flex justify="space-between" align="center" mb={2}>
            <Heading size="md">Order #{orderId || "New"}</Heading>
            <HStack spacing={2}>
              <OrderType 
                onChange={handleOrderTypeChange} 
                initialType={orderType}
                showLabel={false}
              />
            <Button
              leftIcon={<FiUser />}
              variant="outline"
              onClick={onCustomerSelectorOpen}
              colorScheme={selectedCustomer ? "blue" : "gray"}
              size="sm"
            >
              {selectedCustomer ? selectedCustomer.name : "انتخاب مشتری"}
            </Button>
            </HStack>
          </Flex>
          
          {/* Customer info if selected */}
          {selectedCustomer && (
            <Box mb={2} p={2} bg="blue.50" borderRadius="md">
              <Flex justify="space-between" align="center">
                <HStack>
                  <FiUser />
                  <Text fontWeight="medium">{selectedCustomer.name}</Text>
                </HStack>
                <IconButton
                  size="xs"
                  icon={<FiX />}
                  aria-label="Remove customer"
                  variant="ghost"
                  onClick={handleRemoveCustomer}
                />
              </Flex>
              {selectedCustomer.phone && (
                <Text fontSize="sm" color="gray.600" mt={1}>
                  تلفن: {selectedCustomer.phone}
                </Text>
              )}
              {selectedCustomer.mobile && (
                <Text fontSize="sm" color="gray.600" mt={1}>
                  موبایل: {selectedCustomer.mobile}
                </Text>
              )}
            </Box>
          )}
          
          {/* Cart items - scrollable */}
          <Box flex="1" overflowY="auto" mb={2} data-cart-container="true">
            {cart.length > 0 ? (
              <VStack spacing={1} align="stretch" divider={<Divider />}>
                {cart.map(item => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemove={handleRemoveItem}
                    onUpdateDiscount={handleUpdateDiscount}
                  />
                ))}
              </VStack>
            ) : (
              <Flex justify="center" align="center" h="100%">
                <Text color="gray.500">Cart is empty</Text>
              </Flex>
            )}
          </Box>
          
          {/* Order summary - fixed at bottom */}
          <Box>
            <Divider mb={2} />
            <HStack justify="space-between" mb={1}>
              <Text>Subtotal</Text>
              <Text fontWeight="bold">${cartTotal.toFixed(2)}</Text>
            </HStack>
            {totalDiscount > 0 && (
              <HStack justify="space-between" mb={1}>
                <Text>Discount</Text>
                <Text fontWeight="bold" color="green.500">-${totalDiscount.toFixed(2)}</Text>
              </HStack>
            )}
            <HStack justify="space-between" mb={2}>
              <Text>Tax (15%)</Text>
              <Text fontWeight="bold">${taxAmount.toFixed(2)}</Text>
            </HStack>
            <HStack justify="space-between" mb={3}>
              <Text fontSize="lg" fontWeight="bold">Total</Text>
              <Text fontSize="lg" fontWeight="bold" color="primary.500">
                ${finalTotal.toFixed(2)}
              </Text>
            </HStack>
            
            {/* Action buttons */}
            <Button
              leftIcon={isRefundOrder ? <FiRefreshCw /> : <FiDollarSign />}
              colorScheme={isRefundOrder ? "red" : "green"}
              size="lg"
              w="full"
              isLoading={isLoading}
              onClick={() => handleOpenPaymentScreen()}
              isDisabled={cart.length === 0}
              mt={1}
              mb={4}
            >
              {isRefundOrder ? "پردازش بازگشت" : "پردازش پرداخت"}
            </Button>
          </Box>
        </GridItem>
      </Grid>
      ) : (
        <SessionSelectionScreen />
      )}

      {/* Sidebar overlay - visible when sidebar is open */}
      {posSidebarOpen && (
        <Box
          position="fixed"
          top="0"
          left="0"
          width="250px"
          height="100vh"
          bg="white"
          boxShadow="lg"
          zIndex="5"
          p={4}
          transition="0.3s"
          overflowY="auto"
        >
          {/* <VStack align="stretch" spacing={4}>
            <Heading size="md">POS Menu</Heading>
            <Divider />
            <Button leftIcon={<FiSettings />} variant="ghost" justifyContent="flex-start" onClick={onSessionModalOpen}>
              POS Sessions
            </Button>
            <Button 
              w="full" 
              colorScheme="purple" 
              variant="ghost" 
              justifyContent="flex-start" 
              leftIcon={<FiShoppingBag />} 
              onClick={handleProductsClick}
              mb={2}
            >
              مدیریت محصولات
            </Button>
            
                <Button
              w="full"
              colorScheme="blue"
              variant="ghost"
                  justifyContent="flex-start"
              leftIcon={<FiList />}
              onClick={handleCategoriesClick}
              mb={2}
            >
              مدیریت دسته‌بندی‌ها
                </Button>
                
                  <Button
              w="full"
              colorScheme="teal"
              variant="ghost"
                    justifyContent="flex-start"
              leftIcon={<FiUsers />}
              onClick={handleCustomersClick}
              mb={2}
            >
              مدیریت مشتریان
                  </Button>
              
              <Button
              w="full"
              colorScheme="blue"
              variant="ghost"
              justifyContent="flex-start"
              leftIcon={<FiFileText />}
              onClick={() => navigate('/orders')}
              mb={2}
            >
              مدیریت سفارش‌ها
                  </Button>
              
              <Button
              w="full"
              colorScheme="purple"
              variant="ghost"
              justifyContent="flex-start"
              leftIcon={<FiSettings />}
              onClick={handleSettingsClick}
              mb={2}
            >
              تنظیمات
              </Button>
            
            <Divider />
            <Button leftIcon={<FiLogOut />} variant="ghost" justifyContent="flex-start" colorScheme="red" onClick={handleLogout}>
              Logout
            </Button>
          </VStack> */}
        </Box>
      )}

      {/* Backdrop for sidebar - closes sidebar when clicked */}
      {posSidebarOpen && (
        <Box
          position="fixed"
          top="0"
          left="0"
          width="100vw"
          height="100vh"
          bg="blackAlpha.300"
          zIndex="4"
          onClick={() => setPOSSidebarOpen(false)}
        />
      )}

      {/* Existing modals */}
      {/* Session Management Modal */}
      <SessionManagementModal
        isOpen={isSessionModalOpen}
        onClose={onSessionModalClose}
      />
      
      {/* Categories Management Modal */}
      <CategoryManagementModal
        isOpen={isCategoriesModalOpen}
        onClose={onCategoriesModalClose}
        categories={categories}
        products={products}
        updateCategories={setCategories}
        categoryColors={categoryColors}
        updateCategoryColors={setCategoryColors}
        categoryService={categoryService}
      />
      
      {/* Products Management Modal */}
      <ProductManagementModal
        isOpen={isProductsModalOpen}
        onClose={onProductsModalClose}
      />
      
      {/* Customers Management Modal */}
      <CustomerManagementModal
        isOpen={isCustomersModalOpen}
        onClose={onCustomersModalClose}
      />
      
      {/* Customer Selector Modal */}
      <CustomerSelectorModal
        isOpen={isCustomerSelectorOpen}
        onClose={onCustomerSelectorClose}
        onSelectCustomer={handleSelectCustomer}
        onAddNewCustomer={() => {
          onCustomerSelectorClose();
          onCustomersModalOpen();
        }}
      />
      
      {/* Delete Category Confirmation */}
      <DeleteCategoryConfirmation />
      
      {/* Payment Modal */}
      <PaymentScreen
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        cartTotal={cartTotal}
        taxAmount={taxAmount}
        totalDiscount={totalDiscount}
        totalToPay={finalTotal}
        selectedCustomer={selectedCustomer}
        cart={cart}
        activePOSSession={activePOSSession}
        onPaymentComplete={handlePaymentComplete}
        orderId={orderId}
        orderType={orderType}
      />
      
      {/* Order Complete Modal */}
      {completedOrder && (
        <OrderComplete
          isOpen={isOrderCompleteOpen}
          onClose={handleOrderCompleteClose}
          order={completedOrder}
          customer={selectedCustomer}
        />
      )}
    </Box>
  );
};

export default POSPage; 