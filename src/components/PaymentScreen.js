import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  VStack,
  HStack,
  Divider,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Spinner,
  FormControl,
  Input,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import { FiCreditCard, FiDollarSign, FiTrash2, FiArrowLeft, FiCheck } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';
import { getLocalPOSData } from '../api/odooApi';
import { connectionStatus } from '../api/odoo';
import offlineOrderService from '../api/offlineOrderService';

const PaymentScreen = ({ 
  isOpen, 
  onClose, 
  cartTotal, 
  taxAmount,
  totalDiscount,
  totalToPay,
  selectedCustomer, 
  cart, 
  activePOSSession, 
  onPaymentComplete,
  orderId,
  orderType
}) => {
  // Payment state
  const [payments, setPayments] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const [paymentInputs, setPaymentInputs] = useState({});
  const defaultMethodRef = useRef(null);
  const toast = useToast();
  
  // Calculate remaining amount
  const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const remainingToPay = Math.max(0, parseFloat((totalToPay - totalPaid).toFixed(2)));

  // Fetch payment methods from IndexedDB
  useEffect(() => {
    if (isOpen && activePOSSession && activePOSSession.config_id) {
      fetchLocalPaymentMethods();
    }
  }, [isOpen, activePOSSession]);

  // Reset payments state when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('[Payment] Modal opened - resetting payments state');
      setPayments([]);
      setPaymentInputs({});
      localStorage.removeItem('lastPaymentData');
      
      // Initialize payment inputs after a short delay
      setTimeout(() => {
        if (paymentMethods.length > 0) {
          console.log('[Payment] Initializing payment inputs with zeroes');
          const inputs = {};
          paymentMethods.forEach(method => {
            inputs[method.id] = '0';
          });
          setPaymentInputs(inputs);
        }
      }, 100);
    }
  }, [isOpen]);
  
  // Auto-select a payment method whenever payment methods are loaded
  useEffect(() => {
    if (isOpen && paymentMethods.length > 0 && payments.length === 0) {
      console.log('[Payment] Auto-selecting default payment method');
      
      // Find card method (non-cash) or use first available
      const cardMethod = paymentMethods.find(m => !m.is_cash_count);
      const methodToUse = cardMethod || paymentMethods[0];
      
      if (methodToUse) {
        // Delay to ensure state is ready
        setTimeout(() => {
          console.log(`[Payment] Auto-selecting method ${methodToUse.id} (${methodToUse.name})`);
          handleSetMethodAsFullPayment(methodToUse.id);
        }, 300);
      }
    }
  }, [isOpen, paymentMethods]);

  // Focus on default payment method when methods are loaded
  useEffect(() => {
    if (paymentMethods.length > 0 && defaultMethodRef.current) {
      setTimeout(() => {
        defaultMethodRef.current.focus();
      }, 200);
    }
  }, [paymentMethods]);

  // Fetch payment methods from local database
  const fetchLocalPaymentMethods = async () => {
    try {
      setIsLoadingMethods(true);
      
      // Get the configuration ID from the active POS session
      const configId = activePOSSession?.config_id;
      if (!configId) {
        throw new Error('No active POS configuration found');
      }
      
      console.log(`[Payment] Using POS config ID: ${configId}`);
      
      // First get the POS config to find allowed payment methods
      console.log('[Payment] Getting POS config to find allowed payment methods');
      const configData = await getLocalPOSData.getModelData('pos.config');
      
      // Get allowed payment method IDs from config
      let allowedPaymentMethodIds = [];
      if (configData?.data?.[0]?.payment_method_ids) {
        allowedPaymentMethodIds = configData.data[0].payment_method_ids;
        console.log('[Payment] Found allowed payment methods in config:', allowedPaymentMethodIds);
      } else {
        console.error('[Payment] No allowed payment methods found in POS config');
        throw new Error('No allowed payment methods configured');
      }
      
      // Now get all payment methods and filter to allowed ones
      console.log('[Payment] Getting payment methods from pos_payment_method');
      const methodsData = await getLocalPOSData.getModelData('pos_payment_method');
      
      if (methodsData?.data && Array.isArray(methodsData.data)) {
        console.log('[Payment] Found payment methods:', methodsData.data);
        
        // Filter to allowed methods
        const paymentMethodsToUse = methodsData.data.filter(method => 
          allowedPaymentMethodIds.includes(method.id)
        );
        
        console.log('[Payment] Filtered to allowed payment methods:', paymentMethodsToUse);
        
        if (paymentMethodsToUse.length === 0) {
          throw new Error('No allowed payment methods available');
              }
        
        // Set the payment methods
        setPaymentMethods(paymentMethodsToUse);
        
        // Initialize payment inputs
        const inputs = {};
        paymentMethodsToUse.forEach(method => {
          inputs[method.id] = '0';
        });
        setPaymentInputs(inputs);
        
        // Set card method as default (first non-cash method), or first method if no card method
        const cardMethod = paymentMethodsToUse.find(m => !m.is_cash_count);
        
        if (cardMethod) {
          setTimeout(() => {
            handleSetMethodAsFullPayment(cardMethod.id);
          }, 300);
        } else if (paymentMethodsToUse.length > 0) {
          setTimeout(() => {
            handleSetMethodAsFullPayment(paymentMethodsToUse[0].id);
          }, 300);
        }
      } else {
        throw new Error('No payment methods found in database');
      }
    } catch (error) {
      console.error('[Payment] Error setting up payment methods:', error);
      toast({
        title: 'Error Loading Payment Methods',
        description: error.message || 'Failed to load payment methods from database.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      
      // Clear payment methods since we don't want defaults
      setPaymentMethods([]);
      setPaymentInputs({});
    } finally {
      setIsLoadingMethods(false);
    }
  };

  // Handle payment input change
  const handlePaymentInputChange = (methodId, value) => {
    // Clean and normalize the input
    let cleanValue = value.replace(/[^\d.,]/g, '');
    cleanValue = cleanValue.replace(',', '.');
    
    // Extract whole and decimal parts
    const parts = cleanValue.split('.');
    cleanValue = parts[0];
    if (parts.length > 1) {
      cleanValue += '.' + parts[1];
    }
    
    // Parse as number (default to 0 if empty/invalid)
    const numericValue = parseFloat(cleanValue) || 0;
    
    console.log(`[Payment] Input change for method ${methodId}: ${value} → ${numericValue}`);
    
    // First update the input field
    const newInputs = { ...paymentInputs };
    newInputs[methodId] = cleanValue || '0';
    setPaymentInputs(newInputs);
    
    // If input is 0, remove any payment for this method
    if (numericValue <= 0) {
      console.log(`[Payment] Removing payment for method ${methodId} as amount is 0`);
      setPayments(prev => prev.filter(p => p.method_id !== methodId));
      return;
    }
    
    // Get the current payments and sort by priority (non-current method first)
    // This way we'll remove from other methods in the right order
    const currentPayments = [...payments];
    const otherPayments = currentPayments.filter(p => p.method_id !== methodId);
    
    // Calculate total of other payments
    const otherPaymentTotal = otherPayments.reduce((total, p) => 
      total + parseFloat(p.amount), 0);
    
    console.log(`[Payment] Current total to pay: ${totalToPay}`);
    console.log(`[Payment] User wants to pay ${numericValue} with method ${methodId}`);
    console.log(`[Payment] Other payments total: ${otherPaymentTotal}`);
    
    // IMPORTANT: When a user manually enters a value for one method,
    // we need to adjust other methods to make room for it
    
    // First, limit the new amount to not exceed the total
    const newAmount = Math.min(numericValue, totalToPay);
    
    // If this new amount plus other payments exceeds the total, 
    // we need to reduce other payments
    if (newAmount + otherPaymentTotal > totalToPay) {
      console.log(`[Payment] Need to reduce other payments as total would be ${newAmount + otherPaymentTotal}`);
      
      // How much we need to reduce other payments by
      const reductionNeeded = (newAmount + otherPaymentTotal) - totalToPay;
      console.log(`[Payment] Reduction needed: ${reductionNeeded}`);
      
      let remainingReduction = reductionNeeded;
      const reducedPayments = [];
      
      // Sort other payments so we reduce from the last one first
      const sortedOtherPayments = [...otherPayments].sort((a, b) => 
        a.method_id - b.method_id); // Simple sort, can be improved
      
      // Reduce payments one by one until we've covered the reduction
      for (const payment of sortedOtherPayments) {
        const currentAmount = parseFloat(payment.amount);
        
        if (remainingReduction >= currentAmount) {
          // This payment will be completely removed
          console.log(`[Payment] Removing payment for method ${payment.method_id} (${currentAmount})`);
          remainingReduction -= currentAmount;
          
          // Set input to 0
          newInputs[payment.method_id] = '0';
        } else {
          // This payment will be partially reduced
          const newPaymentAmount = (currentAmount - remainingReduction).toFixed(2);
          console.log(`[Payment] Reducing payment for method ${payment.method_id} from ${currentAmount} to ${newPaymentAmount}`);
          
          reducedPayments.push({
            ...payment,
            amount: newPaymentAmount
          });
          
          // Update input field
          newInputs[payment.method_id] = newPaymentAmount;
          
          remainingReduction = 0;
        }
        
        if (remainingReduction <= 0) break;
      }
      
      // Create or update the current payment
      const currentPayment = payments.find(p => p.method_id === methodId);
      const method = paymentMethods.find(m => m.id === methodId);
      
      if (!method) {
        console.error(`[Payment] Could not find method with ID ${methodId}`);
        return;
      }
      
      // New payment array with reduced payments + current payment
      const newPaymentArray = [
        ...reducedPayments,
        {
          id: currentPayment?.id || uuidv4(),
          method_id: methodId,
          method_name: method.name,
          amount: newAmount.toFixed(2),
          date: new Date().toISOString()
        }
      ];
      
      // Update inputs and payments
      setPaymentInputs(newInputs);
      setPayments(newPaymentArray);
      
      console.log(`[Payment] New payment array:`, newPaymentArray);
    } else {
      // There's enough room for this payment without reducing others
      console.log(`[Payment] No need to reduce other payments, adding/updating payment for method ${methodId}`);
      
      // Find existing payment
    const existingPaymentIndex = payments.findIndex(p => p.method_id === methodId);
      const method = paymentMethods.find(m => m.id === methodId);
    
      if (!method) {
        console.error(`[Payment] Could not find method with ID ${methodId}`);
        return;
      }
      
      if (existingPaymentIndex >= 0) {
        // Update existing payment
        const newPayments = [...payments];
        newPayments[existingPaymentIndex] = {
          ...newPayments[existingPaymentIndex],
          amount: newAmount.toFixed(2)
        };
        console.log(`[Payment] Updated payment for method ${methodId} to ${newAmount}`);
        setPayments(newPayments);
      } else {
        // Add new payment
    const newPayment = {
      id: uuidv4(),
      method_id: methodId,
          method_name: method.name,
          amount: newAmount.toFixed(2),
          date: new Date().toISOString()
        };
        console.log(`[Payment] Added new payment for method ${methodId} with amount ${newAmount}`);
        setPayments([...payments, newPayment]);
      }
    }
  };

  // Handle setting a payment method as the full payment amount
  const handleSetMethodAsFullPayment = (methodId) => {
    console.log(`[Payment] Setting method ${methodId} as full payment amount: ${totalToPay}`);
    
    // Find the method first
    const method = paymentMethods.find(m => m.id === methodId);
    if (!method) {
      console.error(`[Payment] Could not find method with ID ${methodId}`);
      // If method not found, try to use the first available method
      if (paymentMethods.length > 0) {
        console.log('[Payment] Using first available method instead');
        handleSetMethodAsFullPayment(paymentMethods[0].id);
      }
      return;
    }
    
    // Reset all inputs
    const newInputs = { ...paymentInputs };
    Object.keys(newInputs).forEach(id => {
      newInputs[id] = '0';
    });
    
    // Set this method's input to the total
    newInputs[methodId] = totalToPay.toString();
    setPaymentInputs(newInputs);
    
    // Create a completely new payments array with just this payment
    const newPayment = {
      id: uuidv4(),
      method_id: methodId,
      method_name: method.name,
      amount: totalToPay.toFixed(2),
      date: new Date().toISOString(),
    };
    
    // Set the payments array directly
    setPayments([newPayment]);
  };

  // Process final payment
  const processPayment = async () => {
    try {
      setIsProcessing(true);
      
      // Check if this is a refund order
      const isRefundOrder = cart.some(item => item.isRefund || item.quantity < 0);
      
      if (isRefundOrder) {
        console.log('Starting refund payment processing', {
          orderId,
          cartItems: cart.length,
          totalAmount: totalToPay,
          paymentMethods: payments.map(p => p.method_name)
        });
        
        // Extract the original order ID from the refund order ID
        const originalOrderId = orderId?.split('-')[1] || '';
        if (originalOrderId) {
          console.log('Attempting to tag original order as refunded', { originalOrderId });
          try {
            // Tag the original order explicitly (in addition to automatic tagging in saveOrderOffline)
            await offlineOrderService.tagOrderAsRefunded(originalOrderId, {
              refundOrderId: isRefundOrder ? `REFUND-${originalOrderId}` : orderId,
              refundDate: new Date().toISOString(),
              refundAmount: totalToPay
            });
            console.log('Successfully tagged original order as refunded', { originalOrderId });
          } catch (tagError) {
            console.error('Error tagging original order as refunded', tagError);
          }
        }
      }

      // Safely get values from activePOSSession
      const userId = Array.isArray(activePOSSession?.user_id) 
        ? activePOSSession.user_id[0] 
        : activePOSSession?.user_id;

      const companyId = Array.isArray(activePOSSession?.company_id) 
        ? activePOSSession.company_id[0] 
        : activePOSSession?.company_id;

      const pricelistId = Array.isArray(activePOSSession?.config_id) 
        ? activePOSSession.config_id[0] 
        : activePOSSession?.config_id;

      // Get current user ID from localStorage if available
      let currentUserId = userId || 2;
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user && user.uid) {
            currentUserId = user.uid;
            console.log(`[Payment] Using user ID from localStorage: ${currentUserId}`);
          }
        }
      } catch (e) {
        console.warn('[Payment] Error getting user from localStorage:', e);
      }

      // Generate a unique order ID
      const newOrderId = orderId || uuidv4();
      
      // Ensure all refund items have proper flags and negative quantities
      const processedCart = cart.map(item => {
        if (isRefundOrder) {
          return {
            ...item,
            isRefund: true,
            quantity: item.quantity < 0 ? item.quantity : -Math.abs(item.quantity)
          };
        }
        return item;
      });
      
      if (isRefundOrder) {
        console.log('Processed cart items for refund payment', {
          before: cart.slice(0, 2), // Just log first two items to avoid large logs
          after: processedCart.slice(0, 2)
        });
      }

      // Create the order data
      const orderData = {
        id: newOrderId,
        data: {
          message_follower_ids: [],
          message_ids: [],
          website_message_ids: [],
          access_token: uuidv4(),
          name: isRefundOrder 
            ? `Refund Order ${newOrderId.slice(0, 8)}`
            : `Order ${newOrderId.slice(0, 8)}`,
          // Add refund metadata if applicable
          ...(isRefundOrder && {
            is_refund: true,
            refund_order: true,
            original_order_id: orderId?.split('-')[1] || '',
          }),
          last_order_preparation_change: JSON.stringify({
            lines: {},
            generalNote: "",
            sittingMode: orderType || "dine in"
          }),
          date_order: new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ''),
          user_id: currentUserId,
          amount_difference: false,
          amount_tax: taxAmount,
          amount_total: totalToPay,
          amount_paid: totalPaid,
          amount_return: Math.max(0, totalPaid - totalToPay),
          lines: processedCart.map(item => [
            0,
            0,
            {
              skip_change: false,
              product_id: item.id,
              attribute_value_ids: [],
              custom_attribute_value_ids: [],
              price_unit: item.price,
              qty: item.quantity,
              price_subtotal: item.price * item.quantity * (1 - (item.discount || 0) / 100),
              price_subtotal_incl: item.price * item.quantity * (1 - (item.discount || 0) / 100) * 1.15,
              price_extra: 0,
              price_type: "original",
              discount: item.discount || false,
              order_id: newOrderId,
              tax_ids: item.tax_ids || [[4, 1]], // استفاده از مالیات آیتم در صورت وجود، در غیر این صورت مالیات پیش‌فرض
              pack_lot_ids: [],
              full_product_name: item.name,
              customer_note: false,
              refund_orderline_ids: [],
              refunded_orderline_id: false,
              uuid: uuidv4(),
              note: "",
              combo_parent_id: false,
              combo_line_ids: [],
              combo_item_id: false,
              id: item.id
            }
          ]),
          company_id: companyId || 1,
          pricelist_id: pricelistId || 1,
          partner_id: selectedCustomer?.id || false,
          sequence_number: 1,
          session_id: activePOSSession?.id,
          state: 'paid',
          account_move: false,
          picking_ids: [],
          procurement_group_id: false,
          floating_order_name: false,
          general_note: "",
          nb_print: 0,
          pos_reference: isRefundOrder ? newOrderId : `Order ${newOrderId.slice(0, 8)}`,
          fiscal_position_id: false,
          payment_ids: payments.map(payment => [
            0,
            0,
            {
              name: false,
              pos_order_id: newOrderId,
              amount: parseFloat(payment.amount),
              payment_method_id: payment.method_id,
              payment_date: new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ''),
              account_move_id: false,
              card_brand: false,
              card_no: false,
              card_type: false,
              cardholder_name: false,
              create_date: false,
              create_uid: false,
              id: currentUserId,
              is_change: false,
              online_account_payment_id: false,
              payment_method_authcode: false,
              payment_method_issuer_bank: false,
              payment_method_payment_mode: false,
              payment_ref_no: false,
              payment_status: false,
              ticket: "",
              transaction_id: false,
              uuid: uuidv4(),
              write_date: false,
              write_uid: false
            }
          ]),
          to_invoice: false,
          shipping_date: false,
          is_tipped: false,
          tip_amount: false,
          ticket_code: generateRandomString(5),
          uuid: newOrderId,
          has_deleted_line: false,
          create_uid: false,
          create_date: false,
          write_uid: false,
          write_date: false,
          employee_id: false,
          next_online_payment_amount: false,
          table_id: false,
          customer_count: false,
          takeaway: false,
          table_stand_number: false
        }
      };

      console.log('[Payment] Processing order with data:', orderData);

      // Save order offline first
      const savedOrder = await offlineOrderService.saveOrderOffline(orderData);
      
      if (savedOrder) {
        // Try to sync if online
        if (connectionStatus.isOnline) {
          try {
            await offlineOrderService.syncOrder(savedOrder.localId);
            if (isRefundOrder) {
              console.log('Synced refund order with server', { orderId: newOrderId });
            }
          } catch (syncError) {
            console.error('[Payment] Error syncing order:', syncError);
            if (isRefundOrder) {
              console.error('Error syncing refund order with server', syncError);
            }
          }
        } else if (isRefundOrder) {
          console.log('Device is offline, refund order saved locally only', { orderId: newOrderId });
        }

        // Clear payment state
        setPayments([]);
        setPaymentInputs({});
        
        // Clean up any refund-related localStorage items
        if (isRefundOrder) {
          try {
            // Find any localStorage items related to this refund
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (
                  key.includes(`pos_cart_${orderId}`) ||
                  key === 'refund_items' || 
                  key === 'refund_order_id' ||
                  key === 'pending_refund_items' ||
                  key === 'pending_refund_order_id'
                )) {
                localStorage.removeItem(key);
                console.log(`Removed localStorage item after payment: ${key}`);
              }
            }
            
            console.log('Payment completed successfully for refund order', { 
              orderId: newOrderId,
              serverOrderId: savedOrder.serverId,
              status: 'completed' 
            });
          } catch (e) {
            console.error('Error cleaning up localStorage after refund payment', e);
          }
        }
        
        // Notify success
        toast({
          title: isRefundOrder ? "پردازش بازگشت موفق" : "پرداخت موفق",
          description: isRefundOrder 
            ? "بازگشت سفارش با موفقیت پردازش شد."
            : "سفارش با موفقیت پردازش شد.",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        
        // Close modal and notify parent
        onPaymentComplete(savedOrder);
        onClose();
      }
    } catch (error) {
      console.error('[Payment] Error processing payment:', error);
      
      // Log refund payment error
      if (cart.some(item => item.isRefund || item.quantity < 0)) {
        console.error('Error processing refund payment', error);
      }
      
      toast({
        title: "Payment Failed",
        description: error.message || "There was an error processing the payment.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate a random string for ticket code
  const generateRandomString = (length) => {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" closeOnOverlayClick={false}>
      <ModalOverlay />
      <ModalContent data-payment-active="true">
        <ModalHeader>Payment</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Box mb={4}>
            <Heading size="md" mb={2}>Order Summary</Heading>
            <Flex justify="space-between" mb={1}>
                  <Text>Subtotal:</Text>
                  <Text>${cartTotal.toFixed(2)}</Text>
                </Flex>
            {totalDiscount > 0 && (
              <Flex justify="space-between" mb={1}>
                  <Text>Discount:</Text>
                <Text color="green.500">-${totalDiscount.toFixed(2)}</Text>
                </Flex>
            )}
            <Flex justify="space-between" mb={1}>
              <Text>Tax (15%):</Text>
                  <Text>${taxAmount.toFixed(2)}</Text>
                </Flex>
                <Divider my={2} />
                <Flex justify="space-between" fontWeight="bold">
              <Text>Total:</Text>
                  <Text>${totalToPay.toFixed(2)}</Text>
              </Flex>
            </Box>

          {/* Payment methods section with input fields */}
          <Box mb={4}>
            <Heading size="md" mb={3}>Payment Methods</Heading>
            
            {isLoadingMethods ? (
              <Flex justify="center" my={4}>
                <Spinner size="md" />
                <Text ml={2}>Loading payment methods...</Text>
              </Flex>
            ) : (
              <VStack spacing={3} align="stretch" mb={4} maxH="400px" overflowY="auto">
                {paymentMethods.map(method => {
                  const isDefault = !method.is_cash_count; // Bank card as default
                  return (
                    <HStack key={method.id} spacing={2}>
              <FormControl>
                <InputGroup>
                          <InputLeftElement
                            pointerEvents="none"
                            color="gray.300"
                            fontSize="1.2em"
                          >
                            {method.is_cash_count ? <FiDollarSign /> : <FiCreditCard />}
                          </InputLeftElement>
                  <Input 
                    type="text" 
                            placeholder="0.00"
                            ref={isDefault ? defaultMethodRef : null}
                            value={paymentInputs[method.id] || ''}
                            onChange={(e) => handlePaymentInputChange(method.id, e.target.value)}
                            borderColor={isDefault ? "blue.500" : "gray.200"}
                    onClick={(e) => e.target.select()}
                    inputMode="decimal"
                  />
                </InputGroup>
              </FormControl>
                <Button 
                        colorScheme={method.is_cash_count ? "green" : "blue"}
                        onClick={() => handleSetMethodAsFullPayment(method.id)}
                        minW="170px"
                      >
                        {method.name}
                </Button>
                    </HStack>
                  );
                })}
              </VStack>
            )}
            </Box>

          {/* Current payments */}
          <Box mb={4}>
            <Heading size="md" mb={2}>Payment Details</Heading>
            {payments.length > 0 ? (
              <>
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Method</Th>
                      <Th isNumeric>Amount</Th>
                      <Th width="50px"></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {payments.map(payment => (
                      <Tr key={payment.id}>
                        <Td>{payment.method_name}</Td>
                        <Td isNumeric>${parseFloat(payment.amount).toFixed(2)}</Td>
                        <Td>
                          <IconButton
                            aria-label="Remove payment"
                            icon={<FiTrash2 />}
                            size="xs"
                            colorScheme="red"
                            variant="ghost"
                            onClick={() => {
                              console.log(`[Payment] Removing payment ${payment.id} for method ${payment.method_id}`);
                              // Update input to zero
                              const newInputs = { ...paymentInputs };
                              newInputs[payment.method_id] = '0';
                              setPaymentInputs(newInputs);
                              
                              // Remove from payments array
                              setPayments(prev => prev.filter(p => p.id !== payment.id));
                            }}
                          />
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
                
                <Divider my={2} />
                <Flex justify="space-between" fontWeight="bold">
                  <Text>Total Paid:</Text>
                  <Text>${totalPaid.toFixed(2)}</Text>
                </Flex>
                
                <Flex justify="space-between" mt={1}>
                  <Text>Remaining:</Text>
                  <Text color={remainingToPay > 0 ? "red.500" : "green.500"}>
                    ${remainingToPay.toFixed(2)}
                  </Text>
                      </Flex>
                
                {totalPaid > totalToPay && (
                  <Flex justify="space-between" mt={1}>
                    <Text>Change:</Text>
                    <Text color="green.500">
                      ${(totalPaid - totalToPay).toFixed(2)}
                    </Text>
                    </Flex>
                )}
              </>
            ) : (
              <Text color="gray.500" textAlign="center" py={4}>
                No payments added yet
              </Text>
            )}
          </Box>
        </ModalBody>

        <ModalFooter>
          <Button 
            colorScheme="gray" 
            mr={3} 
            leftIcon={<FiArrowLeft />}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button 
            colorScheme="green" 
            leftIcon={<FiCheck />}
            onClick={processPayment}
            isLoading={isProcessing}
            loadingText="Processing"
            isDisabled={payments.length === 0 || remainingToPay > 0 || isProcessing}
          >
            Confirm Payment
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default PaymentScreen; 