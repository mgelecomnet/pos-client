import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
  Image,
} from '@chakra-ui/react';
import { authService } from '../api/odoo';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: 'Error',
        description: 'Please enter both username and password',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await authService.login(username, password);
      toast({
        title: 'Login successful',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
      navigate('/pos');
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Login failed',
        description: error.message || 'Please check your credentials and try again',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxW="md" py={12}>
      <Flex direction="column" align="center" justify="center">
        <Box mb={8} textAlign="center">
          <Image 
            src="/logo.png" 
            alt="POS Logo" 
            fallbackSrc="https://placehold.co/150x150?text=POS"
            boxSize="100px"
            mb={4}
          />
          <Heading size="xl">POS Login</Heading>
          <Text mt={2} color="gray.600">
            Enter your credentials to access the POS system
          </Text>
        </Box>
        
        <Box w="100%" p={8} borderWidth={1} borderRadius={8} boxShadow="lg">
          <form onSubmit={handleLogin}>
            <Stack spacing={4}>
              <FormControl id="username" isRequired>
                <FormLabel>Username</FormLabel>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                />
              </FormControl>
              
              <FormControl id="password" isRequired>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </FormControl>
              
              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                fontSize="md"
                isLoading={isLoading}
                loadingText="Logging in..."
                mt={6}
                w="100%"
              >
                Sign In
              </Button>
            </Stack>
          </form>
        </Box>
        
        <Text mt={8} fontSize="sm" color="gray.600" textAlign="center">
          © {new Date().getFullYear()} Test POS Client. All rights reserved.
        </Text>
      </Flex>
    </Container>
  );
};

export default Login; 