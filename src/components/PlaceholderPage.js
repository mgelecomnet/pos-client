import React from 'react';
import { Box, Flex, Heading, Text, Button, Icon } from '@chakra-ui/react';
import { FiSettings, FiUsers, FiList } from 'react-icons/fi';

const getIcon = (title) => {
  switch (title.toLowerCase()) {
    case 'customers':
      return FiUsers;
    case 'orders':
      return FiList;
    case 'settings':
      return FiSettings;
    default:
      return FiSettings;
  }
};

const PlaceholderPage = ({ title }) => {
  const IconComponent = getIcon(title);
  
  return (
    <Flex 
      direction="column" 
      align="center" 
      justify="center" 
      h="full" 
      textAlign="center"
      p={8}
    >
      <Icon as={IconComponent} boxSize={16} color="gray.300" mb={4} />
      <Heading size="xl" mb={4} color="gray.600">{title}</Heading>
      <Box maxW="md" mb={8}>
        <Text fontSize="lg" color="gray.500">
          This page is currently under development. 
          Check back soon for updates or contact the administrator for more information.
        </Text>
      </Box>
      <Button colorScheme="blue">Back to POS</Button>
    </Flex>
  );
};

export default PlaceholderPage; 