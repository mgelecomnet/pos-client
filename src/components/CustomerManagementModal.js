import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  Input,
  Image,
  Badge,
  HStack,
  VStack,
  IconButton,
  Spinner,
  Heading,
  Divider,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useColorModeValue,
  SimpleGrid,
  GridItem,
  Center,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import { 
  FiUser, 
  FiEdit, 
  FiTrash2, 
  FiRefreshCw,
  FiImage,
  FiPlus,
  FiSave,
  FiX,
  FiPhone,
  FiMail,
  FiMapPin,
  FiSearch
} from 'react-icons/fi';
import { customerService } from '../api/odoo';

const CustomerManagementModal = ({ isOpen, onClose }) => {
  // Local state for the modal
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    mobile: '',
    email: '',
    street: '',
    city: '',
    vat: ''
  });
  const [customerImage, setCustomerImage] = useState(null);
  const [previewImage, setPreviewImage] = useState('');
  
  // Edit and delete state
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const cancelRef = useRef();
  const toast = useToast();
  
  // Colors
  const bgHover = useColorModeValue("gray.50", "gray.700");
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const headerBg = useColorModeValue("blue.50", "blue.900");
  const infoBg = useColorModeValue("blue.50", "blue.900");
  const infoBorderColor = useColorModeValue("blue.100", "blue.800");
  const infoHeadingColor = useColorModeValue("blue.600", "blue.300");
  const infoTextColor = useColorModeValue("blue.700", "blue.200");
  const tableHeadBg = useColorModeValue("gray.50", "gray.700");

  // Load customers when modal opens
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
  
  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      mobile: '',
      email: '',
      street: '',
      city: '',
      vat: ''
    });
    setCustomerImage(null);
    setPreviewImage('');
    setEditingCustomer(null);
  };
  
  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
      setSearchQuery('');
    }
  }, [isOpen]);
  
  // Function to convert file to base64
  const getBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };
  
  // Fetch customers
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
  
  // Refresh customers
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
  
  // Handle image change
  const handleImageChange = (e) => {
    e.preventDefault();
    const file = e.target.files[0];
    if (file) {
      setCustomerImage(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle edit click
  const handleEditClick = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      mobile: customer.mobile || '',
      email: customer.email || '',
      street: customer.street || '',
      city: customer.city || '',
      vat: customer.vat || ''
    });
    if (customer.image_128) {
      setPreviewImage(`data:image/png;base64,${customer.image_128}`);
    } else {
      setPreviewImage('');
    }
  };
  
  // Handle delete click
  const handleDeleteClick = (customer) => {
    setCustomerToDelete(customer);
  };
  
  // Add customer - updated for Odoo 18 API
  const handleAddCustomer = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'نام مشتری الزامی است',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsAdding(true);
    
    try {
      let customerData = { ...formData };
      
      if (customerImage) {
        try {
          const base64 = await getBase64(customerImage);
          const imageData = base64.split(',')[1];
          customerData.image_128 = imageData;
        } catch (error) {
          console.error('Error converting image to base64:', error);
          toast({
            title: 'خطا در آماده‌سازی تصویر',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          setIsAdding(false);
          return;
        }
      }
      
      // برای Odoo 18 از همان روش فعلی استفاده می‌کنیم
      const response = await customerService.createCustomer(customerData);
      
      if (response) {
        toast({
          title: 'مشتری با موفقیت اضافه شد',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh customers
        await fetchCustomers();
        
        // Reset form
        resetForm();
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({
        title: 'خطا در افزودن مشتری',
        description: error.message || 'لطفاً مجدد تلاش کنید',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsAdding(false);
    }
  };
  
  // Update customer - updated for Odoo 18 API
  const handleUpdateCustomer = async () => {
    if (!editingCustomer) return;
    
    if (!formData.name.trim()) {
      toast({
        title: 'نام مشتری الزامی است',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsUpdating(true);
    
    try {
      let customerData = { ...formData };
      
      if (customerImage) {
        try {
          const base64 = await getBase64(customerImage);
          const imageData = base64.split(',')[1];
          customerData.image_128 = imageData;
        } catch (error) {
          console.error('Error converting image to base64:', error);
          toast({
            title: 'خطا در آماده‌سازی تصویر',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          setIsUpdating(false);
          return;
        }
      }
      
      // استفاده از روش web_save برای Odoo 18
      const success = await customerService.updateCustomer(editingCustomer.id, customerData);
      
      if (success) {
        toast({
          title: 'مشتری با موفقیت به‌روزرسانی شد',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh customers
        await fetchCustomers();
        
        // Reset form
        resetForm();
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({
        title: 'خطا در به‌روزرسانی مشتری',
        description: error.message || 'لطفاً مجدد تلاش کنید',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Delete customer - updated for Odoo 18 API
  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    
    setIsDeleting(true);
    
    try {
      const success = await customerService.deleteCustomer(customerToDelete.id);
      
      if (success) {
        toast({
          title: 'موفقیت',
          description: 'مشتری با موفقیت حذف شد',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh customers
        await fetchCustomers();
        
        // Reset state
        setCustomerToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: 'خطا',
        description: error.message || 'حذف مشتری با خطا مواجه شد',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Get contact info
  const getContactInfo = (customer) => {
    if (customer.phone && customer.mobile) {
      return `${customer.phone} / ${customer.mobile}`;
    } else {
      return customer.phone || customer.mobile || '-';
    }
  };
  
  // Get address
  const getAddress = (customer) => {
    const parts = [];
    if (customer.street) parts.push(customer.street);
    if (customer.city) parts.push(customer.city);
    
    return parts.length > 0 ? parts.join(', ') : '-';
  };
  
  // Delete Customer Confirmation Dialog
  const DeleteCustomerConfirmation = () => {
    return (
      <AlertDialog
        isOpen={!!customerToDelete}
        leastDestructiveRef={cancelRef}
        onClose={() => setCustomerToDelete(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              حذف مشتری
            </AlertDialogHeader>

            <AlertDialogBody>
              آیا از حذف مشتری "{customerToDelete?.name}" اطمینان دارید؟
              <Text color="red.500" mt={2}>
                این عملیات غیرقابل بازگشت است.
              </Text>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setCustomerToDelete(null)}>
                انصراف
              </Button>
              <Button colorScheme="red" onClick={handleDeleteCustomer} ml={3} isLoading={isDeleting}>
                حذف
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    );
  };
  
  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent maxW="900px">
          <ModalHeader borderBottom="1px" borderColor={borderColor} bg={headerBg}>
            <Flex align="center" justify="space-between">
              <Flex align="center">
                <Box mr={2} color="blue.500">
                  <FiUser size="20px" />
                </Box>
                <Text>مدیریت مشتریان (Odoo 18)</Text>
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
              {/* Add/Edit customer form */}
              <Box p={4} borderWidth="1px" borderRadius="lg" bg={cardBg} shadow="sm">
                <Heading size="sm" mb={4} display="flex" alignItems="center">
                  {editingCustomer ? <FiEdit size="18px" style={{marginLeft: '8px'}} /> : <FiPlus size="18px" style={{marginLeft: '8px'}} />}
                  {editingCustomer ? 'ویرایش مشتری' : 'افزودن مشتری جدید'}
                </Heading>
                
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (editingCustomer) {
                    handleUpdateCustomer();
                  } else {
                    handleAddCustomer();
                  }
                }}>
                  <SimpleGrid columns={{base: 1, md: 2}} spacing={4}>
                    <GridItem>
                      <FormControl isRequired>
                        <FormLabel fontSize="sm">نام مشتری</FormLabel>
                        <Input
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="نام مشتری را وارد کنید"
                          size="sm"
                        />
                      </FormControl>
                    </GridItem>
                    
                    <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm">تلفن</FormLabel>
                        <Input
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="شماره تلفن"
                          size="sm"
                        />
                      </FormControl>
                    </GridItem>
                    
                    <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm">موبایل</FormLabel>
                        <Input
                          name="mobile"
                          value={formData.mobile}
                          onChange={handleChange}
                          placeholder="شماره موبایل"
                          size="sm"
                        />
                      </FormControl>
                    </GridItem>
                    
                    <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm">ایمیل</FormLabel>
                        <Input
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="آدرس ایمیل"
                          size="sm"
                        />
                      </FormControl>
                    </GridItem>
                    
                    <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm">آدرس</FormLabel>
                        <Input
                          name="street"
                          value={formData.street}
                          onChange={handleChange}
                          placeholder="آدرس خیابان"
                          size="sm"
                        />
                      </FormControl>
                    </GridItem>
                    
                    <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm">شهر</FormLabel>
                        <Input
                          name="city"
                          value={formData.city}
                          onChange={handleChange}
                          placeholder="نام شهر"
                          size="sm"
                        />
                      </FormControl>
                    </GridItem>
                    
                    <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm">شناسه مالیاتی</FormLabel>
                        <Input
                          name="vat"
                          value={formData.vat}
                          onChange={handleChange}
                          placeholder="شناسه مالیاتی"
                          size="sm"
                        />
                      </FormControl>
                    </GridItem>
                    
                    <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm">تصویر مشتری (اختیاری)</FormLabel>
                        <Flex align="center">
                          <Button
                            as="label"
                            htmlFor="customer-image"
                            size="sm"
                            leftIcon={<FiImage />}
                            cursor="pointer"
                            colorScheme="gray"
                            mr={4}
                          >
                            انتخاب تصویر
                          </Button>
                          <Input 
                            id="customer-image"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            display="none"
                          />
                          <Text fontSize="sm" color="gray.500">
                            {customerImage ? customerImage.name : 'تصویری انتخاب نشده است'}
                          </Text>
                        </Flex>
                      </FormControl>
                    </GridItem>
                  </SimpleGrid>
                  
                  {previewImage && (
                    <Flex mt={3} justify="center">
                      <Box position="relative" borderRadius="md" borderWidth="1px" borderColor="gray.200" p={2}>
                        <Image 
                          src={previewImage} 
                          alt="Customer preview" 
                          maxHeight="100px" 
                          maxWidth="100px"
                          borderRadius="md"
                          objectFit="contain"
                        />
                        <IconButton
                          icon={<FiX />}
                          size="xs"
                          colorScheme="red"
                          position="absolute"
                          top="-8px"
                          right="-8px"
                          borderRadius="full"
                          onClick={() => {
                            setPreviewImage('');
                            setCustomerImage(null);
                          }}
                        />
                      </Box>
                    </Flex>
                  )}
                  
                  <Flex justifyContent="flex-end" gap={2} mt={4}>
                    <Button
                      variant="outline"
                      colorScheme="gray"
                      size="sm"
                      leftIcon={<FiX />}
                      onClick={(e) => {
                        e.preventDefault();
                        resetForm();
                      }}
                    >
                      پاک کردن فرم
                    </Button>
                    <Button
                      colorScheme="blue"
                      type="submit"
                      size="sm"
                      leftIcon={editingCustomer ? <FiSave /> : <FiPlus />}
                      isLoading={editingCustomer ? isUpdating : isAdding}
                      loadingText={editingCustomer ? "در حال به‌روزرسانی..." : "در حال افزودن..."}
                    >
                      {editingCustomer ? 'ویرایش مشتری' : 'افزودن مشتری'}
                    </Button>
                  </Flex>
                </form>
              </Box>
              
              {/* Search and filter */}
              <Box p={4} borderWidth="1px" borderRadius="lg" bg={cardBg} shadow="sm">
                <Flex align="center" gap={4}>
                  <FormControl flex="1">
                    <InputGroup size="sm">
                      <InputLeftElement pointerEvents="none">
                        <FiSearch color="gray.300" />
                      </InputLeftElement>
                      <Input
                        placeholder="جستجو در نام، تلفن یا ایمیل مشتری..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        size="sm"
                      />
                    </InputGroup>
                  </FormControl>
                  <Button
                    colorScheme="blue"
                    size="sm"
                    leftIcon={<FiSearch />}
                    onClick={() => {
                      // Already filtered via effect
                    }}
                  >
                    جستجو
                  </Button>
                </Flex>
              </Box>
              
              {/* Customers list */}
              <Box p={4} borderWidth="1px" borderRadius="lg" bg={cardBg} shadow="sm">
                <Heading size="sm" mb={4} display="flex" alignItems="center">
                  <FiUser size="18px" style={{marginLeft: '8px'}} />
                  لیست مشتریان
                </Heading>
                
                {isLoading ? (
                  <Flex justify="center" align="center" p={10}>
                    <Spinner size="xl" color="blue.500" />
                  </Flex>
                ) : filteredCustomers.length > 0 ? (
                  <Box borderRadius="md" overflow="hidden" borderWidth="1px" borderColor={borderColor}>
                    <Table variant="simple" size="sm">
                      <Thead bg={tableHeadBg}>
                        <Tr>
                          <Th width="50px" textAlign="center">تصویر</Th>
                          <Th>نام</Th>
                          <Th>تماس</Th>
                          <Th>ایمیل</Th>
                          <Th>آدرس</Th>
                          <Th width="120px">عملیات</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {filteredCustomers.map(customer => (
                          <Tr key={customer.id} _hover={{ bg: bgHover }}>
                            <Td width="50px" textAlign="center">
                              {customer.image_128 ? (
                                <Image
                                  src={`data:image/png;base64,${customer.image_128}`}
                                  alt={customer.name}
                                  boxSize="40px"
                                  objectFit="cover"
                                  borderRadius="full"
                                  mx="auto"
                                />
                              ) : (
                                <Center
                                  width="40px"
                                  height="40px"
                                  bg="blue.50"
                                  color="blue.500"
                                  borderRadius="full"
                                  mx="auto"
                                >
                                  <FiUser size="16px" />
                                </Center>
                              )}
                            </Td>
                            <Td fontWeight="medium">{customer.name}</Td>
                            <Td>{getContactInfo(customer)}</Td>
                            <Td>{customer.email || '-'}</Td>
                            <Td>{getAddress(customer)}</Td>
                            <Td>
                              <HStack spacing={1} justify="center">
                                <IconButton
                                  size="xs"
                                  colorScheme="blue"
                                  icon={<FiEdit />}
                                  aria-label="Edit customer"
                                  onClick={() => handleEditClick(customer)}
                                />
                                <IconButton
                                  size="xs"
                                  colorScheme="red"
                                  icon={<FiTrash2 />}
                                  aria-label="Delete customer"
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
                  <Flex justify="center" align="center" p={5} borderWidth="1px" borderRadius="md" borderStyle="dashed">
                    <Text color="gray.500">مشتری یافت نشد</Text>
                  </Flex>
                )}
              </Box>
              
              {/* Information box */}
              <Box p={4} bg={infoBg} borderRadius="lg" borderWidth="1px" borderColor={infoBorderColor}>
                <VStack align="start" spacing={2}>
                  <Heading size="sm" color={infoHeadingColor} display="flex" alignItems="center">
                    <FiRefreshCw size="16px" style={{marginLeft: '8px'}} />
                    راهنمای مدیریت مشتریان در Odoo 18
                  </Heading>
                  <Text fontSize="xs" color={infoTextColor}>• در این بخش می‌توانید مشتریان را مدیریت کنید</Text>
                  <Text fontSize="xs" color={infoTextColor}>• برای افزودن مشتری جدید، فرم بالا را تکمیل کنید</Text>
                  <Text fontSize="xs" color={infoTextColor}>• برای ویرایش مشتری، روی آیکون مداد کلیک کنید</Text>
                  <Text fontSize="xs" color={infoTextColor}>• برای حذف مشتری، روی آیکون سطل زباله کلیک کنید</Text>
                </VStack>
              </Box>
            </VStack>
          </ModalBody>
          
          <ModalFooter borderTop="1px" borderColor={borderColor}>
            <Button variant="outline" colorScheme="blue" onClick={onClose} size="sm">بستن</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Delete Customer Confirmation */}
      <DeleteCustomerConfirmation />
    </>
  );
};

export default CustomerManagementModal; 