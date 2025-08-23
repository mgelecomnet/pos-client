import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Icon,
  Image,
  Input,
  SimpleGrid,
  Spinner,
  Text,
  useToast,
  VStack,
  HStack,
  Divider,
  Badge,
  IconButton,
} from '@chakra-ui/react';
import { productsDB, categoriesDB, ordersDB } from '../services/db';
import useSyncData from '../hooks/useSyncData';

// Simple icon components for UI
const CartIcon = () => <span role="img" aria-label="cart">🛒</span>;
const SearchIcon = () => <span role="img" aria-label="search">🔍</span>;
const SyncIcon = () => <span role="img" aria-label="sync">🔄</span>;
const DeleteIcon = () => <span role="img" aria-label="delete">❌</span>;
const PlusIcon = () => <span role="img" aria-label="add">➕</span>;
const MinusIcon = () => <span role="img" aria-label="subtract">➖</span>;
const CategoryIcon = () => <span role="img" aria-label="category">📁</span>;

const POS = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { syncAll, syncProducts, isSyncing } = useSyncData();
  const toast = useToast();

  // Load products and categories from IndexedDB
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load products
        const dbProducts = await productsDB.getAll();
        setProducts(dbProducts);
        setFilteredProducts(dbProducts);
        
        // Load categories
        const dbCategories = await categoriesDB.getAll();
        setCategories(dbCategories);
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: 'Error loading data',
          description: error.message || 'Could not load products and categories',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [toast]);

  // Filter products based on search query and selected category
  useEffect(() => {
    const filterProducts = async () => {
      try {
        let filtered = [...products];
        
        // Filter by search query
        if (searchQuery) {
          filtered = await productsDB.search(searchQuery);
        }
        
        // Filter by category
        if (selectedCategory) {
          filtered = filtered.filter(product => 
            product.pos_categ_id && product.pos_categ_id[0] === selectedCategory.id
          );
        }
        
        setFilteredProducts(filtered);
      } catch (error) {
        console.error('Error filtering products:', error);
      }
    };
    
    filterProducts();
  }, [searchQuery, selectedCategory, products]);

  // Handle adding product to cart
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Increase quantity if product already in cart
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      // Add new product to cart
      setCart([...cart, { product, quantity: 1 }]);
    }
    
    toast({
      title: 'Added to cart',
      description: `${product.name} added to cart`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  // Handle updating cart item quantity
  const updateQuantity = (productId, delta) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0)); // Remove items with quantity 0
  };

  // Handle removing item from cart
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  // Calculate total amount
  const calculateTotal = () => {
    return cart.reduce((total, item) => 
      total + (item.product.list_price * item.quantity), 0
    );
  };

  // Handle checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Empty cart',
        description: 'Please add products to cart before checkout',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      // Create order
      const order = {
        state: 'pending',
        date: new Date().toISOString(),
        amount_total: calculateTotal(),
      };
      
      // Add order to IndexedDB
      const orderId = await ordersDB.add(order);
      
      // Add order lines
      const orderLines = cart.map(item => ({
        order_id: orderId,
        product_id: item.product.id,
        qty: item.quantity,
        price_unit: item.product.list_price,
        product_name: item.product.name,
      }));
      
      await ordersDB.addLines(orderLines);
      
      // Clear cart
      setCart([]);
      
      toast({
        title: 'Order created',
        description: 'Order has been saved and will be synced with Odoo',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: 'Error creating order',
        description: error.message || 'Could not create order',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Render loading spinner
  if (isLoading) {
    return (
      <Flex height="100vh" alignItems="center" justifyContent="center">
        <Spinner size="xl" thickness="4px" speed="0.65s" color="blue.500" />
      </Flex>
    );
  }

  return (
    <Flex h="100vh" flexDirection="column">
      {/* Header */}
      <Box p={4} bg="blue.600" color="white">
        <Flex justifyContent="space-between" alignItems="center">
          <Heading size="md">POS System</Heading>
          <Button
            size="sm"
            leftIcon={<SyncIcon />}
            onClick={syncAll}
            isLoading={isSyncing}
            loadingText="Syncing"
          >
            Sync Data
          </Button>
        </Flex>
      </Box>
      
      {/* Main Content */}
      <Flex flex="1" overflow="hidden">
        {/* Left Panel: Categories + Products */}
        <Box w="70%" p={4} overflowY="auto">
          {/* Search */}
          <Flex mb={4}>
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              bg="white"
              borderRadius="md"
              mr={2}
            />
            <IconButton
              icon={<SearchIcon />}
              aria-label="Search"
              colorScheme="blue"
            />
          </Flex>
          
          {/* Categories */}
          <Box mb={6}>
            <HStack overflowX="auto" py={2} spacing={4}>
              <Button
                size="sm"
                colorScheme={selectedCategory === null ? "blue" : "gray"}
                onClick={() => setSelectedCategory(null)}
              >
                All Products
              </Button>
              
              {categories.map(category => (
                <Button
                  key={category.id}
                  size="sm"
                  leftIcon={<CategoryIcon />}
                  colorScheme={selectedCategory?.id === category.id ? "blue" : "gray"}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category.name}
                </Button>
              ))}
            </HStack>
          </Box>
          
          {/* Products */}
          {filteredProducts.length === 0 ? (
            <Box textAlign="center" p={10} bg="gray.100" borderRadius="md">
              <Text>No products found</Text>
            </Box>
          ) : (
            <SimpleGrid columns={3} spacing={4}>
              {filteredProducts.map(product => (
                <Box
                  key={product.id}
                  bg="white"
                  p={4}
                  borderRadius="md"
                  boxShadow="md"
                  cursor="pointer"
                  onClick={() => addToCart(product)}
                  _hover={{ transform: 'scale(1.02)', transition: 'all 0.2s' }}
                >
                  <Image
                    src={product.image_128 ? `data:image/png;base64,${product.image_128}` : 'https://via.placeholder.com/128?text=No+Image'}
                    alt={product.name}
                    height="100px"
                    objectFit="contain"
                    mx="auto"
                    mb={2}
                  />
                  <Text fontWeight="semibold" isTruncated>
                    {product.name}
                  </Text>
                  <Text color="blue.600" fontSize="lg" fontWeight="bold">
                    ${product.list_price.toFixed(2)}
                  </Text>
                  {product.default_code && (
                    <Badge mt={1} colorScheme="gray">
                      {product.default_code}
                    </Badge>
                  )}
                </Box>
              ))}
            </SimpleGrid>
          )}
        </Box>
        
        {/* Right Panel: Cart */}
        <Box w="30%" bg="gray.50" p={4} overflowY="auto" borderLeft="1px" borderColor="gray.200">
          <VStack spacing={4} align="stretch">
            <Heading size="md">Shopping Cart</Heading>
            
            {/* Cart Items */}
            {cart.length === 0 ? (
              <Box textAlign="center" p={6} bg="white" borderRadius="md">
                <CartIcon boxSize="2rem" color="gray.400" />
                <Text mt={2} color="gray.500">Your cart is empty</Text>
              </Box>
            ) : (
              <VStack spacing={2} align="stretch">
                {cart.map(item => (
                  <Box key={item.product.id} p={2} bg="white" borderRadius="md" boxShadow="sm">
                    <Flex justifyContent="space-between" mb={1}>
                      <Text fontWeight="semibold" isTruncated flex="1">
                        {item.product.name}
                      </Text>
                      <IconButton
                        icon={<DeleteIcon />}
                        aria-label="Remove"
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => removeFromCart(item.product.id)}
                      />
                    </Flex>
                    
                    <Flex justifyContent="space-between" alignItems="center">
                      <Text color="gray.600">${item.product.list_price.toFixed(2)}</Text>
                      
                      <HStack>
                        <IconButton
                          icon={<MinusIcon />}
                          aria-label="Decrease"
                          size="xs"
                          onClick={() => updateQuantity(item.product.id, -1)}
                        />
                        <Text fontWeight="bold" minW="1.5rem" textAlign="center">
                          {item.quantity}
                        </Text>
                        <IconButton
                          icon={<PlusIcon />}
                          aria-label="Increase"
                          size="xs"
                          onClick={() => updateQuantity(item.product.id, 1)}
                        />
                      </HStack>
                      
                      <Text fontWeight="bold">
                        ${(item.product.list_price * item.quantity).toFixed(2)}
                      </Text>
                    </Flex>
                  </Box>
                ))}
              </VStack>
            )}
            
            {/* Cart Summary */}
            <Box mt="auto">
              <Divider my={4} />
              <Flex justifyContent="space-between" fontWeight="bold" fontSize="lg">
                <Text>Total:</Text>
                <Text>${calculateTotal().toFixed(2)}</Text>
              </Flex>
              
              <Button
                w="100%"
                colorScheme="green"
                size="lg"
                mt={4}
                onClick={handleCheckout}
                isDisabled={cart.length === 0}
              >
                Checkout
              </Button>
            </Box>
          </VStack>
        </Box>
      </Flex>
    </Flex>
  );
};

export default POS; 