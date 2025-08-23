# POS Data API Documentation

This document explains how to use the POS data API to load and access data from the Odoo server.

## Overview

The POS data API allows you to:
1. Load all POS data at once from the Odoo server
2. Store this data in a local IndexedDB database
3. Access this data anytime without making additional server requests

## Loading POS Data

The simplest way to load data is when getting the POS session:

```javascript
import { orderService } from '../api/odoo';

// Get session and load all related data at once
const sessions = await orderService.getPOSSession(true); // true to load all data
```

You can also manually load the data at any time:

```javascript
import { posDataService } from '../api/odoo';

// Load data for a specific session
await posDataService.loadAllPOSData(sessionId);
```

## Accessing POS Data

All data access functions are asynchronous because they use IndexedDB:

```javascript
import { posDataService } from '../api/odoo';

// Example component using POS data
function ProductList() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  useEffect(() => {
    async function loadData() {
      // Get products from local database
      const productsData = await posDataService.getProducts();
      setProducts(productsData);
      
      // Get categories from local database
      const categoriesData = await posDataService.getCategories();
      setCategories(categoriesData);
    }
    
    loadData();
  }, []);
  
  // Rest of component...
}
```

## Available Data Types

The following data types are available:

- `getAllPOSData()`: Get the complete POS data
- `getProducts()`: Get all products
- `getCustomers()`: Get all customers/partners
- `getCategories()`: Get all product categories
- `getPaymentMethods()`: Get all payment methods
- `getTaxes()`: Get all taxes
- `getSessionInfo()`: Get session information
- `getPOSConfig()`: Get POS configuration

## Data Freshness

The API includes functionality to check if the data is fresh:

```javascript
const isFresh = await posDataService.isFreshData(sessionId);
if (!isFresh) {
  await posDataService.loadAllPOSData(sessionId);
}
```

Data is considered fresh if:
1. It belongs to the current session
2. It was loaded less than 15 minutes ago

## Clearing Data

Clear all stored data with:

```javascript
await posDataService.clearAllPOSData();
```

## Full Example

Here's a complete example of how to use the POS data API in a component:

```javascript
import React, { useState, useEffect } from 'react';
import { orderService, posDataService } from '../api/odoo';

function POSDataLoader({ sessionId }) {
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        
        // Check if we have fresh data
        const isFresh = await posDataService.isFreshData(sessionId);
        
        // If not fresh, load from server
        if (!isFresh) {
          await posDataService.loadAllPOSData(sessionId);
        }
        
        // Get products from local database
        const productsData = await posDataService.getProducts();
        setProducts(productsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [sessionId]);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h2>Products ({products.length})</h2>
      <ul>
        {products.map(product => (
          <li key={product.id}>{product.name} - ${product.list_price}</li>
        ))}
      </ul>
    </div>
  );
}

export default POSDataLoader; 