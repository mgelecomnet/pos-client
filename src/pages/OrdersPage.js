import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Icon,
  Button,
  Table,
  Thead,
  Tbody,
  Tfoot,
  Tr,
  Th,
  Td,
  Badge,
  Spinner,
  useToast,
  HStack,
  VStack,
  Card,
  CardBody,
  SimpleGrid,
  IconButton,
  Tooltip,
  Divider,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Input,
  InputGroup,
  InputLeftElement,
  FormControl
} from '@chakra-ui/react';
import {
  FiRefreshCw,
  FiCloudOff,
  FiCloud,
  FiCheckCircle,
  FiAlertTriangle,
  FiClock,
  FiEye,
  FiX,
  FiHome,
  FiShoppingBag,
  FiTruck,
  FiExternalLink,
  FiSearch
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { openDB } from 'idb';

import offlineOrderService, { OFFLINE_ORDER_STATUS } from '../api/offlineOrderService';
import { connectionStatus } from '../api/odoo';
import OrderDetailsModal from '../components/OrderDetailsModal';

const DB_NAME = 'POSDatabase';
const DB_VERSION = 4;

const OrdersPage = ({ isOpen = true, onClose = () => {}, isModal = false }) => {
  // Get context from AppLayout

  
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOnline, setIsOnline] = useState(connectionStatus.isOnline);
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
  const toast = useToast();
  const navigate = useNavigate();
  const [currency, setCurrency] = useState({ symbol: '$', position: 'before', name: 'USD' });
  const [taxes, setTaxes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOrders, setFilteredOrders] = useState([]);

  // Format price with currency
  const formatPrice = useCallback((amount) => {
    // Handle undefined, null, or NaN values
    const validAmount = Number(amount) || 0;
    const formattedAmount = validAmount.toLocaleString();
    return currency.position === 'after' 
      ? `${formattedAmount} ${currency.symbol}`
      : `${currency.symbol}${formattedAmount}`;
  }, [currency]);

  // Calculate tax for an item
  const calculateTax = useCallback((price, taxIds = []) => {
    if (!price || !Array.isArray(taxIds) || !taxes.length) return 0;
    
    return taxIds.reduce((total, taxId) => {
      const tax = taxes.find(t => t.id === taxId);
      if (!tax) return total;
      
      return total + (price * (tax.amount / 100));
    }, 0);
  }, [taxes]);

  // Transform order lines with tax calculation
  const transformOrderLines = useCallback((lines) => {
    if (!Array.isArray(lines)) return [];
    
    return lines.map((line, index) => {
      if (!Array.isArray(line)) {
        console.warn('⚠️ Invalid line format:', line);
        return null;
      }

      // Product details are in the third element (index 2) of each line array
      const productDetails = line[2] || {};
      console.log(`🛍️ Product details from line ${index}:`, productDetails);

      // Ensure all numeric values have defaults
      // Try to extract quantity from multiple possible sources in the order line data
      const quantity = Number(productDetails.qty || productDetails.quantity || line[1] || 1);
      const price = Number(productDetails.price_unit || productDetails.list_price || 0);
      const discount = Number(productDetails.discount || 0);
      const priceAfterDiscount = price * (1 - discount / 100);
      const taxAmount = calculateTax(priceAfterDiscount * quantity, productDetails.tax_ids || []);
      const total = (priceAfterDiscount * quantity) + taxAmount;

      return {
        id: productDetails.id || `temp_${index}`,
        name: productDetails.full_product_name || productDetails.name || 'Unknown Product',
        price_unit: price,
        qty: quantity,
        quantity: quantity,  // Store both qty and quantity fields for compatibility
        discount: discount,
        tax_amount: taxAmount,
        total: total
      };
    }).filter(Boolean); // Remove any null items
  }, [calculateTax]);

  // Load orders callback
  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Starting to load orders...');
      
      const offlineOrders = await offlineOrderService.getOfflineOrders();
      console.log('📦 Raw offline orders:', offlineOrders);
      
      const transformedOfflineOrders = offlineOrders.map(order => {
        console.log('🔍 Processing order:', order);
        
        const orderData = order.orderData?.data || {};
        console.log('📄 Order data:', orderData);
        
        const lines = orderData.lines || [];
        console.log('📝 Raw order lines:', lines);
        
        let items = [];
        
        // Handle different data formats for order items
        if (Array.isArray(lines) && lines.length > 0) {
          items = transformOrderLines(lines, orderData);
        } else if (Array.isArray(orderData.items) && orderData.items.length > 0) {
          // Handle case where items are already in a simpler format
          items = orderData.items.map(item => {
            // محاسبه قیمت پایه و تخفیف
            const basePrice = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 1;
            const discount = Number(item.discount) || 0;
            
            // محاسبه قیمت بعد از تخفیف
            const priceAfterDiscount = basePrice * (1 - discount / 100);
            
            // محاسبه مبلغ خالص (بدون مالیات)
            const subtotal = priceAfterDiscount * quantity;
            
            // محاسبه مالیات (اگر tax_ids موجود باشد از آن استفاده می‌کنیم، در غیر این صورت از نرخ پیش‌فرض)
            let taxAmount = 0;
            if (item.tax_ids && Array.isArray(item.tax_ids)) {
              taxAmount = calculateTax(subtotal, item.tax_ids);
            } else if (item.tax_amount !== undefined) {
              taxAmount = Number(item.tax_amount) || 0;
            } else if (item.price_with_tax !== undefined && item.price !== undefined) {
              // اگر قیمت با مالیات و بدون مالیات هر دو موجود باشند
              const taxRate = (item.price_with_tax / item.price) - 1;
              taxAmount = subtotal * taxRate;
            } else if (orderData.amount_tax && orderData.amount_total && orderData.amount_total > 0) {
              // استفاده از نرخ مالیات کلی سفارش
              const orderTaxRate = orderData.amount_tax / (orderData.amount_total - orderData.amount_tax);
              taxAmount = subtotal * orderTaxRate;
            } else {
              // در غیر این صورت فرض کنیم مالیات 15% است (قابل تنظیم)
              const defaultTaxRate = 0.15; // 15%
              taxAmount = subtotal * defaultTaxRate;
            }
            
            // محاسبه کل
            const total = subtotal + taxAmount;
            
            return {
              id: item.id,
              name: item.name,
              price_unit: basePrice,
              qty: quantity,
              quantity: quantity,
              discount: discount,
              tax_amount: taxAmount,
              total: total
            };
          });
        }
        
        console.log('✨ Transformed items:', items);
        
        // Calculate total with null check, ensuring tax amounts are included
        const total = items.reduce((sum, item) => {
          // Handle different possible structures
          const itemTotal = Number(item?.total) || 0;
          
          // If total already includes tax (as it should from our transform above), use it
          return sum + itemTotal;
        }, 0);
        
        // Double check if order has explicit amount_total and it's different from our calculation
        const orderDataTotal = Number(orderData.amount_total) || 0;
        
        // If the order has an explicit amount_total and it's significantly different (more than 1 unit),
        // use that instead, as it's likely to be more accurate
        const finalTotal = (orderDataTotal > 0 && Math.abs(orderDataTotal - total) > 1)
          ? orderDataTotal
          : total;
          
        console.log('💰 Calculated total:', total, 'Order data total:', orderDataTotal, 'Using:', finalTotal);

        return {
          id: order.orderId || orderData.id || order.localId,
          localId: order.localId,
          status: order.syncStatus === OFFLINE_ORDER_STATUS.SYNCED ? 'completed' : 'pending',
          syncStatus: order.syncStatus || OFFLINE_ORDER_STATUS.PENDING,
          createdAt: order.timestamp || orderData.date_order,
          syncedAt: order.syncDate,
          orderType: orderData.order_type || orderData.orderType || 'dine_in',
          items: items || [],
          total: finalTotal || 0,
          source: 'offline',
          details: orderData
        };
      });
      
      // Sort orders by date (newest first)
      const sortedOrders = transformedOfflineOrders.sort((a, b) => {
        // Convert to Date objects for proper comparison
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        // Sort descending (newest first)
        return dateB - dateA;
      });
      
      console.log('📊 All transformed orders:', sortedOrders);
      setOrders(sortedOrders);
      setFilteredOrders(sortedOrders);
      
    } catch (error) {
      console.error('❌ Error loading orders:', error);
      toast({
        title: 'Error Loading Orders',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [transformOrderLines, toast]);

  // Load POS data on component mount
  const loadPOSData = useCallback(async () => {
    try {
      const db = await openDB(DB_NAME, DB_VERSION);
      
      // Get currency info
      const posData = await db.get('pos_raw_data', 'pos_data');
      if (posData?.currency) {
        setCurrency({
          position: posData.currency.position || 'before',
          symbol: posData.currency.symbol || '$',
          name: posData.currency.name || 'USD'
        });
        console.log('💰 Loaded currency:', posData.currency);
      }

      // Get taxes
      if (posData?.taxes) {
        setTaxes(posData.taxes);
        console.log('💸 Loaded taxes:', posData.taxes);
      }
    } catch (error) {
      console.error('Error loading POS data:', error);
    }
  }, []);

  // Load orders on component mount or when modal opens
  useEffect(() => {
    if (isOpen) {
      loadPOSData();
      loadOrders();
      // Reset search query when modal opens
      setSearchQuery('');
    }
    
    // Add connection status listener
    const handleStatusChange = (status) => {
      setIsOnline(status);
    };
    
    connectionStatus.addListener(handleStatusChange);
    
    // Clean up
    return () => {
      connectionStatus.removeListener(handleStatusChange);
    };
  }, [loadPOSData, loadOrders, isOpen]);

  // Sync all pending orders
  const syncAllOrders = async () => {
    if (isSyncing) return;
    
    // Check if we're online
    if (!isOnline) {
      toast({
        title: 'آفلاین',
        description: 'نمی‌توان سفارش‌ها را در حالت آفلاین همگام‌سازی کرد',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    console.log('🔄 Starting to sync all pending orders...');
    
    // Get an accurate count of pending orders first to avoid false syncs
    const pendingCount = await offlineOrderService.getPendingOrdersCount();
    console.log(`🔢 Actual pending orders count: ${pendingCount}`);
    
    if (pendingCount === 0) {
      toast({
        title: 'بدون همگام‌سازی',
        description: 'سفارش در انتظار همگام‌سازی یافت نشد',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsSyncing(true);
    try {
      const result = await offlineOrderService.syncAllPendingOrders();
      console.log('✅ Sync result:', result);
      
      if (result.successful > 0) {
        toast({
          title: 'همگام‌سازی موفق',
          description: `${result.successful} سفارش با موفقیت همگام‌سازی شد`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else if (result.failed > 0) {
        toast({
          title: 'مشکل در همگام‌سازی',
          description: `همگام‌سازی ${result.failed} سفارش با خطا مواجه شد`,
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'بدون همگام‌سازی',
          description: 'سفارش در انتظار همگام‌سازی یافت نشد',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      }
      
      // Refresh the orders list
      await loadOrders();
    } catch (error) {
      console.error('❌ Error syncing orders:', error);
      toast({
        title: 'خطای همگام‌سازی',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Sync a specific order
  const syncOrder = async (orderId) => {
    if (isSyncing) return;
    
    console.log('🔄 Starting to sync order:', orderId);
    
    // Check if we're online
    if (!isOnline) {
      console.log('❌ Cannot sync - offline');
      toast({
        title: 'آفلاین',
        description: 'نمی‌توان سفارش را در حالت آفلاین همگام‌سازی کرد',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    // Check if the order really needs syncing
    const needsSync = await offlineOrderService.needsSync(orderId);
    if (!needsSync) {
      console.log('⏭️ Order already synced, skipping:', orderId);
      toast({
        title: 'سفارش همگام شده',
        description: 'این سفارش قبلاً همگام‌سازی شده است',
        status: 'info',
        duration: 3000, 
        isClosable: true,
      });
      return;
    }
    
    setIsSyncing(true);
    try {
      console.log('🌐 Syncing order with server...');
      const result = await offlineOrderService.syncOrder(orderId);
      console.log('✅ Sync result:', result);
      
      if (result.success) {
        toast({
          title: 'همگام‌سازی موفق',
          description: `سفارش با موفقیت همگام‌سازی شد. شناسه سرور: ${result.serverOrderId}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        console.error('❌ Sync failed:', result.error);
        toast({
          title: 'خطای همگام‌سازی',
          description: result.error || 'همگام‌سازی سفارش با خطا مواجه شد',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
      
      // Refresh the orders list
      await loadOrders();
    } catch (error) {
      console.error('❌ Error syncing order:', error);
      toast({
        title: 'خطای همگام‌سازی',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSyncing(false);
    }
  };
  
  // View order details
  const viewOrderDetails = (order) => {
    console.log('👁️ Viewing order details:', order);
    setSelectedOrder(order);
    onDetailOpen();
  };

  // States for the full order details modal
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const { isOpen: isFullDetailOpen, onOpen: onFullDetailOpen, onClose: onFullDetailClose } = useDisclosure();

  // Open the full order details modal
  const navigateToOrderDetails = (orderId) => {
    setSelectedOrderId(orderId);
    onFullDetailOpen();
  };
  
  // Get status badge for an order
  const getStatusBadge = (order) => {
    if (order?.syncStatus === OFFLINE_ORDER_STATUS.SYNCED) {
      return (
        <Badge colorScheme="green" display="flex" alignItems="center">
          <Icon as={FiCheckCircle} mr={1} />
          <Text>همگام‌سازی شده</Text>
        </Badge>
      );
    } else if (order?.syncStatus === OFFLINE_ORDER_STATUS.FAILED) {
      return (
        <Badge colorScheme="red" display="flex" alignItems="center">
          <Icon as={FiAlertTriangle} mr={1} />
          <Text>خطا در همگام‌سازی</Text>
        </Badge>
      );
    } else if (order?.syncStatus === OFFLINE_ORDER_STATUS.DRAFT) {
      return (
        <Badge colorScheme="purple" display="flex" alignItems="center">
          <Icon as={FiClock} mr={1} />
          <Text>پیش‌نویس</Text>
        </Badge>
      );
    } else {
      return (
        <Badge colorScheme="yellow" display="flex" alignItems="center">
          <Icon as={FiClock} mr={1} />
          <Text>در انتظار همگام‌سازی</Text>
        </Badge>
      );
    }
  };
  
  // Get order type badge
  const getOrderTypeBadge = (orderType) => {
    switch(orderType) {
      case 'takeout':
        return (
          <Badge colorScheme="blue" display="flex" alignItems="center">
            <Icon as={FiShoppingBag} mr={1} />
            <Text>بیرون‌بر</Text>
          </Badge>
        );
      case 'delivery':
        return (
          <Badge colorScheme="purple" display="flex" alignItems="center">
            <Icon as={FiTruck} mr={1} />
            <Text>تحویل</Text>
          </Badge>
        );
      case 'dine_in':
      default:
        return (
          <Badge colorScheme="green" display="flex" alignItems="center">
            <Icon as={FiHome} mr={1} />
            <Text>صرف در محل</Text>
          </Badge>
        );
    }
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'ثبت نشده';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  const renderOrderRow = (order) => (
    <Tr key={order?.id || 'unknown'}>
      <Td>{order?.id || 'N/A'}</Td>
      <Td>{formatDate(order?.createdAt)}</Td>
      <Td>{getStatusBadge(order)}</Td>
      <Td>{getOrderTypeBadge(order?.orderType)}</Td>
      <Td isNumeric>{order?.items?.length || 0}</Td>
      <Td isNumeric>{formatPrice(order?.total)}</Td>
      <Td>
        <HStack spacing={2}>
          {(order?.syncStatus === OFFLINE_ORDER_STATUS.PENDING || 
            order?.syncStatus === OFFLINE_ORDER_STATUS.DRAFT || 
            order?.syncStatus === OFFLINE_ORDER_STATUS.FAILED) && (
            <Tooltip label="همگام‌سازی سفارش">
              <IconButton
                icon={<FiRefreshCw />}
                size="sm"
                colorScheme="blue"
                isLoading={isSyncing}
                onClick={() => syncOrder(order.id)}
              />
            </Tooltip>
          )}
          <Tooltip label="مشاهده جزئیات">
            <IconButton
              icon={<FiEye />}
              size="sm"
              onClick={() => viewOrderDetails(order)}
            />
          </Tooltip>
        </HStack>
      </Td>
    </Tr>
  );

  const renderOrderDetails = () => {
    if (!selectedOrder) return null;
    
    // Log order details for debugging
    console.log('🔄 Rendering order details:', selectedOrder);
    console.log('📋 Order items:', selectedOrder.items);
    
    return (
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>نام محصول</Th>
            <Th isNumeric>تعداد</Th>
            <Th isNumeric>قیمت واحد</Th>
            <Th isNumeric>تخفیف</Th>
            <Th isNumeric>مالیات</Th>
            <Th isNumeric>جمع</Th>
          </Tr>
        </Thead>
        <Tbody>
          {(selectedOrder.items || []).map((item, idx) => {
            // Extract quantity from multiple possible sources, preferring quantity over qty
            const itemQuantity = item.quantity || item.qty || 0;
            
            return (
            <Tr key={item?.id || idx}>
              <Td>{item?.name || 'N/A'}</Td>
                <Td isNumeric>{itemQuantity}</Td>
              <Td isNumeric>{formatPrice(item?.price_unit)}</Td>
              <Td isNumeric>{item?.discount > 0 ? `${item.discount}%` : '-'}</Td>
              <Td isNumeric>
                {item?.tax_amount > 0 
                  ? `${formatPrice(item?.tax_amount)} (15%)`
                  : `${formatPrice((item?.price_unit || 0) * itemQuantity * 0.15)} (15%)`
                }
              </Td>
              <Td isNumeric>{formatPrice(item?.total)}</Td>
            </Tr>
            );
          })}
        </Tbody>
        <Tfoot>
          <Tr>
            <Th colSpan={4}></Th>
            <Th isNumeric>جمع کل:</Th>
            <Th isNumeric>{formatPrice(selectedOrder?.total)}</Th>
          </Tr>
        </Tfoot>
      </Table>
    );
  };

  // Filter orders based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredOrders(orders);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = orders.filter(order => 
      (order.id && order.id.toString().toLowerCase().includes(query)) ||
      (order.items && order.items.some(item => 
        item.name && item.name.toLowerCase().includes(query)
      ))
    );
    setFilteredOrders(filtered);
  }, [searchQuery, orders]);

  // Content to render for both normal and modal views
  function OrdersContent() {
    return (
    <Box p={4} w="100%">
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading size="lg">مدیریت سفارش‌ها</Heading>
        <HStack>
          <Button
            leftIcon={<FiRefreshCw />}
            colorScheme="blue"
            onClick={loadOrders}
            isLoading={isLoading}
            loadingText="در حال بارگیری"
              tabIndex={-1}
              aria-hidden="true"
          >
            بروزرسانی
          </Button>
          <Button
            leftIcon={<FiCloud />}
            colorScheme="green"
            onClick={syncAllOrders}
            isLoading={isSyncing}
            loadingText="همگام‌سازی"
            isDisabled={!isOnline}
              tabIndex={-1}
              aria-hidden="true"
          >
            همگام‌سازی همه
          </Button>
          {isModal && (
            <Button
              leftIcon={<FiX />}
              onClick={onClose}
                tabIndex={-1}
                aria-hidden="true"
            >
              بستن
            </Button>
          )}
        </HStack>
      </Flex>
      
        {/* Connection status and search */}
        <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Badge 
          colorScheme={isOnline ? "green" : "red"} 
          p={2} 
          display="flex" 
          alignItems="center" 
          width="fit-content"
        >
          <Icon as={isOnline ? FiCloud : FiCloudOff} mr={2} />
          <Text>{isOnline ? "آنلاین - سفارش‌ها به‌صورت خودکار همگام‌سازی می‌شوند" : "آفلاین - برای همگام‌سازی سفارش‌ها به اینترنت متصل شوید"}</Text>
        </Badge>
        </Flex>
        
        {/* Search box */}
        <Box p={4} borderWidth="1px" borderRadius="lg" mb={6} shadow="sm">
          <Flex align="center" gap={4}>
            <FormControl flex="1">
              <InputGroup size="sm">
                <InputLeftElement pointerEvents="none">
                  <FiSearch color="gray.300" />
                </InputLeftElement>
                <Input
                  placeholder="جستجو در سفارش‌ها..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="sm"
                />
              </InputGroup>
            </FormControl>
            <Button
              colorScheme="blue"
              size="sm"
              leftIcon={<FiSearch />}
              onClick={() => {
                // Already filtered via effect
              }}
            >
              جستجو
            </Button>
          </Flex>
      </Box>
      
      {/* Orders table */}
      <Card>
        <CardBody>
            <Flex justifyContent="space-between" alignItems="center" mb={4}>
              <Heading size="md">لیست سفارش‌ها</Heading>
              <Text color="gray.600" fontSize="sm">
                {filteredOrders.length} سفارش {searchQuery ? `(فیلتر شده از ${orders.length})` : ''}
              </Text>
            </Flex>
          {isLoading ? (
            <Flex justifyContent="center" py={10}>
              <Spinner size="xl" />
            </Flex>
          ) : orders.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Text color="gray.500">هیچ سفارشی یافت نشد</Text>
            </Box>
          ) : (
            <Box 
              overflowX="auto" 
              overflowY="auto" 
              maxHeight="60vh" 
              sx={{
                '&::-webkit-scrollbar': {
                  width: '8px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                },
              }}
            >
              <Table variant="simple" size="sm">
                <Thead position="sticky" top={0} bg="white" zIndex={1}>
                  <Tr>
                    <Th>شناسه سفارش</Th>
                    <Th>تاریخ ایجاد</Th>
                    <Th>وضعیت</Th>
                    <Th>نوع سفارش</Th>
                    <Th isNumeric>تعداد اقلام</Th>
                    <Th isNumeric>مبلغ کل</Th>
                    <Th>عملیات</Th>
                  </Tr>
                </Thead>
                <Tbody>
                    {filteredOrders.map(renderOrderRow)}
                </Tbody>
              </Table>
            </Box>
          )}
        </CardBody>
      </Card>
      
      {/* Order details modal */}
        <Modal isOpen={isDetailOpen} onClose={onDetailClose} size="2xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
            <ModalHeader>
              <Flex alignItems="center" justifyContent="space-between">
                <Text>جزئیات سفارش {selectedOrder?.id}</Text>
              </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedOrder && (
                <VStack spacing={4} align="stretch">
                  {/* Order metadata */}
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Card>
                      <CardBody>
                        <Heading size="sm" mb={2}>اطلاعات سفارش</Heading>
                        <VStack align="start" spacing={1}>
                          <Flex width="100%" justify="space-between">
                            <Text fontWeight="bold">تاریخ ایجاد:</Text>
                            <Text>{formatDate(selectedOrder.createdAt)}</Text>
                          </Flex>
                          <Flex width="100%" justify="space-between">
                            <Text fontWeight="bold">وضعیت همگام‌سازی:</Text>
                    {getStatusBadge(selectedOrder)}
                          </Flex>
                          <Flex width="100%" justify="space-between">
                            <Text fontWeight="bold">نوع سفارش:</Text>
                    {getOrderTypeBadge(selectedOrder.orderType)}
                          </Flex>
                          <Flex width="100%" justify="space-between">
                            <Text fontWeight="bold">تعداد اقلام:</Text>
                            <Text>{selectedOrder.items?.length || 0}</Text>
                          </Flex>
                        </VStack>
                      </CardBody>
                    </Card>
                  </SimpleGrid>
                  
                  {/* Order items */}
                  <Card>
                    <CardBody>
                  <Heading size="sm" mb={2}>اقلام سفارش</Heading>
                  {renderOrderDetails()}
                    </CardBody>
                  </Card>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
              <Button mr={3} onClick={onDetailClose}>
                بستن
              </Button>
              {selectedOrder && (
            <Button
                  colorScheme="blue" 
              leftIcon={<FiExternalLink />}
                  onClick={() => navigateToOrderDetails(selectedOrder.id)}
            >
              مشاهده کامل
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
  }

  return (
    <>
      {/* Add the OrderDetailsModal at the root level */}
      <OrderDetailsModal
        isOpen={isFullDetailOpen}
        onClose={onFullDetailClose}
        orderId={selectedOrderId}
      />
      
      {/* Original return content */}
      {isModal ? (
        <Modal isOpen={isOpen} onClose={onClose} size="full">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>مدیریت سفارش‌ها</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <OrdersContent />
            </ModalBody>
          </ModalContent>
        </Modal>
      ) : (
        <OrdersContent />
      )}
    </>
  );
};

export default OrdersPage; 