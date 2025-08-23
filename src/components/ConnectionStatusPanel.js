import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  Badge,
  HStack,
  VStack,
  Divider,
  Spinner,
  useColorModeValue,
  Flex,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Icon,
  Switch,
  FormControl,
  FormLabel,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Tooltip,
  Code,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import { 
  FiWifi, 
  FiWifiOff, 
  FiRefreshCw, 
  FiClock, 
  FiServer, 
  FiCheck, 
  FiX, 
  FiAlertTriangle,
  FiSettings,
  FiDatabase
} from 'react-icons/fi';
import { connectionStatus } from '../api/odoo';

const ConnectionStatusPanel = () => {
  const [isOnline, setIsOnline] = useState(connectionStatus.isOnline);
  const [lastChecked, setLastChecked] = useState(connectionStatus.lastChecked);
  const [isChecking, setIsChecking] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [connectionHistory, setConnectionHistory] = useState([]);
  const [pingDetails, setPingDetails] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);
  const maxHistoryItems = 20;
  const intervalRef = useRef(null);

  useEffect(() => {
    // Add connection status change listener
    const handleStatusChange = (status) => {
      setIsOnline(status);
      setLastChecked(connectionStatus.lastChecked);
      
      // Add to history
      setConnectionHistory(prev => {
        const newHistory = [
          {
            timestamp: new Date(),
            status: status ? 'connected' : 'disconnected',
            pingTime: connectionStatus.pingTime
          },
          ...prev
        ].slice(0, maxHistoryItems); // Keep only the last N items
        
        return newHistory;
      });
    };
    
    connectionStatus.addListener(handleStatusChange);
    
    // Initial status check
    checkConnection();
    
    // Set up auto-refresh
    if (autoRefresh) {
      startAutoRefresh();
    }
    
    return () => {
      connectionStatus.removeListener(handleStatusChange);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  // Handle auto-refresh toggle
  useEffect(() => {
    if (autoRefresh) {
      startAutoRefresh();
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [autoRefresh, refreshInterval]);
  
  const startAutoRefresh = () => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Set up new interval
    intervalRef.current = setInterval(() => {
      checkConnection();
    }, refreshInterval * 1000);
  };
  
  const checkConnection = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    const startTime = performance.now();
    
    try {
      // Check connection status
      const status = await connectionStatus.checkConnection();
      setIsOnline(status);
      setLastChecked(new Date());
      
      // Calculate response time
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);
      
      // Store ping details
      setPingDetails({
        timestamp: new Date(),
        responseTime,
        success: status
      });
      
      // Try to get server info if connected
      if (status) {
        try {
          // We would normally get this from the server
          setServerInfo({
            version: 'Odoo 18.0',
            database: localStorage.getItem('db_name') || 'Unknown',
            lastSync: new Date(),
            serverTime: new Date()
          });
        } catch (error) {
          console.error('Error fetching server info:', error);
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setIsChecking(false);
    }
  };
  
  const handleChangeInterval = (value) => {
    const newInterval = parseInt(value, 10);
    setRefreshInterval(newInterval);
    
    // Reset interval timer if auto-refresh is on
    if (autoRefresh) {
      startAutoRefresh();
    }
  };
  
  const formatDate = (date) => {
    if (!date) return 'Never';
    return date.toLocaleString('fa-IR');
  };
  
  const formatTime = (milliseconds) => {
    if (!milliseconds) return 'N/A';
    return `${milliseconds}ms`;
  };

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const headingColor = useColorModeValue('gray.700', 'white');
  const statusBg = isOnline ? useColorModeValue('green.50', 'green.900') : useColorModeValue('red.50', 'red.900');
  const statusColor = isOnline ? useColorModeValue('green.500', 'green.200') : useColorModeValue('red.500', 'red.200');
  
  return (
    <Box bg={bgColor} p={5} borderRadius="md" boxShadow="md" width="100%">
      <VStack spacing={6} align="stretch">
        {/* Header section */}
        <HStack spacing={4} alignItems="center">
          <Heading size="md" color={headingColor}>
            <Icon as={FiServer} mr={2} />
            وضعیت اتصال به سرور
          </Heading>
          <Button
            leftIcon={isChecking ? <Spinner size="sm" /> : <FiRefreshCw />}
            colorScheme="blue"
            size="sm"
            onClick={checkConnection}
            isLoading={isChecking}
            loadingText="در حال بررسی..."
          >
            بررسی اتصال
          </Button>
        </HStack>
        
        <Divider />
        
        {/* Current status section */}
        <Flex 
          direction="row" 
          bg={statusBg} 
          p={4} 
          borderRadius="md" 
          alignItems="center"
          justifyContent="space-between"
        >
          <HStack>
            <Icon 
              as={isOnline ? FiWifi : FiWifiOff} 
              boxSize={8} 
              color={statusColor}
            />
            <Box>
              <Text fontWeight="bold" fontSize="lg" color={statusColor}>
                {isOnline ? 'متصل به سرور' : 'عدم اتصال به سرور'}
              </Text>
              <Text fontSize="sm" color="gray.500">
                آخرین بررسی: {formatDate(lastChecked)}
              </Text>
            </Box>
          </HStack>
          
          {pingDetails && (
            <Badge 
              colorScheme={pingDetails.responseTime < 500 ? 'green' : 
                          pingDetails.responseTime < 1000 ? 'yellow' : 'red'}
              fontSize="sm"
              py={1}
              px={2}
            >
              {formatTime(pingDetails.responseTime)}
            </Badge>
          )}
        </Flex>
        
        {/* Server info accordion */}
        <Accordion allowToggle defaultIndex={[0]}>
          <AccordionItem border="none">
            <AccordionButton px={4} py={2} bg="gray.50" borderRadius="md">
              <Box flex="1" textAlign="right" fontWeight="medium">
                <Icon as={FiDatabase} mr={2} />
                اطلاعات سرور
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4} pt={4} bg="gray.50" borderBottomRadius="md">
              {serverInfo ? (
                <VStack align="stretch" spacing={2}>
                  <HStack justify="space-between">
                    <Text fontWeight="medium">نسخه Odoo:</Text>
                    <Code>{serverInfo.version}</Code>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontWeight="medium">دیتابیس:</Text>
                    <Code>{serverInfo.database}</Code>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontWeight="medium">آخرین همگام‌سازی:</Text>
                    <Text>{formatDate(serverInfo.lastSync)}</Text>
                  </HStack>
                </VStack>
              ) : (
                <Text color="gray.500" textAlign="center">
                  {isOnline ? 'در حال دریافت اطلاعات...' : 'اطلاعات سرور در دسترس نیست'}
                </Text>
              )}
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
        
        {/* Connection history table */}
        <Box>
          <Heading size="sm" mb={2}>
            <Icon as={FiClock} mr={2} />
            تاریخچه اتصال
          </Heading>
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>زمان</Th>
                  <Th>وضعیت</Th>
                  <Th isNumeric>زمان پاسخ</Th>
                </Tr>
              </Thead>
              <Tbody>
                {connectionHistory.length > 0 ? (
                  connectionHistory.map((record, index) => (
                    <Tr key={index}>
                      <Td>{formatDate(record.timestamp)}</Td>
                      <Td>
                        <Badge 
                          colorScheme={record.status === 'connected' ? 'green' : 'red'}
                        >
                          {record.status === 'connected' ? 'متصل' : 'قطع'}
                        </Badge>
                      </Td>
                      <Td isNumeric>{formatTime(record.pingTime)}</Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={3} textAlign="center">
                      تاریخچه‌ای ثبت نشده است
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </Box>
        </Box>
        
        {/* Settings section */}
        <Box bg="gray.50" p={4} borderRadius="md">
          <Heading size="sm" mb={3}>
            <Icon as={FiSettings} mr={2} />
            تنظیمات
          </Heading>
          <HStack spacing={6}>
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="auto-refresh" mb="0" fontSize="sm">
                بررسی خودکار
              </FormLabel>
              <Switch 
                id="auto-refresh" 
                isChecked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                colorScheme="blue"
              />
            </FormControl>
            
            {autoRefresh && (
              <FormControl display="flex" alignItems="center" maxW="200px">
                <FormLabel htmlFor="refresh-interval" mb="0" fontSize="sm" whiteSpace="nowrap">
                  بازه زمانی (ثانیه):
                </FormLabel>
                <NumberInput 
                  id="refresh-interval"
                  min={5} 
                  max={300} 
                  step={5}
                  value={refreshInterval}
                  onChange={handleChangeInterval}
                  size="sm"
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>
            )}
          </HStack>
        </Box>
      </VStack>
    </Box>
  );
};

export default ConnectionStatusPanel; 