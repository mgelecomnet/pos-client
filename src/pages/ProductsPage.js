import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Flex,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  Button,
  HStack,
  VStack,
  Text,
  useToast,
  Spinner,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  FormHelperText,
  Switch,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Select,
  Grid,
  GridItem,
  Divider,
} from '@chakra-ui/react';
import { FiSearch, FiPlus, FiRefreshCw, FiEdit2, FiTrash2, FiFilter, FiTag, FiPackage, FiLayers, FiX } from 'react-icons/fi';
import { productService, categoryService } from '../api/odoo';
import ProductManagementModal from '../components/ProductManagementModal';

// AddProductModal component
const AddProductModal = ({ isOpen, onClose, categories, onAddProduct }) => {
  const [productData, setProductData] = useState({
    name: '',
    default_code: '',
    barcode: '',
    list_price: 0,
    categ_id: '',
    available_in_pos: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProductData({ ...productData, [name]: value });
  };

  const handleSwitchChange = (e) => {
    const { name, checked } = e.target;
    setProductData({ ...productData, [name]: checked });
  };

  const handlePriceChange = (value) => {
    setProductData({ ...productData, list_price: parseFloat(value) });
  };

  const handleSubmit = async () => {
    if (!productData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Product name is required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const newProductData = {
        ...productData,
        categ_id: productData.categ_id ? Number(productData.categ_id) : false,
      };
      
      await onAddProduct(newProductData);
      
      setProductData({
        name: '',
        default_code: '',
        barcode: '',
        list_price: 0,
        categ_id: '',
        available_in_pos: true,
      });
      onClose();
      
      toast({
        title: 'Product Created',
        description: 'Product has been created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error creating product:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create product',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add New Product</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={4} isRequired>
            <FormLabel>Product Name</FormLabel>
            <Input 
              name="name"
              placeholder="Enter product name" 
              value={productData.name}
              onChange={handleInputChange}
            />
          </FormControl>
          
          <FormControl mb={4}>
            <FormLabel>Product Code</FormLabel>
            <Input 
              name="default_code"
              placeholder="Enter product code" 
              value={productData.default_code}
              onChange={handleInputChange}
            />
            <FormHelperText>Internal reference code</FormHelperText>
          </FormControl>
          
          <FormControl mb={4}>
            <FormLabel>Barcode</FormLabel>
            <Input 
              name="barcode"
              placeholder="Enter barcode" 
              value={productData.barcode}
              onChange={handleInputChange}
            />
          </FormControl>
          
          <FormControl mb={4} isRequired>
            <FormLabel>Price</FormLabel>
            <NumberInput 
              min={0} 
              precision={2} 
              step={0.01}
              value={productData.list_price}
              onChange={handlePriceChange}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>
          
          <FormControl mb={4}>
            <FormLabel>Category</FormLabel>
            <Select 
              name="categ_id"
              placeholder="Select product category" 
              value={productData.categ_id}
              onChange={handleInputChange}
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.complete_name || category.name}
                </option>
              ))}
            </Select>
          </FormControl>
          
          <FormControl mb={4} display="flex" alignItems="center">
            <FormLabel mb="0">Available in POS</FormLabel>
            <Switch 
              name="available_in_pos"
              isChecked={productData.available_in_pos}
              onChange={handleSwitchChange}
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
            Create Product
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

// EditProductModal component
const EditProductModal = ({ isOpen, onClose, product, categories, onUpdateProduct }) => {
  const [productData, setProductData] = useState({
    name: '',
    default_code: '',
    barcode: '',
    list_price: 0,
    categ_id: '',
    available_in_pos: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  // Initialize form with product data when opened
  useEffect(() => {
    if (product) {
      setProductData({
        name: product.name || '',
        default_code: product.default_code || '',
        barcode: product.barcode || '',
        list_price: product.list_price || 0,
        categ_id: product.categ_id ? product.categ_id[0] : '',
        available_in_pos: product.available_in_pos || false,
      });
    }
  }, [product]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProductData({ ...productData, [name]: value });
  };

  const handleSwitchChange = (e) => {
    const { name, checked } = e.target;
    setProductData({ ...productData, [name]: checked });
  };

  const handlePriceChange = (value) => {
    setProductData({ ...productData, list_price: parseFloat(value) });
  };

  const handleSubmit = async () => {
    if (!productData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Product name is required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const updatedProductData = {
        ...productData,
        categ_id: productData.categ_id ? Number(productData.categ_id) : false,
      };
      
      await onUpdateProduct(product.id, updatedProductData);
      onClose();
      
      toast({
        title: 'Product Updated',
        description: 'Product has been updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update product',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit Product</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={4} isRequired>
            <FormLabel>Product Name</FormLabel>
            <Input 
              name="name"
              placeholder="Enter product name" 
              value={productData.name}
              onChange={handleInputChange}
            />
          </FormControl>
          
          <FormControl mb={4}>
            <FormLabel>Product Code</FormLabel>
            <Input 
              name="default_code"
              placeholder="Enter product code" 
              value={productData.default_code}
              onChange={handleInputChange}
            />
            <FormHelperText>Internal reference code</FormHelperText>
          </FormControl>
          
          <FormControl mb={4}>
            <FormLabel>Barcode</FormLabel>
            <Input 
              name="barcode"
              placeholder="Enter barcode" 
              value={productData.barcode}
              onChange={handleInputChange}
            />
          </FormControl>
          
          <FormControl mb={4} isRequired>
            <FormLabel>Price</FormLabel>
            <NumberInput 
              min={0} 
              precision={2} 
              step={0.01}
              value={productData.list_price}
              onChange={handlePriceChange}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>
          
          <FormControl mb={4}>
            <FormLabel>Category</FormLabel>
            <Select 
              name="categ_id"
              placeholder="Select product category" 
              value={productData.categ_id}
              onChange={handleInputChange}
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.complete_name || category.name}
                </option>
              ))}
            </Select>
          </FormControl>
          
          <FormControl mb={4} display="flex" alignItems="center">
            <FormLabel mb="0">Available in POS</FormLabel>
            <Switch 
              name="available_in_pos"
              isChecked={productData.available_in_pos}
              onChange={handleSwitchChange}
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
            Update Product
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const toast = useToast();
  const { isOpen: isAddOpen, onClose: onAddClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isDeleteConfirmOpen, onOpen: onDeleteConfirmOpen, onClose: onDeleteConfirmClose } = useDisclosure();
  const { isOpen: isProductModalOpen, onOpen: onProductModalOpen, onClose: onProductModalClose } = useDisclosure();

  // Define fetchProducts and fetchCategories with useCallback
  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await productService.getProducts();
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to load products',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoryService.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: 'Error',
        description: 'Failed to load categories',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [toast]);

  // Load products and categories on mount
  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  // Filter products when search text or category changes
  useEffect(() => {
    let filtered = [...products];
    
    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(product => 
        product.categ_id && product.categ_id[0] === selectedCategory.id
      );
    }
    
    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        product => 
          product.name.toLowerCase().includes(searchLower) || 
          (product.default_code && product.default_code.toLowerCase().includes(searchLower)) ||
          (product.barcode && product.barcode.toLowerCase().includes(searchLower))
      );
    }
    
    setFilteredProducts(filtered);
  }, [products, searchText, selectedCategory]);

  const handleAddProduct = async (productData) => {
    try {
      const result = await productService.createProduct(productData);
      await fetchProducts(); // Refresh the products list
      return result;
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  };

  const handleUpdateProduct = async (id, productData) => {
    try {
      await productService.updateProduct(id, productData);
      await fetchProducts(); // Refresh the products list
      return true;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    
    try {
      await productService.deleteProduct(selectedProduct.id);
      await fetchProducts(); // Refresh the products list
      onDeleteConfirmClose();
      setSelectedProduct(null);
      
      toast({
        title: 'Product Deleted',
        description: 'Product has been deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete product',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleEditClick = (product) => {
    setSelectedProduct(product);
    onEditOpen();
  };

  const handleDeleteClick = (product) => {
    setSelectedProduct(product);
    onDeleteConfirmOpen();
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchProducts();
      toast({
        title: 'Success',
        description: 'Products refreshed successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error refreshing products:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getCategoryName = (product) => {
    if (!product.categ_id) return '-';
    const categoryId = product.categ_id[0];
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : '-';
  };

  const countProductsByCategory = (categoryId) => {
    return products.filter(product => 
      product.categ_id && product.categ_id[0] === categoryId
    ).length;
  };

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSearchText('');
  };

  return (
    <Box p={4}>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Products Management</Heading>
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
            onClick={onProductModalOpen}
          >
            Manage Products
          </Button>
        </HStack>
      </Flex>

      <Grid templateColumns={{ base: "1fr", md: "250px 1fr" }} gap={6}>
        {/* Sidebar */}
        <GridItem>
          <VStack align="stretch" spacing={4} bg="white" p={4} borderRadius="md" shadow="sm">
            <Box>
              <Heading size="sm" mb={3} display="flex" alignItems="center">
                <FiFilter style={{ marginRight: '8px' }} />
                Filters
              </Heading>
              <Button 
                size="sm" 
                width="full" 
                justifyContent="flex-start"
                variant={!selectedCategory ? "solid" : "outline"}
                colorScheme={!selectedCategory ? "blue" : "gray"}
                leftIcon={<FiPackage />}
                mb={2}
                onClick={() => setSelectedCategory(null)}
              >
                All Products
                <Badge ml="auto" colorScheme="blue">{products.length}</Badge>
              </Button>
              
              {selectedCategory && (
                <Button
                  size="sm"
                  width="full"
                  justifyContent="flex-start"
                  variant="outline"
                  colorScheme="red"
                  leftIcon={<FiX />}
                  mb={2}
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              )}
            </Box>
            
            <Divider />
            
            <Box>
              <Heading size="sm" mb={3} display="flex" alignItems="center">
                <FiLayers style={{ marginRight: '8px' }} />
                Categories
              </Heading>
              
              <VStack align="stretch" spacing={1} maxH="300px" overflowY="auto">
                {categories.map(category => (
                  <Button
                    key={category.id}
                    size="sm"
                    width="full"
                    justifyContent="flex-start"
                    variant={selectedCategory?.id === category.id ? "solid" : "ghost"}
                    colorScheme={selectedCategory?.id === category.id ? "blue" : "gray"}
                    leftIcon={<FiTag />}
                    onClick={() => handleCategoryClick(category)}
                  >
                    {category.name}
                    <Badge ml="auto" colorScheme="blue">
                      {countProductsByCategory(category.id)}
                    </Badge>
                  </Button>
                ))}
                
                {categories.length === 0 && (
                  <Text fontSize="sm" color="gray.500" textAlign="center" py={2}>
                    No categories found
                  </Text>
                )}
              </VStack>
            </Box>
          </VStack>
        </GridItem>
        
        {/* Main Content */}
        <GridItem>
          <Box bg="white" p={4} borderRadius="md" shadow="sm" mb={6}>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <FiSearch color="gray.300" />
              </InputLeftElement>
              <Input
                placeholder="Search products by name, code or barcode..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </InputGroup>
          </Box>

          <Box bg="white" borderRadius="md" shadow="sm" overflow="hidden">
            {isLoading ? (
              <Flex justify="center" align="center" p={10}>
                <Spinner size="xl" color="blue.500" />
              </Flex>
            ) : filteredProducts.length > 0 ? (
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th>Image</Th>
                      <Th>Name</Th>
                      <Th>Code</Th>
                      <Th>Barcode</Th>
                      <Th>Category</Th>
                      <Th isNumeric>Price</Th>
                      <Th>Available in POS</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredProducts.map(product => (
                      <Tr key={product.id} _hover={{ bg: 'gray.50' }}>
                        <Td>
                          {product.image_128 ? (
                            <Image
                              src={`data:image/png;base64,${product.image_128}`}
                              fallbackSrc="https://via.placeholder.com/40?text=Product"
                              alt={product.name}
                              boxSize="40px"
                              objectFit="contain"
                            />
                          ) : (
                            <Box
                              bg="gray.100"
                              boxSize="40px"
                              borderRadius="md"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                            >
                              <Text fontSize="xs" color="gray.500">N/A</Text>
                            </Box>
                          )}
                        </Td>
                        <Td fontWeight="medium">{product.name}</Td>
                        <Td>{product.default_code || '-'}</Td>
                        <Td>
                          {product.barcode ? (
                            <Badge colorScheme="blue">{product.barcode}</Badge>
                          ) : (
                            '-'
                          )}
                        </Td>
                        <Td>{getCategoryName(product)}</Td>
                        <Td isNumeric fontWeight="bold">
                          ${product.list_price.toFixed(2)}
                        </Td>
                        <Td>
                          <Badge colorScheme={product.available_in_pos ? 'green' : 'red'}>
                            {product.available_in_pos ? 'Yes' : 'No'}
                          </Badge>
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            <IconButton
                              size="sm"
                              colorScheme="blue"
                              icon={<FiEdit2 />}
                              aria-label="Edit"
                              variant="ghost"
                              onClick={() => handleEditClick(product)}
                            />
                            <IconButton
                              size="sm"
                              colorScheme="red"
                              icon={<FiTrash2 />}
                              aria-label="Delete"
                              variant="ghost"
                              onClick={() => handleDeleteClick(product)}
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
                <Text color="gray.500">No products found</Text>
              </Flex>
            )}
          </Box>
        </GridItem>
      </Grid>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddOpen}
        onClose={onAddClose}
        categories={categories}
        onAddProduct={handleAddProduct}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={isEditOpen}
        onClose={onEditClose}
        product={selectedProduct}
        categories={categories}
        onUpdateProduct={handleUpdateProduct}
      />

      {/* Product Management Modal */}
      <ProductManagementModal
        isOpen={isProductModalOpen}
        onClose={onProductModalClose}
      />

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteConfirmOpen} onClose={onDeleteConfirmClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete Product</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Are you sure you want to delete this product?</Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" mr={3} onClick={onDeleteConfirmClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleDeleteProduct}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ProductsPage; 