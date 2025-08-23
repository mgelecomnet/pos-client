import React, { useState, useEffect } from 'react';
import { orderService } from '../services/orderService';
import { paymentService } from '../services/paymentService';
import '../styles/Cart.css';

const Cart = ({ config }) => {
    const [items, setItems] = useState([]);
    const [totals, setTotals] = useState({ subtotal: 0, tax: 0, total: 0 });
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

    useEffect(() => {
        updateTotals();
        loadPaymentMethods();
    }, [items]);

    const loadPaymentMethods = async () => {
        const methods = await paymentService.getPaymentMethods();
        setPaymentMethods(methods);
        if (methods.length > 0) {
            setSelectedPaymentMethod(methods[0]);
        }
    };

    const updateTotals = () => {
        setTotals(orderService.calculateTotals(items));
    };

    const addItem = (product) => {
        const existingItem = items.find(item => item.product_id === product.id);
        
        if (existingItem) {
            setItems(items.map(item => 
                item.product_id === product.id
                    ? {
                        ...item,
                        qty: item.qty + 1,
                        price_subtotal: (item.qty + 1) * item.price_unit,
                        price_subtotal_incl: (item.qty + 1) * item.price_unit * (1 + item.tax_rate)
                    }
                    : item
            ));
        } else {
            const tax_rate = product.taxes_id ? 0.09 : 0; // Example tax rate
            const newItem = {
                product_id: product.id,
                qty: 1,
                price_unit: product.list_price,
                discount: 0,
                tax_rate: tax_rate,
                price_subtotal: product.list_price,
                price_subtotal_incl: product.list_price * (1 + tax_rate),
                product_name: product.name
            };
            setItems([...items, newItem]);
        }
    };

    const removeItem = (productId) => {
        setItems(items.filter(item => item.product_id !== productId));
    };

    const updateQuantity = (productId, newQty) => {
        if (newQty < 1) return;
        
        setItems(items.map(item => 
            item.product_id === productId
                ? {
                    ...item,
                    qty: newQty,
                    price_subtotal: newQty * item.price_unit,
                    price_subtotal_incl: newQty * item.price_unit * (1 + item.tax_rate)
                }
                : item
        ));
    };

    const clearCart = () => {
        setItems([]);
    };

    const handlePayment = async () => {
        if (!selectedPaymentMethod) {
            console.error('No payment method selected');
            return false;
        }

        try {
            // Process the payment first
            const paymentResult = await paymentService.processPayment(
                items,
                selectedPaymentMethod,
                totals.total
            );

            if (!paymentResult.success) {
                console.error('Payment failed:', paymentResult.error);
                return false;
            }

            // Create order data with all required fields for Odoo 18
            const orderData = {
                lines: items.map(item => ({
                    product_id: item.product_id,
                    qty: item.qty,
                    price_unit: item.price_unit,
                    discount: item.discount || 0,
                    price_subtotal: item.price_subtotal,
                    price_subtotal_incl: item.price_subtotal_incl,
                    tax_ids: [[4, 1]],
                })),
                amount_total: totals.total,
                amount_tax: totals.tax,
                amount_paid: totals.total, // Required field for Odoo 18
                amount_return: 0,
                pos_session_id: config.pos_session_id,
                partner_id: false,
                user_id: config.user_id,
                state: 'paid',
                payment_ids: [{
                    payment_method_id: selectedPaymentMethod.id,
                    amount: totals.total,
                    payment_date: paymentResult.payment_date,
                    transaction_id: paymentResult.transaction_id,
                    payment_status: 'paid',
                    is_change: false
                }],
                // Additional required fields for Odoo 18
                company_id: config.company_id,
                pricelist_id: config.pricelist_id,
                fiscal_position_id: false,
                table_id: false,
                to_invoice: false,
                access_token: Date.now().toString(), // Generate a unique token
                date_order: new Date().toISOString(),
                amount_subtotal: totals.subtotal,
                amount_tax_base: totals.subtotal,
                is_tipped: false,
                tip_amount: 0,
                has_printed_receipt: false,
                has_validated: true,
                has_changes: false
            };

            // Save the order
            const order = await orderService.saveOrder(orderData, config);
            
            if (order) {
                clearCart();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Payment processing failed:', error);
            return false;
        }
    };

    return (
        <div className="cart-container">
            <div className="cart-header">
                <h2>Shopping Cart</h2>
                <button className="clear-cart-btn" onClick={clearCart}>Clear Cart</button>
            </div>
            
            <div className="cart-items">
                {items.map((item) => (
                    <div key={item.product_id} className="cart-item">
                        <div className="item-info">
                            <span className="item-name">{item.product_name}</span>
                            <span className="item-price">${item.price_subtotal_incl.toFixed(2)}</span>
                        </div>
                        <div className="quantity-controls">
                            <button className="quantity-btn" onClick={() => updateQuantity(item.product_id, item.qty - 1)}>-</button>
                            <span className="quantity">{item.qty}</span>
                            <button className="quantity-btn" onClick={() => updateQuantity(item.product_id, item.qty + 1)}>+</button>
                        </div>
                        <span className="item-total">${(item.qty * item.price_subtotal_incl).toFixed(2)}</span>
                        <button onClick={() => removeItem(item.product_id)} className="remove-item">×</button>
                    </div>
                ))}
            </div>

            <div className="cart-summary">
                <div className="summary-row">
                    <span>Subtotal:</span>
                    <span>${totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                    <span>Tax ({(totals.tax_rate * 100).toFixed(0)}%):</span>
                    <span>${totals.tax.toFixed(2)}</span>
                </div>
                <div className="summary-row total">
                    <span>Total:</span>
                    <span>${totals.total.toFixed(2)}</span>
                </div>
            </div>

            <div className="payment-method-selector">
                <select 
                    value={selectedPaymentMethod?.id || ''} 
                    onChange={(e) => {
                        const method = paymentMethods.find(m => m.id === parseInt(e.target.value));
                        setSelectedPaymentMethod(method);
                    }}
                >
                    {paymentMethods.map(method => (
                        <option key={method.id} value={method.id}>
                            {method.name}
                        </option>
                    ))}
                </select>
            </div>

            <button 
                className="checkout-btn"
                onClick={handlePayment}
                disabled={items.length === 0 || !selectedPaymentMethod}
            >
                Pay with {selectedPaymentMethod?.name || 'Selected Method'}
            </button>
        </div>
    );
};

export default Cart;