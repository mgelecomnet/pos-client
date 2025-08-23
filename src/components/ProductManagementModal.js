import React, { useState, useEffect, useRef } from 'react';
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
  FormControl,
  FormLabel,
  Input,
  Textarea,
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
  Stack,
  VStack,
  HStack,
  Divider,
  useToast,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  InputRightAddon,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Checkbox,
  Badge,
  useColorModeValue,
  IconButton,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Switch,
  Container,
  Heading,
  Grid,
  SimpleGrid,
  RadioGroup,
  Radio,
  Icon,
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
  FiSearch,
  FiDollarSign,
  FiPackage,
  FiTag,
  FiBarChart,
  FiArrowLeft,
  FiSettings,
  FiLayers,
  FiMonitor,
  FiShoppingCart,
  FiShoppingBag,
} from 'react-icons/fi';
import { categoryAPI, productAPI, customerAPI, currencyAPI, odooOnlineConfig, getImageUrl } from '../api/odooapi_online';
import { useNavigate } from 'react-router-dom';

// Helper function to get product image URL
const getProductImageUrl = (productId, field = 'image_128') => {
  // Add timestamp to prevent caching
  const timestamp = new Date().getTime();
  return `http://localhost:8069/web/image/product.template/${productId}/${field}?unique=${timestamp}`;
};

// Add/Edit Product Modal Component
const ProductFormModal = ({ isOpen, onClose, product, categories, posCategories, currencies, isEditing = false, onSave }) => {
  const [productForm, setProductForm] = useState({
    name: '',
    default_code: '',
    barcode: '',
    list_price: 0,
    standard_price: 0,
    categ_id: 2, // Default to the saleable category (ID 2)
    pos_categ_ids: [],
    available_in_pos: true,
    sale_ok: true,
    purchase_ok: true,
    type: 'consu',
    description: '',
    description_sale: '',
    image_1920: null,
  });
  const [previewImage, setPreviewImage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preserveImage, setPreserveImage] = useState(true);
  
  const toast = useToast();
  
  // Initialize form with product data when opened for editing
  useEffect(() => {
    if (isEditing && product) {
      const categoryId = product.categ_id ? 
        (Array.isArray(product.categ_id) ? product.categ_id[0] : 
          (typeof product.categ_id === 'object' ? product.categ_id.id : product.categ_id)) : '';
      
      // Handle POS categories - new format from server
      let posCategoryId = '';
      if (product.pos_categ_ids) {
        console.log('Original POS category data:', product.pos_categ_ids);
        
        // Handle array of objects format: [{id: 6, display_name: "Others", color: 4}]
        if (Array.isArray(product.pos_categ_ids) && product.pos_categ_ids.length > 0) {
          if (typeof product.pos_categ_ids[0] === 'object' && product.pos_categ_ids[0].id) {
            posCategoryId = product.pos_categ_ids[0].id;
          } else {
            // Handle simple array of ids format: [6]
            posCategoryId = product.pos_categ_ids[0];
          }
        } 
        // Handle object format with ids property: {ids: [6]}
        else if (typeof product.pos_categ_ids === 'object') {
          if (product.pos_categ_ids.ids && Array.isArray(product.pos_categ_ids.ids) && product.pos_categ_ids.ids.length > 0) {
            posCategoryId = product.pos_categ_ids.ids[0];
          }
        }
      }
      
      console.log('Processing product for edit:', product);
      console.log('Resolved POS category ID:', posCategoryId);

      // Ensure product type is one of our supported types (consu, service, combo)
      let productType = product.type || 'consu';
      if (!['consu', 'service', 'combo'].includes(productType)) {
        productType = 'consu'; // Default to consu if an unsupported type
      }

      setProductForm({
        name: product.name || '',
        default_code: product.default_code || '',
        barcode: product.barcode || '',
        list_price: product.list_price || 0,
        standard_price: product.standard_price || 0,
        categ_id: categoryId || '',
        pos_categ_ids: posCategoryId ? [posCategoryId] : [],
        available_in_pos: product.available_in_pos || false,
        sale_ok: product.sale_ok || true,
        purchase_ok: product.purchase_ok || true,
        type: productType,
        description: product.description || '',
        description_sale: product.description_sale || '',
        image_1920: null,
      });
      
      // Use direct URL for product images instead of base64
      if (product.id) {
        setPreviewImage(getProductImageUrl(product.id));
      } else {
        setPreviewImage('');
      }
    } else {
      // Reset form when opening for adding
      setProductForm({
        name: '',
        default_code: '',
        barcode: '',
        list_price: 0,
        standard_price: 0,
        categ_id: 2, // Default to the saleable category (ID 2)
        pos_categ_ids: [],
        available_in_pos: true,
        sale_ok: true,
        purchase_ok: true,
        type: 'consu',
        description: '',
        description_sale: '',
        image_1920: null,
      });
      setPreviewImage('');
    }
    
    // Reset preserve image flag when opening modal
    setPreserveImage(true);
  }, [isEditing, product, isOpen]);
  
  // Handle form input changes
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProductForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Handle image change
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result.split(',')[1];
      setProductForm(prev => ({
        ...prev,
        image_1920: base64
      }));
      setPreviewImage(event.target.result);
      // Set preserve image to false since we're explicitly changing it
      setPreserveImage(false);
    };
    reader.readAsDataURL(file);
  };
  
  // Handle price input
  const handlePriceChange = (name, value) => {
    setProductForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    try {
      // Validate form
      if (!productForm.name.trim()) {
        toast({
          title: 'خطا',
          description: 'نام محصول الزامی است',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      setIsSubmitting(true);
      
      // Create product data object
      const productData = {
        name: productForm.name,
        default_code: productForm.default_code,
        barcode: productForm.barcode,
        list_price: parseFloat(productForm.list_price),
        standard_price: parseFloat(productForm.standard_price),
        categ_id: productForm.categ_id ? parseInt(productForm.categ_id) : false,
        available_in_pos: productForm.available_in_pos,
        sale_ok: productForm.sale_ok,
        purchase_ok: productForm.purchase_ok,
        type: productForm.type,
        description: productForm.description,
        description_sale: productForm.description_sale,
      };
      
      // Only include image if it was changed (not preserved)
      if (!preserveImage && productForm.image_1920) {
        productData.image_1920 = productForm.image_1920;
      }
      
      // Handle POS categories - try a different approach for Odoo API
      if (productForm.pos_categ_ids && productForm.pos_categ_ids.length > 0) {
        // Get the first (and only) POS category ID
        const posCategoryId = productForm.pos_categ_ids[0];
        
        if (posCategoryId) {
          // Format as integer
          const categoryIdInt = typeof posCategoryId === 'string' ? 
            parseInt(posCategoryId) : posCategoryId;
          
          // Try the simplest format - just plain array of IDs
          productData.pos_categ_ids = [categoryIdInt];
          
          console.log('Using simple array for POS category:', productData.pos_categ_ids);
        } else {
          // If no valid category, use an empty array
          productData.pos_categ_ids = [];
        }
      } else {
        // If no categories selected, use an empty array
        productData.pos_categ_ids = [];
      }
      
      console.log('Saving product with data:', productData);
      
      // Save product through the parent component handler
      await onSave(productData, isEditing ? product.id : null);
      
      // Close modal after success
      onClose();
      
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} product:`, error);
        toast({
          title: 'خطا',
        description: `${isEditing ? 'به‌روزرسانی' : 'ایجاد'} محصول با مشکل مواجه شد`,
          status: 'error',
        duration: 5000,
          isClosable: true,
        });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="5xl">
      <ModalOverlay />
      <ModalContent maxW="90vw">
        <ModalHeader borderBottomWidth="1px">
          {isEditing ? 'ویرایش محصول' : 'افزودن محصول جدید'}
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody py={4}>
          <Grid templateColumns="repeat(2, 1fr)" gap={6}>
            {/* Column 1 */}
            <VStack align="stretch" spacing={4}>
              <FormControl isRequired>
                <FormLabel>نام محصول</FormLabel>
                <Input
                  name="name"
                  value={productForm.name}
                  onChange={handleFormChange}
                  placeholder="نام محصول را وارد کنید"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>کد محصول</FormLabel>
                <Input
                  name="default_code"
                  value={productForm.default_code}
                  onChange={handleFormChange}
                  placeholder="کد محصول را وارد کنید"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>بارکد</FormLabel>
                <Input
                  name="barcode"
                  value={productForm.barcode}
                  onChange={handleFormChange}
                  placeholder="بارکد محصول را وارد کنید"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>قیمت فروش</FormLabel>
                <InputGroup>
                  <NumberInput
                    min={0}
                    precision={0}
                    value={productForm.list_price}
                    onChange={(value) => handlePriceChange('list_price', value)}
                    width="100%"
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <InputRightAddon children="واحد پول" />
                </InputGroup>
              </FormControl>
              
              <FormControl>
                <FormLabel>قیمت خرید</FormLabel>
                <InputGroup>
                  <NumberInput
                    min={0}
                    precision={0}
                    value={productForm.standard_price}
                    onChange={(value) => handlePriceChange('standard_price', value)}
                    width="100%"
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <InputRightAddon children="واحد پول" />
                </InputGroup>
              </FormControl>
              
              <FormControl>
                <FormLabel>دسته‌بندی</FormLabel>
                <Select
                  name="categ_id"
                  value={productForm.categ_id}
                  onChange={handleFormChange}
                  placeholder="انتخاب دسته‌بندی"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl>
                <FormLabel>دسته‌بندی POS</FormLabel>
                <Select
                  name="pos_categ_ids"
                  value={productForm.pos_categ_ids?.[0] || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setProductForm(prev => ({
                      ...prev,
                      pos_categ_ids: value ? [parseInt(value)] : []
                    }));
                  }}
                  placeholder="انتخاب دسته‌بندی POS"
                >
                  {posCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </VStack>
            
            {/* Column 2 */}
            <VStack align="stretch" spacing={4}>
              <FormControl>
                <FormLabel>نوع محصول</FormLabel>
                <RadioGroup
                  value={productForm.type}
                  onChange={(value) => setProductForm(prev => ({ ...prev, type: value }))}
                >
                  <Stack direction="row" spacing={4}>
                    <Radio colorScheme="blue" size="lg" value="consu">
                      <HStack>
                        <Icon as={FiPackage} />
                        <Text>کالای فیزیکی</Text>
                      </HStack>
                    </Radio>
                    <Radio colorScheme="green" size="lg" value="service">
                      <HStack>
                        <Icon as={FiSettings} />
                        <Text>خدمات</Text>
                      </HStack>
                    </Radio>
                    <Radio colorScheme="purple" size="lg" value="combo">
                      <HStack>
                        <Icon as={FiLayers} />
                        <Text>ترکیبی</Text>
                      </HStack>
                    </Radio>
                  </Stack>
                </RadioGroup>
              </FormControl>
              
              <SimpleGrid columns={3} spacing={4}>
                <FormControl>
                  <FormLabel>قابل استفاده در POS</FormLabel>
                  <Flex align="center">
                    <Switch
                      name="available_in_pos"
                      isChecked={productForm.available_in_pos}
                      onChange={handleFormChange}
                      size="lg"
                      colorScheme="blue"
                      mr={2}
                    />
                    <Icon 
                      as={FiMonitor} 
                      color={productForm.available_in_pos ? "blue.500" : "gray.400"}
                      boxSize="24px"
                    />
                  </Flex>
                </FormControl>
                
                <FormControl>
                  <FormLabel>قابل فروش</FormLabel>
                  <Flex align="center">
                    <Switch
                      name="sale_ok"
                      isChecked={productForm.sale_ok}
                      onChange={handleFormChange}
                      size="lg"
                      colorScheme="green"
                      mr={2}
                    />
                    <Icon 
                      as={FiShoppingCart} 
                      color={productForm.sale_ok ? "green.500" : "gray.400"}
                      boxSize="24px"
                    />
                  </Flex>
                </FormControl>
                
                <FormControl>
                  <FormLabel>قابل خرید</FormLabel>
                  <Flex align="center">
                    <Switch
                      name="purchase_ok"
                      isChecked={productForm.purchase_ok}
                      onChange={handleFormChange}
                      size="lg"
                      colorScheme="orange"
                      mr={2}
                    />
                    <Icon 
                      as={FiShoppingBag} 
                      color={productForm.purchase_ok ? "orange.500" : "gray.400"}
                      boxSize="24px"
                    />
                  </Flex>
                </FormControl>
              </SimpleGrid>
              
              <FormControl>
                <FormLabel>توضیحات</FormLabel>
                <Textarea
                  name="description"
                  value={productForm.description}
                  onChange={handleFormChange}
                  placeholder="توضیحات محصول"
                  rows={2}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>توضیحات فروش</FormLabel>
                <Textarea
                  name="description_sale"
                  value={productForm.description_sale}
                  onChange={handleFormChange}
                  placeholder="توضیحات فروش محصول"
                  rows={2}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>تصویر محصول</FormLabel>
                <Input
                  type="file"
                  p={1}
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {previewImage && (
                  <Box mt={2}>
                    <Image
                      src={previewImage}
                      alt="تصویر محصول"
                      maxH="100px"
                      objectFit="contain"
                      borderRadius="md"
                    />
                  </Box>
                )}
              </FormControl>
            </VStack>
          </Grid>
        </ModalBody>
        
        <ModalFooter borderTopWidth="1px">
          <Button variant="outline" mr={3} onClick={onClose}>
            انصراف
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={handleSubmit}
            isLoading={isSubmitting}
            loadingText={isEditing ? "در حال ویرایش..." : "در حال افزودن..."}
          >
            {isEditing ? 'ذخیره تغییرات' : 'افزودن محصول'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

// Main component that can be used both as a modal and a standalone page
const ProductManagement = ({ isModal = false, modalProps = {} }) => {
  const navigate = useNavigate();
  // State for products list
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for product form modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // State for categories (kept for forms)
  const [categories, setCategories] = useState([]);
  const [posCategories, setPOSCategories] = useState([]);
  
  // Add state for currency information
  const [currencies, setCurrencies] = useState([]);
  const [defaultCurrency, setDefaultCurrency] = useState({ symbol: 'تومان', position: 'after' });
  
  // State for delete confirmation
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const cancelRef = useRef();
  
  const toast = useToast();
  
  // Colors
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const headerBg = useColorModeValue('blue.50', 'blue.900');
  const tableHeadBg = useColorModeValue('gray.50', 'gray.700');
  const bgHover = useColorModeValue('gray.50', 'gray.700');

  // Fetch products and other data when component mounts or modal opens
  useEffect(() => {
    if (!isModal || modalProps.isOpen) {
      fetchProducts();
      fetchProductCategories();
      fetchPOSCategories();
      fetchCurrencies(); // Add currency fetching
    }
  }, [isModal, modalProps.isOpen]);
  
  // Filter products based on search query
  useEffect(() => {
    let filtered = [...products];
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product => {
        if (!product) return false;
        
        const nameMatch = product.name && 
          typeof product.name === 'string' && 
          product.name.toLowerCase().includes(query);
        
        const codeMatch = product.default_code && 
          typeof product.default_code === 'string' && 
          product.default_code.toLowerCase().includes(query);
        
        return nameMatch || codeMatch;
      });
    }
    
    setFilteredProducts(filtered);
  }, [searchQuery, products]);
  
  // Fetch currencies from Odoo
  const fetchCurrencies = async () => {
    try {
      const currencyData = await currencyAPI.fetchCurrencies();
      
      if (currencyData && currencyData.length > 0) {
        setCurrencies(currencyData);
        
        // Try to find the base currency (rate = 1)
        const baseCurrency = currencyData.find(c => c.rate === 1);
        if (baseCurrency) {
          setDefaultCurrency({
            id: baseCurrency.id,
            name: baseCurrency.name,
            symbol: baseCurrency.symbol || 'تومان',
            position: baseCurrency.position || 'after',
            decimal_places: baseCurrency.decimal_places || 0
          });
        }
        
        console.log('Currency data loaded successfully:', currencyData);
      }
    } catch (error) {
      console.error('Error fetching currencies:', error);
      // Keep the default currency as fallback
    }
  };
  
  // Fetch products from API
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      // Use direct Odoo API call with product.template model
      const data = await productAPI.fetchProductTemplates();
      setProducts(data);
      console.log('Products loaded:', data.length);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'خطا',
        description: 'دریافت محصولات با مشکل مواجه شد',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch product categories from API
  const fetchProductCategories = async () => {
    try {
      // Use direct Odoo API call for product categories
      const data = await categoryAPI.fetchProductCategories();
      setCategories(data);
      console.log('Product categories loaded:', data);
      
      // Try to find the Saleable category by name
      const saleableCategory = data.find(cat => 
        cat.name === 'Saleable' || 
        cat.display_name === 'Saleable' || 
        cat.name === 'All / Saleable' ||
        cat.display_name === 'All / Saleable' ||
        cat.name === 'قابل فروش' ||
        cat.display_name === 'قابل فروش'
      );
      
      if (saleableCategory) {
        console.log('Found Saleable category:', saleableCategory);
        // Store the saleable category ID for later use, but don't update the form here
      }
    } catch (error) {
      console.error('Error fetching product categories:', error);
        toast({
          title: 'خطا',
        description: 'دریافت دسته‌بندی‌های محصول با مشکل مواجه شد',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
    }
  };
  
  // Fetch POS categories
  const fetchPOSCategories = async () => {
    try {
      // Use direct Odoo API call for POS categories
      const data = await categoryAPI.fetchCategories();
      setPOSCategories(data);
      console.log('POS categories loaded:', data);
    } catch (error) {
      console.error('Error fetching POS categories:', error);
        toast({
          title: 'خطا',
        description: 'دریافت دسته‌بندی‌های POS با مشکل مواجه شد',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
    }
  };
  
  // Refresh products list
  const refreshProducts = async () => {
    try {
      await fetchProducts();
        toast({
        title: 'به‌روزرسانی',
        description: 'لیست محصولات به‌روزرسانی شد',
        status: 'success',
        duration: 2000,
          isClosable: true,
        });
    } catch (error) {
      console.error('Error refreshing products:', error);
    }
  };
  
  // Handle edit click
  const handleEditClick = async (product) => {
    try {
      setIsLoading(true);
      
      // Get detailed product information using web_read
      const productDetails = await productAPI.getProductDetails(product.id);
      
      if (productDetails) {
        console.log('Product details:', productDetails);
        setSelectedProduct(productDetails);
      } else {
        // If detailed fetch fails, use the basic product info
        console.warn('Could not fetch detailed product info, using basic data');
        setSelectedProduct(product);
      }
      
      // Open edit modal
      setIsEditModalOpen(true);
    } catch (error) {
      console.error('Error fetching product details:', error);
      toast({
          title: 'خطا',
        description: 'دریافت اطلاعات محصول با مشکل مواجه شد',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      
      // If there's an error, still open the modal with basic product info
      setSelectedProduct(product);
      setIsEditModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle add click - just open the modal
  const handleAddClick = () => {
    // Simply open the modal - the form will be initialized with defaults in the modal component
    setIsAddModalOpen(true);
  };
  
  // Handle delete click
  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setIsDeleteConfirmOpen(true);
  };
  
  // Handle save product (both add and edit)
  const handleSaveProduct = async (productData, productId = null) => {
    try {
      let result;
      
      if (productId) {
        // Update existing product using web_save API
        console.log('Updating product with ID:', productId);
        result = await productAPI.updateProduct(productId, productData);
      } else {
        // Create new product 
        console.log('Creating new product');
        result = await productAPI.createProduct(productData);
      }
      
      if (result) {
        // Get the product ID from the result if it's a new product
        const updatedProductId = productId || (typeof result === 'number' ? result : (result.id || null));
        console.log('Product saved successfully, ID:', updatedProductId);
      
      toast({
          title: 'موفقیت',
          description: productId ? 'محصول با موفقیت به‌روزرسانی شد' : 'محصول با موفقیت اضافه شد',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
        // Refresh product list
        fetchProducts();
        
        // Reset forms
        if (isAddModalOpen) setIsAddModalOpen(false);
        if (isEditModalOpen) setIsEditModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: 'خطا',
        description: productId ? 'به‌روزرسانی محصول با خطا مواجه شد' : 'افزودن محصول با خطا مواجه شد',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Handle delete product
  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    
    setIsDeleting(true);
    
    try {
      // Delete product using direct API
      const success = await productAPI.deleteProduct(productToDelete.id);
      
      if (success) {
        toast({
          title: 'موفقیت',
          description: 'محصول با موفقیت حذف شد',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh product list
        fetchProducts();
        
        // Reset state
        setProductToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'خطا',
        description: 'حذف محصول با خطا مواجه شد',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Get category name for product
  const getCategoryName = (product) => {
    if (!product.categ_id) return 'بدون دسته بندی';
    
    // Support both formats: [id, name] array or {id, name} object
    if (Array.isArray(product.categ_id) && product.categ_id.length > 1) {
      return product.categ_id[1];
    } else if (typeof product.categ_id === 'object' && product.categ_id.display_name) {
      return product.categ_id.display_name;
    } else if (typeof product.categ_id === 'object' && product.categ_id.name) {
      return product.categ_id.name;
    }
    
    // Try to find the category in our categories list
    const categoryId = Array.isArray(product.categ_id) ? product.categ_id[0] : product.categ_id;
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'بدون دسته بندی';
  };

  // Get currency for a product
  const getProductCurrency = (product) => {
    if (!product || !product.currency_id) return defaultCurrency;
    
    let currencyId;
    // Handle different formats of currency_id
    if (Array.isArray(product.currency_id)) {
      currencyId = product.currency_id[0];
    } else if (typeof product.currency_id === 'object' && product.currency_id.id) {
      currencyId = product.currency_id.id;
    } else if (typeof product.currency_id === 'number') {
      currencyId = product.currency_id;
    } else {
      return defaultCurrency;
    }
    
    // Find currency in our currencies array
    const currency = currencies.find(c => c.id === currencyId);
    if (currency) {
      return {
        id: currency.id,
        name: currency.name,
        symbol: currency.symbol || 'تومان',
        position: currency.position || 'after',
        decimal_places: currency.decimal_places || 0
      };
    }
    
    return defaultCurrency;
  };

  // Format price with currency
  const formatPrice = (price, product) => {
    if (price === undefined || price === null) return '0';
    if (!product) return `0 تومان`;
    
    try {
      const currency = getProductCurrency(product);
      const formattedNumber = Number(price).toLocaleString('fa-IR');
      
      // Format based on currency position
      if (currency.position === 'before') {
        return `${currency.symbol} ${formattedNumber}`;
      } else {
        return `${formattedNumber} ${currency.symbol}`;
      }
    } catch (error) {
      console.warn('Error formatting price:', price, error);
      return `0 تومان`;
    }
  };

  // Delete confirmation dialog component
  const DeleteProductConfirmation = () => (
      <AlertDialog
        isOpen={isDeleteConfirmOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsDeleteConfirmOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              حذف محصول
            </AlertDialogHeader>

            <AlertDialogBody>
            آیا از حذف محصول "{productToDelete?.name}" اطمینان دارید؟
            این عملیات غیرقابل بازگشت است.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsDeleteConfirmOpen(false)}>
                انصراف
              </Button>
              <Button colorScheme="red" onClick={handleDeleteProduct} ml={3}>
                حذف
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    );

  // The actual content of the product management screen
  const ProductManagementContent = () => (
    <Box>
      {/* Header and search bar */}
      <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
        {!isModal && (
          <Button leftIcon={<FiArrowLeft />} variant="ghost" onClick={() => navigate(-1)}>
            بازگشت
              </Button>
        )}
        <Heading size="md" mb={isModal ? 4 : 0}>مدیریت محصولات</Heading>
        <HStack spacing={2}>
          <InputGroup size="md" maxW="300px">
                    <InputLeftElement pointerEvents="none">
                      <FiSearch color="gray.300" />
                    </InputLeftElement>
                    <Input 
              placeholder="جستجوی محصول..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </InputGroup>
          <IconButton
            aria-label="افزودن محصول"
            icon={<FiPlus />}
            colorScheme="green"
            onClick={handleAddClick}
          />
          <IconButton
            aria-label="بارگذاری مجدد"
            icon={<FiRefreshCw />}
            onClick={refreshProducts}
            isLoading={isLoading}
          />
        </HStack>
      </Flex>
      
      {/* Products list */}
      <Box
        p={4}
        borderWidth="1px"
        borderRadius="md"
        borderColor={borderColor}
        bg="white"
        boxShadow="sm"
        overflowX="auto"
      >
                  {isLoading ? (
          <Flex justify="center" align="center" h="200px">
            <Spinner size="xl" thickness="4px" speed="0.65s" color="blue.500" />
                    </Flex>
                  ) : filteredProducts.length > 0 ? (
          <>
                    <Table variant="simple" size="sm">
              <Thead bg={tableHeadBg}>
                        <Tr>
                  <Th>تصویر</Th>
                          <Th>نام محصول</Th>
                          <Th>کد</Th>
                          <Th>قیمت</Th>
                          <Th>موجودی</Th>
                  <Th>عملیات</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {filteredProducts.map(product => (
                  <Tr key={product.id} _hover={{ bg: bgHover }}>
                    <Td width="60px">
                                <Image
                        src={product.id ? getProductImageUrl(product.id) : 'https://via.placeholder.com/50'}
                                  alt={product.name}
                        boxSize="50px"
                        objectFit="contain"
                                  borderRadius="md"
                                />
                            </Td>
                            <Td fontWeight="medium">{product.name}</Td>
                            <Td>{product.default_code || '-'}</Td>
                    <Td>{formatPrice(product.list_price, product)}</Td>
                    <Td>{product.qty_available || 0}</Td>
                            <Td>
                              <HStack spacing={2}>
                                <IconButton
                          aria-label="ویرایش"
                                  icon={<FiEdit />}
                                  size="sm"
                                  onClick={() => handleEditClick(product)}
                                />
                                <IconButton
                          aria-label="حذف"
                                  icon={<FiTrash2 />}
                                  size="sm"
                                  colorScheme="red"
                                  onClick={() => handleDeleteClick(product)}
                                />
                              </HStack>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
            
            {/* Info bar at the bottom */}
            <Flex justify="space-between" align="center" mt={4} px={2} py={1} bg="gray.50" borderRadius="md">
              <Text fontSize="sm">
                نمایش {filteredProducts.length} محصول از {products.length} محصول
                  </Text>
              
              <Text fontSize="sm" color="gray.600">
                مجموع موجودی: {
                  Array.isArray(products) 
                    ? products.reduce((sum, p) => sum + (p && p.qty_available ? Number(p.qty_available) || 0 : 0), 0)
                    : 0
                }
                    </Text>
                  </Flex>
          </>
        ) : (
          <Flex justify="center" align="center" h="200px" direction="column">
            <Text fontSize="lg" mb={2}>محصولی یافت نشد</Text>
            <Text color="gray.500">
              {searchQuery ? 'جستجوی شما با هیچ محصولی مطابقت ندارد.' : 'هیچ محصولی وجود ندارد. محصول جدیدی اضافه کنید.'}
            </Text>
                    </Flex>
                  )}
                </Box>
                
      {/* Product Form Modals */}
      <ProductFormModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        categories={categories}
        posCategories={posCategories}
        currencies={currencies}
        isEditing={false}
        onSave={handleSaveProduct}
      />
      
      <ProductFormModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        product={selectedProduct}
        categories={categories}
        posCategories={posCategories}
        currencies={currencies}
        isEditing={true}
        onSave={handleSaveProduct}
      />
      
      {/* Delete confirmation dialog */}
      <DeleteProductConfirmation />
                      </Box>
  );

  // Render component based on whether it's being used as a modal or a standalone page
  return isModal ? (
    <Modal 
      isOpen={modalProps.isOpen} 
      onClose={modalProps.onClose} 
      size="6xl"
      scrollBehavior="inside"
    >
      <ModalOverlay />
      <ModalContent maxW="95vw">
        <ModalHeader>مدیریت محصولات</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <ProductManagementContent />
          </ModalBody>
        </ModalContent>
      </Modal>
  ) : (
    <Box p={4}>
      <Container maxW="container.xl" py={4}>
        <ProductManagementContent />
      </Container>
    </Box>
  );
};

// Original modal component for backward compatibility
const ProductManagementModal = ({ isOpen, onClose }) => {
  return <ProductManagement isModal={true} modalProps={{ isOpen, onClose }} />;
};

export { ProductManagement };
export default ProductManagementModal; 