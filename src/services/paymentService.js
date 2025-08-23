import { openDB } from 'idb';

const DB_NAME = 'pos_db';
const PAYMENT_STORE = 'pos_payment_method';

// Initialize IndexedDB
const initDB = async () => {
    const db = await openDB(DB_NAME, 1, {
        upgrade(db) {
            // Create payment methods store if it doesn't exist
            if (!db.objectStoreNames.contains(PAYMENT_STORE)) {
                const store = db.createObjectStore(PAYMENT_STORE, { keyPath: 'id' });
                store.createIndex('name', 'name');
                store.createIndex('is_cash_count', 'is_cash_count');
            }
        },
    });
    return db;
};

class PaymentService {
    constructor() {
        this.dbPromise = initDB();
        this.defaultPaymentMethods = [
            {
                id: 1,
                name: 'Cash',
                is_cash_count: true,
            },
            {
                id: 2,
                name: 'Card',
                is_cash_count: false,
            }
        ];
    }

    async initializePaymentMethods() {
        try {
            const db = await this.dbPromise;
            const tx = db.transaction(PAYMENT_STORE, 'readwrite');
            const store = tx.objectStore(PAYMENT_STORE);

            // Add default payment methods
            for (const method of this.defaultPaymentMethods) {
                await store.put(method);
            }

            await tx.complete;
            return true;
        } catch (error) {
            console.error('Failed to initialize payment methods:', error);
            return false;
        }
    }

    async getPaymentMethods() {
        try {
            const db = await this.dbPromise;
            return await db.getAll(PAYMENT_STORE);
        } catch (error) {
            console.error('Failed to get payment methods:', error);
            return this.defaultPaymentMethods;
        }
    }

    async getPaymentMethod(id) {
        try {
            const db = await this.dbPromise;
            return await db.get(PAYMENT_STORE, id);
        } catch (error) {
            console.error('Failed to get payment method:', error);
            return null;
        }
    }

    async processPayment(orderData, paymentMethod, amount) {
        try {
            // Here you would typically integrate with a payment processor
            // For now, we'll just simulate a successful payment
            return {
                success: true,
                payment_method_id: paymentMethod.id,
                amount: amount,
                transaction_id: Date.now().toString(),
                payment_date: new Date().toISOString()
            };
        } catch (error) {
            console.error('Payment processing failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export const paymentService = new PaymentService(); 