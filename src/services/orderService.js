import { createOrderData, prepareOrderForSync } from '../data/orderModel';
import { openDB } from 'idb';

const DB_NAME = 'pos_db';
const STORE_NAME = 'orders';

// Initialize IndexedDB
const initDB = async () => {
    const db = await openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'uuid' });
                store.createIndex('sync_status', 'sync_status');
                store.createIndex('created_at', 'created_at');
            }
        },
    });
    return db;
};

class OrderService {
    constructor() {
        this.dbPromise = initDB();
    }

    // Save order to local DB
    async saveOrder(orderData, config) {
        const db = await this.dbPromise;
        const order = createOrderData({
            ...orderData,
            config
        });
        
        order.sync_status = 'pending';
        order.created_at = new Date().toISOString();
        
        await db.put(STORE_NAME, order);
        return order;
    }

    // Get unsynchronized orders
    async getUnsyncedOrders() {
        const db = await this.dbPromise;
        return await db.getAllFromIndex(STORE_NAME, 'sync_status', 'pending');
    }

    // Sync order with server
    async syncOrder(order) {
        try {
            const syncData = prepareOrderForSync(order);
            const response = await fetch('/api/pos/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(syncData)
            });

            if (!response.ok) {
                throw new Error('Sync failed');
            }

            const db = await this.dbPromise;
            order.sync_status = 'synced';
            await db.put(STORE_NAME, order);
            
            return true;
        } catch (error) {
            console.error('Order sync failed:', error);
            return false;
        }
    }

    // Sync all pending orders
    async syncPendingOrders() {
        const unsyncedOrders = await this.getUnsyncedOrders();
        const results = await Promise.allSettled(
            unsyncedOrders.map(order => this.syncOrder(order))
        );
        
        return results.filter(r => r.status === 'fulfilled' && r.value).length;
    }

    // Get order by UUID
    async getOrder(uuid) {
        const db = await this.dbPromise;
        return await db.get(STORE_NAME, uuid);
    }

    // Delete order
    async deleteOrder(uuid) {
        const db = await this.dbPromise;
        await db.delete(STORE_NAME, uuid);
    }

    // Calculate order totals
    calculateTotals(orderLines) {
        return orderLines.reduce((totals, line) => {
            totals.subtotal += line.price_subtotal;
            totals.tax += line.price_subtotal_incl - line.price_subtotal;
            totals.total += line.price_subtotal_incl;
            return totals;
        }, { subtotal: 0, tax: 0, total: 0 });
    }
}

export const orderService = new OrderService();