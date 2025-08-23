import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  useToast,
  Image,
  InputGroup,
  InputRightElement,
  IconButton,
  Container,
  Card,
  CardBody,
} from '@chakra-ui/react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: 'Error',
        description: 'Username and password are required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      setIsLoading(true);
      await login(username, password);
      navigate('/pos');
    } catch (error) {
      console.error('Login failed:', error);
      toast({
        title: 'Authentication Error',
        description: error.message || 'Failed to log in. Please check your credentials.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box 
      bg="gray.50" 
      minH="100vh" 
      py="12" 
      px={{ base: '4', lg: '8' }}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Container maxW="md">
        <VStack spacing="8" align="center" mb="8">
          <Image
            src="/logo.png"
            fallbackSrc="https://via.placeholder.com/150x50?text=Odoo+POS"
            alt="Odoo POS"
            h="14"
          />
          <Heading size="lg" textAlign="center">Welcome to Odoo POS</Heading>
        </VStack>
        
        <Card boxShadow="lg" borderRadius="xl">
          <CardBody p="8">
            <form onSubmit={handleSubmit}>
              <VStack spacing="6">
                <FormControl id="username" isRequired>
                  <FormLabel>Username</FormLabel>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    size="lg"
                  />
                </FormControl>
                
                <FormControl id="password" isRequired>
                  <FormLabel>Password</FormLabel>
                  <InputGroup size="lg">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                    <InputRightElement>
                      <IconButton
                        variant="ghost"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        icon={showPassword ? <FiEyeOff /> : <FiEye />}
                        onClick={togglePasswordVisibility}
                      />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>
                
                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  width="full"
                  isLoading={isLoading}
                  loadingText="Logging In"
                >
                  Sign In
                </Button>
              </VStack>
            </form>
          </CardBody>
        </Card>

        <Text color="gray.600" mt="8" textAlign="center">
          © {new Date().getFullYear()} Odoo POS. All rights reserved.
        </Text>
      </Container>
    </Box>
  );
};

export default LoginPage; 