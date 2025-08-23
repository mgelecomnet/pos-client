import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  VStack, 
  Text, 
  Code, 
  Heading, 
  Divider, 
  Badge, 
  useToast 
} from '@chakra-ui/react';
import { authService } from '../api/odoo';
import odooApi, { odooConfig } from '../api/odooApi';

const SessionTest = () => {
  const [sessionInfo, setSessionInfo] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const [requestLog, setRequestLog] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // Function to check the current user from localStorage
  const checkCurrentUser = () => {
    const userData = authService.getCurrentUser();
    
    // Log the session ID information
    console.log('[TEST] Current user from localStorage:', userData);
    console.log('[TEST] Session ID:', userData?.session_id);
    
    // Get cookies
    const cookies = document.cookie.split(';').map(cookie => cookie.trim());
    const sessionCookie = cookies.find(c => c.startsWith('session_id='));
    
    console.log('[TEST] Session cookie:', sessionCookie);
    
    return { userData, sessionCookie };
  };

  // Function to test connection and session
  const testConnection = async () => {
    setIsLoading(true);
    addToLog('Starting connection test...');
    
    try {
      // First check local storage and cookies
      const { userData, sessionCookie } = checkCurrentUser();
      addToLog(`Found user in localStorage: ${userData ? 'Yes' : 'No'}`);
      addToLog(`User ID: ${userData?.uid || 'Not found'}`);
      addToLog(`Session ID in localStorage: ${userData?.session_id || 'Not found'}`);
      addToLog(`Session cookie: ${sessionCookie || 'Not found'}`);
      
      // Test connection using the utility function
      const result = await odooConfig.testConnection();
      
      if (result.success) {
        setConnectionStatus('success');
        setSessionInfo(result);
        addToLog('Connection successful! Session is valid.');
      } else {
        setConnectionStatus('error');
        setSessionInfo(result);
        addToLog(`Connection test failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[TEST] Error testing connection:', error);
      setConnectionStatus('error');
      setSessionInfo({ error: error.message });
      addToLog(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to add entries to the request log
  const addToLog = (message) => {
    setRequestLog(prevLog => [
      ...prevLog, 
      { time: new Date().toISOString(), message }
    ]);
  };

  // Test a basic API call to fetch product categories
  const testAPICall = async () => {
    setIsLoading(true);
    addToLog('Testing API call: Get product categories...');
    
    try {
      const response = await odooApi.post('/web/dataset/call_kw', {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.category',
          method: 'search_read',
          args: [
            [], 
            ['id', 'name', 'parent_id', 'child_ids']
          ],
          kwargs: { limit: 10 },
        },
      });
      
      if (response.data && response.data.result) {
        const categories = response.data.result;
        addToLog(`Successfully retrieved ${categories.length} categories`);
        console.log('[TEST] Categories:', categories);
        
        toast({
          title: 'API Call Successful',
          description: `Retrieved ${categories.length} categories`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } else if (response.data && response.data.error) {
        addToLog(`Error: ${response.data.error.data?.message || response.data.error.message}`);
        toast({
          title: 'API Call Failed',
          description: response.data.error.data?.message || response.data.error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('[TEST] API call error:', error);
      addToLog(`API call error: ${error.message}`);
      toast({
        title: 'API Call Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Clear session data for testing
  const clearSession = () => {
    localStorage.removeItem('user');
    document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    addToLog('Session data cleared from localStorage and cookies');
    setSessionInfo(null);
    setConnectionStatus('unknown');
    
    toast({
      title: 'Session Cleared',
      description: 'All session data has been removed',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  // Check session on component mount
  useEffect(() => {
    checkCurrentUser();
  }, []);

  return (
    <Box p={5} maxW="800px" mx="auto">
      <Heading mb={5}>Odoo Session Test</Heading>
      
      <Box mb={5}>
        <Text mb={2}>Session Status: 
          <Badge ml={2} colorScheme={
            connectionStatus === 'success' ? 'green' : 
            connectionStatus === 'error' ? 'red' : 'gray'
          }>
            {connectionStatus === 'success' ? 'Valid' : 
             connectionStatus === 'error' ? 'Invalid' : 'Unknown'}
          </Badge>
        </Text>
        
        <VStack spacing={3} mt={4} align="stretch">
          <Button 
            colorScheme="blue" 
            onClick={testConnection} 
            isLoading={isLoading}
            loadingText="Testing"
          >
            Test Session Connection
          </Button>
          
          <Button 
            colorScheme="teal" 
            onClick={testAPICall} 
            isLoading={isLoading}
            loadingText="Testing API"
            isDisabled={connectionStatus !== 'success'}
          >
            Test API Call (Get Categories)
          </Button>
          
          <Button 
            colorScheme="red" 
            onClick={clearSession} 
            variant="outline"
          >
            Clear Session Data
          </Button>
        </VStack>
      </Box>
      
      {sessionInfo && (
        <Box mb={5} bg="gray.50" p={3} borderRadius="md">
          <Heading size="sm" mb={2}>Session Information</Heading>
          <Code display="block" whiteSpace="pre" p={2} overflowX="auto">
            {JSON.stringify(sessionInfo, null, 2)}
          </Code>
        </Box>
      )}
      
      <Divider my={5} />
      
      <Box>
        <Heading size="sm" mb={3}>Request Log</Heading>
        <VStack 
          align="stretch" 
          spacing={2} 
          maxH="300px" 
          overflowY="auto" 
          bg="gray.50" 
          p={3} 
          borderRadius="md"
        >
          {requestLog.length === 0 ? (
            <Text color="gray.500">No log entries yet</Text>
          ) : (
            requestLog.map((entry, index) => (
              <Text key={index} fontSize="sm">
                <Text as="span" color="gray.500" fontFamily="monospace">
                  {new Date(entry.time).toLocaleTimeString()}
                </Text>
                {' '}{entry.message}
              </Text>
            ))
          )}
        </VStack>
      </Box>
    </Box>
  );
};

export default SessionTest; 