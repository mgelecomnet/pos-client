import React, { useState, useEffect } from 'react';
import {
  Badge, 
  Box, 
  Tooltip, 
  IconButton, 
  Text,
  HStack,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Button,
  Spinner,
  useColorModeValue
} from '@chakra-ui/react';
import { FiWifi, FiWifiOff, FiRefreshCw } from 'react-icons/fi';
import { connectionStatus } from '../api/odoo';

/**
 * Connection status indicator component
 * Shows current connection status to Odoo server and allows manual refresh
 */
const ConnectionStatus = ({ showText = false, size = "md" }) => {
  const [isOnline, setIsOnline] = useState(connectionStatus.isOnline);
  const [lastChecked, setLastChecked] = useState(connectionStatus.lastChecked);
  const [isChecking, setIsChecking] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // Colors
  const onlineColor = useColorModeValue('green.500', 'green.300');
  const offlineColor = useColorModeValue('red.500', 'red.300');
  const bgColor = useColorModeValue('white', 'gray.800');
  
  // Update status when connection status changes
  useEffect(() => {
    const handleStatusChange = (status) => {
      setIsOnline(status);
      setLastChecked(connectionStatus.lastChecked);
    };
    
    // Add listener for status changes
    connectionStatus.addListener(handleStatusChange);
    
    // Initialize with current status
    setIsOnline(connectionStatus.isOnline);
    setLastChecked(connectionStatus.lastChecked);
    
    // Start periodic checking (every 30 seconds)
    const intervalId = connectionStatus.startPeriodicCheck(30000);
    
    // Clean up
    return () => {
      clearInterval(intervalId);
      connectionStatus.removeListener(handleStatusChange);
    };
  }, []);
  
  // Format last checked time
  const formatLastChecked = () => {
    if (!lastChecked) return 'هرگز';
    
    const now = new Date();
    const diff = now - lastChecked;
    
    // Less than a minute
    if (diff < 60000) {
      return 'چند لحظه پیش';
    }
    
    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} دقیقه پیش`;
    }
    
    // Show full time
    return lastChecked.toLocaleTimeString();
  };
  
  // Manually check connection
  const handleCheckConnection = async () => {
    setIsChecking(true);
    await connectionStatus.checkConnection();
    setIsOnline(connectionStatus.isOnline);
    setLastChecked(connectionStatus.lastChecked);
    setIsChecking(false);
  };
  
  return (
    <Popover
      isOpen={isPopoverOpen}
      onOpen={() => setIsPopoverOpen(true)}
      onClose={() => setIsPopoverOpen(false)}
      placement="bottom-end"
    >
      <PopoverTrigger>
        <Box display="inline-block">
          <HStack 
            as={Button} 
            variant="ghost" 
            size={size}
            cursor="pointer"
            borderRadius="md"
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          >
            {isOnline ? (
              <FiWifi color={onlineColor} />
            ) : (
              <FiWifiOff color={offlineColor} />
            )}
            
            {showText && (
              <Text fontSize={size === "sm" ? "xs" : "sm"} color={isOnline ? onlineColor : offlineColor}>
                {isOnline ? 'آنلاین' : 'آفلاین'}
              </Text>
            )}
          </HStack>
        </Box>
      </PopoverTrigger>
      
      <PopoverContent bg={bgColor} borderColor="gray.200" width="250px" dir="rtl">
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader fontWeight="bold" borderBottomWidth="1px">
          وضعیت اتصال به سرور Odoo
        </PopoverHeader>
        <PopoverBody>
          <Box mb={3}>
            <HStack justify="space-between" mb={2}>
              <Text>وضعیت:</Text>
              <Badge colorScheme={isOnline ? 'green' : 'red'}>
                {isOnline ? 'متصل' : 'قطع ارتباط'}
              </Badge>
            </HStack>
            
            <HStack justify="space-between">
              <Text>آخرین بررسی:</Text>
              <Text fontSize="sm">{formatLastChecked()}</Text>
            </HStack>
          </Box>
          
          <Button
            leftIcon={isChecking ? <Spinner size="sm" /> : <FiRefreshCw />}
            colorScheme="blue"
            size="sm"
            width="full"
            onClick={handleCheckConnection}
            isLoading={isChecking}
          >
            بررسی مجدد اتصال
          </Button>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default ConnectionStatus; 