import React, { useState, useEffect } from 'react';
import { ChakraProvider} from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';

// Import theme
import theme from './theme';

// Import pages
import LoginPage from './pages/LoginPage';
import POSPage from './pages/POSPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import OrderStatusPage from './pages/OrderStatusPage';
import SettingsPage from './pages/SettingsPage';
import POSDataTestPage from './pages/POSDataTestPage';

// Import layout components
import AppLayout from './components/layouts/AppLayout';

// Import session test component
import SessionTest from './components/SessionTest';

// Import sync manager
import OrderSyncManager from './components/OrderSyncManager';

// Import providers
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Create a wrapper component to handle the orders modal
const POSPageWithOrdersModal = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  
  useEffect(() => {
    // Check if we should show the orders modal
    if (searchParams.get('showOrdersModal') === 'true') {
      setShowOrdersModal(true);
      // Remove the parameter from URL to avoid reopening on refresh
      navigate('/pos', { replace: true });
    }
  }, [searchParams, navigate]);
  
  const handleCloseOrdersModal = () => {
    setShowOrdersModal(false);
  };
  
  return (
    <>
      <POSPage />
      {showOrdersModal && (
        <OrdersPage 
          isOpen={showOrdersModal} 
          onClose={handleCloseOrdersModal} 
          isModal={true}
        />
      )}
    </>
  );
};

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  
  if (!isLoggedIn) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

function App() {
  return (
    <ChakraProvider theme={theme}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/test-session" element={<SessionTest />} />
            <Route path="/test-pos-data" element={<POSDataTestPage />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/pos" />} />
              <Route path="pos" element={<POSPageWithOrdersModal />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:orderId" element={<OrderStatusPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="pos-data-test" element={<POSDataTestPage />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          
          {/* OrderSyncManager added at router level to be available across the app */}
          <OrderSyncManager />
        </Router>
      </AuthProvider>
    </ChakraProvider>
  );
}

export default App;
