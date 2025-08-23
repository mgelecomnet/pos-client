import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  useDisclosure,
  useToast,
  Spinner,
  Badge,
} from '@chakra-ui/react';
import { FiUsers, FiSearch, FiPlus, FiRefreshCw, FiEdit2, FiUser, FiPhone, FiMail, FiMapPin, FiTrash2 } from 'react-icons/fi';
import { customerService } from '../api/odoo';

// Add Customer Modal Component
const AddCustomerModal = ({ isOpen, onClose, onAddCustomer }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    street: '',
    city: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Customer name is required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddCustomer(formData);
      
      // Reset form
      setFormData({
        name: '',
        phone: '',
        email: '',
        street: '',
        city: '',
      });
      
      onClose();
      
      toast({
        title: 'Success',
        description: 'Customer added successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add customer',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add New Customer</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={3} isRequired>
            <FormLabel>Name</FormLabel>
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Customer name"
            />
          </FormControl>
          
          <FormControl mb={3}>
            <FormLabel>Phone</FormLabel>
            <Input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Phone number"
            />
          </FormControl>
          
          <FormControl mb={3}>
            <FormLabel>Email</FormLabel>
            <Input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email address"
            />
          </FormControl>
          
          <FormControl mb={3}>
            <FormLabel>Street</FormLabel>
            <Input
              name="street"
              value={formData.street}
              onChange={handleChange}
              placeholder="Street address"
            />
          </FormControl>
          
          <FormControl mb={3}>
            <FormLabel>City</FormLabel>
            <Input
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="City"
            />
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSubmit}
            isLoading={isSubmitting}
          >
            Add Customer
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

// EditCustomerModal Component
const EditCustomerModal = ({ isOpen, onClose, customer, onUpdateCustomer }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    street: '',
    city: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  // Initialize form with customer data when opened
  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        street: customer.street || '',
        city: customer.city || '',
      });
    }
  }, [customer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Customer name is required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await onUpdateCustomer(customer.id, formData);
      onClose();
      
      toast({
        title: 'Success',
        description: 'Customer updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update customer',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit Customer</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={3} isRequired>
            <FormLabel>Name</FormLabel>
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Customer name"
            />
          </FormControl>
          
          <FormControl mb={3}>
            <FormLabel>Phone</FormLabel>
            <Input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Phone number"
            />
          </FormControl>
          
          <FormControl mb={3}>
            <FormLabel>Email</FormLabel>
            <Input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email address"
            />
          </FormControl>
          
          <FormControl mb={3}>
            <FormLabel>Street</FormLabel>
            <Input
              name="street"
              value={formData.street}
              onChange={handleChange}
              placeholder="Street address"
            />
          </FormControl>
          
          <FormControl mb={3}>
            <FormLabel>City</FormLabel>
            <Input
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="City"
            />
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSubmit}
            isLoading={isSubmitting}
          >
            Update Customer
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isDeleteConfirmOpen, onOpen: onDeleteConfirmOpen, onClose: onDeleteConfirmClose } = useDisclosure();
  const toast = useToast();

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Filter customers when search query changes
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

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchCustomers();
      toast({
        title: 'Success',
        description: 'Customers refreshed successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error refreshing customers:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddCustomer = async (customerData) => {
    try {
      await customerService.createCustomer(customerData);
      await fetchCustomers(); // Refresh customer list
    } catch (error) {
      console.error('Error adding customer:', error);
      throw error;
    }
  };

  const handleUpdateCustomer = async (customerId, customerData) => {
    try {
      await customerService.updateCustomer(customerId, customerData);
      await fetchCustomers(); // Refresh customer list
      toast({
        title: 'Success',
        description: 'Customer updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  };
  
  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    
    try {
      await customerService.deleteCustomer(selectedCustomer.id);
      await fetchCustomers(); // Refresh customer list
      onDeleteConfirmClose();
      setSelectedCustomer(null);
      
      toast({
        title: 'Success',
        description: 'Customer deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete customer',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  const handleEditClick = (customer) => {
    setSelectedCustomer(customer);
    onEditOpen();
  };
  
  const handleDeleteClick = (customer) => {
    setSelectedCustomer(customer);
    onDeleteConfirmOpen();
  };

  const getContactInfo = (customer) => {
    const contacts = [];
    if (customer.phone) contacts.push(customer.phone);
    if (customer.mobile && customer.mobile !== customer.phone) contacts.push(customer.mobile);
    
    return contacts.join(' / ') || '-';
  };

  const getAddress = (customer) => {
    const address = [];
    if (customer.street) address.push(customer.street);
    if (customer.city) address.push(customer.city);
    
    return address.join(', ') || '-';
  };

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Customers</Heading>
        <HStack>
          <Button
            leftIcon={<FiRefreshCw />}
            variant="outline"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            loadingText="Refreshing"
          >
            Refresh
          </Button>
          <Button
            leftIcon={<FiPlus />}
            colorScheme="blue"
            onClick={onAddOpen}
          >
            Add Customer
          </Button>
        </HStack>
      </Flex>

      <InputGroup mb={6}>
        <InputLeftElement pointerEvents="none">
          <FiSearch color="gray.300" />
        </InputLeftElement>
        <Input
          placeholder="Search customers by name, phone, or email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </InputGroup>

      <Box bg="white" borderRadius="md" shadow="sm" overflow="hidden">
        {isLoading ? (
          <Flex justify="center" align="center" p={10}>
            <Spinner size="xl" color="blue.500" />
          </Flex>
        ) : filteredCustomers.length > 0 ? (
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead bg="gray.50">
                <Tr>
                  <Th></Th>
                  <Th>Name</Th>
                  <Th>Contact</Th>
                  <Th>Email</Th>
                  <Th>Address</Th>
                  <Th>VAT</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredCustomers.map(customer => (
                  <Tr key={customer.id} _hover={{ bg: 'gray.50' }}>
                    <Td width="50px">
                      {customer.image_128 ? (
                        <Image
                          src={`data:image/png;base64,${customer.image_128}`}
                          fallbackSrc="https://via.placeholder.com/40?text=C"
                          alt={customer.name}
                          boxSize="40px"
                          objectFit="cover"
                          borderRadius="full"
                        />
                      ) : (
                        <Flex
                          bg="blue.50"
                          color="blue.500"
                          boxSize="40px"
                          borderRadius="full"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <FiUser />
                        </Flex>
                      )}
                    </Td>
                    <Td fontWeight="medium">{customer.name}</Td>
                    <Td>{getContactInfo(customer)}</Td>
                    <Td>{customer.email || '-'}</Td>
                    <Td>{getAddress(customer)}</Td>
                    <Td>{customer.vat || '-'}</Td>
                    <Td>
                      <HStack spacing={2}>
                        <IconButton
                          icon={<FiEdit2 />}
                          aria-label="Edit"
                          onClick={() => handleEditClick(customer)}
                        />
                        <IconButton
                          icon={<FiTrash2 />}
                          aria-label="Delete"
                          onClick={() => handleDeleteClick(customer)}
                        />
                      </HStack>
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
      </Box>

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddOpen}
        onClose={onAddClose}
        onAddCustomer={handleAddCustomer}
      />

      {/* Edit Customer Modal */}
      {selectedCustomer && (
        <EditCustomerModal
          isOpen={isEditOpen}
          onClose={onEditClose}
          customer={selectedCustomer}
          onUpdateCustomer={handleUpdateCustomer}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteConfirmOpen} onClose={onDeleteConfirmClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete Customer</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Are you sure you want to delete customer: <strong>{selectedCustomer?.name}</strong>?</Text>
            <Text mt={2} color="red.500" fontSize="sm">This action cannot be undone.</Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" mr={3} onClick={onDeleteConfirmClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleDeleteCustomer}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default CustomersPage; 