import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Flex,
  Box,
  Text,
  Spinner,
  useToast
} from '@chakra-ui/react';
import { FiSearch } from 'react-icons/fi';
import { customerService } from '../../api/odoo';

const CustomerSelector = ({ isOpen, onClose, onSelectCustomer }) => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
    }
  }, [isOpen]);

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

  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      const data = await customerService.getCustomers();
      setCustomers(data);
      setFilteredCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load customers',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSelect = (customer) => {
    onSelectCustomer(customer);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Select Customer</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <InputGroup mb={4}>
            <InputLeftElement pointerEvents="none">
              <FiSearch color="gray.300" />
            </InputLeftElement>
            <Input
              placeholder="Search customers by name, phone, or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </InputGroup>

          {isLoading ? (
            <Flex justify="center" p={10}>
              <Spinner size="xl" color="blue.500" />
            </Flex>
          ) : filteredCustomers.length > 0 ? (
            <Box maxH="60vh" overflowY="auto">
              <Table variant="simple" size="sm">
                <Thead bg="gray.50" position="sticky" top={0} zIndex={1}>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Contact</Th>
                    <Th>Email</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredCustomers.map(customer => (
                    <Tr key={customer.id} _hover={{ bg: 'gray.50' }}>
                      <Td fontWeight="medium">{customer.name}</Td>
                      <Td>{customer.phone || customer.mobile || '-'}</Td>
                      <Td>{customer.email || '-'}</Td>
                      <Td textAlign="right">
                        <Button
                          size="sm"
                          colorScheme="blue"
                          variant="ghost"
                          onClick={() => handleCustomerSelect(customer)}
                        >
                          Select
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          ) : (
            <Flex justify="center" align="center" p={10}>
              <Text color="gray.500">No customers found</Text>
            </Flex>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CustomerSelector; 