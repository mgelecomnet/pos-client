import React from 'react';
import { Container, Heading, Box, Text, Link } from '@chakra-ui/react';
import POSDataTest from '../components/POSDataTest';

const POSDataTestPage = () => {
  return (
    <Container maxW="container.lg" pt={10}>
      <Box mb={8}>
        <Heading mb={2}>POS Data API Testing</Heading>
        <Text fontSize="lg" color="gray.600">
          Use this page to test the POS data loading and database functionality. 
          This will help verify that the API endpoint is working correctly.
        </Text>
        <Text mt={2}>
          You are testing the API: <code>http://localhost:8069/web/dataset/call_kw/pos.session/load_data</code>
        </Text>
      </Box>
      
      <POSDataTest />
      
      <Box mt={8} p={4} borderRadius="md" bg="blue.50">
        <Heading size="sm" mb={2}>Instructions:</Heading>
        <Text>
          1. Click "Fetch Active Session" to find your current POS session <br />
          2. Click "Run POS Data Test" to load and test the data API <br />
          3. Check the console logs for detailed outputs <br />
          4. Results will show if the API call was successful
        </Text>
      </Box>
    </Container>
  );
};

export default POSDataTestPage; 