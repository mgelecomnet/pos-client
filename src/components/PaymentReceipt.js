import React, { useRef, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  VStack,
  Divider,
  Center,
  Image,
  IconButton,
  useColorModeValue,
  useToast
} from '@chakra-ui/react';
import { FiPrinter } from 'react-icons/fi';
import { QRCodeSVG } from 'qrcode.react';
import '@fontsource/roboto-mono';

/**
 * Payment receipt component that displays the full order details in a format
 * suitable for printing on a narrow thermal printer.
 */
const PaymentReceipt = ({ order, companyInfo, printRef }) => {
  const toast = useToast();
  const receiptRef = useRef(null);
  const receiptBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');

  // Function to handle printing
  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (!printWindow) {
      toast({
        title: 'خطا در چاپ',
        description: 'لطفاً pop-up blocker را غیرفعال کنید و دوباره امتحان کنید.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Add necessary styles for printing
    printWindow.document.write(`
      <html>
        <head>
          <title>رسید پرداخت</title>
          <style>
            @media print {
              @page {
                size: 80mm auto; /* 80mm width for standard thermal receipt */
                margin: 0;
              }
              body {
                font-family: 'Roboto Mono', monospace;
                background-color: white;
                color: black;
                font-size: 12px;
                margin: 5mm;
                padding: 0;
                width: 70mm;
              }
              .receipt {
                width: 70mm;
                padding: 5mm;
                text-align: center;
              }
              .divider {
                border-top: 1px dashed #ccc;
                margin: 10px 0;
              }
              .text-left { text-align: left; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .bold { font-weight: bold; }
              .items {
                width: 100%;
              }
              .items th, .items td {
                text-align: right;
                padding: 2px 0;
              }
              .items th:first-child, .items td:first-child {
                text-align: left;
              }
              .total-row {
                font-weight: bold;
              }
              .receipt-info {
                margin-top: 10px;
                font-size: 10px;
              }
              .qr-code {
                margin: 10px auto;
              }
              .print-button { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Trigger print after content is rendered
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Set the ref for parent components
  useEffect(() => {
    if (printRef) {
      printRef.current = {
        print: handlePrint
      };
    }
  }, [printRef]);

  // Format date to Persian locale if possible
  const formatDate = (dateString) => {
    if (!dateString) return 'تاریخ ثبت نشده';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      // Fallback to standard ISO format
      return new Date(dateString).toISOString().split('T').join(' ');
    }
  };

  // Format numbers with commas
  const formatNumber = (num) => {
    return Number(num).toLocaleString('fa-IR');
  };
  
  // Format currency with proper symbol position
  const formatCurrency = (amount) => {
    const currency = companyInfo.currency || { symbol: '$', name: 'USD', position: 'before' };
    const formattedNumber = formatNumber(amount);
    
    if (currency.position === 'before') {
      return `${currency.symbol} ${formattedNumber}`;
    } else {
      return `${formattedNumber} ${currency.symbol}`;
    }
  };

  // Get order items from the order data
  const getOrderItems = () => {
    if (!order) return [];
    
    // Try to get from order.data.lines (Odoo format)
    if (order.data && order.data.lines && Array.isArray(order.data.lines)) {
      return order.data.lines.map(line => {
        // Handle line data structure [0, 0, {actual data}]
        const lineData = line[2] || line;
        const price = parseFloat(lineData.price_unit || 0);
        const quantity = parseFloat(lineData.qty || 0);
        const discount = parseFloat(lineData.discount || 0);
        
        return {
          id: lineData.id,
          name: lineData.full_product_name || lineData.name || 'محصول ناشناخته',
          quantity: quantity,
          price: price,
          // محاسبه جمع بدون در نظر گرفتن تخفیف
          total: price * quantity,
          discount: discount,
          // محاسبه مقدار تخفیف هر آیتم
          discountAmount: price * quantity * (discount / 100)
        };
      });
    }
    
    // Try order.items format
    if (order.items && Array.isArray(order.items)) {
      return order.items.map(item => {
        const price = parseFloat(item.price || 0);
        const quantity = parseFloat(item.quantity || 1);
        const discount = parseFloat(item.discount || 0);
        
        return {
          id: item.id,
          name: item.name,
          quantity: quantity,
          price: price,
          // محاسبه جمع بدون در نظر گرفتن تخفیف
          total: price * quantity,
          discount: discount,
          // محاسبه مقدار تخفیف هر آیتم
          discountAmount: price * quantity * (discount / 100)
        };
      });
    }
    
    // Try cart from POSPage
    if (order.cart && Array.isArray(order.cart) && order.cart.length > 0) {
      return order.cart.map(item => {
        const price = parseFloat(item.price || 0);
        const quantity = parseFloat(item.quantity || 1);
        const discount = parseFloat(item.discount || 0);
        
        return {
          id: item.id,
          name: item.name,
          quantity: quantity,
          price: price,
          // محاسبه جمع بدون در نظر گرفتن تخفیف
          total: price * quantity,
          discount: discount,
          // محاسبه مقدار تخفیف هر آیتم
          discountAmount: price * quantity * (discount / 100)
        };
      });
    }
    
    // Try refundData.refundItems for refund orders
    if (order.refundData && order.refundData.refundItems && Array.isArray(order.refundData.refundItems)) {
      return order.refundData.refundItems.map(item => {
        const price = parseFloat(item.price || 0);
        const quantity = -Math.abs(parseFloat(item.quantity || 1)); // Ensure negative for refunds
        const discount = parseFloat(item.discount || 0);
        
        return {
          id: item.productId,
          name: item.name,
          quantity: quantity,
          price: price,
          // محاسبه جمع بدون در نظر گرفتن تخفیف
          total: price * Math.abs(quantity),
          discount: discount,
          // محاسبه مقدار تخفیف هر آیتم
          discountAmount: price * Math.abs(quantity) * (discount / 100)
        };
      });
    }
    
    return [];
  };

  // Get payment methods from the order
  const getPaymentMethods = () => {
    if (!order) return [];
    
    // Get payment information from order data
    const payments = order.payment_ids || order.data?.payment_ids || [];
    return payments.map(payment => {
      // Handle payment data structure [0, 0, {actual data}]
      const paymentData = Array.isArray(payment) && payment.length > 2 ? payment[2] : payment;
      return {
        method: paymentData.method_name || 'روش پرداخت نامشخص',
        amount: parseFloat(paymentData.amount || 0)
      };
    });
  };

  // Get order totals
  const getTotals = () => {
    if (!order) return { subtotal: 0, tax: 0, total: 0 };
    
    // Get totals from order data - prioritize direct values passed to us
    const subtotal = parseFloat(order.amount_subtotal || 
                              (order.amount_total || order.data?.amount_total || 0) - 
                              (order.amount_tax || order.data?.amount_tax || 0));
    const tax = parseFloat(order.amount_tax || order.data?.amount_tax || 0);
    const total = parseFloat(order.amount_total || order.data?.amount_total || 0);
    const discount = parseFloat(order.totalDiscount || order.data?.totalDiscount || 0);
    
    return { 
      subtotal: isNaN(subtotal) ? 0 : subtotal, 
      tax: isNaN(tax) ? 0 : tax, 
      total: isNaN(total) ? 0 : total,
      discount: isNaN(discount) ? 0 : discount
    };
  };

  const orderItems = getOrderItems();
  const paymentMethods = getPaymentMethods();
  const { subtotal, tax, total, discount } = getTotals();
  const orderId = order?.id || order?.data?.id || 'شناسه نامشخص';
  const orderDate = order?.date_order || order?.data?.date_order || order?.createdAt || new Date();

  // Is this a refund order?
  const isRefund = orderId.startsWith('REFUND-') || 
                  order?.isRefund || 
                  order?.data?.is_refund || 
                  (orderItems.some(item => item.quantity < 0));
  
  // Calculate tax rate
  const taxRate = order?.taxRate || (subtotal > 0 ? Math.round((tax / subtotal) * 100) : 15);
  
  // Calculate total discount manually from all items
  const totalDiscount = orderItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
  
  // Calculate subtotal without discount
  const subtotalBeforeDiscount = orderItems.reduce((sum, item) => sum + Math.abs(item.total || 0), 0);

  return (
    <Box>
      {/* Receipt container */}
      <Box
        ref={receiptRef}
        className="receipt"
        width="100%"
        maxWidth="320px"
        mx="auto"
        p={2}
        bg={receiptBg}
        borderWidth="1px"
        borderColor={borderColor}
        borderRadius="md"
        boxShadow="sm"
        overflow="hidden"
        fontFamily="'Roboto Mono', monospace"
        dir="rtl"
      >
        {/* Receipt header */}
        <Center flexDirection="column" mb={1}>
          {companyInfo.logo && (
            <Image 
              src={companyInfo.logo} 
              alt={companyInfo.name}
              maxHeight="36px"
              mb={1}
            />
          )}
          <Text fontWeight="bold" fontSize="md">{companyInfo.name}</Text>
          <Text fontSize="2xs">{companyInfo.address}</Text>
          <Text fontSize="2xs">{companyInfo.phone}</Text>
          <Text fontSize="2xs">{companyInfo.taxId}</Text>
          <Text fontSize="2xs">{companyInfo.website}</Text>
        </Center>

        <Divider borderStyle="dashed" my={1} />

        {/* Order info */}
        <Flex justify="space-between" my={1} fontSize="2xs">
          <Text>شماره فاکتور:</Text>
          <Text fontWeight="bold" dir="ltr">{order?.invoiceNumber || orderId}</Text>
        </Flex>
        <Flex justify="space-between" my={1} fontSize="2xs">
          <Text>تاریخ:</Text>
          <Text>{formatDate(orderDate)}</Text>
        </Flex>
        <Flex justify="space-between" my={1} fontSize="2xs">
          <Text>کاربر:</Text>
          <Text>{companyInfo.cashierName}</Text>
        </Flex>

        {isRefund && (
          <Box 
            bg="red.50" 
            p={1} 
            borderRadius="md" 
            my={1} 
            textAlign="center"
          >
            <Text fontWeight="bold" color="red.600" fontSize="2xs">بازگشت وجه</Text>
          </Box>
        )}

        <Divider borderStyle="dashed" my={1} />

        {/* Items table */}
        <VStack align="stretch" spacing={0} className="items-table">
          <Flex justify="space-between" fontWeight="bold" fontSize="2xs" pb={1}>
            <Text width="40%">کالا</Text>
            <Text width="20%" textAlign="center">تعداد</Text>
            <Text width="20%" textAlign="center">قیمت</Text>
            <Text width="20%" textAlign="center">جمع</Text>
          </Flex>

          {orderItems.map((item, idx) => (
            <Box key={idx} fontSize="2xs" mb={1}>
              <Text fontWeight="medium" mb={0}>{item.name}</Text>
              <Flex justify="space-between">
                <Text width="40%"></Text>
                <Text width="20%" textAlign="center">{Math.abs(item.quantity).toFixed(item.quantity % 1 > 0 ? 2 : 0)}</Text>
                <Text width="20%" textAlign="center">{formatCurrency(Math.abs(item.price))}</Text>
                <Text width="20%" textAlign="center" fontWeight="bold">{formatCurrency(Math.abs(item.total))}</Text>
              </Flex>
              {item.discount > 0 && (
                <Flex>
                  <Text width="40%"></Text>
                  <Text width="60%" fontSize="2xs" color="green.600" textAlign="left">دارای تخفیف: {item.discount}%</Text>
                </Flex>
              )}
            </Box>
          ))}
        </VStack>

        <Divider borderStyle="dashed" my={1} />

        {/* Totals */}
        <VStack align="stretch" spacing={0} mb={1}>
          <Flex justify="space-between" fontSize="2xs">
            <Text>جمع کالاها:</Text>
            <Text>{formatCurrency(Math.abs(subtotalBeforeDiscount || 0))}</Text>
          </Flex>
          {totalDiscount > 0 && (
            <Flex justify="space-between" fontSize="2xs">
              <Text>تخفیف:</Text>
              <Text color="green.600">- {formatCurrency(Math.abs(totalDiscount || 0))}</Text>
            </Flex>
          )}
          <Flex justify="space-between" fontSize="2xs">
            <Text>مالیات ({taxRate}%):</Text>
            <Text>{formatCurrency(Math.abs(tax || 0))}</Text>
          </Flex>
          <Box h={1} />
          <Flex justify="space-between" fontWeight="bold" fontSize="xs">
            <Text>جمع کل:</Text>
            <Text>{formatCurrency(Math.abs(total || 0))}</Text>
          </Flex>
        </VStack>

        <Divider borderStyle="dashed" my={1} />

        {/* Payment methods */}
        <VStack align="stretch" spacing={0}>
          <Text fontWeight="bold" fontSize="2xs">روش‌های پرداخت:</Text>
          {paymentMethods.map((payment, idx) => (
            <Flex key={idx} justify="space-between" fontSize="2xs">
              <Text>{payment.method}:</Text>
              <Text>{formatCurrency(payment.amount)}</Text>
            </Flex>
          ))}
        </VStack>

        {/* QR Code for digital receipt */}
        <Center my={2}>
          <QRCodeSVG 
            value={`https://my-pos-system.com/receipt/${orderId}`} 
            size={60}
            className="qr-code"
          />
        </Center>

        {/* Footer text */}
        <VStack align="center" spacing={0} className="receipt-info" mt={1}>
          <Text fontSize="2xs" textAlign="center">
            از خرید شما متشکریم
          </Text>
          <Text fontSize="2xs" color={mutedColor}>
            این رسید به عنوان گارانتی کالای خریداری شده است
          </Text>
          <Text fontSize="2xs" color={mutedColor}>
            لطفا تا پایان مدت گارانتی آن را نگه دارید
          </Text>
        </VStack>
      </Box>
    </Box>
  );
};

export default PaymentReceipt; 