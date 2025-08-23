import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Box,
  Flex,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  Text,
  Badge,
  Heading,
  Divider,
  SimpleGrid,
  Stack,
  useToast,
  Spinner,
  Icon,
  HStack,
} from '@chakra-ui/react';
import {
  FiRefreshCw,
  FiCloud,
  FiCloudOff,
  FiCheckCircle,
  FiAlertTriangle,
  FiClock,
  FiX,
  FiHome,
  FiShoppingBag,
  FiTruck,
  FiCreditCard,
  FiDollarSign,
} from 'react-icons/fi';
import { getOrderById, syncOrderById } from '../api/ordersApi';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useConnectionStatus } from '../hooks/useConnectionStatus';

const OrderDetailsModal = ({ isOpen, onClose, orderId }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [paymentMethodNames, setPaymentMethodNames] = useState({});
  const { isOnline } = useConnectionStatus();
  const toast = useToast();

  // Function to load all payment methods from IndexedDB
  const loadAllPaymentMethods = () => {
    try {
      console.log('Loading payment methods from POSDatabase...');
      const request = window.indexedDB.open('POSDatabase', 1);
      
      request.onsuccess = (event) => {
        const database = event.target.result;
        console.log('Available stores in POSDatabase:', Array.from(database.objectStoreNames));
        
        // Try different possible store names
        const possibleStoreNames = [
          'pos_payment_method', 
          'pos.payment.method',
          'payment_method',
          'payment.method'
        ];
        
        let storeFound = false;
        
        for (const storeName of possibleStoreNames) {
          // Check if this store exists
          if (database.objectStoreNames.contains(storeName)) {
            console.log(`Found store: ${storeName}`);
            storeFound = true;
            
            // Open a transaction
            const transaction = database.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            // There's likely only one record with all payment methods
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = (event) => {
              const result = event.target.result;
              console.log(`Raw payment methods data from ${storeName}:`, result);
              
              // Create a map of ID to name
              const methodMap = {};
              
              try {
                // Handle different possible data structures
                if (result && result.length > 0) {
                  let paymentMethodsData = null;
                  
                  // Try different possible structures
                  // Structure 1: {data: Array, fields: {}, relations: {}}
                  if (result[0] && result[0].data && Array.isArray(result[0].data)) {
                    console.log('Found payment methods in data property');
                    paymentMethodsData = result[0].data;
                  } 
                  // Structure 2: Direct array of payment methods
                  else if (Array.isArray(result) && result[0] && result[0].id) {
                    console.log('Found payment methods directly in result');
                    paymentMethodsData = result;
                  }
                  // Structure 3: Array with fields property
                  else if (result[0] && result[0].fields && result[0].fields.data) {
                    console.log('Found payment methods in fields.data property');
                    paymentMethodsData = result[0].fields.data;
                  }
                  
                  if (paymentMethodsData) {
                    console.log('Payment methods data array:', paymentMethodsData);
                    
                    paymentMethodsData.forEach(method => {
                      if (method && method.id) {
                        methodMap[method.id] = method.name || `Method ${method.id}`;
                        console.log(`Added payment method: ID=${method.id}, Name=${method.name}, Type=${method.type}`);
                      }
                    });
                    
                    console.log('Created payment methods map:', methodMap);
                    // Update state with all payment method names
                    setPaymentMethodNames(methodMap);
                    return; // Stop after finding methods
                  } else {
                    console.error('Could not find payment methods data in the expected structure:', result);
                  }
                } else {
                  console.warn(`No payment methods found in ${storeName}`);
                }
              } catch (error) {
                console.error('Error processing payment methods data:', error);
              }
            };
            
            getAllRequest.onerror = (event) => {
              console.error(`Error fetching payment methods from ${storeName}:`, event.target.error);
            };
          }
        }
        
        if (!storeFound) {
          console.error('No matching payment method store found. Available stores:', Array.from(database.objectStoreNames));
        }
      };
      
      request.onerror = (event) => {
        console.error('Error opening POSDatabase:', event.target.error);
      };
    } catch (error) {
      console.error('Error accessing IndexedDB:', error);
    }
  };

  // Load order details when modal is opened
  useEffect(() => {
    if (isOpen && orderId) {
      loadOrderDetails();
      loadAllPaymentMethods();
      
      // Fallback method - direct inspection of IndexedDB
      setTimeout(() => {
        // If we don't have any payment method names after 1 second, try a direct approach
        if (Object.keys(paymentMethodNames).length === 0) {
          console.log('No payment methods loaded yet, trying direct IndexedDB access');
          directInspectPaymentMethods();
        }
      }, 1000);
    }
  }, [isOpen, orderId]);

  const loadOrderDetails = async () => {
    if (!orderId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Loading order details for ID:', orderId);
      const orderData = await getOrderById(orderId);
      if (orderData) {
        console.log('Order data loaded:', orderData);
        setOrder(orderData);
      } else {
        setError('سفارش پیدا نشد');
      }
    } catch (err) {
      console.error('Error loading order details:', err);
      setError(err.message || 'خطا در بارگذاری اطلاعات سفارش');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncOrder = async () => {
    if (!isOnline) {
      toast({
        title: 'حالت آفلاین',
        description: 'در حالت آفلاین امکان همگام‌سازی وجود ندارد',
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
        title: 'همگام‌سازی موفق',
        description: 'سفارش با موفقیت با سرور همگام‌سازی شد',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      loadOrderDetails();
    } catch (err) {
      console.error('Error syncing order:', err);
      toast({
        title: 'خطای همگام‌سازی',
        description: err.message || 'همگام‌سازی سفارش با خطا مواجه شد',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setSyncing(false);
    }
  };

  // Get status badge for an order's state
  const getStatusBadge = (state) => {
    switch(state) {
      case 'done':
        return (
          <Badge colorScheme="green" display="flex" alignItems="center">
            <Icon as={FiCheckCircle} mr={1} />
            <Text>تکمیل شده</Text>
          </Badge>
        );
      case 'paid':
        return (
          <Badge colorScheme="blue" display="flex" alignItems="center">
            <Icon as={FiCheckCircle} mr={1} />
            <Text>پرداخت شده</Text>
          </Badge>
        );
      case 'draft':
        return (
          <Badge colorScheme="yellow" display="flex" alignItems="center">
            <Icon as={FiClock} mr={1} />
            <Text>پیش‌نویس</Text>
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge colorScheme="red" display="flex" alignItems="center">
            <Icon as={FiX} mr={1} />
            <Text>لغو شده</Text>
          </Badge>
        );
      default:
        return (
          <Badge colorScheme="gray" display="flex" alignItems="center">
            <Icon as={FiClock} mr={1} />
            <Text>نامشخص</Text>
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
            <Text>همگام شده</Text>
          </Badge>
        );
      case 'pending':
        return (
          <Badge colorScheme="yellow" display="flex" alignItems="center">
            <Icon as={FiClock} mr={1} />
            <Text>در انتظار همگام‌سازی</Text>
          </Badge>
        );
      case 'failed':
        return (
          <Badge colorScheme="red" display="flex" alignItems="center">
            <Icon as={FiAlertTriangle} mr={1} />
            <Text>خطا در همگام‌سازی</Text>
          </Badge>
        );
      default:
        return (
          <Badge colorScheme="gray" display="flex" alignItems="center">
            <Icon as={FiCloudOff} mr={1} />
            <Text>همگام نشده</Text>
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

  // Render payment methods
  const renderPaymentMethods = () => {
    if (!order || !order.payment_ids || order.payment_ids.length === 0) {
      return (
        <Text color="gray.500" fontStyle="italic">اطلاعات پرداخت موجود نیست</Text>
      );
    }

    // Helper function to check if a payment method is cash
    const isCashPayment = (id, name) => {
      if (id === 1 || id === 2 || id === 5) return true; // Common IDs for cash
      if (name && (name.toLowerCase().includes('cash') || name.toLowerCase().includes('نقد'))) return true;
      return false;
    };

    console.log('Rendering payment methods with names:', paymentMethodNames);

    return (
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>روش پرداخت</Th>
            <Th isNumeric>مبلغ</Th>
            <Th>تاریخ</Th>
          </Tr>
        </Thead>
        <Tbody>
          {order.payment_ids.map((payment, index) => {
            // Get payment method ID
            const paymentMethodId = payment.payment_method_id?.id;
            // Get payment method name from our state
            const methodName = paymentMethodNames[paymentMethodId];
            
            console.log(`Payment method ${index}: ID=${paymentMethodId}, Name=${methodName || 'Unknown'}`);
            
            // Determine icon based on payment type
            const isCash = isCashPayment(paymentMethodId, methodName);
            
            return (
              <Tr key={index}>
                <Td>
                  <Flex align="center">
                    <Icon 
                      as={isCash ? FiDollarSign : FiCreditCard} 
                      mr={2} 
                      color={isCash ? "green.500" : "blue.500"}
                    />
                    {methodName 
                      ? `${paymentMethodId} - ${methodName}` 
                      : `${paymentMethodId || 'نامشخص'}`}
                  </Flex>
                </Td>
                <Td isNumeric>{formatCurrency(payment.amount || 0)}</Td>
                <Td>{formatDate(payment.payment_date || order.create_date)}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    );
  };

  // Direct inspection of payment methods in IndexedDB
  const directInspectPaymentMethods = () => {
    try {
      const dbName = 'POSDatabase';
      // Try different possible store names
      const possibleStoreNames = [
        'pos_payment_method', 
        'pos.payment.method',
        'payment_method',
        'payment.method'
      ];
      
      // Open the database
      const request = window.indexedDB.open(dbName);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        console.log('Available stores in POSDatabase:', Array.from(db.objectStoreNames));
        
        // Try each possible store name
        let storeFound = false;
        
        for (const storeName of possibleStoreNames) {
          if (db.objectStoreNames.contains(storeName)) {
            console.log(`Found store: ${storeName}`);
            storeFound = true;
            
            // Check what's in the store
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = (event) => {
              const allData = event.target.result;
              console.log(`Direct inspection found ${allData.length} entries in ${storeName}:`, allData);
              
              // Try to extract payment methods regardless of structure
              const methods = {};
              
              if (allData && allData.length > 0) {
                // Try each possible structure
                allData.forEach((item, index) => {
                  console.log(`Examining item ${index}:`, item);
                  
                  // Check if this item itself is a payment method
                  if (item && item.id && item.name) {
                    methods[item.id] = item.name;
                  }
                  
                  // Check if it has a data array
                  if (item && item.data && Array.isArray(item.data)) {
                    item.data.forEach(method => {
                      if (method && method.id && method.name) {
                        methods[method.id] = method.name;
                      }
                    });
                  }
                });
                
                if (Object.keys(methods).length > 0) {
                  console.log('Direct inspection found payment methods:', methods);
                  setPaymentMethodNames(methods);
                  return; // Stop after finding methods
                }
              }
            };
            
            request.onerror = (event) => {
              console.error(`Error in direct inspection of ${storeName}:`, event.target.error);
            };
          }
        }
        
        if (!storeFound) {
          console.error('No matching payment method store found. Available stores:', Array.from(db.objectStoreNames));
        }
      };
      
      request.onerror = (event) => {
        console.error('Error opening database for direct inspection:', event.target.error);
      };
    } catch (error) {
      console.error('Error in direct inspection:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxW="90vw">
        <ModalHeader>
          <Flex justify="space-between" align="center">
            <Text>جزئیات سفارش {order?.name || orderId}</Text>
            <HStack>
              {order && getStatusBadge(order.state)}
              {order && <Box ml={2}>{getSyncStatusBadge(order.sync_status)}</Box>}
            </HStack>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          {loading ? (
            <Flex direction="column" align="center" justify="center" my={10}>
              <Spinner size="xl" color="blue.500" />
              <Text mt={4}>در حال بارگذاری جزئیات سفارش...</Text>
            </Flex>
          ) : error ? (
            <Box textAlign="center" my={10} p={4} bg="red.50" borderRadius="md">
              <Icon as={FiAlertTriangle} color="red.500" boxSize={8} mb={2} />
              <Text color="red.500" fontWeight="bold">{error}</Text>
            </Box>
          ) : order ? (
            <Box>
              {/* Order Header Information */}
              <Box bg="white" shadow="sm" borderRadius="lg" p={4} mb={6}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={4}>
                  <Box>
                    <Text fontWeight="bold" color="gray.600">تاریخ ایجاد</Text>
                    <Text>{formatDate(order.create_date)}</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold" color="gray.600">نوع سفارش</Text>
                    {getOrderTypeBadge(order.order_type)}
                  </Box>
                  <Box>
                    <Text fontWeight="bold" color="gray.600">مشتری</Text>
                    <Text>{order.partner_id ? order.partner_id.name : 'مهمان'}</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold" color="gray.600">مبلغ کل</Text>
                    <Text fontWeight="bold" fontSize="xl">{formatCurrency(order.amount_total)}</Text>
                  </Box>
                </SimpleGrid>
              </Box>

              {/* Payment Methods Section */}
              <Box bg="white" shadow="sm" borderRadius="lg" p={4} mb={6}>
                <Heading size="md" mb={4}>روش‌های پرداخت</Heading>
                {renderPaymentMethods()}
              </Box>

              {/* Order Items Section */}
              <Box bg="white" shadow="sm" borderRadius="lg" p={4} mb={6}>
                <Heading size="md" mb={4}>اقلام سفارش</Heading>
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>محصول</Th>
                      <Th isNumeric>تعداد</Th>
                      <Th isNumeric>قیمت واحد</Th>
                      <Th isNumeric>مالیات</Th>
                      <Th isNumeric>جمع</Th>
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
                          <Td isNumeric>{taxAmount > 0 ? `${formatCurrency(taxAmount)} (15%)` : `${formatCurrency(line.price_unit * line.qty * 0.15)} (15%)`}</Td>
                          <Td isNumeric>{formatCurrency(line.price_subtotal || (line.price_unit * line.qty))}</Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
                
                <Divider my={4} />
                
                <Stack spacing={2} align="flex-end">
                  <Flex justify="space-between" w="200px">
                    <Text>جمع کل:</Text>
                    <Text>{formatCurrency(order.amount_untaxed || 0)}</Text>
                  </Flex>
                  <Flex justify="space-between" w="200px">
                    <Text>مالیات (15%):</Text>
                    <Text>{formatCurrency(order.amount_tax || 0)}</Text>
                  </Flex>
                  <Flex justify="space-between" w="200px" fontWeight="bold">
                    <Text>مبلغ نهایی:</Text>
                    <Text>{formatCurrency(order.amount_total || 0)}</Text>
                  </Flex>
                </Stack>
              </Box>

              {/* Order Notes Section - if applicable */}
              {order.notes && (
                <Box bg="white" shadow="sm" borderRadius="lg" p={4} mb={6}>
                  <Heading size="md" mb={2}>یادداشت‌ها</Heading>
                  <Text>{order.notes}</Text>
                </Box>
              )}
            </Box>
          ) : (
            <Box textAlign="center" my={10}>
              <Text>اطلاعات سفارش موجود نیست</Text>
            </Box>
          )}
        </ModalBody>

        <ModalFooter>
          <Button mr={3} onClick={onClose}>
            بستن
          </Button>
          
          {order && order.sync_status !== 'synced' && (
            <Button
              colorScheme="blue"
              leftIcon={<FiRefreshCw />}
              isLoading={syncing}
              loadingText="در حال همگام‌سازی"
              isDisabled={!isOnline}
              onClick={handleSyncOrder}
            >
              همگام‌سازی سفارش
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default OrderDetailsModal; 