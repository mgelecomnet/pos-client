import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Spinner,
  Text,
  Flex,
  Image,
  InputGroup,
  InputLeftElement,
  HStack,
  VStack,
  Divider,
  useColorModeValue,
  useToast,
  Center,
  IconButton,
} from '@chakra-ui/react';
import { 
  FiSearch, 
  FiUser, 
  FiPlus, 
  FiPhone, 
  FiMail, 
  FiMapPin,
  FiCheck,
  FiRefreshCw
} from 'react-icons/fi';
import { customerService } from '../api/odoo';

const CustomerSelectorModal = ({ isOpen, onClose, onSelectCustomer, onAddNewCustomer }) => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  
  const toast = useToast();
  
  // Colors
  const bgHover = useColorModeValue("gray.50", "gray.700");
  const headerBg = useColorModeValue("blue.50", "blue.900");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const tableHeadBg = useColorModeValue("gray.50", "gray.700");
  
  // Fetch customers when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
    }
  }, [isOpen]);
  
  // Filter customers based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = customers.filter(customer => 
      (customer.name && customer.name.toLowerCase().includes(query)) ||
      (customer.phone && customer.phone.toLowerCase().includes(query)) ||
      (customer.mobile && customer.mobile.toLowerCase().includes(query)) ||
      (customer.email && customer.email.toLowerCase().includes(query))
    );
    
    setFilteredCustomers(filtered);
  }, [searchQuery, customers]);
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedCustomerId(null);
    }
  }, [isOpen]);
  
  // Fetch customers from API
  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      const data = await customerService.getCustomers();
      setCustomers(data);
      setFilteredCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: 'خطا',
        description: 'بارگذاری مشتریان با مشکل مواجه شد',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Refresh customers list
  const refreshCustomers = async () => {
    try {
      setIsRefreshing(true);
      await fetchCustomers();
      toast({
        title: 'به‌روزرسانی',
        description: 'لیست مشتریان به‌روزرسانی شد',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error refreshing customers:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Handle customer selection
  const handleSelectCustomer = () => {
    if (!selectedCustomerId) {
      toast({
        title: 'هشدار',
        description: 'لطفاً یک مشتری را انتخاب کنید',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    if (selectedCustomer) {
      onSelectCustomer(selectedCustomer);
      onClose();
    }
  };
  
  // Get contact info for display
  const getContactInfo = (customer) => {
    if (customer.phone && customer.mobile) {
      return `${customer.phone} / ${customer.mobile}`;
    } else {
      return customer.phone || customer.mobile || '-';
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxW="800px">
        <ModalHeader borderBottom="1px" borderColor={borderColor} bg={headerBg}>
          <Flex align="center" justify="space-between">
            <Flex align="center">
              <Box mr={2} color="blue.500">
                <FiUser size="20px" />
              </Box>
              <Text>انتخاب مشتری</Text>
            </Flex>
            <Button 
              size="sm"
              leftIcon={<FiRefreshCw />}
              onClick={refreshCustomers}
              colorScheme="blue"
              variant="outline"
              isLoading={isRefreshing}
            >
              بارگذاری مجدد
            </Button>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody py={4}>
          <VStack spacing={4} align="stretch">
            {/* Search and filter */}
            <Box p={4} borderWidth="1px" borderRadius="lg" shadow="sm">
              <Flex align="center" justify="space-between" gap={4}>
                <InputGroup size="md">
                  <InputLeftElement pointerEvents="none">
                    <FiSearch color="gray.500" />
                  </InputLeftElement>
                  <Input
                    placeholder="جستجو در نام، تلفن یا ایمیل مشتری..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </InputGroup>
                <Button
                  colorScheme="green"
                  size="md"
                  leftIcon={<FiPlus />}
                  onClick={onAddNewCustomer}
                >
                  مشتری جدید
                </Button>
              </Flex>
            </Box>
            
            {/* Customers list */}
            <Box borderWidth="1px" borderRadius="lg" shadow="sm" overflow="hidden">
              {isLoading ? (
                <Flex justify="center" align="center" p={10}>
                  <Spinner size="xl" color="blue.500" />
                </Flex>
              ) : filteredCustomers.length > 0 ? (
                <Table variant="simple" size="sm">
                  <Thead bg={tableHeadBg}>
                    <Tr>
                      <Th width="50px"></Th>
                      <Th width="50px">تصویر</Th>
                      <Th>نام مشتری</Th>
                      <Th>تماس</Th>
                      <Th>ایمیل</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredCustomers.map(customer => (
                      <Tr 
                        key={customer.id} 
                        _hover={{ bg: bgHover }}
                        bg={selectedCustomerId === customer.id ? "blue.50" : undefined}
                        cursor="pointer"
                        onClick={() => setSelectedCustomerId(customer.id)}
                      >
                        <Td textAlign="center">
                          {selectedCustomerId === customer.id ? (
                            <Box color="green.500">
                              <FiCheck size="20px" />
                            </Box>
                          ) : null}
                        </Td>
                        <Td>
                          {customer.image_128 ? (
                            <Image
                              src={`data:image/png;base64,${customer.image_128}`}
                              alt={customer.name}
                              boxSize="40px"
                              objectFit="cover"
                              borderRadius="full"
                            />
                          ) : (
                            <Center
                              width="40px"
                              height="40px"
                              bg="blue.50"
                              color="blue.500"
                              borderRadius="full"
                            >
                              <FiUser size="16px" />
                            </Center>
                          )}
                        </Td>
                        <Td fontWeight="medium">{customer.name}</Td>
                        <Td>{getContactInfo(customer)}</Td>
                        <Td>{customer.email || '-'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              ) : (
                <Flex justify="center" align="center" p={5}>
                  <Text color="gray.500">مشتری یافت نشد</Text>
                </Flex>
              )}
            </Box>
            
            {filteredCustomers.length > 0 && (
              <Flex justify="flex-end" p={2}>
                <Text fontSize="sm" color="gray.500">
                  {filteredCustomers.length} مشتری یافت شد
                </Text>
              </Flex>
            )}
          </VStack>
        </ModalBody>
        
        <ModalFooter borderTop="1px" borderColor={borderColor}>
          <Button variant="ghost" mr={3} onClick={onClose}>
            انصراف
          </Button>
          <Button colorScheme="blue" onClick={handleSelectCustomer}>
            انتخاب مشتری
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CustomerSelectorModal; 