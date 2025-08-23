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
  TabList,
  Tab,
  Tabs,
  TabPanel,
  TabPanels,
  Select,
} from '@chakra-ui/react';
import { 
  FiList, 
  FiEdit, 
  FiTrash2, 
  FiRefreshCw,
  FiImage,
  FiPlus,
  FiSave,
  FiX,
  FiServer,
  FiPackage,
  FiShoppingBag
} from 'react-icons/fi';
import { categoryAPI, productAPI, odooOnlineConfig, getImageUrl } from '../api/odooapi_online';

// Main CategoryManagementModal component
const CategoryManagementModal = ({ isOpen, onClose }) => {
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  
  // State for categories list (POS categories)
  const [categories, setCategories] = useState([]);
  // State for product categories
  const [productCategories, setProductCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProductCategories, setIsLoadingProductCategories] = useState(false);
  
  // State for form
  const [categoryName, setCategoryName] = useState('');
  const [categoryImage, setCategoryImage] = useState(null);
  const [previewImage, setPreviewImage] = useState('');
  const [categoryColor, setCategoryColor] = useState('#FFFFFF');
  const [selectedParentId, setSelectedParentId] = useState('');
  
  // State for product category form
  const [productCategoryName, setProductCategoryName] = useState('');
  const [selectedProductParentId, setSelectedProductParentId] = useState('');
  const [editingProductCategory, setEditingProductCategory] = useState(null);
  const [isAddingProductCategory, setIsAddingProductCategory] = useState(false);
  const [isUpdatingProductCategory, setIsUpdatingProductCategory] = useState(false);
  const [productCategoryToDelete, setProductCategoryToDelete] = useState(null);
  const [isDeletingProductCategory, setIsDeletingProductCategory] = useState(false);
  const [isLoadingCategoryDetails, setIsLoadingCategoryDetails] = useState(false);
  const [categoryDetails, setCategoryDetails] = useState(null);
  
  // State for edit and delete
  const [editingCategory, setEditingCategory] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Category colors map
  const [categoryColors, setCategoryColors] = useState({});
  
  const cancelRef = useRef();
  const toast = useToast();
  
  // Colors for UI elements
  const bgHover = useColorModeValue("gray.50", "gray.700");
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const headerBg = useColorModeValue("blue.50", "blue.900");
  const tableHeadBg = useColorModeValue("gray.50", "gray.700");
  const infoBg = useColorModeValue("blue.50", "blue.900");
  const infoBorderColor = useColorModeValue("blue.100", "blue.800");
  const infoHeadingColor = useColorModeValue("blue.600", "blue.300");
  const infoTextColor = useColorModeValue("blue.700", "blue.200");
  
  // Load categories and products when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchProductCategories();
      fetchProducts();
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
  
  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
      resetProductCategoryForm();
    }
  }, [isOpen]);
  
  // Reset form
  const resetForm = () => {
    setCategoryName('');
    setCategoryImage(null);
    setPreviewImage('');
    setEditingCategory(null);
    setCategoryColor('#FFFFFF');
  };
  
  // Reset product category form
  const resetProductCategoryForm = () => {
    setProductCategoryName('');
    setSelectedProductParentId('');
    setEditingProductCategory(null);
  };
  
  // Fetch categories directly from Odoo server
  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      
      // Use direct Odoo API call
      const data = await categoryAPI.fetchCategories();
      setCategories(data);
      
      // Initialize category colors
      const colors = {};
      data.forEach(category => {
        // Convert color integer to hex if available, otherwise use default colors
        if (category.color) {
          try {
            colors[category.id] = `#${category.color.toString(16).padStart(6, '0')}`;
          } catch (e) {
            colors[category.id] = '#FFFFFF';
          }
        } else {
          colors[category.id] = '#FFFFFF';
        }
      });
      setCategoryColors(colors);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: 'خطا',
        description: 'بارگذاری دسته‌بندی‌ها با مشکل مواجه شد',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch products directly from Odoo server
  const fetchProducts = async () => {
    try {
      // Use direct Odoo API call
      const data = await productAPI.fetchProducts();
      if (!data || !Array.isArray(data)) {
        console.warn('Products data is not in expected format:', data);
        setProducts([]);
        return;
      }
      
      console.log(`Successfully loaded ${data.length} products`);
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      // محصولات را آرایه خالی می‌گذاریم تا برنامه به کار خود ادامه دهد
      setProducts([]);
      
      // اگر تب فعلی دسته‌بندی‌های POS است، پیام خطا نمایش دهیم
      if (activeTab === 0) {
        toast({
          title: 'خطا در بارگذاری محصولات',
          description: 'محصولات برای شمارش تعداد در هر دسته‌بندی بارگذاری نشدند. ممکن است آمار صحیح نباشد.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      }
    }
  };
  
  // Refresh categories from server
  const refreshCategories = async () => {
    try {
      await fetchCategories();
      toast({
        title: 'به‌روزرسانی',
        description: 'لیست دسته‌بندی‌ها به‌روزرسانی شد',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error refreshing categories:', error);
    }
  };
  
  // Count products by category
  const countProductsByCategory = (categoryId) => {
    if (!products || products.length === 0 || !categoryId) return 0;
    
    // برای دسته‌بندی‌های POS
    if (activeTab === 0) {
      return products.filter(product => {
        if (!product || !product.pos_categ_ids) return false;
        
        // بررسی ساختارهای مختلف pos_categ_ids
        if (Array.isArray(product.pos_categ_ids)) {
          // حالت 1: آرایه از آیدی‌ها: [1, 2, 3]
          if (product.pos_categ_ids.includes(categoryId)) return true;
          
          // حالت 2: آرایه‌ای از آبجکت‌ها: [{id: 1, display_name: "..."}, ...]
          for (const categ of product.pos_categ_ids) {
            if (typeof categ === 'object' && categ.id === categoryId) return true;
          }
          
          // حالت 3: آرایه‌ای از زوج‌ها: [[1, "name1"], [2, "name2"]]
          for (const categ of product.pos_categ_ids) {
            if (Array.isArray(categ) && categ[0] === categoryId) return true;
          }
        }
        // حالت 4: آبجکت با آرایه‌ی ids: {ids: [1, 2, 3]}
        else if (typeof product.pos_categ_ids === 'object') {
          if (product.pos_categ_ids.ids && Array.isArray(product.pos_categ_ids.ids)) {
            return product.pos_categ_ids.ids.includes(categoryId);
          }
        }
        
        // بررسی اضافی:
        // تبدیل categoryId به عدد برای مقایسه دقیق‌تر
        const categIdNum = parseInt(categoryId);
        if (isNaN(categIdNum)) return false;
        
        // بررسی مجدد با استفاده از عدد صحیح
        if (Array.isArray(product.pos_categ_ids)) {
          for (const categ of product.pos_categ_ids) {
            if (typeof categ === 'number' && categ === categIdNum) return true;
            if (typeof categ === 'object' && categ.id === categIdNum) return true;
            if (Array.isArray(categ) && categ[0] === categIdNum) return true;
          }
        }
        
        return false;
      }).length;
    } 
    // برای دسته‌بندی‌های محصول
    else {
      return products.filter(product => {
        if (!product || !product.categ_id) return false;
        const categIdNum = parseInt(categoryId);
        
        if (Array.isArray(product.categ_id)) {
          return product.categ_id[0] === categoryId || product.categ_id[0] === categIdNum;
        } else if (typeof product.categ_id === 'object' && product.categ_id.id) {
          return product.categ_id.id === categoryId || product.categ_id.id === categIdNum;
        } else {
          return product.categ_id === categoryId || product.categ_id === categIdNum;
        }
      }).length;
    }
  };
  
  // Handle image change
  const handleImageChange = (e) => {
    e.preventDefault();
    const file = e.target.files[0];
    if (file) {
      setCategoryImage(file);
      
      // برای پیش‌نمایش از URL موقت استفاده می‌کنیم
      const reader = new FileReader();
      reader.onloadend = () => {
        // در اینجا هنوز از تصویر موقت base64 استفاده می‌کنیم زیرا هنوز در سرور ذخیره نشده است
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Handle edit click
  const handleEditClick = async (category) => {
    console.log('Edit POS category:', category);
    setEditingCategory(category);
    setCategoryName(category.name || category.display_name || '');
    
    // استفاده از URL تصویر به جای داده‌های base64
    if (category.id) {
      setPreviewImage(getImageUrl('pos.category', category.id));
    } else {
      setPreviewImage('');
    }
    
    setCategoryColor(categoryColors[category.id] || '#FFFFFF');
    
    // بررسی دقیق‌تر ساختار parent_id و دریافت اطلاعات کامل
    try {
      // دریافت اطلاعات کامل دسته‌بندی از سرور
      const details = await categoryAPI.getPosCategoryDetails(category.id);
      console.log('POS Category details:', details);
      
      if (details && details.parent_id) {
        console.log('Parent ID from details:', details.parent_id);
        
        // ساختار جدید: parent_id به صورت آبجکت { id: 1, display_name: "All" }
        if (details.parent_id && typeof details.parent_id === 'object' && details.parent_id.id) {
          setSelectedParentId(details.parent_id.id.toString());
        } else if (Array.isArray(details.parent_id) && details.parent_id.length > 0) {
          setSelectedParentId(details.parent_id[0].toString());
        } else if (typeof details.parent_id === 'number') {
          setSelectedParentId(details.parent_id.toString());
        } else {
          setSelectedParentId('');
        }
      } else {
        setSelectedParentId('');
      }
    } catch (error) {
      console.error('Error fetching POS category details:', error);
      
      // در صورت خطا، از روش قبلی استفاده می‌کنیم
      if (category.parent_id) {
        if (Array.isArray(category.parent_id) && category.parent_id.length > 0) {
          setSelectedParentId(category.parent_id[0].toString());
        } else if (typeof category.parent_id === 'number') {
          setSelectedParentId(category.parent_id.toString());
        } else if (typeof category.parent_id === 'object' && category.parent_id.id) {
          setSelectedParentId(category.parent_id.id.toString());
        } else {
          setSelectedParentId('');
        }
      } else {
        setSelectedParentId('');
      }
    }
  };
  
  // Handle delete click
  const handleDeleteClick = (category) => {
    setCategoryToDelete(category);
  };
  
  // Add category
  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      toast({
        title: 'نام دسته‌بندی الزامی است',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsAdding(true);
    
    try {
      // تنظیم parent_id با ساختار مناسب برای API web_save
      // در این API، parent_id به صورت عدد ارسال می‌شود (نه آرایه)
      let categoryData = {
        name: categoryName,
        color: parseInt(categoryColor.replace('#', ''), 16) || 4,
        parent_id: selectedParentId ? parseInt(selectedParentId, 10) : false,
        hour_after: 0.0,
        hour_until: 24.0
      };
      
      console.log('Creating POS category with data:', categoryData);
      
      // If image is selected, convert it to base64
      if (categoryImage) {
        try {
          const base64 = await getBase64(categoryImage);
          const imageData = base64.split(',')[1];
          categoryData.image_128 = imageData;
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
      
      // Use direct Odoo API call
      const response = await categoryAPI.createCategory(categoryData);
      
      if (response) {
        toast({
          title: 'دسته‌بندی با موفقیت اضافه شد',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh categories
        await fetchCategories();
        
        // Reset form
        resetForm();
      }
    } catch (error) {
      console.error('Error adding category:', error);
      toast({
        title: 'خطا در افزودن دسته‌بندی',
        description: error.message || 'لطفاً مجدد تلاش کنید',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsAdding(false);
    }
  };
  
  // Update category
  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    
    if (!categoryName.trim()) {
      toast({
        title: 'نام دسته‌بندی الزامی است',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsUpdating(true);
    
    try {
      // تنظیم parent_id با ساختار مناسب برای API web_save
      // در این API، parent_id به صورت عدد ارسال می‌شود (نه آرایه)
      let categoryData = {
        name: categoryName,
        color: parseInt(categoryColor.replace('#', ''), 16) || 4,
        parent_id: selectedParentId ? parseInt(selectedParentId, 10) : false,
        hour_after: 0.0,
        hour_until: 24.0
      };
      
      console.log('Updating POS category with data:', categoryData);
      
      // If image is selected, convert it to base64
      if (categoryImage) {
        try {
          const base64 = await getBase64(categoryImage);
          const imageData = base64.split(',')[1];
          categoryData.image_128 = imageData;
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
      
      // Use direct Odoo API call
      const success = await categoryAPI.updateCategory(editingCategory.id, categoryData);
      
      if (success) {
        toast({
          title: 'دسته‌بندی با موفقیت به‌روزرسانی شد',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh categories
        await fetchCategories();
        
        // Reset form
        resetForm();
      }
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: 'خطا در به‌روزرسانی دسته‌بندی',
        description: error.message || 'لطفاً مجدد تلاش کنید',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Delete category
  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);
      
    try {
      // Use direct Odoo API call
      const success = await categoryAPI.deleteCategory(categoryToDelete.id);
      
      if (success) {
        toast({
          title: 'موفقیت',
          description: 'دسته‌بندی با موفقیت حذف شد',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh categories
        await fetchCategories();
        
        // Reset state
        setCategoryToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: 'خطا',
        description: error.message || 'حذف دسته‌بندی با خطا مواجه شد',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Fetch product categories from Odoo server
  const fetchProductCategories = async () => {
    try {
      setIsLoadingProductCategories(true);
      
      // Use direct Odoo API call
      const data = await categoryAPI.fetchProductCategories();
      setProductCategories(data);
    } catch (error) {
      console.error('Error fetching product categories:', error);
      toast({
        title: 'خطا',
        description: 'بارگذاری دسته‌بندی‌های محصولات با مشکل مواجه شد',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoadingProductCategories(false);
    }
  };
  
  // Refresh product categories from server
  const refreshProductCategories = async () => {
    try {
      await fetchProductCategories();
      toast({
        title: 'به‌روزرسانی',
        description: 'لیست دسته‌بندی‌های محصولات به‌روزرسانی شد',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error refreshing product categories:', error);
    }
  };
  
  // Handle edit click for product category
  const handleEditProductCategoryClick = async (category) => {
    console.log('Edit product category:', category);
    setEditingProductCategory(category);
    setProductCategoryName(category.name || '');
    
    // بررسی دقیق‌تر ساختار parent_id و دریافت اطلاعات کامل
    try {
      setIsLoadingCategoryDetails(true);
      
      // دریافت اطلاعات کامل دسته‌بندی از سرور
      const details = await categoryAPI.getProductCategoryDetails(category.id);
      console.log('Category details:', details);
      setCategoryDetails(details);
      
      if (details && details.parent_id) {
        console.log('Parent ID from details:', details.parent_id);
        
        // ساختار جدید: parent_id به صورت آبجکت { id: 1, display_name: "All" }
        if (details.parent_id && typeof details.parent_id === 'object' && details.parent_id.id) {
          setSelectedProductParentId(details.parent_id.id.toString());
        } else if (Array.isArray(details.parent_id) && details.parent_id.length > 0) {
          setSelectedProductParentId(details.parent_id[0].toString());
        } else if (typeof details.parent_id === 'number') {
          setSelectedProductParentId(details.parent_id.toString());
        } else {
          setSelectedProductParentId('');
        }
      } else {
        setSelectedProductParentId('');
      }
    } catch (error) {
      console.error('Error fetching category details:', error);
      toast({
        title: 'خطا',
        description: 'دریافت اطلاعات دسته‌بندی با مشکل مواجه شد',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
  
      // در صورت خطا، از روش قبلی استفاده می‌کنیم
      if (category.parent_id) {
        if (Array.isArray(category.parent_id) && category.parent_id.length > 0) {
          setSelectedProductParentId(category.parent_id[0].toString());
        } else if (typeof category.parent_id === 'number') {
          setSelectedProductParentId(category.parent_id.toString());
        } else if (typeof category.parent_id === 'object' && category.parent_id.id) {
          setSelectedProductParentId(category.parent_id.id.toString());
        } else {
          setSelectedProductParentId('');
        }
      } else {
        setSelectedProductParentId('');
      }
    } finally {
      setIsLoadingCategoryDetails(false);
    }
  };
  
  // Handle delete click for product category
  const handleDeleteProductCategoryClick = (category) => {
    setProductCategoryToDelete(category);
  };
  
  // Add product category
  const handleAddProductCategory = async () => {
    if (!productCategoryName.trim()) {
      toast({
        title: 'نام دسته‌بندی الزامی است',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsAddingProductCategory(true);
    
    try {
      // تبدیل parent_id به مقدار مناسب برای ارسال به سرور
      // در Odoo، parent_id به صورت [id] یا false ارسال می‌شود
      let parent = selectedProductParentId ? [parseInt(selectedProductParentId, 10)] : false;
      
      console.log('Creating product category with parent_id:', parent);
      
      let categoryData = {
        name: productCategoryName,
        parent_id: parent
      };
      
      // Use direct Odoo API call
      const response = await categoryAPI.createProductCategory(categoryData);
      
      if (response) {
        toast({
          title: 'دسته‌بندی محصول با موفقیت اضافه شد',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh product categories
        await fetchProductCategories();
        
        // Reset form
        resetProductCategoryForm();
      }
    } catch (error) {
      console.error('Error adding product category:', error);
      toast({
        title: 'خطا در افزودن دسته‌بندی محصول',
        description: error.message || 'لطفاً مجدد تلاش کنید',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsAddingProductCategory(false);
    }
  };
  
  // Update product category
  const handleUpdateProductCategory = async () => {
    if (!editingProductCategory) return;
    
    if (!productCategoryName.trim()) {
      toast({
        title: 'نام دسته‌بندی الزامی است',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsUpdatingProductCategory(true);
    
    try {
      // تبدیل parent_id به مقدار مناسب برای ارسال به سرور
      // در Odoo، parent_id به صورت [id] یا false ارسال می‌شود
      let parent = selectedProductParentId ? [parseInt(selectedProductParentId, 10)] : false;
      
      console.log('Updating product category with parent_id:', parent);
      
      let categoryData = {
        name: productCategoryName,
        parent_id: parent
      };
      
      // Use direct Odoo API call
      const success = await categoryAPI.updateProductCategory(editingProductCategory.id, categoryData);
      
      if (success) {
        toast({
          title: 'دسته‌بندی محصول با موفقیت به‌روزرسانی شد',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh product categories
        await fetchProductCategories();
        
        // Reset form
        resetProductCategoryForm();
      }
    } catch (error) {
      console.error('Error updating product category:', error);
      toast({
        title: 'خطا در به‌روزرسانی دسته‌بندی محصول',
        description: error.message || 'لطفاً مجدد تلاش کنید',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdatingProductCategory(false);
    }
  };
  
  // Delete product category
  const handleDeleteProductCategory = async () => {
    if (!productCategoryToDelete) return;
    
    setIsDeletingProductCategory(true);
    
    try {
      // Use direct Odoo API call
      const success = await categoryAPI.deleteProductCategory(productCategoryToDelete.id);
      
      if (success) {
        toast({
          title: 'موفقیت',
          description: 'دسته‌بندی محصول با موفقیت حذف شد',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh product categories
        await fetchProductCategories();
        
        // Reset state
        setProductCategoryToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting product category:', error);
      toast({
        title: 'خطا',
        description: error.message || 'حذف دسته‌بندی محصول با خطا مواجه شد',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeletingProductCategory(false);
    }
  };
  
  // Delete confirmation dialog
  const DeleteCategoryConfirmation = () => (
      <AlertDialog
      isOpen={!!categoryToDelete}
      leastDestructiveRef={cancelRef}
      onClose={() => setCategoryToDelete(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              حذف دسته‌بندی
            </AlertDialogHeader>

            <AlertDialogBody>
            آیا از حذف دسته‌بندی "{categoryToDelete?.name || categoryToDelete?.display_name}" اطمینان دارید؟
            {countProductsByCategory(categoryToDelete?.id) > 0 && (
                <Text color="red.500" mt={2}>
                هشدار: این دسته‌بندی دارای {countProductsByCategory(categoryToDelete?.id)} محصول است و حذف آن ممکن است باعث مشکل در محصولات شود.
                </Text>
              )}
            </AlertDialogBody>

            <AlertDialogFooter>
            <Button ref={cancelRef} onClick={() => setCategoryToDelete(null)}>
                انصراف
              </Button>
            <Button colorScheme="red" onClick={handleDeleteCategory} ml={3} isLoading={isDeleting}>
                حذف
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    );
  
  // Delete confirmation dialog for product categories
  const DeleteProductCategoryConfirmation = () => (
    <AlertDialog
      isOpen={!!productCategoryToDelete}
      leastDestructiveRef={cancelRef}
      onClose={() => setProductCategoryToDelete(null)}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            حذف دسته‌بندی محصول
          </AlertDialogHeader>

          <AlertDialogBody>
            آیا از حذف دسته‌بندی محصول "{productCategoryToDelete?.name || productCategoryToDelete?.display_name || 'انتخاب شده'}" اطمینان دارید؟
            {productCategoryToDelete && countProductsByCategory(productCategoryToDelete.id) > 0 && (
              <Text color="red.500" mt={2}>
                هشدار: این دسته‌بندی دارای {countProductsByCategory(productCategoryToDelete.id)} محصول است و حذف آن ممکن است باعث مشکل در محصولات شود.
              </Text>
            )}
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={() => setProductCategoryToDelete(null)}>
              انصراف
            </Button>
            <Button colorScheme="red" onClick={handleDeleteProductCategory} ml={3} isLoading={isDeletingProductCategory}>
              حذف
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
  
  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent maxW="900px">
          <ModalHeader borderBottom="1px" borderColor={borderColor} bg={headerBg}>
            <Flex align="center" justify="space-between">
              <Flex align="center">
                <Box mr={2} color="blue.500">
                  <FiList size="20px" />
                </Box>
                <Text>مدیریت دسته‌بندی‌ها</Text>
              </Flex>
              <Button 
                size="sm" 
                leftIcon={<FiRefreshCw />} 
                onClick={activeTab === 0 ? refreshCategories : refreshProductCategories}
                colorScheme="blue"
                variant="outline"
                isLoading={activeTab === 0 ? isLoading : isLoadingProductCategories}
              >
                بارگذاری مجدد
              </Button>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody py={4}>
            <VStack spacing={4} align="stretch">
              {/* Server connection status */}
              <Box p={2} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
                <Flex align="center">
                  <FiServer size="16px" style={{marginLeft: '8px'}} />
                  <Text fontSize="sm">سرور اودوو: {odooOnlineConfig?.apiUrl || 'تنظیم نشده'}</Text>
                </Flex>
              </Box>
              
              {/* Tabs for different category types */}
              <Tabs variant="enclosed" colorScheme="blue" index={activeTab} onChange={setActiveTab}>
                <TabList>
                  <Tab _selected={{ bg: "blue.50" }}>
                    <Flex align="center">
                      <FiShoppingBag size="14px" style={{marginLeft: '5px'}} />
                      <Text>دسته‌بندی‌های POS</Text>
                    </Flex>
                  </Tab>
                  <Tab _selected={{ bg: "blue.50" }}>
                    <Flex align="center">
                      <FiPackage size="14px" style={{marginLeft: '5px'}} />
                      <Text>دسته‌بندی‌های محصولات</Text>
                    </Flex>
                  </Tab>
                </TabList>
                
                <TabPanels>
                  {/* POS Categories Tab */}
                  <TabPanel p={0} pt={4}>
                    {/* Add/Edit POS category form */}
              <Box p={4} borderWidth="1px" borderRadius="lg" bg={cardBg} shadow="sm">
                <Heading size="sm" mb={4} display="flex" alignItems="center">
                        {editingCategory ? <FiEdit size="18px" style={{marginLeft: '8px'}} /> : <FiPlus size="18px" style={{marginLeft: '8px'}} />}
                        {editingCategory ? 'ویرایش دسته‌بندی POS' : 'افزودن دسته‌بندی POS جدید'}
                </Heading>
                
                <form onSubmit={(e) => {
                        e.preventDefault();
                        if (editingCategory) {
                          handleUpdateCategory();
                  } else {
                          handleAddCategory();
                  }
                }}>
                  <SimpleGrid columns={{base: 1, md: 2}} spacing={4}>
                    <GridItem>
                      <FormControl isRequired>
                        <FormLabel fontSize="sm">نام دسته‌بندی</FormLabel>
                        <Input
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                          placeholder="نام دسته‌بندی را وارد کنید" 
                          size="sm"
                        />
                      </FormControl>
                    </GridItem>
                    
                    <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm">رنگ دسته‌بندی</FormLabel>
                        <Flex align="center">
                          <Input 
                            type="color" 
                                  value={categoryColor}
                                  onChange={(e) => setCategoryColor(e.target.value)}
                            width="80px"
                            height="32px"
                          />
                          <Box ml={3} p={1} borderRadius="md" border="1px" borderColor="gray.200">
                            <Box 
                              width="60px" 
                              height="24px" 
                                    bg={categoryColor} 
                              borderRadius="sm" 
                            />
                          </Box>
                        </Flex>
                      </FormControl>
                    </GridItem>
                    
                          <GridItem>
                            <FormControl>
                              <FormLabel fontSize="sm">دسته‌بندی والد</FormLabel>
                              <Select
                                placeholder="بدون والد"
                                value={selectedParentId}
                                onChange={(e) => setSelectedParentId(e.target.value)}
                                size="sm"
                              >
                                {categories
                                  .filter(cat => !editingCategory || cat.id !== editingCategory.id)
                                  .map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.display_name || cat.name}
                                    </option>
                                  ))}
                              </Select>
                              {/* اطلاعات دیباگ برای مشخص کردن والد انتخاب شده */}
                              {process.env.NODE_ENV === 'development' && (
                                <Text fontSize="xs" color="gray.500" mt={1}>
                                  والد انتخاب شده: {selectedParentId || 'بدون والد'} 
                                  {selectedParentId && ` (${categories.find(c => c.id == selectedParentId)?.name || 'نامشخص'})`}
                                </Text>
                              )}
                            </FormControl>
                          </GridItem>
                          
                          <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm">تصویر دسته‌بندی (اختیاری)</FormLabel>
                        <Flex align="center">
                          <Button
                            as="label"
                            htmlFor="category-image"
                            size="sm"
                            leftIcon={<FiImage />}
                            cursor="pointer"
                            colorScheme="gray"
                            mr={4}
                          >
                            انتخاب تصویر
                          </Button>
                          <Input 
                            id="category-image"
                            type="file" 
                            accept="image/*"
                            onChange={handleImageChange}
                            display="none"
                          />
                          <Text fontSize="sm" color="gray.500">
                                  {categoryImage ? categoryImage.name : 'تصویری انتخاب نشده است'}
                          </Text>
                        </Flex>
                      
                              {previewImage && (
                          <Flex mt={3} justify="center">
                            <Box position="relative" borderRadius="md" borderWidth="1px" borderColor="gray.200" p={2}>
                              <Image 
                                      src={previewImage} 
                                alt="Category preview" 
                                maxHeight="100px" 
                                maxWidth="200px"
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
                                        setCategoryImage(null);
                                }}
                              />
                            </Box>
                          </Flex>
                        )}
                      </FormControl>
                    </GridItem>
                  </SimpleGrid>
                  
                  <Flex justifyContent="flex-end" gap={2} mt={4}>
                    <Button
                      variant="outline"
                      colorScheme="gray" 
                      size="sm"
                      leftIcon={<FiX />}
                            onClick={resetForm}
                    >
                      پاک کردن فرم
                    </Button>
                    <Button
                      colorScheme="blue" 
                      type="submit"
                      size="sm"
                            leftIcon={editingCategory ? <FiSave /> : <FiPlus />}
                            isLoading={editingCategory ? isUpdating : isAdding}
                            loadingText={editingCategory ? "در حال به‌روزرسانی..." : "در حال افزودن..."}
                    >
                            {editingCategory ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی'}
                    </Button>
                  </Flex>
                </form>
              </Box>
              
                    {/* POS Categories list */}
                    <Box p={4} borderWidth="1px" borderRadius="lg" bg={cardBg} shadow="sm" mt={4}>
                <Heading size="sm" mb={4} display="flex" alignItems="center">
                  <FiList size="18px" style={{marginLeft: '8px'}} />
                        دسته‌بندی‌های POS موجود
                </Heading>
                
                      {isLoading ? (
                        <Flex justify="center" align="center" p={10}>
                          <Spinner size="xl" color="blue.500" />
                        </Flex>
                      ) : categories.length > 0 ? (
                  <Box borderRadius="md" overflow="hidden" borderWidth="1px" borderColor={borderColor}>
                    <Table variant="simple" size="sm">
                      <Thead bg={tableHeadBg}>
                        <Tr>
                          <Th width="80px" textAlign="center">تصویر</Th>
                          <Th>نام دسته‌بندی</Th>
                                <Th>والد</Th>
                          <Th isNumeric>تعداد محصولات</Th>
                          <Th width="80px">رنگ</Th>
                          <Th width="120px">عملیات</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {categories.map(category => (
                          <Tr key={category.id} _hover={{ bg: bgHover }}>
                            <Td width="80px" textAlign="center">
                              {category.image_128 ? (
                                <Image 
                                        src={getImageUrl('pos.category', category.id)}
                                        alt={category.name || category.display_name}
                                  boxSize="40px"
                                  objectFit="contain"
                                  borderRadius="md"
                                  mx="auto"
                                />
                              ) : (
                                <Center
                                  width="40px"
                                  height="40px"
                                  bg="gray.100"
                                  borderRadius="md"
                                  mx="auto"
                                >
                                  <FiList size="16px" color="gray" />
                                </Center>
                              )}
                            </Td>
                                  <Td fontWeight="medium" fontSize="sm">{category.name || category.display_name}</Td>
                                  <Td fontSize="sm">
                                    {category.parent_id ? (
                                      <Text>
                                        {typeof category.parent_id === 'object' && category.parent_id.display_name
                                          ? category.parent_id.display_name
                                          : (Array.isArray(category.parent_id) && category.parent_id.length > 1 
                                              ? category.parent_id[1] 
                                              : (typeof category.parent_id === 'number' 
                                                  ? categories.find(c => c.id === category.parent_id)?.name || `(ID: ${category.parent_id})`
                                                  : 'نامشخص'))}
                                      </Text>
                                    ) : (
                                      <Text color="gray.500">-</Text>
                                    )}
                                  </Td>
                            <Td isNumeric>
                              <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={2}>
                                {(() => {
                                  try {
                                    return countProductsByCategory(category.id);
                                  } catch (error) {
                                    console.error(`Error counting products for category ${category.id}:`, error);
                                    return 0;
                                  }
                                })()}
                              </Badge>
                            </Td>
                            <Td>
                              <Box 
                                w="24px" 
                                h="24px" 
                                borderRadius="md" 
                                borderWidth="1px"
                                borderColor="gray.200"
                                bg={categoryColors[category.id] || "gray.200"}
                                mx="auto"
                              />
                            </Td>
                            <Td>
                              <HStack spacing={1} justify="center">
                                <IconButton
                                  size="xs"
                                  colorScheme="blue"
                                  icon={<FiEdit />}
                                  aria-label="Edit category"
                                  onClick={() => handleEditClick(category)}
                                />
                                <IconButton
                                  size="xs"
                                  colorScheme="red"
                                  icon={<FiTrash2 />}
                                  aria-label="Delete category"
                                  onClick={() => handleDeleteClick(category)}
                                        isDisabled={countProductsByCategory(category.id) > 0}
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
                    <Text color="gray.500">هیچ دسته‌بندی یافت نشد</Text>
                  </Flex>
                )}
              </Box>
                  </TabPanel>
                  
                  {/* Product Categories Tab */}
                  <TabPanel p={0} pt={4}>
                    {/* Add/Edit product category form */}
                    <Box p={4} borderWidth="1px" borderRadius="lg" bg={cardBg} shadow="sm">
                      <Heading size="sm" mb={4} display="flex" alignItems="center">
                        {editingProductCategory ? <FiEdit size="18px" style={{marginLeft: '8px'}} /> : <FiPlus size="18px" style={{marginLeft: '8px'}} />}
                        {editingProductCategory ? 'ویرایش دسته‌بندی محصول' : 'افزودن دسته‌بندی محصول جدید'}
                      </Heading>
                      
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        if (editingProductCategory) {
                          handleUpdateProductCategory();
                        } else {
                          handleAddProductCategory();
                        }
                      }}>
                        <SimpleGrid columns={{base: 1, md: 2}} spacing={4}>
                          <GridItem>
                            <FormControl isRequired>
                              <FormLabel fontSize="sm">نام دسته‌بندی محصول</FormLabel>
                              <Input
                                value={productCategoryName}
                                onChange={(e) => setProductCategoryName(e.target.value)}
                                placeholder="نام دسته‌بندی محصول را وارد کنید"
                                size="sm"
                              />
                            </FormControl>
                          </GridItem>
                          
                          <GridItem>
                            <FormControl>
                              <FormLabel fontSize="sm">دسته‌بندی والد</FormLabel>
                              <Select
                                placeholder="بدون والد"
                                value={selectedProductParentId}
                                onChange={(e) => setSelectedProductParentId(e.target.value)}
                                size="sm"
                                isDisabled={isLoadingCategoryDetails}
                              >
                                {productCategories
                                  .filter(cat => !editingProductCategory || cat.id !== editingProductCategory.id)
                                  .map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.complete_name || cat.display_name || cat.name}
                                    </option>
                                  ))
                                }
                              </Select>
                              {isLoadingCategoryDetails && (
                                <Flex align="center" mt={1}>
                                  <Spinner size="xs" mr={2} />
                                  <Text fontSize="xs" color="blue.500">در حال دریافت اطلاعات...</Text>
                                </Flex>
                              )}
                              {/* نمایش اطلاعات اضافی برای دیباگ */}
                              {process.env.NODE_ENV === 'development' && !isLoadingCategoryDetails && (
                                <Text fontSize="xs" color="gray.500" mt={1}>
                                  انتخاب شده: {selectedProductParentId || 'بدون والد'} 
                                  {selectedProductParentId && ` (${productCategories.find(c => c.id == selectedProductParentId)?.name || 'نامشخص'})`}
                                </Text>
                              )}
                              {categoryDetails && categoryDetails.parent_id && (
                                <Text fontSize="xs" color="green.500" mt={1}>
                                  والد: {typeof categoryDetails.parent_id === 'object' && categoryDetails.parent_id.display_name
                                    ? categoryDetails.parent_id.display_name
                                    : (Array.isArray(categoryDetails.parent_id) 
                                        ? categoryDetails.parent_id[1] 
                                        : 'نامشخص')}
                                </Text>
                              )}
                            </FormControl>
                          </GridItem>
                        </SimpleGrid>
                        
                        <Flex justifyContent="flex-end" gap={2} mt={4}>
                          <Button
                            variant="outline"
                            colorScheme="gray"
                            size="sm"
                            leftIcon={<FiX />}
                            onClick={resetProductCategoryForm}
                          >
                            پاک کردن فرم
                          </Button>
                          <Button
                            colorScheme="blue"
                            type="submit"
                            size="sm"
                            leftIcon={editingProductCategory ? <FiSave /> : <FiPlus />}
                            isLoading={editingProductCategory ? isUpdatingProductCategory : isAddingProductCategory}
                            loadingText={editingProductCategory ? "در حال به‌روزرسانی..." : "در حال افزودن..."}
                          >
                            {editingProductCategory ? 'ویرایش دسته‌بندی محصول' : 'افزودن دسته‌بندی محصول'}
                          </Button>
                        </Flex>
                      </form>
                    </Box>
                    
                    {/* Product Categories list */}
                    <Box p={4} borderWidth="1px" borderRadius="lg" bg={cardBg} shadow="sm" mt={4}>
                      <Heading size="sm" mb={4} display="flex" alignItems="center">
                        <FiPackage size="18px" style={{marginLeft: '8px'}} />
                        دسته‌بندی‌های محصولات موجود
                      </Heading>
                      
                      {isLoadingProductCategories ? (
                        <Flex justify="center" align="center" p={10}>
                          <Spinner size="xl" color="blue.500" />
                        </Flex>
                      ) : productCategories.length > 0 ? (
                        <Box borderRadius="md" overflow="hidden" borderWidth="1px" borderColor={borderColor}>
                          <Table variant="simple" size="sm">
                            <Thead bg={tableHeadBg}>
                              <Tr>
                                <Th>نام کامل دسته‌بندی</Th>
                                <Th>نام</Th>
                                <Th>والد</Th>
                                <Th width="120px">عملیات</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {productCategories.map(category => (
                                <Tr key={category.id} _hover={{ bg: bgHover }}>
                                  <Td fontWeight="medium" fontSize="sm">
                                    {category.complete_name || category.display_name || ''}
                                  </Td>
                                  <Td fontSize="sm">{category.name || ''}</Td>
                                  <Td fontSize="sm">
                                    {category.parent_id ? (
                                      <Text>
                                        {typeof category.parent_id === 'object' && category.parent_id.display_name
                                          ? category.parent_id.display_name
                                          : (Array.isArray(category.parent_id) && category.parent_id.length > 1 
                                              ? category.parent_id[1] 
                                              : (typeof category.parent_id === 'number' 
                                                  ? productCategories.find(c => c.id === category.parent_id)?.name || `(ID: ${category.parent_id})`
                                                  : 'نامشخص'))}
                                      </Text>
                                    ) : (
                                      <Text color="gray.500">-</Text>
                                    )}
                                  </Td>
                                  <Td>
                                    <HStack spacing={1} justify="center">
                                      <IconButton
                                        size="xs"
                                        colorScheme="blue"
                                        icon={<FiEdit />}
                                        aria-label="Edit product category"
                                        onClick={() => handleEditProductCategoryClick(category)}
                                      />
                                      <IconButton
                                        size="xs"
                                        colorScheme="red"
                                        icon={<FiTrash2 />}
                                        aria-label="Delete product category"
                                        onClick={() => handleDeleteProductCategoryClick(category)}
                                        isDisabled={countProductsByCategory(category.id) > 0}
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
                          <Text color="gray.500">هیچ دسته‌بندی محصولی یافت نشد</Text>
                        </Flex>
                      )}
                    </Box>
                  </TabPanel>
                </TabPanels>
              </Tabs>
              
              {/* Information box */}
              <Box p={4} bg={infoBg} borderRadius="lg" borderWidth="1px" borderColor={infoBorderColor}>
                <VStack align="start" spacing={2}>
                  <Heading size="sm" color={infoHeadingColor} display="flex" alignItems="center">
                    <FiRefreshCw size="16px" style={{marginLeft: '8px'}} />
                    راهنمای دسته‌بندی‌ها
                  </Heading>
                  <Text fontSize="xs" color={infoTextColor}>• ارتباط مستقیم با سرور اودو انجام می‌شود</Text>
                  <Text fontSize="xs" color={infoTextColor}>• دسته‌بندی‌های POS برای نمایش در صفحه فروش استفاده می‌شوند</Text>
                  <Text fontSize="xs" color={infoTextColor}>• دسته‌بندی‌های محصولات برای طبقه‌بندی محصولات در اودو استفاده می‌شوند</Text>
                  <Text fontSize="xs" color={infoTextColor}>• دسته‌بندی‌های دارای محصول را نمی‌توانید حذف کنید</Text>
                </VStack>
              </Box>
            </VStack>
          </ModalBody>
          
          <ModalFooter borderTop="1px" borderColor={borderColor}>
            <Button variant="outline" colorScheme="blue" onClick={onClose} size="sm">بستن</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Delete confirmation dialog */}
      <DeleteCategoryConfirmation />
      
      {/* Delete confirmation dialog for product categories */}
      <DeleteProductCategoryConfirmation />
    </>
  );
};

export default CategoryManagementModal; 