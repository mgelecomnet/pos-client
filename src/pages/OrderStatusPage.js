import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Flex,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Text,
  Button,
  HStack,
  VStack,
  useToast,
  Spinner,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Card,
  CardBody,
  Tooltip,
  Stack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Icon,
} from '@chakra-ui/react';
import {
  FiRefreshCw as RepeatIcon,
  FiArrowLeft as ArrowBackIcon,
  FiCloud,
  FiCloudOff,
  FiCheckCircle,
  FiAlertTriangle,
  FiClock,
  FiDownload,
  FiX,
  FiHome,
  FiShoppingBag,
  FiTruck,
} from 'react-icons/fi';
import offlineOrderService, { OFFLINE_ORDER_STATUS } from '../api/offlineOrderService';
import { connectionStatus } from '../api/odoo';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrderById, syncOrderById } from '../api/ordersApi';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { formatCurrency, formatDate } from '../utils/formatters';

const OrderStatusPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    synced: 0,
    failed: 0,
    completed: 0,
    total: 0,
    dineIn: 0,
    takeout: 0,
    delivery: 0
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { isOnline } = useConnectionStatus();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Load orders on component mount
  useEffect(() => {
    loadOrders();
  }, []);

  // Load orders from IndexedDB and localStorage
  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get offline orders from IndexedDB
      const offlineOrders = await offlineOrderService.getOfflineOrders();
      
      // Get active orders from localStorage
      let activeOrders = [];
      try {
        const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        activeOrders = savedOrders.map(order => ({
          id: order.id,
          status: order.status || 'active',
          createdAt: order.createdAt,
          completedAt: order.completedAt,
          syncStatus: order.syncStatus || 'pending',
          orderType: order.orderType || 'dine_in',
          items: order.cart || [],
          total: order.cart ? order.cart.reduce((sum, item) => {
            const priceAfterDiscount = item.price * (1 - (item.discount || 0) / 100);
            return sum + (priceAfterDiscount * item.quantity);
          }, 0) : 0,
          source: 'local'
        }));
      } catch (error) {
        console.error('Error parsing active orders:', error);
      }
      
      // Transform offline orders
      const transformedOfflineOrders = offlineOrders.map(order => {
        // Extract order details
        const orderDetails = order.orderData || {};
        return {
          id: order.orderId,
          localId: order.localId,
          status: order.status === OFFLINE_ORDER_STATUS.SYNCED ? 'completed' : 'pending',
          syncStatus: order.status,
          createdAt: order.timestamp,
          syncedAt: order.syncDate,
          orderType: orderDetails.orderType || 'dine_in',
          items: orderDetails.items || [],
          total: orderDetails.amount_total || 0,
          source: 'offline'
        };
      });
      
      // Combine all orders, with offline orders taking precedence for duplicates
      const allOrders = [...activeOrders];
      
      // Add offline orders, avoiding duplicates
      transformedOfflineOrders.forEach(offlineOrder => {
        const existingIndex = allOrders.findIndex(o => o.id === offlineOrder.id);
        if (existingIndex >= 0) {
          // Update existing order with offline data
          allOrders[existingIndex] = {
            ...allOrders[existingIndex],
            ...offlineOrder
          };
        } else {
          // Add new offline order
          allOrders.push(offlineOrder);
        }
      });
      
      // Sort by creation date (newest first)
      allOrders.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      
      setOrders(allOrders);
      
      // Calculate stats
      const pending = allOrders.filter(o => o.syncStatus === OFFLINE_ORDER_STATUS.PENDING || o.syncStatus === 'pending').length;
      const synced = allOrders.filter(o => o.syncStatus === OFFLINE_ORDER_STATUS.SYNCED || o.syncStatus === 'synced').length;
      const failed = allOrders.filter(o => o.syncStatus === OFFLINE_ORDER_STATUS.FAILED).length;
      const completed = allOrders.filter(o => o.status === 'completed').length;
      const dineIn = allOrders.filter(o => o.orderType === 'dine_in').length;
      const takeout = allOrders.filter(o => o.orderType === 'takeout').length;
      const delivery = allOrders.filter(o => o.orderType === 'delivery').length;
      
      setStats({
        pending,
        synced,
        failed,
        completed,
        total: allOrders.length,
        dineIn,
        takeout,
        delivery
      });
    } catch (error) {
      console.error('Error loading orders:', error);
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
  }, [toast]);

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
    
    setIsSyncing(true);
    try {
      const result = await offlineOrderService.syncAllPendingOrders();
      
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
      console.error('Error syncing orders:', error);
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
    
    // Check if we're online
    if (!isOnline) {
      toast({
        title: 'آفلاین',
        description: 'نمی‌توان سفارش را در حالت آفلاین همگام‌سازی کرد',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsSyncing(true);
    try {
      const result = await offlineOrderService.syncOrder(orderId);
      
      if (result.success) {
        toast({
          title: 'همگام‌سازی موفق',
          description: `سفارش با موفقیت همگام‌سازی شد. شناسه سرور: ${result.serverOrderId}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
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
      console.error(`Error syncing order ${orderId}:`, error);
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
    setSelectedOrder(order);
    onOpen();
  };
  
  // Get status badge for an order's state
  const getStatusBadge = (state) => {
    switch(state) {
      case 'done':
        return (
          <Badge colorScheme="green" display="flex" alignItems="center">
            <Icon as={FiCheckCircle} mr={1} />
            <Text>Complete</Text>
          </Badge>
        );
      case 'paid':
        return (
          <Badge colorScheme="blue" display="flex" alignItems="center">
            <Icon as={FiCheckCircle} mr={1} />
            <Text>Paid</Text>
          </Badge>
        );
      case 'draft':
        return (
          <Badge colorScheme="yellow" display="flex" alignItems="center">
            <Icon as={FiClock} mr={1} />
            <Text>Draft</Text>
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge colorScheme="red" display="flex" alignItems="center">
            <Icon as={FiX} mr={1} />
            <Text>Cancelled</Text>
          </Badge>
        );
      default:
        return (
          <Badge colorScheme="gray" display="flex" alignItems="center">
            <Icon as={FiClock} mr={1} />
            <Text>Unknown</Text>
          </Badge>
        );
    }
  };
  
  // Get sync status badge
  const getSyncStatusBadge = (syncStatus) => {
    switch(syncStatus) {
      case 'synced':
        return (
          <Badge colorScheme="green" display="flex" alignItems="center">
            <Icon as={FiCloud} mr={1} />
            <Text>Synced</Text>
          </Badge>
        );
      case 'pending':
        return (
          <Badge colorScheme="yellow" display="flex" alignItems="center">
            <Icon as={FiClock} mr={1} />
            <Text>Pending Sync</Text>
          </Badge>
        );
      case 'failed':
        return (
          <Badge colorScheme="red" display="flex" alignItems="center">
            <Icon as={FiAlertTriangle} mr={1} />
            <Text>Sync Failed</Text>
          </Badge>
        );
      default:
        return (
          <Badge colorScheme="gray" display="flex" alignItems="center">
            <Icon as={FiCloudOff} mr={1} />
            <Text>Not Synced</Text>
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

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  const loadOrderDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const orderData = await getOrderById(orderId);
      if (orderData) {
        setOrder(orderData);
      } else {
        setError('Order not found');
      }
    } catch (err) {
      console.error('Error loading order details:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncOrder = async () => {
    if (!isOnline) {
      toast({
        title: 'Offline Mode',
        description: 'Cannot sync order while offline',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setSyncing(true);
    try {
      await syncOrderById(orderId);
      toast({
        title: 'Order Synced',
        description: 'Order has been successfully synced with Odoo',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      loadOrderDetails();
    } catch (err) {
      console.error('Error syncing order:', err);
      toast({
        title: 'Sync Failed',
        description: err.message || 'Failed to sync order with Odoo',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Flex direction="column" align="center" justify="center" h="80vh">
        <Spinner size="xl" color="blue.500" />
        <Text mt={4}>Loading order details...</Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Box p={5}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertTitle mr={2}>Error!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button leftIcon={<ArrowBackIcon />} mt={4} onClick={() => navigate('/orders')}>
          Back to Orders
        </Button>
      </Box>
    );
  }

  if (!order) {
    return (
      <Box p={5}>
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <AlertTitle mr={2}>Order Not Found</AlertTitle>
          <AlertDescription>We couldn't find the order you're looking for</AlertDescription>
        </Alert>
        <Button leftIcon={<ArrowBackIcon />} mt={4} onClick={() => navigate('/orders')}>
          Back to Orders
        </Button>
      </Box>
    );
  }

  return (
    <Box p={5}>
      <Flex justify="space-between" align="center" mb={6}>
        <HStack spacing={3}>
        <Button leftIcon={<ArrowBackIcon />} onClick={() => navigate('/orders')}>
          Back to Orders
        </Button>
          <Button 
            leftIcon={<FiHome />} 
            colorScheme="teal" 
            onClick={() => navigate('/pos')}
          >
            Back to POS
          </Button>
        </HStack>
        
        <Button 
          rightIcon={<RepeatIcon />} 
          colorScheme="blue" 
          isLoading={syncing} 
          loadingText="Syncing"
          isDisabled={!isOnline || order.sync_status === 'synced'}
          onClick={handleSyncOrder}
        >
          {order.sync_status === 'synced' ? 'Synced' : 'Sync Order'}
        </Button>
      </Flex>

      <Box bg="white" shadow="md" borderRadius="lg" p={6} mb={6}>
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="lg">Order #{order.name}</Heading>
          <Flex>
            {getStatusBadge(order.state)}
            <Box ml={2}>{getSyncStatusBadge(order.sync_status)}</Box>
          </Flex>
        </Flex>
        
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
          <Box>
            <Text fontWeight="bold" color="gray.600">Created</Text>
            <Text>{formatDate(order.create_date)}</Text>
          </Box>
          <Box>
            <Text fontWeight="bold" color="gray.600">Customer</Text>
            <Text>{order.partner_id ? order.partner_id.name : 'Guest Customer'}</Text>
          </Box>
          <Box>
            <Text fontWeight="bold" color="gray.600">Total Amount</Text>
            <Text fontWeight="bold" fontSize="xl">{formatCurrency(order.amount_total)}</Text>
          </Box>
          <Box>
            <Text fontWeight="bold" color="gray.600">Payment Method</Text>
            <Text>{order.payment_method_id ? order.payment_method_id.name : 'Not paid yet'}</Text>
          </Box>
        </SimpleGrid>

        {order.notes && (
          <Box mb={4}>
            <Text fontWeight="bold" color="gray.600">Notes</Text>
            <Text>{order.notes}</Text>
          </Box>
        )}
      </Box>

      <Box bg="white" shadow="md" borderRadius="lg" p={6}>
        <Heading size="md" mb={4}>Order Lines</Heading>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Product</Th>
              <Th isNumeric>Qty</Th>
              <Th isNumeric>Price</Th>
              <Th isNumeric>Tax</Th>
              <Th isNumeric>Subtotal</Th>
            </Tr>
          </Thead>
          <Tbody>
            {order.lines && order.lines.map((line, index) => {
              // Calculate or extract tax amount for this line
              const subtotal = line.price_subtotal || (line.price_unit * line.qty);
              const taxAmount = line.tax_amount || (line.price_subtotal_incl - line.price_subtotal) || (subtotal * 0.15);
              
              return (
              <Tr key={index}>
                <Td>
                  <Text fontWeight="medium">{line.product_id.name}</Text>
                  {line.note && <Text fontSize="sm" color="gray.600">{line.note}</Text>}
                </Td>
                <Td isNumeric>{line.qty}</Td>
                <Td isNumeric>{formatCurrency(line.price_unit)}</Td>
                  <Td isNumeric>
                    {taxAmount > 0 ? `${formatCurrency(taxAmount)} (15%)` : '-'}
                  </Td>
                  <Td isNumeric>{formatCurrency(line.price_subtotal || (line.price_unit * line.qty))}</Td>
              </Tr>
              );
            })}
          </Tbody>
        </Table>
        
        <Divider my={4} />
        
        <Stack spacing={2} align="flex-end">
          <Flex justify="space-between" w="200px">
            <Text>Subtotal:</Text>
            <Text>{formatCurrency(order.amount_untaxed || 0)}</Text>
          </Flex>
          <Flex justify="space-between" w="200px">
            <Text>Tax (15%):</Text>
            <Text>{formatCurrency(order.amount_tax || 0)}</Text>
          </Flex>
          <Flex justify="space-between" w="200px" fontWeight="bold">
            <Text>Total:</Text>
            <Text>{formatCurrency(order.amount_total || 0)}</Text>
          </Flex>
        </Stack>
      </Box>
    </Box>
  );
};

export default OrderStatusPage; 