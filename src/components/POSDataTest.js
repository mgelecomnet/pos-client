import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Input,
  FormControl,
  FormLabel,
  VStack,
  HStack,
  Text,
  Heading,
  Divider,
  Code,
  Alert,
  AlertIcon,
  Spinner,
  Badge,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useToast,
} from '@chakra-ui/react';
import { FiRefreshCw, FiSearch, FiInfo, FiFile, FiDatabase, FiTrash2 } from 'react-icons/fi';
import { loadPOSData, getLocalPOSData, inspectDatabase, debugModelData } from '../api/odooApi';
import odooApi from '../api/odooApi';

const POSDataTest = () => {
  const [sessionId, setSessionId] = useState('');
  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingActiveSessions, setIsLoadingActiveSessions] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});
  const [dbInspection, setDbInspection] = useState(null);
  const [selectedModel, setSelectedModel] = useState('product.product');
  const [modelData, setModelData] = useState(null);
  const [firstDataItem, setFirstDataItem] = useState(null);
  const toast = useToast();

  // Fetch active POS sessions from the server
  const fetchActiveSessions = async () => {
    try {
      setIsLoadingActiveSessions(true);
      setError(null);
      
      const response = await odooApi.post('/web/dataset/call_kw/pos.session/search_read', {
        id: 0,
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'pos.session',
          method: 'search_read',
          args: [
            [['state', '=', 'opened']]
          ],
          kwargs: {
            fields: ['id', 'name', 'config_id', 'user_id', 'start_at'],
            limit: 10
          }
        }
      });
      
      if (response.data && response.data.result) {
        setActiveSessions(response.data.result);
        
        if (response.data.result.length > 0) {
          // Auto-select the first active session
          setSessionId(response.data.result[0].id.toString());
        }
      } else {
        setActiveSessions([]);
        setError('No active sessions found');
      }
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      setError(error.message || 'Failed to fetch active sessions');
      setActiveSessions([]);
    } finally {
      setIsLoadingActiveSessions(false);
    }
  };

  // Function to load POS data
  const handleLoadData = async (force = false) => {
    if (!sessionId) {
      setError('Please enter a valid session ID');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Loading POS data for session: ${sessionId}, force: ${force}`);
      const data = await loadPOSData(sessionId, force);
      
      // Count items in each store
      const stats = {};
      for (const [modelName, modelData] of Object.entries(data)) {
        stats[modelName] = modelData.data ? modelData.data.length : 0;
      }
      
      setStats(stats);
      setDataLoaded(true);
      
      // Also inspect the database
      await inspectDatabase();
      
      toast({
        title: 'Data Loaded Successfully',
        description: `Loaded data for ${Object.keys(stats).length} models`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
    } catch (error) {
      console.error('Error loading POS data:', error);
      setError(error.message || 'Failed to load POS data');
      setDataLoaded(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to inspect database
  const handleInspectDatabase = async () => {
    try {
      setIsLoading(true);
      const inspection = await inspectDatabase();
      setDbInspection(inspection);
    } catch (error) {
      console.error('Error inspecting database:', error);
      setError(error.message || 'Failed to inspect database');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to inspect a specific model's data
  const handleInspectModel = async () => {
    if (!selectedModel) return;
    
    try {
      setIsLoading(true);
      const result = await debugModelData(selectedModel);
      setModelData(result);
      
      if (result.success && result.sample) {
        setFirstDataItem(result.sample);
      } else {
        setFirstDataItem(null);
      }
    } catch (error) {
      console.error(`Error inspecting model ${selectedModel}:`, error);
      setError(error.message || `Failed to inspect model ${selectedModel}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to clear a specific model's data
  const handleClearModel = async () => {
    if (!selectedModel) return;
    
    try {
      setIsLoading(true);
      await getLocalPOSData.clearStore(selectedModel);
      toast({
        title: 'Store Cleared',
        description: `Cleared data for ${selectedModel}`,
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      await handleInspectModel(); // Refresh model data
    } catch (error) {
      console.error(`Error clearing model ${selectedModel}:`, error);
      setError(error.message || `Failed to clear model ${selectedModel}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to reload a specific model's data
  const handleReloadModel = async () => {
    if (!selectedModel || !sessionId) {
      setError('Please select a model and enter a valid session ID');
      return;
    }
    
    try {
      setIsLoading(true);
      await getLocalPOSData.reloadModelData(selectedModel);
      toast({
        title: 'Model Data Reloaded',
        description: `Reloaded data for ${selectedModel}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      await handleInspectModel(); // Refresh model data
    } catch (error) {
      console.error(`Error reloading model ${selectedModel}:`, error);
      setError(error.message || `Failed to reload model ${selectedModel}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box p={5}>
      <Heading size="lg" mb={4}>POS Data Test</Heading>
      
      <VStack spacing={5} align="stretch">
        {/* Session Selection Section */}
        <Box borderWidth={1} borderRadius="md" p={4}>
          <Heading size="md" mb={2}>Step 1: Select POS Session</Heading>
          <HStack mb={3}>
            <Button 
              leftIcon={<FiRefreshCw />} 
              colorScheme="blue" 
              onClick={fetchActiveSessions} 
              isLoading={isLoadingActiveSessions}
            >
              Fetch Active Sessions
            </Button>
          </HStack>
          
          {activeSessions.length > 0 ? (
            <Box mb={3}>
              <FormControl>
                <FormLabel>Active Sessions</FormLabel>
                <Select 
                  value={sessionId} 
                  onChange={(e) => setSessionId(e.target.value)}
                >
                  {activeSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      ID: {session.id} - {session.name} ({session.config_id[1]})
                    </option>
                  ))}
                </Select>
              </FormControl>
            </Box>
          ) : (
            <FormControl mb={3}>
              <FormLabel>Session ID</FormLabel>
              <Input 
                placeholder="Enter POS session ID" 
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              />
            </FormControl>
          )}
        </Box>
        
        {/* Data Loading Section */}
        <Box borderWidth={1} borderRadius="md" p={4}>
          <Heading size="md" mb={2}>Step 2: Load POS Data</Heading>
          <HStack spacing={3} mb={3}>
            <Button 
              colorScheme="green" 
              onClick={() => handleLoadData(false)} 
              isLoading={isLoading}
              isDisabled={!sessionId}
            >
              Load Data
            </Button>
            <Button 
              colorScheme="orange" 
              onClick={() => handleLoadData(true)} 
              isLoading={isLoading}
              isDisabled={!sessionId}
            >
              Force Reload
            </Button>
          </HStack>
        </Box>
        
        {/* Database Inspection */}
        <Box borderWidth={1} borderRadius="md" p={4}>
          <Heading size="md" mb={2}>Step 3: Inspect Database</Heading>
          <HStack spacing={3} mb={4}>
            <Button 
              leftIcon={<FiDatabase />} 
              colorScheme="purple" 
              onClick={handleInspectDatabase} 
              isLoading={isLoading}
            >
              Inspect Database
            </Button>
          </HStack>
          
          <HStack spacing={3} mb={4}>
            <FormControl>
              <FormLabel>Select Model to Inspect</FormLabel>
              <Select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="product.product">Products</option>
                <option value="pos.category">Categories</option>
                <option value="res.partner">Partners</option>
                <option value="pos.payment.method">Payment Methods</option>
                <option value="pos.session">POS Sessions</option>
                <option value="pos.config">POS Configs</option>
                <option value="account.tax">Taxes</option>
              </Select>
            </FormControl>
            <Button 
              leftIcon={<FiSearch />} 
              colorScheme="blue" 
              onClick={handleInspectModel} 
              isLoading={isLoading}
              mt={8}
            >
              Inspect Model
            </Button>
            <Button 
              leftIcon={<FiTrash2 />} 
              colorScheme="red" 
              onClick={handleClearModel} 
              isLoading={isLoading}
              mt={8}
            >
              Clear Store
            </Button>
            <Button 
              leftIcon={<FiRefreshCw />} 
              colorScheme="green" 
              onClick={handleReloadModel} 
              isLoading={isLoading}
              isDisabled={!sessionId}
              mt={8}
            >
              Reload Model
            </Button>
          </HStack>
        </Box>
        
        {/* Error Display */}
        {error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            {error}
          </Alert>
        )}
        
        {/* Results Section */}
        {dataLoaded && Object.keys(stats).length > 0 && (
          <Box borderWidth={1} borderRadius="md" p={4}>
            <Heading size="md" mb={2}>Data Load Results</Heading>
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Model</Th>
                  <Th isNumeric>Record Count</Th>
                </Tr>
              </Thead>
              <Tbody>
                {Object.entries(stats).map(([model, count]) => (
                  <Tr key={model}>
                    <Td>{model}</Td>
                    <Td isNumeric>
                      <Badge 
                        colorScheme={count > 0 ? "green" : "red"}
                        borderRadius="full"
                        px={2}
                      >
                        {count}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
        
        {/* Database Inspection Results */}
        {dbInspection && (
          <Box borderWidth={1} borderRadius="md" p={4}>
            <Heading size="md" mb={2}>Database Inspection Results</Heading>
            <Text mb={2}>
              <Badge colorScheme="blue" mr={2}>Stores</Badge>
              {dbInspection.storeNames.length} stores found
            </Text>
            <Box overflowX="auto" maxHeight="400px" overflowY="auto">
              <pre style={{ fontSize: '0.8rem' }}>
                {JSON.stringify(dbInspection.results, null, 2)}
              </pre>
            </Box>
          </Box>
        )}
        
        {/* Model Data Inspection Results */}
        {modelData && (
          <Box borderWidth={1} borderRadius="md" p={4}>
            <Heading size="md" mb={2}>
              {selectedModel} Inspection Results
              <Badge 
                ml={2} 
                colorScheme={modelData.success ? "green" : "red"}
              >
                {modelData.success ? "Success" : "Failed"}
              </Badge>
            </Heading>
            
            {modelData.success ? (
              <>
                <Box mb={3}>
                  <Badge colorScheme="blue" mr={2}>Data Structure</Badge>
                  <Code>{modelData.structure.join(', ')}</Code>
                </Box>
                
                <Box mb={3}>
                  <Badge colorScheme="blue" mr={2}>Has Data Array</Badge>
                  <Code>{modelData.hasDataArray ? "Yes" : "No"}</Code>
                </Box>
                
                <Box mb={3}>
                  <Badge colorScheme="blue" mr={2}>Data Length</Badge>
                  <Code>{modelData.dataLength}</Code>
                </Box>
                
                {firstDataItem && (
                  <Box mb={3}>
                    <Heading size="sm" mb={2}>First Item Sample</Heading>
                    <Box overflowX="auto" maxHeight="300px" overflowY="auto">
                      <pre style={{ fontSize: '0.8rem' }}>
                        {JSON.stringify(firstDataItem, null, 2)}
                      </pre>
                    </Box>
                  </Box>
                )}
              </>
            ) : (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                {modelData.error || "Failed to inspect model data"}
              </Alert>
            )}
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default POSDataTest; 