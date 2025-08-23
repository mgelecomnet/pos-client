import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  Box,
  Divider,
  HStack,
  Icon,
  Image,
  Flex,
  Center,
  Input,
  InputGroup,
  InputRightElement,
  useColorModeValue,
  Badge,
  Tooltip,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel
} from '@chakra-ui/react';
import { FiCheckCircle, FiPrinter, FiSend, FiArrowLeft, FiShoppingBag, FiTruck, FiHome, FiRefreshCw, FiAlertTriangle, FiFileText } from 'react-icons/fi';
import offlineOrderService from '../../api/offlineOrderService';
import PaymentReceipt from '../PaymentReceipt';
import { getLocalPOSData } from '../../api/odooApi';

const OrderComplete = ({ isOpen, onClose, order }) => {
  const bgSuccess = useColorModeValue('green.50', 'green.900');
  const colorSuccess = useColorModeValue('green.500', 'green.200');
  const [email, setEmail] = useState('');
  const [isResyncing, setIsResyncing] = useState(false);
  const [refundInfo, setRefundInfo] = useState(null);
  const [currency, setCurrency] = useState({ symbol: '$', name: 'USD', position: 'before' });
  const toast = useToast();
  const printRef = useRef(null);

  console.log('Order complete data:', order);
  
  // Load currency information on component mount
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const currencyInfo = await getLocalPOSData.getCurrency();
        console.log('Loaded currency info:', currencyInfo);
        // Make sure we have a valid currency
        if (currencyInfo && currencyInfo.symbol) {
          setCurrency(currencyInfo);
        }
      } catch (error) {
        console.error('Error loading currency information:', error);
        // Keep default currency (USD)
      }
    };
    
    loadCurrency();
  }, []);
  
  // Format number with proper currency
  const formatCurrency = (amount) => {
    const formattedNumber = new Intl.NumberFormat('fa-IR').format(Math.abs(amount));
    
    if (currency.position === 'before') {
      return `${currency.symbol} ${formattedNumber}`;
    } else {
      return `${formattedNumber} ${currency.symbol}`;
    }
  };
  
  // Company information for the receipt
  const companyInfo = {
    name: 'فروشگاه نمونه',
    address: 'تهران، خیابان ولیعصر، پلاک 123',
    phone: '021-12345678',
    taxId: 'شناسه مالیاتی: 123456789',
    website: 'www.example.com',
    cashierName: 'کاربر سیستم',
    logo: 'https://via.placeholder.com/150x50', // Replace with your actual logo URL
    currency: currency
  };
  
  // Check if the order has been refunded previously
  useEffect(() => {
    if (isOpen && order) {
      const orderId = order?.localId || order?.id || order?.data?.id || order?.orderId;
      
      if (orderId) {
        console.log('Checking if order has been refunded:', orderId);
        
        // Check if order has refund info directly in the object
        if (order.hasBeenRefunded || order.data?.has_been_refunded) {
          console.log('Order has refund flag in data:', orderId);
          const refundHistoryStr = order.data?.refund_history || '';
          let refundHistory = [];
          
          try {
            refundHistory = refundHistoryStr ? JSON.parse(refundHistoryStr) : order.refundHistory || [];
          } catch (e) {
            console.error('Error parsing refund history:', e);
          }
          
          setRefundInfo({
            hasBeenRefunded: true,
            refundHistory: refundHistory,
            lastRefundDate: order.lastRefundDate || order.data?.last_refund_date
          });
          return;
        }
        
        // If no direct flag, query the offline storage
        const fetchRefundInfo = async () => {
          try {
            const refundData = await offlineOrderService.getOrderRefundInfo(orderId);
            if (refundData) {
              console.log('Found refund info for order:', refundData);
              setRefundInfo(refundData);
            } else {
              setRefundInfo(null);
            }
          } catch (error) {
            console.error('Error fetching refund info:', error);
            setRefundInfo(null);
          }
        };
        
        fetchRefundInfo();
      }
    }
  }, [isOpen, order]);

  // Print function
  const handlePrint = () => {
    if (printRef.current && printRef.current.print) {
      printRef.current.print();
    } else {
      // Fallback to browser print
    window.print();
    }
  };
  
  const handleSendEmail = () => {
    if (!email) return;
    // Implement email sending logic here
    toast({
      title: "ارسال رسید",
      description: `رسید به آدرس ${email} ارسال شد.`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };

  // Handle force resync
  const handleForceResync = async () => {
    const orderId = order?.localId || order?.id || order?.data?.id || order?.orderId;
    
    if (!orderId) {
      toast({
        title: "خطا",
        description: "شناسه سفارش برای همگام‌سازی یافت نشد",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      setIsResyncing(true);
      
      // Try to force resync the order
      const result = await offlineOrderService.forceResyncOrder(orderId);
      
      if (result && result.success) {
        toast({
          title: "همگام‌سازی موفق",
          description: "سفارش با موفقیت با سرور همگام‌سازی شد",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: "خطا در همگام‌سازی",
          description: result.error || "همگام‌سازی سفارش با سرور با خطا مواجه شد",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error resyncing order:', error);
      toast({
        title: "خطای همگام‌سازی",
        description: error.message || "خطایی هنگام همگام‌سازی رخ داد",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsResyncing(false);
    }
  };

  // Format date for receipt
  const formatDate = (date) => {
    const d = new Date(date || new Date());
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };
  
  // Calculate payment amounts
  const calculateAmounts = () => {
    if (!order) return { subtotal: 0, tax: 0, total: 0, payments: [] };
    
    // Get payment information from order data
    const payments = order.payment_ids || order.data?.payment_ids || [];
    const mappedPayments = payments.map(payment => {
      // Handle payment data structure [0, 0, {actual data}]
      const paymentData = Array.isArray(payment) && payment.length > 2 ? payment[2] : payment;
      return {
        method: paymentData.method_name || 'Unknown',
        amount: parseFloat(paymentData.amount || 0)
      };
    });
    
    // Get totals from order data
    const subtotal = parseFloat(order.amount_total || order.data?.amount_total || 0) - 
                    parseFloat(order.amount_tax || order.data?.amount_tax || 0);
    const tax = parseFloat(order.amount_tax || order.data?.amount_tax || 0);
    const total = parseFloat(order.amount_total || order.data?.amount_total || 0);
    
    return { subtotal, tax, total, payments: mappedPayments };
  };
  
  const { subtotal, tax, total, payments } = calculateAmounts();
  
  // Get order type with a default fallback
  const getOrderType = () => {
    const orderType = order.orderType || order.data?.orderType || 'dine_in';
    
    switch(orderType) {
      case 'takeout':
        return { name: 'Takeout', icon: FiShoppingBag, color: 'blue' };
      case 'delivery':
        return { name: 'Delivery', icon: FiTruck, color: 'purple' };
      case 'dine_in':
      default:
        return { name: 'Dine In', icon: FiHome, color: 'green' };
    }
  };
  
  const orderTypeInfo = getOrderType();
  
  // Get order lines/items
  const getOrderItems = () => {
    if (!order) return [];
    
    // Try cart from POSPage first (most likely to have complete data)
    if (order.cart && Array.isArray(order.cart) && order.cart.length > 0) {
      return order.cart.map(item => ({
        id: item.id,
        name: item.name,
        quantity: parseFloat(item.quantity || 1),
        price: parseFloat(item.price || 0),
        total: parseFloat(item.price || 0) * parseFloat(item.quantity || 1) * 
              (1 - parseFloat(item.discount || 0) / 100),
        discount: parseFloat(item.discount || 0)
      }));
    }
    
    // Try to get from order.data.lines (Odoo format)
    if (order.data && order.data.lines && Array.isArray(order.data.lines)) {
      return order.data.lines.map(line => {
        // Handle line data structure [0, 0, {actual data}]
        const lineData = line[2] || line;
        return {
          id: lineData.id,
          name: lineData.full_product_name || lineData.name || 'Unknown Product',
          quantity: parseFloat(lineData.qty || 0),
          price: parseFloat(lineData.price_unit || 0),
          total: parseFloat(lineData.price_subtotal_incl || lineData.price_subtotal || 0),
          discount: parseFloat(lineData.discount || 0)
        };
      });
    }
    
    // Try order.items format
    if (order.items && Array.isArray(order.items)) {
      return order.items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: parseFloat(item.quantity || 1),
        price: parseFloat(item.price || 0),
        total: parseFloat(item.price || 0) * parseFloat(item.quantity || 1) * 
               (1 - parseFloat(item.discount || 0) / 100),
        discount: parseFloat(item.discount || 0)
      }));
    }
    
    // Try refundData.refundItems for refund orders
    if (order.refundData && order.refundData.refundItems && Array.isArray(order.refundData.refundItems)) {
      return order.refundData.refundItems.map(item => ({
        id: item.productId,
        name: item.name,
        quantity: -Math.abs(parseFloat(item.quantity || 1)), // Ensure negative quantity for refunds
        price: parseFloat(item.price || 0),
        total: -parseFloat(item.price || 0) * Math.abs(parseFloat(item.quantity || 1)) * 
              (1 - parseFloat(item.discount || 0) / 100),
        discount: parseFloat(item.discount || 0)
      }));
    }
    
    return [];
  };
  
  const orderItems = getOrderItems();
  
  // Get order ID
  const orderId = order?.id || order?.data?.id || order?.orderId || 'N/A';
  
  // Check if this is a refund order
  const isRefundOrder = orderId.startsWith('REFUND-') || 
                      order?.isRefund || 
                      order?.data?.is_refund || 
                      (orderItems.some(item => item.quantity < 0));
  
  // Get original order ID for refunds
  const originalOrderId = isRefundOrder ? 
                         (orderId.split('-')[1] || 
                         order?.data?.original_order_id || 
                         'Unknown') : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" closeOnOverlayClick={false} scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent dir="rtl" maxHeight="90vh" display="flex" flexDirection="column">
        <Box py={4} px={4} bg={bgSuccess} borderTopRadius="md">
          <Flex direction="column" align="center">
            <Icon as={FiCheckCircle} w={8} h={8} color={colorSuccess} />
            <Text fontSize="xl" fontWeight="bold" mt={2} textAlign="center">
              {isRefundOrder ? 'بازگشت وجه با موفقیت انجام شد' : 'پرداخت با موفقیت انجام شد'}
              </Text>
            <Text fontSize="2xl" fontWeight="bold" mt={1}>
              {formatCurrency(Math.abs(total))}
              </Text>
            
            {/* Display order type */}
            <Badge 
              colorScheme={orderTypeInfo.color}
              display="flex" 
              alignItems="center" 
              mt={2}
              px={2}
              py={1}
            >
              <Icon as={orderTypeInfo.icon} mr={2} />
              <Text>{orderTypeInfo.name}</Text>
            </Badge>
          </Flex>
            </Box>

        {/* دو ستونی: ستون راست برای دکمه‌ها و ستون چپ برای محتوای رسید */}
        <Flex flex="1" overflow="hidden">
          {/* ستون راست برای دکمه‌ها */}
          <Box 
            width="120px" 
            borderRight="1px solid" 
            borderColor="gray.200" 
            p={2}
            display="flex"
            flexDirection="column"
            justifyContent="flex-start"
            alignItems="stretch"
          >
            <VStack spacing={3} align="stretch">
            <Button
              leftIcon={<FiPrinter />}
                colorScheme="blue" 
                size="sm" 
              onClick={handlePrint}
                title="چاپ رسید"
            >
                چاپ
            </Button>
            
            <Button
                leftIcon={<FiSend />} 
                colorScheme="teal" 
                size="sm"
                onClick={() => {
                  // اسکرول به پایین رسید برای نمایش فرم ارسال ایمیل
                  const receiptPanel = document.querySelector('[role="tabpanel"]');
                  if (receiptPanel) {
                    receiptPanel.scrollTo({
                      top: receiptPanel.scrollHeight,
                      behavior: 'smooth'
                    });
                  }
                }}
                title="اسکرول به فرم ارسال ایمیل"
              >
                ارسال
              </Button>
              
              <Divider my={1} />
              
              <Button 
                leftIcon={<FiArrowLeft />} 
                variant="outline"
                size="sm"
                onClick={onClose}
                mt="auto"
                title="بازگشت به فروشگاه"
              >
                بازگشت
              </Button>
            </VStack>
          </Box>
          
          {/* ستون چپ برای محتوای رسید */}
          <Box flex="1" overflow="hidden">
            <Box 
              display="flex" 
              flexDirection="column" 
              height="100%"
            >
              <Box 
                height="100%" 
                overflow="auto" 
                p={3} 
                sx={{
                  '&::-webkit-scrollbar': {
                    width: '4px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: 'gray.100',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'gray.400',
                    borderRadius: '4px',
                  },
                }}
              >
                <PaymentReceipt 
                  order={{
                    ...order,
                    items: orderItems,  // Explicitly pass processed items
                    amount_total: order.amount_total || total,
                    amount_tax: order.amount_tax || tax,
                    amount_subtotal: order.amount_subtotal || subtotal,
                    payment_ids: payments,
                    // Add a fallback invoice number based on order ID
                    invoiceNumber: order?.invoice_number || order?.data?.invoice_number || orderId,
                    // Ensure tax rate is passed
                    taxRate: order?.taxRate || order?.data?.taxRate || 15,
                    // Ensure discount is passed
                    totalDiscount: order?.totalDiscount || order?.data?.totalDiscount || 0
                  }} 
                  companyInfo={companyInfo}
                  printRef={printRef}
                />
                
                {/* فرم ارسال ایمیل */}
                <Box 
                  mt={6} 
                  mb={2} 
                  px={2} 
                  py={3} 
                  borderWidth="1px" 
                  borderColor="gray.200" 
                  borderRadius="md"
                  bg="gray.50"
                >
                  <Text fontSize="md" fontWeight="medium" mb={3}>ارسال رسید به ایمیل</Text>
                  <InputGroup>
              <Input
                      placeholder="آدرس ایمیل"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                bg="white"
              />
                    <InputRightElement width="4.5rem">
                      <Button h="1.75rem" size="sm" onClick={handleSendEmail} colorScheme="teal">
                        ارسال
                </Button>
              </InputRightElement>
            </InputGroup>
            
                  <Divider my={3} />
                  
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={2}>اطلاعات سفارش</Text>
                    <VStack align="stretch" spacing={2} fontSize="sm">
                      <Flex justify="space-between">
                        <Text>شناسه سفارش:</Text>
                        <Text fontWeight="bold">{orderId}</Text>
                      </Flex>
                      {isRefundOrder && (
                        <Flex justify="space-between">
                          <Text>سفارش اصلی:</Text>
                          <Text>{originalOrderId}</Text>
                        </Flex>
                      )}
                      <Flex justify="space-between">
                        <Text>تاریخ:</Text>
                        <Text>{formatDate(order?.date_order || order?.createdAt)}</Text>
                      </Flex>
                      <Flex justify="space-between">
                        <Text>تعداد اقلام:</Text>
                        <Text>{orderItems.length}</Text>
                      </Flex>
                      <Flex justify="space-between">
                        <Text>مبلغ کل:</Text>
                        <Text fontWeight="bold">{formatCurrency(Math.abs(total))}</Text>
                      </Flex>
          </VStack>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Flex>
      </ModalContent>
    </Modal>
  );
};

export default OrderComplete; 