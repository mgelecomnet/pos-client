import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  HStack,
  Button,
  useColorModeValue,
  Icon,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Badge
} from '@chakra-ui/react';
import { FiChevronDown, FiHome, FiShoppingBag, FiTruck } from 'react-icons/fi';

// Order type options
const ORDER_TYPES = [
  { id: 'dine_in', name: 'Dine In', icon: FiHome, color: 'green' },
  { id: 'takeout', name: 'Takeout', icon: FiShoppingBag, color: 'blue' },
  { id: 'delivery', name: 'Delivery', icon: FiTruck, color: 'purple' }
];

const OrderType = ({ onChange, initialType, showLabel = true }) => {
  // Use dine_in as default type if not specified
  const [selectedType, setSelectedType] = useState(initialType || 'dine_in');
  const bgColor = useColorModeValue('white', 'gray.700');
  
  // Find the selected type object
  const selectedTypeObj = ORDER_TYPES.find(type => type.id === selectedType);
  
  // When selected type changes, call the onChange callback
  useEffect(() => {
    if (onChange) {
      onChange(selectedType);
    }
  }, [selectedType, onChange]);
  
  // Handle type selection
  const handleSelectType = (typeId) => {
    setSelectedType(typeId);
  };
  
  return (
    <Box>
      {showLabel && (
        <Text fontSize="sm" fontWeight="medium" mb={1}>
          Order Type
        </Text>
      )}
      
      <Menu>
        <MenuButton
          as={Button}
          rightIcon={<Icon as={FiChevronDown} />}
          leftIcon={<Icon as={selectedTypeObj.icon} />}
          variant="outline"
          size="md"
          bg={bgColor}
          borderWidth="1px"
          px={3}
          _hover={{ bg: `${selectedTypeObj.color}.50` }}
        >
          <HStack>
            <Text>{selectedTypeObj.name}</Text>
            <Badge colorScheme={selectedTypeObj.color} variant="subtle">
              {selectedTypeObj.id === 'dine_in' ? 'In' : selectedTypeObj.id === 'takeout' ? 'Out' : 'Del'}
            </Badge>
          </HStack>
        </MenuButton>
        
        <MenuList>
          {ORDER_TYPES.map((type) => (
            <MenuItem 
              key={type.id}
              onClick={() => handleSelectType(type.id)}
              icon={<Icon as={type.icon} color={`${type.color}.500`} />}
              fontWeight={selectedType === type.id ? 'bold' : 'normal'}
            >
              {type.name}
            </MenuItem>
          ))}
        </MenuList>
      </Menu>
    </Box>
  );
};

export default OrderType; 