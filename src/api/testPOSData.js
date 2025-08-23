import { loadPOSData } from './odooApi';
import { posDataService } from './odoo';

// Function to test POS data loading
export const testLoadPOSData = async (sessionId) => {
  console.log('======== TEST POS DATA LOADING ========');
  console.log(`Testing POS data loading for session ID: ${sessionId}`);
  
  try {
    // Directly call the loadPOSData function to test it
    console.log('Calling loadPOSData directly...');
    const result = await loadPOSData(sessionId);
    
    console.log('Raw result from loadPOSData:', result);
    
    if (result.success) {
      console.log('✅ Successfully loaded POS data!');
      console.log(`Data includes: ${Object.keys(result.data).join(', ')}`);
      
      // Check for payment methods in the Odoo structure
      if (result.data['pos.payment.method'] && result.data['pos.payment.method'].data) {
        console.log(`Found ${result.data['pos.payment.method'].data.length} payment methods`);
      }
      
      if (result.data.products) {
        console.log(`Found ${result.data.products.length} products`);
      }
      
      if (result.data.partners) {
        console.log(`Found ${result.data.partners.length} partners`);
      }
      
      return result; // Return the complete result
    } else {
      console.error('❌ Failed to load POS data:', result.error);
      return result;
    }
  } catch (error) {
    console.error('❌ Error in test function:', error);
    return { success: false, error: error.message };
  }
};

// Function to test accessing the stored data
export const testAccessPOSData = async () => {
  try {
    // Test retrieving products
    const products = await posDataService.getProducts();
    const productsAvailable = products && products.length > 0;
    console.log(`Products available: ${productsAvailable ? 'Yes' : 'No'}`);
    if (productsAvailable) {
      console.log(`Number of products: ${products.length}`);
    }

    // Test retrieving partners
    const partners = await posDataService.getPartners();
    const partnersAvailable = partners && partners.length > 0;
    console.log(`Partners available: ${partnersAvailable ? 'Yes' : 'No'}`);
    if (partnersAvailable) {
      console.log(`Number of partners: ${partners.length}`);
    }

    // Test retrieving raw data from IndexedDB
    const rawData = await posDataService.getRawData();
    const rawDataAvailable = rawData !== null;
    console.log(`Raw data available: ${rawDataAvailable ? 'Yes' : 'No'}`);
    
    return {
      success: productsAvailable || partnersAvailable || rawDataAvailable,
      productsAvailable,
      partnersAvailable,
      rawDataAvailable,
      productCount: productsAvailable ? products.length : 0,
      partnerCount: partnersAvailable ? partners.length : 0
    };
  } catch (error) {
    console.error('Error testing POS data access:', error);
    return {
      success: false,
      productsAvailable: false,
      partnersAvailable: false,
      rawDataAvailable: false,
      error: error.message,
      productCount: 0,
      partnerCount: 0
    };
  }
};

// Export a function that runs both tests
export const runPOSDataTests = async (sessionId) => {
  console.log('========= RUNNING POS DATA TESTS =========');
  console.log(`SessionID: ${sessionId}`);
  
  // First, load the data
  const loadResult = await testLoadPOSData(sessionId);
  
  if (loadResult.success) {
    // Then try to access it
    const accessResult = await testAccessPOSData();
    
    return {
      loading: loadResult,
      access: accessResult,
      success: loadResult.success && accessResult.success
    };
  }
  
  console.log('========= POS DATA TESTS COMPLETE =========');
  return loadResult;
};

export default runPOSDataTests; 