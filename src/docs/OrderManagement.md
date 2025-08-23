# Order Management System

The POS Order Management System provides a comprehensive solution for managing orders, both online and offline. This documentation explains how orders are handled within the system.

## Order Types

The system supports multiple order types:

- **Dine-In**: For customers dining in the restaurant
- **Takeout**: For customers picking up orders to take away
- **Delivery**: For orders to be delivered to customers

Each order type is visually distinguished with different icons and colors for easy identification.

## Order States

Orders can be in various states throughout their lifecycle:

- **Active**: Currently being processed
- **Completed**: Finalized and paid
- **Pending Sync**: Completed but not yet synchronized with the Odoo server
- **Synced**: Successfully synchronized with the Odoo server
- **Failed Sync**: Synchronization with the server failed

## Offline Support

The system provides robust offline support:

1. **Offline Order Creation**: Orders can be created and processed even when offline
2. **Local Storage**: Active and completed orders are stored locally
3. **Background Sync**: Automatic synchronization when connection is restored
4. **Sync Status Tracking**: Clear visibility of which orders need synchronization
5. **Manual Sync Option**: Users can manually trigger synchronization of specific orders

## Order Management Pages

### Orders List Page (`/orders`)

The main page displays all orders in a table with:

- Order ID and creation date
- Order type indicators
- Item count and total amount
- Sync status with visual indicators
- Action buttons for viewing details and syncing

The page also shows key statistics:
- Total number of orders
- Orders by status (pending, synced, failed)
- Orders by type (dine-in, takeout, delivery)

### Order Details Page (`/orders/:orderId`)

This page shows comprehensive details about a specific order:

- Order header with status and sync indicators
- Customer and payment information
- Detailed list of order items with quantities and prices
- Subtotal, tax, and total calculations
- Sync controls for pending orders

## Implementation Details

The order system is implemented through several components:

1. **OrdersPage.js**: Lists all orders and provides management functionality
2. **OrderStatusPage.js**: Displays detailed information about a specific order
3. **OrderType.js**: Component for selecting and displaying order types
4. **offlineOrderService.js**: Service for handling offline order storage and synchronization
5. **ordersApi.js**: API service for communication with Odoo

## Data Flow

1. Orders are created in the POS interface
2. Completed orders are stored in IndexedDB (offline) or sent to Odoo (online)
3. When offline, orders are marked for synchronization 
4. When connection is restored, pending orders can be synchronized
5. Order status and history can be viewed in the Orders management pages

## Synchronization Process

The synchronization process works as follows:

1. System checks connection status
2. For each pending order:
   - Order data is prepared for the server
   - A request is sent to the Odoo API
   - On success, the order is marked as synced
   - On failure, the error is logged and the order is marked as failed

Users can manually retry synchronization of failed orders. 