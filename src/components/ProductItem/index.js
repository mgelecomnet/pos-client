import React, { useState } from 'react';
import {
  Box,
  Flex,
  Text,
  Badge,
  Image,
  Card,
  CardBody,
} from '@chakra-ui/react';
import { FiShoppingBag } from 'react-icons/fi';

// Use the specific URL pattern requested
const SERVER_URL = process.env.REACT_APP_ODOO_API_URL || 'http://localhost:8069';

const ProductItem = ({ product, onSelect, categoryColor }) => {
  // Track image loading errors
  const [imageError, setImageError] = useState(false);
  
  // Ensure we have a valid color with a default fallback
  const bgColor = categoryColor || "white";
  
  // Safely get the price with fallback to 0
  const price = product ? (product.list_price || product.lst_price || 0) : 0;
  
  // Generate server image URL
  const getServerImageUrl = (product) => {
    // Only generate if we have a product
    if (!product) return null;
    
    // Get base URL, removing trailing slash if present
    const baseUrl = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;
    
    // Extract the product ID properly from the Odoo data structure
    let productId = null;
    
    if (product.id !== undefined) {
      // Direct ID
      productId = product.id;
    } else if (product[0] !== undefined) {
      // Sometimes Odoo returns [id, name] format
      productId = product[0];
    }
    
    if (!productId) {
      console.warn('Could not extract product ID for image URL:', product);
      return null;
    }
    
    return `${baseUrl}/web/image/product.product/${productId}/image_128`;
  };
  
  // Always use server URL first now, regardless of local data
  const imageSource = !imageError && product ? getServerImageUrl(product) : null;
  
  return (
    <Card
      onClick={() => onSelect(product)}
      cursor="pointer"
      variant="outline"
      _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
      transition="all 0.2s"
      size="sm"
      bg={bgColor}
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="md"
      overflow="hidden"
      h="100%"
      display="flex"
      flexDirection="column"
    >
      <Box position="relative" height="130px" width="100%" bg="white">
        {imageSource ? (
          <Image
            src={imageSource}
            alt={product ? product.name || 'Product' : 'Product'}
            width="100%"
            height="100%"
            objectFit="contain"
            position="absolute"
            top="0"
            left="0"
            onError={() => setImageError(true)}
            fallback={
              <Flex
                bg="gray.100"
                height="100%"
                width="100%"
                alignItems="center"
                justifyContent="center"
                position="absolute"
                top="0"
                left="0"
              >
                <FiShoppingBag size="36px" color="gray" />
              </Flex>
            }
          />
        ) : (
          <Flex
            bg="gray.100"
            height="100%"
            width="100%"
            alignItems="center"
            justifyContent="center"
            position="absolute"
            top="0"
            left="0"
          >
            <FiShoppingBag size="36px" color="gray" />
          </Flex>
        )}
      </Box>
      <CardBody p="3" flex="1" display="flex" flexDirection="column" justifyContent="space-between" bg={bgColor}>
        <Text fontWeight="medium" noOfLines={2} fontSize="sm" mb={2}>
          {product ? product.name || 'Unnamed Product' : 'Product'}
        </Text>
        <Flex w="full" justify="space-between" align="center">
          <Badge colorScheme="blue" variant="subtle" fontSize="0.7em">
            {product && product.default_code ? product.default_code : 'N/A'}
          </Badge>
          <Text fontWeight="bold" color="primary.600" fontSize="md">
            ${typeof price === 'number' ? price.toFixed(2) : '0.00'}
          </Text>
        </Flex>
      </CardBody>
    </Card>
  );
};

export default ProductItem; 