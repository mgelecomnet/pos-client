import React, { useState, useEffect } from 'react';
import {
  Badge, 
  IconButton, 
  Tooltip, 
  HStack,
  Text,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Button,
  Box,
  Spinner,
  List,
  ListItem,
  Flex,
  useToast,
  useColorModeValue
} from '@chakra-ui/react';
import { FiCloud, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import offlineOrderService, { OFFLINE_ORDER_STATUS } from '../api/offlineOrderService';

const PendingOrdersBadge = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [lastCheck, setLastCheck] = useState(null);
  const toast = useToast();
  
  // Colors
  const bgColor = useColorModeValue('white', 'gray.800');
  
  // Load pending orders count when component mounts
  useEffect(() => {
    checkPendingOrders();
    
    // Set up interval to check every 60 seconds
    const intervalId = setInterval(checkPendingOrders, 60000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Check for pending orders
  const checkPendingOrders = async () => {
    try {
      const count = await offlineOrderService.getPendingOrdersCount();
      setPendingCount(count);
      setLastCheck(new Date());
      
      // If popover is open, also load the pending orders data
      if (isPopoverOpen) {
        const orders = await offlineOrderService.getOfflineOrders(OFFLINE_ORDER_STATUS.PENDING);
        setPendingOrders(orders);
      }
    } catch (error) {
      console.error('[PendingOrdersBadge] Error checking pending orders:', error);
    }
  };
  
  // Load order details when the popover opens
  const handlePopoverOpen = async () => {
    setIsPopoverOpen(true);
    try {
      const orders = await offlineOrderService.getOfflineOrders(OFFLINE_ORDER_STATUS.PENDING);
      setPendingOrders(orders);
      console.log('[PendingOrdersBadge] Loaded pending orders:', orders);
    } catch (error) {
      console.error('[PendingOrdersBadge] Error loading pending orders:', error);
    }
  };
  
  // Format date
  const formatDate = (date) => {
    if (!date) return 'Never';
    return date.toLocaleString();
  };
  
  // Sync all pending orders
  const syncAllPendingOrders = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      const result = await offlineOrderService.syncAllPendingOrders();
      console.log('[PendingOrdersBadge] Sync result:', result);
      
      // Show appropriate toast based on results
      if (result.successful > 0) {
        toast({
          title: 'Orders Synced',
          description: `Successfully synced ${result.successful} order(s) with the server.`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      }
      
      if (result.failed > 0) {
        toast({
          title: 'Sync Issues',
          description: `Failed to sync ${result.failed} order(s). Will retry later.`,
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      }
      
      if (result.total === 0) {
        toast({
          title: 'No Orders to Sync',
          description: 'There are no pending orders to synchronize.',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      }
      
      // Refresh the data
      await checkPendingOrders();
    } catch (error) {
      console.error('[PendingOrdersBadge] Error syncing orders:', error);
      toast({
        title: 'Sync Error',
        description: error.message || 'Failed to sync orders with server.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSyncing(false);
    }
  };
  
  // If no pending orders, don't show the badge
  if (pendingCount === 0) return null;
  
  return (
    <Popover
      isOpen={isPopoverOpen}
      onOpen={handlePopoverOpen}
      onClose={() => setIsPopoverOpen(false)}
      placement="bottom-end"
    >
      <PopoverTrigger>
        <Button
          size="sm"
          variant="ghost"
          colorScheme="yellow"
          rightIcon={<Badge colorScheme="yellow" borderRadius="full">{pendingCount}</Badge>}
          leftIcon={<FiCloud />}
        >
          Pending Orders
        </Button>
      </PopoverTrigger>
      
      <PopoverContent bg={bgColor} width="300px">
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader fontWeight="bold">
          Pending Orders ({pendingCount})
        </PopoverHeader>
        <PopoverBody>
          <Box mb={3}>
            <Text fontSize="sm" mb={2}>
              These orders have been saved locally but not yet synchronized with the server.
            </Text>
            
            {pendingOrders.length > 0 ? (
              <List spacing={2} maxH="200px" overflowY="auto">
                {pendingOrders.map(order => (
                  <ListItem key={order.localId} fontSize="sm">
                    <Flex justify="space-between" align="center">
                      <Text>
                        Order #{order.orderId} 
                        <Text as="span" fontSize="xs" color="gray.500" ml={1}>
                          ({new Date(order.timestamp).toLocaleTimeString()})
                        </Text>
                      </Text>
                      <Badge colorScheme="yellow" size="sm">Pending</Badge>
                    </Flex>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Text fontSize="sm" color="gray.500" textAlign="center">
                Loading pending orders...
              </Text>
            )}
            
            <Text fontSize="xs" color="gray.500" mt={2}>
              Last checked: {formatDate(lastCheck)}
            </Text>
          </Box>
          
          <Button
            leftIcon={isSyncing ? <Spinner size="xs" /> : <FiRefreshCw />}
            colorScheme="blue"
            size="sm"
            width="100%"
            onClick={syncAllPendingOrders}
            isLoading={isSyncing}
            loadingText="Syncing..."
          >
            Sync All Pending Orders
          </Button>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default PendingOrdersBadge; 