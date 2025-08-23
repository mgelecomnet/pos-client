import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Text,
  HStack,
  IconButton,
  NumberInput,
  NumberInputField,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Button,
  Flex,
  Badge,
  useToast,
} from '@chakra-ui/react';
import { FiMinus, FiPlus, FiTrash2, FiPercent } from 'react-icons/fi';

// Global store for cart state
if (typeof window !== 'undefined') {
  window.cartState = window.cartState || {
    focusedItemId: null,
    inputData: {},
    lastDirection: null, // Track the last navigation direction
    updatingPositions: false, // Lock to prevent concurrent updates
    numericBuffer: '', // Buffer for multi-digit quantity entry
    numericTimeout: null, // Timeout for auto-applying numeric input
    discountMode: false // Flag to track if we're entering discount
  };
  
  // Function to focus on a specific cart item (especially for newly added items)
  window.focusCartItem = function(itemId) {
    if (!itemId) return;
    
    // Update positions first
    window.updateCartPositions();
    
    // Set the focused item
    window.cartState.focusedItemId = itemId;
    
    // Dispatch focus event
    window.dispatchEvent(new CustomEvent('cartItemFocus'));
    
    // Try to scroll the item into view
    const itemElement = document.querySelector(`[data-cart-item="true"][data-item-id="${itemId}"]`);
    if (itemElement) {
      itemElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  };
  
  // Function to update positions
  window.updateCartPositions = function() {
    // Prevent concurrent updates
    if (window.cartState.updatingPositions) {
      return;
    }
    
    window.cartState.updatingPositions = true;
    
    try {
      // Find all cart items
      const cartItems = Array.from(document.querySelectorAll('[data-cart-item="true"]'));
      if (!cartItems.length) {
        window.cartState.updatingPositions = false;
        return;
      }
      
      // Sort by visual position (top to bottom)
      const sortedItems = cartItems.sort((a, b) => {
        const posA = a.getBoundingClientRect();
        const posB = b.getBoundingClientRect();
        return posA.top - posB.top;
      });
      
      // Set position attributes
      sortedItems.forEach((item, index) => {
        item.setAttribute('data-position', index);
        
        // Update the visual label
        const posLabel = item.querySelector('.position-label');
        if (posLabel) {
          posLabel.textContent = `#${index + 1}`;
        }
      });
      
      return sortedItems;
    } finally {
      // Always reset the lock
      window.cartState.updatingPositions = false;
    }
  };
  
  // Function to handle navigation
  window.navigateCart = function(direction) {
    // Save any pending changes before navigation
    const currentFocusedId = window.cartState.focusedItemId;
    if (currentFocusedId) {
      // Check if we need to save a discount value
      if (window.cartState.discountMode && window.cartState.numericBuffer) {
        const buffer = window.cartState.numericBuffer;
        const discountValue = Math.min(parseInt(buffer) || 0, 100);
        
        console.log(`[CartItem] Saving discount value ${discountValue}% before navigation`);
        
        // Apply the pending discount
        window.dispatchEvent(new CustomEvent('cartApplyDiscount', {
          detail: {
            itemId: currentFocusedId,
            discount: discountValue
          }
        }));
        
        // Reset the buffer
        window.resetNumericBuffer();
        
        // Exit discount mode
        window.cartState.discountMode = false;
      }
      
      // Force save the current item's quantity
      window.dispatchEvent(new CustomEvent('forceSaveQuantity', {
        detail: { itemId: currentFocusedId, forceSync: true }
      }));
    }
    
    // Update positions after saving
    window.updateCartPositions();
    
    // Get items after positions have been updated
    const sortedItems = Array.from(document.querySelectorAll('[data-cart-item="true"]'))
      .sort((a, b) => {
        const posA = parseInt(a.getAttribute('data-position')) || 0;
        const posB = parseInt(b.getAttribute('data-position')) || 0;
        return posA - posB;
      });
    
    if (!sortedItems || !sortedItems.length) {
      return;
    }
    
    const itemCount = sortedItems.length;
    
    // Get the currently focused item
    const focusedId = window.cartState.focusedItemId;
    let focusedItem = null;
    let currentPosition = -1;
    
    if (focusedId) {
      focusedItem = sortedItems.find(item => item.dataset.itemId === String(focusedId));
      currentPosition = focusedItem ? parseInt(focusedItem.dataset.position) : -1;
    }
    
    let nextPosition;
    
    // If no item is focused, choose the first or last item depending on direction
    if (currentPosition === -1) {
      nextPosition = direction === 'down' ? 0 : itemCount - 1;
    } else {
      // Otherwise, move up or down
      if (direction === 'down') {
        // If at the end, go to the first item
        nextPosition = currentPosition === itemCount - 1 ? 0 : currentPosition + 1;
      } else {
        // If at the beginning, go to the last item
        nextPosition = currentPosition === 0 ? itemCount - 1 : currentPosition - 1;
      }
    }
    
    const nextItem = sortedItems.find(item => parseInt(item.dataset.position) === nextPosition);
    
    if (nextItem) {
      const nextItemId = nextItem.dataset.itemId;
      
      // Update focus immediately
      window.cartState.focusedItemId = nextItemId;
      window.dispatchEvent(new CustomEvent('cartItemFocus'));
      
      // Try to scroll it into view
      nextItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  };
  
  // Function to directly apply quantity to the focused item
  window.applyQuantityToFocusedItem = function(quantity) {
    const focusedId = window.cartState.focusedItemId;
    if (!focusedId) return;
    
    const event = new CustomEvent('cartApplyQuantity', {
      detail: {
        itemId: focusedId,
        quantity: quantity
      }
    });
    window.dispatchEvent(event);
  };
  
  // Function to directly apply discount to the focused item
  window.applyDiscountToFocusedItem = function(discount) {
    const focusedId = window.cartState.focusedItemId;
    if (!focusedId) return;
    
    const event = new CustomEvent('cartApplyDiscount', {
      detail: {
        itemId: focusedId,
        discount: discount
      }
    });
    window.dispatchEvent(event);
  };
  
  // Reset numeric buffer
  window.resetNumericBuffer = function() {
    window.cartState.numericBuffer = '';
    if (window.cartState.numericTimeout) {
      clearTimeout(window.cartState.numericTimeout);
      window.cartState.numericTimeout = null;
    }
  };
  
  // Exit discount mode
  window.exitDiscountMode = function() {
    if (window.cartState.discountMode) {
      console.log('[CartItem] Exiting discount mode');
      
      // Save any pending discount value from the buffer
      const focusedId = window.cartState.focusedItemId;
      const buffer = window.cartState.numericBuffer;
      
      if (focusedId && buffer) {
        // Calculate discount value
        const discountValue = Math.min(parseInt(buffer) || 0, 100);
        console.log(`[CartItem] Saving pending discount value on exit: ${discountValue}%`);
        
        // Apply the discount directly
        window.dispatchEvent(new CustomEvent('cartApplyDiscount', {
          detail: {
            itemId: focusedId,
            discount: discountValue
          }
        }));
      }
      
      // Turn off discount mode
      window.cartState.discountMode = false;
      window.resetNumericBuffer();
      
      // Notify the focused item
      if (focusedId) {
        window.dispatchEvent(new CustomEvent('cartDiscountMode', {
          detail: {
            itemId: focusedId,
            active: false
          }
        }));
      }
    }
  };
  
  // Set up global keyboard navigation (only once)
  if (!window.cartNavInitialized) {
    window.cartNavInitialized = true;
    
    // Initialize positions on load
    setTimeout(() => {
      window.updateCartPositions();
    }, 500);
    
    // Listen for keyboard events
    document.addEventListener('keydown', function(e) {
      const key = e.key.toLowerCase();
      
      // Skip if payment screen is active or a popover/modal is open
      const paymentScreen = document.querySelector('[data-payment-active="true"]');
      const popoverOpen = document.querySelector('[data-popover-open="true"]');
      const quantityInputActive = document.querySelector('[data-quantity-input="true"]');
      
      if (paymentScreen || popoverOpen || quantityInputActive) {
        return;
      }
      
      // Get the focused item
      const focusedId = window.cartState.focusedItemId;
      if (!focusedId) {
        // If no item is focused but arrow keys are pressed, handle navigation
        if (key === 'arrowup' || key === 'arrowdown') {
          // Prevent default scrolling
          e.preventDefault();
          
          // Store the last direction
          const direction = key === 'arrowdown' ? 'down' : 'up';
          window.cartState.lastDirection = direction;
          
          // Force save all item quantities
          document.querySelectorAll('[data-cart-item="true"]').forEach(item => {
            const itemId = item.dataset.itemId;
            if (itemId) {
              window.dispatchEvent(new CustomEvent('forceSaveQuantity', {
                detail: { itemId: itemId }
              }));
            }
          });
          
          // Make sure positions are updated first
          window.updateCartPositions();
          
          // Navigate cart
          setTimeout(() => {
            window.navigateCart(direction);
          }, 50); // increased delay to ensure saves complete
        }
        return;
      }
      
      // Get the focused element
      const focusedElement = document.querySelector(`[data-cart-item="true"][data-item-id="${focusedId}"]`);
      if (!focusedElement) return;
      
      // Handle arrow keys for navigation
      if (key === 'arrowup' || key === 'arrowdown') {
        // Prevent default scrolling
        e.preventDefault();
        
        // Apply any pending buffer before navigation
        if (window.cartState.numericBuffer) {
          const buffer = window.cartState.numericBuffer;
          
          if (window.cartState.discountMode) {
            // Save discount before navigation
            const discountValue = Math.min(parseInt(buffer) || 0, 100);
            console.log(`[CartItem] Saving discount ${discountValue}% before arrow navigation`);
            
            window.dispatchEvent(new CustomEvent('cartApplyDiscount', {
              detail: {
                itemId: focusedId,
                discount: discountValue
              }
            }));
          } else {
            // Save quantity before navigation
            const quantityValue = parseInt(buffer) || 1;
            console.log(`[CartItem] Saving quantity ${quantityValue} before arrow navigation`);
            
            window.dispatchEvent(new CustomEvent('cartApplyQuantity', {
              detail: {
                itemId: focusedId,
                quantity: quantityValue
              }
            }));
          }
          
          // Reset the buffer
        window.resetNumericBuffer();
        }
        
        // Force save the current item
        window.dispatchEvent(new CustomEvent('forceSaveQuantity', {
          detail: { itemId: focusedId, forceSync: true }
        }));
        
        // Reset discount mode
        if (window.cartState.discountMode) {
          window.cartState.discountMode = false;
          
          window.dispatchEvent(new CustomEvent('cartDiscountMode', {
            detail: {
              itemId: focusedId,
              active: false
            }
          }));
        }
        
        // Store the direction for navigation
        const direction = key === 'arrowdown' ? 'down' : 'up';
        window.cartState.lastDirection = direction;
        
        // Make sure positions are updated and then navigate
        window.updateCartPositions();
        setTimeout(() => {
          window.navigateCart(direction);
        }, 10);
      }
      
      // Handle multi-digit numeric input
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        
        // Add digit to buffer
        window.cartState.numericBuffer += e.key;
        
        console.log(`[CartItem] Numeric input: ${e.key}, buffer now: ${window.cartState.numericBuffer}, discountMode: ${window.cartState.discountMode}`);
        
        // Clear any existing timeout
        if (window.cartState.numericTimeout) {
          clearTimeout(window.cartState.numericTimeout);
        }
        
        // Update the display immediately based on mode
        const currentBuffer = window.cartState.numericBuffer;
        const numericValue = parseInt(currentBuffer);
        
        // Check if we're in discount mode
        if (window.cartState.discountMode) {
          console.log(`[CartItem] Processing numeric input in discount mode: ${currentBuffer}`);
          
          // Show buffer in discount mode
          window.dispatchEvent(new CustomEvent('cartShowDiscountBuffer', {
            detail: {
              itemId: focusedId,
              buffer: currentBuffer
            }
          }));
          
          // Set timeout to apply the discount after a brief pause
          window.cartState.numericTimeout = setTimeout(() => {
            const discountValue = Math.min(parseInt(currentBuffer) || 0, 100);
            console.log(`[CartItem] Auto-applying discount of ${discountValue}% to item ${focusedId} after timeout`);
            
            // Apply the discount
            window.applyDiscountToFocusedItem(discountValue);
            
            // Reset buffer and exit discount mode
            window.resetNumericBuffer();
            window.exitDiscountMode();
          }, 500);
        } else {
          // Show visual feedback for the quantity buffer
          window.dispatchEvent(new CustomEvent('cartShowQuantityBuffer', {
            detail: {
              itemId: focusedId,
              buffer: currentBuffer
            }
          }));
          
          // Set timeout to apply the value after a brief pause
          window.cartState.numericTimeout = setTimeout(() => {
            if (numericValue === 0) {
              // Check if this is a refund item before removing
              const focusedElement = document.querySelector(`[data-cart-item="true"][data-item-id="${focusedId}"]`);
              const isRefundItem = focusedElement && (focusedElement.dataset.isRefund === "true");
              
              if (isRefundItem) {
                // For refund items, just set the quantity to 0 instead of removing
                console.log(`[CartItem] Setting refund item ${focusedId} quantity to 0 instead of removing`);
                window.applyQuantityToFocusedItem(0);
              } else {
                // For regular items, remove if quantity is 0
                window.dispatchEvent(new CustomEvent('cartRemoveItem', {
                detail: {
                  itemId: focusedId
                }
                }));
              }
            } else {
              // Apply the final numeric value
              window.applyQuantityToFocusedItem(numericValue);
            }
            
            // Reset buffer
            window.resetNumericBuffer();
          }, 500);
        }
      }
      
      // Use + and - keys to increase/decrease quantity
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        
        // Reset numeric buffer and exit discount mode
        window.resetNumericBuffer();
        window.exitDiscountMode();
        
        const event = new CustomEvent('cartChangeQuantity', { 
          detail: { 
            itemId: focusedId, 
            change: 1 
          } 
        });
        window.dispatchEvent(event);
      }
      
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        
        // Reset numeric buffer and exit discount mode
        window.resetNumericBuffer();
        window.exitDiscountMode();
        
        const event = new CustomEvent('cartChangeQuantity', { 
          detail: { 
            itemId: focusedId, 
            change: -1 
          } 
        });
        window.dispatchEvent(event);
      }
      
      // Use 'd' or '%' key to open discount
      if (e.key.toLowerCase() === 'd' || e.key === '%') {
        e.preventDefault();
        
        console.log(`[CartItem] Discount key pressed: e.key=${e.key}`);
        
        // Check if there's an item focused
        if (!focusedId) {
          console.log('[CartItem] No item is focused, cannot enter discount mode');
          return;
        }
        
        // Reset any existing numeric buffer
        window.resetNumericBuffer();
        
        // Toggle discount mode in global state
        window.cartState.discountMode = !window.cartState.discountMode;
        console.log(`[CartItem] Discount mode toggled to: ${window.cartState.discountMode}`);
        
        // Notify the focused item about discount mode change
        window.dispatchEvent(new CustomEvent('cartDiscountMode', { 
          detail: { 
            itemId: focusedId,
            active: window.cartState.discountMode
          } 
        }));
      }
      
      // Delete key to remove item
      if (e.key === 'delete' || e.key === 'backspace') {
        e.preventDefault();
        
        // Reset numeric buffer and exit discount mode
        window.resetNumericBuffer();
        window.exitDiscountMode();
        
        const event = new CustomEvent('cartRemoveItem', { 
          detail: { 
            itemId: focusedId
          } 
        });
        window.dispatchEvent(event);
      }
    });
    
    // Listen for cart item focus events
    window.addEventListener('cartItemFocus', function() {
      const focusedId = window.cartState.focusedItemId;
      
      // Reset numeric buffer when focus changes
      window.resetNumericBuffer();
      
      if (focusedId) {
        const focusedElement = document.querySelector(`[data-cart-item="true"][data-item-id="${focusedId}"]`);
        if (focusedElement) {
          // Visually highlight the focused element
          document.querySelectorAll('[data-cart-item="true"]').forEach(item => {
            item.classList.remove('item-focused');
          });
          focusedElement.classList.add('item-focused');
        }
      }
    });
  }

  // Add a function to explicitly save current quantities before navigation
  window.syncCartItemQuantities = function() {
    // Get all cart items
    const cartItems = document.querySelectorAll('[data-cart-item="true"]');
    
    cartItems.forEach(itemElement => {
      // Get itemId from data attribute
      const itemId = itemElement.dataset.itemId;
      if (!itemId) return;
      
      // Find the quantity display element
      const quantityDisplay = itemElement.querySelector('[data-quantity-display="true"]');
      if (!quantityDisplay) return;
      
      // Get displayed quantity
      const displayedQuantity = parseInt(quantityDisplay.textContent);
      if (isNaN(displayedQuantity)) return;
      
      // Trigger sync event for this item
      window.dispatchEvent(new CustomEvent('cartSyncQuantity', {
        detail: {
          itemId: itemId,
          quantity: displayedQuantity
        }
      }));
    });
  };
}

const CartItem = ({ item, onUpdateQuantity, onRemove, onUpdateDiscount }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempQuantity, setTempQuantity] = useState(item.quantity);
  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [quantityBuffer, setQuantityBuffer] = useState('');
  const [discountBuffer, setDiscountBuffer] = useState('');
  const [isDiscountMode, setIsDiscountMode] = useState(false);
  
  // Display values
  const [displayQuantity, setDisplayQuantity] = useState(item.quantity);
  const [displayDiscount, setDisplayDiscount] = useState(item.discount || 0);

  // Update display when item changes
  useEffect(() => {
    // Only update if the value has actually changed and is not being edited
    if (!isEditing && displayQuantity !== item.quantity) {
    setDisplayQuantity(item.quantity);
      // Also update tempQuantity to stay in sync
      setTempQuantity(item.quantity);
    }
  }, [item.quantity, displayQuantity, isEditing]);

  useEffect(() => {
    // Only update if the discount value has actually changed
    if (displayDiscount !== (item.discount || 0)) {
    setDisplayDiscount(item.discount || 0);
    }
  }, [item.discount, displayDiscount]);

  // Simple focus tracking
  useEffect(() => {
    const updateFocus = () => {
      // Convert both to string for proper comparison
      const shouldBeFocused = String(window.cartState?.focusedItemId) === String(item.id);
      
      // If we're losing focus and have pending changes, apply them
      if (isFocused && !shouldBeFocused) {
        // If we have any pending quantity changes, apply them
        if (displayQuantity !== item.quantity) {
          console.log(`[CartItem] Applying quantity ${displayQuantity} to item ${item.id} on focus change`);
          onUpdateQuantity(item.id, displayQuantity);
        }
        
        // Check if there's a numeric buffer to apply before focus changes
        const buffer = window.cartState.numericBuffer;
        if (buffer) {
          console.log(`[CartItem] Applying pending buffer on focus change: ${buffer}`);
          
          if (window.cartState.discountMode) {
            // Apply as discount
            const discountValue = Math.min(parseInt(buffer) || 0, 100);
            console.log(`[CartItem] Applying discount of ${discountValue}% to item ${item.id} on focus change`);
            onUpdateDiscount(item.id, discountValue);
          } else {
            // Apply as quantity
            const quantityValue = parseInt(buffer) || 1;
            console.log(`[CartItem] Applying quantity of ${quantityValue} to item ${item.id} on focus change`);
            onUpdateQuantity(item.id, quantityValue);
          }
          
          // Clear the buffer
          window.resetNumericBuffer();
        }
        
        // Exit discount mode if active
        if (isDiscountMode) {
          setIsDiscountMode(false);
          
          if (window.cartState.discountMode) {
            window.cartState.discountMode = false;
          }
        }
      }
      
      if (shouldBeFocused !== isFocused) {
        setIsFocused(shouldBeFocused);
        
        // Clear buffer display when focus changes
        setQuantityBuffer('');
        setDiscountBuffer('');
      }
    };
    
    // Check on mount and when focus changes
    updateFocus();
    
    // Listen for focus change events
    window.addEventListener('cartItemFocus', updateFocus);
    
    return () => {
      window.removeEventListener('cartItemFocus', updateFocus);
    };
  }, [item.id, isFocused, item.quantity, displayQuantity, onUpdateQuantity, isDiscountMode, onUpdateDiscount]);

  // Listen for quantity buffer updates
  useEffect(() => {
    const handleShowBuffer = (e) => {
      if (String(e.detail.itemId) !== String(item.id)) return;
      setQuantityBuffer(e.detail.buffer);
    };
    
    window.addEventListener('cartShowQuantityBuffer', handleShowBuffer);
    
    return () => {
      window.removeEventListener('cartShowQuantityBuffer', handleShowBuffer);
    };
  }, [item.id]);

  // Listen for direct quantity updates
  useEffect(() => {
    const handleApplyQuantity = (e) => {
      if (String(e.detail.itemId) !== String(item.id)) return;
      
      const newQuantity = e.detail.quantity;
      if (newQuantity > 0) {
        onUpdateQuantity(item.id, newQuantity);
      } else if (newQuantity === 0) {
        onRemove(item.id);
      }
    };
    
    window.addEventListener('cartApplyQuantity', handleApplyQuantity);
    
    return () => {
      window.removeEventListener('cartApplyQuantity', handleApplyQuantity);
    };
  }, [item.id, onUpdateQuantity, onRemove]);

  // Listen for quantity change events (+ and -)
  useEffect(() => {
    const handleChangeQuantity = (e) => {
      if (String(e.detail.itemId) !== String(item.id)) return;
      
      // Always use the latest item.quantity from props, not the local state
      // This ensures we're working with the most current value
      const currentQuantity = item.quantity;
      const isRefundItem = item.isRefund || item.quantity < 0;

      // For refund items, handle differently
      let newQuantity;
      if (isRefundItem) {
        // For refund items, incrementing means more negative, decrementing means less negative
        if (e.detail.change > 0) {
          // Incrementing (making more negative)
          newQuantity = currentQuantity - 1;
      } else {
          // Decrementing (making less negative)
          newQuantity = currentQuantity + 1;
          
          // Don't go above 0 for refund items
          if (newQuantity > 0) {
            newQuantity = 0;
          }
        }
      } else {
        // For regular items, don't go below 1
        newQuantity = Math.max(1, currentQuantity + e.detail.change);
      }
      
      console.log(`[CartItem] Changing quantity for item ${item.id} from ${currentQuantity} to ${newQuantity}`);
      
      // Update both display quantity and actual quantity
      setDisplayQuantity(newQuantity);
      onUpdateQuantity(item.id, newQuantity);
    };
    
    const handleRemoveItem = (e) => {
      if (String(e.detail.itemId) !== String(item.id)) return;
      onRemove(item.id);
    };
    
    window.addEventListener('cartChangeQuantity', handleChangeQuantity);
    window.addEventListener('cartRemoveItem', handleRemoveItem);
    
    return () => {
      window.removeEventListener('cartChangeQuantity', handleChangeQuantity);
      window.removeEventListener('cartRemoveItem', handleRemoveItem);
    };
  }, [item, onUpdateQuantity, onRemove]);

  // Listen for discount mode events
  useEffect(() => {
    const handleDiscountMode = (e) => {
      if (String(e.detail.itemId) !== String(item.id)) return;
      
      console.log(`[CartItem] Discount mode event received for item ${item.id}, active=${e.detail.active}`);
      
      // Update discount mode state
      setIsDiscountMode(e.detail.active);
      
      // Clear buffer when entering/exiting discount mode
      setDiscountBuffer('');
    };
    
    const handleShowDiscountBuffer = (e) => {
      if (String(e.detail.itemId) !== String(item.id)) return;
      
      console.log(`[CartItem] Show discount buffer for item ${item.id}, buffer=${e.detail.buffer}`);
      setDiscountBuffer(e.detail.buffer);
    };
    
    const handleApplyDiscount = (e) => {
      if (String(e.detail.itemId) !== String(item.id)) return;
      
      const discountValue = e.detail.discount;
      console.log(`[CartItem] Applying discount of ${discountValue}% to item ${item.id}`);
      
      // Apply the discount immediately
      onUpdateDiscount(item.id, discountValue);
      
      // Clear buffer and exit discount mode
      setDiscountBuffer('');
      setIsDiscountMode(false);
    };
    
    window.addEventListener('cartDiscountMode', handleDiscountMode);
    window.addEventListener('cartShowDiscountBuffer', handleShowDiscountBuffer);
    window.addEventListener('cartApplyDiscount', handleApplyDiscount);
    
    return () => {
      window.removeEventListener('cartDiscountMode', handleDiscountMode);
      window.removeEventListener('cartShowDiscountBuffer', handleShowDiscountBuffer);
      window.removeEventListener('cartApplyDiscount', handleApplyDiscount);
    };
  }, [item.id, onUpdateDiscount]);

  // Listen for sync quantity events
  useEffect(() => {
    const handleSyncQuantity = (e) => {
      if (String(e.detail.itemId) !== String(item.id)) return;
      
      const syncQuantity = e.detail.quantity;
      if (syncQuantity !== item.quantity) {
        console.log(`[CartItem] Syncing quantity for item ${item.id}: ${syncQuantity}`);
        onUpdateQuantity(item.id, syncQuantity);
      }
    };
    
    window.addEventListener('cartSyncQuantity', handleSyncQuantity);
    
    return () => {
      window.removeEventListener('cartSyncQuantity', handleSyncQuantity);
    };
  }, [item.id, item.quantity, onUpdateQuantity]);

  // Handle forced save from parent
  const handleForceSave = (e) => {
    // Only act if this is for our specific item
    if (e.detail && e.detail.itemId === item.id) {
      const forceSync = e.detail.forceSync;
      const currentInputValue = tempQuantity !== '' ? parseFloat(tempQuantity) : item.quantity;
      
      // Check if we have a modified quantity input with data-quantity-modified attribute
      const quantityInput = document.querySelector(`[data-cart-item="true"][data-item-id="${item.id}"] [data-quantity-modified="true"]`);
      const isModified = !!quantityInput;
      
      // Only force save if:
      // 1. The value is different from the current item quantity, OR
      // 2. Sync is explicitly requested AND the item is marked as modified, OR
      // 3. We are in edit mode (meaning user is actively editing this item)
      if (currentInputValue !== item.quantity || (forceSync && isModified) || isEditing) {
        console.log(`[CartItem] Force saving quantity for item ${item.id}: ${currentInputValue}, modified: ${isModified}, editing: ${isEditing}`);
        onUpdateQuantity(item.id, currentInputValue);
        
        // Always update local quantity after force saving
        setTempQuantity(currentInputValue);
        
        // If there's a quantity input that's marked as modified, clear the flag
        if (quantityInput) {
          quantityInput.removeAttribute('data-quantity-modified');
        }
      } else {
        console.log(`[CartItem] Skipping force save for item ${item.id} - no change or not modified`);
      }
    }
  };

  // Set focus when clicked
  const handleFocus = () => {
    // First, check if we need to save changes from the previously focused item
    const currentFocusedId = window.cartState?.focusedItemId;
    if (currentFocusedId && currentFocusedId !== item.id) {
      // If the previous item was in discount mode, save its discount
      if (window.cartState.discountMode && window.cartState.numericBuffer) {
        const buffer = window.cartState.numericBuffer;
        const discountValue = Math.min(parseInt(buffer) || 0, 100);
        
        console.log(`[CartItem] Saving discount value ${discountValue}% for previous item ${currentFocusedId} before changing focus`);
        
        // Apply the pending discount to the previous item
        window.dispatchEvent(new CustomEvent('cartApplyDiscount', {
          detail: {
            itemId: currentFocusedId,
            discount: discountValue
          }
        }));
        
        // Reset buffer and exit discount mode
        window.resetNumericBuffer();
        window.cartState.discountMode = false;
      }
      
      // Force save the previous item's quantity
      window.dispatchEvent(new CustomEvent('forceSaveQuantity', {
        detail: { itemId: currentFocusedId, forceSync: true }
      }));
    }
    
    // Update positions first
    if (window.updateCartPositions) {
      window.updateCartPositions();
    }
    
    // Only update if this is not already the focused item - compare as strings
    if (String(window.cartState.focusedItemId) !== String(item.id)) {
      window.cartState.focusedItemId = item.id;
      
      // Dispatch event immediately
      window.dispatchEvent(new CustomEvent('cartItemFocus'));
      
      // Scroll into view if needed
      const element = document.querySelector(`[data-cart-item="true"][data-item-id="${item.id}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  // Update positions whenever cart changes
  useEffect(() => {
    // Initial position update
    setTimeout(() => {
      if (window.updateCartPositions) {
        window.updateCartPositions();
      }
    }, 100);
    
    // Also update positions when cart items get focused
    const handlePositionUpdate = () => {
      if (window.updateCartPositions) {
        window.updateCartPositions();
      }
    };
    
    window.addEventListener('cartItemFocus', handlePositionUpdate);
    
    return () => {
      window.removeEventListener('cartItemFocus', handlePositionUpdate);
    };
  }, []);

  // Activate editing mode for quantity (when clicking on quantity)
  const handleQuantityClick = (e) => {
    e.stopPropagation();
    handleFocus();
    
    // Reset any buffer
    window.resetNumericBuffer();
    
    // Always start with the current item quantity from props
    setTempQuantity(item.quantity);
    
    setIsEditing(true);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 10);
  };

  // Handle blur from quantity edit
  const handleBlur = () => {
    setIsEditing(false);
    const numericQuantity = parseFloat(tempQuantity);
    const isRefundItem = item.isRefund || item.quantity < 0;
    
    console.log(`[CartItem] handleBlur with tempQuantity: ${tempQuantity}, parsed to: ${numericQuantity}`);
    
    // If the quantity has changed from the original item quantity, mark it as modified
    if (numericQuantity !== item.quantity && inputRef.current) {
      inputRef.current.setAttribute('data-quantity-modified', 'true');
      console.log(`[CartItem] Marked quantity input for item ${item.id} as modified`);
    }
    
    if (numericQuantity > 0 || (isRefundItem && numericQuantity === 0)) {
      // Update both display and actual quantity
      setDisplayQuantity(numericQuantity);
      onUpdateQuantity(item.id, numericQuantity);
    } else if (numericQuantity === 0 && !isRefundItem) {
      // Remove item if quantity is 0 (only for non-refund items)
      onRemove(item.id);
    } else {
      // Invalid input, reset to current quantity
      setTempQuantity(item.quantity);
      setDisplayQuantity(item.quantity);
    }
  };

  // Handle keyboard input in edit mode
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBlur();
      
      // Force save immediately
      window.dispatchEvent(new CustomEvent('forceSaveQuantity', {
        detail: { itemId: item.id, forceSync: true }
      }));
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTempQuantity(item.quantity);
    } else if (/^\d$/.test(e.key)) {
      // When already in edit mode and pressing a number, allow normal input
      // The browser's default behavior will handle this correctly
      return;
    }
  };

  // Calculate final price
  const priceAfterDiscount = item.discount ? item.price * (1 - item.discount / 100) : item.price;
  const totalPrice = priceAfterDiscount * item.quantity;
  const isRefund = item.isRefund || item.quantity < 0;
  // Get the maximum allowed refund quantity from the item or set to infinity for non-refund items
  const maxRefundQuantity = isRefund && item.originalQuantity ? item.originalQuantity : Infinity;

  // Set data attributes for position
  useEffect(() => {
    // Find all cart items
    const allCartItems = Array.from(document.querySelectorAll('[data-cart-item="true"]'));
    
    // Sort items by their visual position (top to bottom)
    const sortedItems = allCartItems.sort((a, b) => {
      const posA = a.getBoundingClientRect();
      const posB = b.getBoundingClientRect();
      return posA.top - posB.top;
    });
    
    // Set position attribute on each item
    sortedItems.forEach((itemEl, index) => {
      itemEl.setAttribute('data-position', index);
      // Also update a visible label for debugging
      const positionLabel = itemEl.querySelector('.position-label');
      if (positionLabel) {
        positionLabel.textContent = `#${index + 1}`;
      }
    });
  }, [isFocused]); // Update when focus changes, which may indicate cart updates

  // Add a global click handler to save all quantities when clicking anywhere
  useEffect(() => {
    const handleDocumentClick = (e) => {
      // Apply any pending buffer on any click
      const currentFocusedId = window.cartState?.focusedItemId;
      const buffer = window.cartState.numericBuffer;
      
      if (currentFocusedId && buffer) {
        console.log(`[CartItem] Document click: applying pending buffer: ${buffer}`);
        
        if (window.cartState.discountMode) {
          // Apply as discount
          const discountValue = Math.min(parseInt(buffer) || 0, 100);
          console.log(`[CartItem] Document click: saving discount ${discountValue}%`);
          
          window.dispatchEvent(new CustomEvent('cartApplyDiscount', {
            detail: {
              itemId: currentFocusedId,
              discount: discountValue
            }
          }));
        } else {
          // Apply as quantity
          const quantityValue = parseInt(buffer) || 1;
          console.log(`[CartItem] Document click: saving quantity ${quantityValue}`);
          
          window.dispatchEvent(new CustomEvent('cartApplyQuantity', {
            detail: {
              itemId: currentFocusedId,
              quantity: quantityValue
            }
          }));
        }
        
        // Clear the buffer
        window.resetNumericBuffer();
      }
      
      // Exit discount mode if clicking outside cart items
      if (!e.target.closest('[data-cart-item="true"]') && 
          !e.target.closest('[data-discount-button="true"]') && 
          !e.target.closest('[data-discount-badge="true"]')) {
        
        // User clicked outside any cart item - ensure discount mode is exited
        if (window.cartState.discountMode) {
          console.log('[CartItem] Exiting discount mode due to click outside cart item');
          window.exitDiscountMode();
        }
        
        // Force save all quantities
        document.querySelectorAll('[data-cart-item="true"]').forEach(itemEl => {
          const itemId = itemEl.dataset.itemId;
          if (itemId) {
            window.dispatchEvent(new CustomEvent('forceSaveQuantity', {
              detail: { itemId: itemId, forceSync: true }
            }));
          }
        });
      }
    };
    
    document.addEventListener('click', handleDocumentClick);
    
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  const toast = useToast();

  return (
    <Box 
      p={3}
      borderWidth="1px"
      borderRadius="md"
      mb={2}
      data-cart-item="true"
      data-item-id={item.id}
      data-position="0"
      data-is-refund={isRefund}
      onClick={handleFocus}
      bg={isFocused ? "blue.50" : isRefund ? "red.50" : "white"}
      borderColor={isFocused ? "blue.300" : isRefund ? "red.300" : "gray.200"}
      boxShadow={isFocused ? "0 0 0 2px rgba(66, 153, 225, 0.6)" : "none"}
      transition="all 0.2s"
      position="relative"
    >
      {/* Position indicator with additional info */}
      <Box
        position="absolute"
        top="2px"
        left="2px"
        fontSize="xs"
        p="1px"
        px="3px"
        borderRadius="sm"
        fontWeight="bold"
        bg={isFocused ? "blue.100" : "gray.100"}
        color={isFocused ? "blue.700" : "gray.600"}
        className="position-label"
        zIndex={2}
      >
        #{isFocused ? '⚡' : '-'}
      </Box>
      
      {/* Focus indicator */}
      {isFocused && (
        <Box 
          position="absolute" 
          top="0" 
          left="-2px"
          width="4px"
          height="100%"
          bg="blue.500"
          borderTopLeftRadius="md"
          borderBottomLeftRadius="md"
          zIndex={1}
        />
      )}
      
      <Flex justify="space-between" align="center" mb={1}>
        <Text 
          fontWeight={isFocused ? "bold" : "medium"} 
          noOfLines={1} 
          flex="1"
          color={isFocused ? "blue.700" : isRefund ? "red.700" : "inherit"}
        >
          {item.name}
          {isRefund && <Badge colorScheme="red" ml={1}>بازگشت</Badge>}
        </Text>
        <IconButton
          size="xs"
          icon={<FiTrash2 />}
          colorScheme="red"
          variant="ghost"
          aria-label="Remove item"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
        />
      </Flex>
      
      <Flex justify="space-between" align="center">
        <HStack spacing={1}>
          <Text fontSize="sm" color="gray.500">
            ${item.price.toFixed(2)}
          </Text>
          {(item.discount > 0 || isDiscountMode) && (
            <Badge 
              colorScheme={isDiscountMode ? "blue" : "green"}
              variant={isDiscountMode ? "solid" : "subtle"}
              cursor={isDiscountMode ? "default" : "pointer"}
              data-discount-badge="true"
              onClick={(e) => {
                if (!isDiscountMode) {
                  e.stopPropagation();
                  
                  console.log(`[CartItem] Discount badge clicked for item ${item.id}`);
                  
                  // First focus this item
                  handleFocus();
                  
                  // Set global discount mode directly
                  window.cartState.discountMode = true;
                  
                  // Notify about discount mode change
                  setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('cartDiscountMode', { 
                    detail: { 
                      itemId: item.id,
                      active: true
                    } 
                  }));
                  }, 10);
                }
              }}
            >
              {discountBuffer || displayDiscount}% {isDiscountMode && "⌨️"}
            </Badge>
          )}
        </HStack>
        
        <HStack>
          <IconButton
            size="xs"
            icon={<FiMinus />}
            aria-label="Decrease quantity"
            onClick={(e) => {
              e.stopPropagation();
              
              // Make sure this item is focused first
              handleFocus();
              
              // For refund items, "decreasing" means making the negative value smaller (closer to zero)
              const newQuantity = isRefund 
                ? Math.min(0, item.quantity + 1) // For refunds, go toward zero but not above
                : Math.max(0, item.quantity - 1);
              
              console.log(`[CartItem] Minus button: ${item.id} from ${item.quantity} to ${newQuantity}`);
              
              if (newQuantity === 0) {
                onRemove(item.id);
              } else {
                // Update both display and actual quantities
                setDisplayQuantity(newQuantity);
                // Use a small delay to ensure state is properly updated
                setTimeout(() => {
                onUpdateQuantity(item.id, newQuantity);
                }, 10);
              }
            }}
            isDisabled={item.quantity <= 1 && !isRefund}
          />
          
          {isEditing ? (
            <NumberInput
              size="xs"
              w="16"
              min={0}
              max={isRefund ? maxRefundQuantity : undefined}
              value={isRefund ? Math.abs(tempQuantity) : tempQuantity}
              onChange={(valueAsString) => {
                const value = parseFloat(valueAsString);
                
                // For refund items, store as negative but display as positive
                const adjustedValue = isRefund && !isNaN(value) ? -Math.abs(value) : value;
                
                // For refund items, ensure we don't exceed the original quantity
                if (isRefund && !isNaN(value) && item.originalQuantity && value > item.originalQuantity) {
                  // Cap at original quantity
                  setTempQuantity(-Math.abs(item.originalQuantity));
                  
                  // Show a warning about exceeding max quantity
                  console.log(`[CartItem] Warning: Refund quantity ${value} exceeds original quantity ${item.originalQuantity}`);
                } else {
                  setTempQuantity(adjustedValue);
                }
                
                // Mark as modified when the value changes
                if (inputRef.current && parseFloat(valueAsString) !== Math.abs(item.quantity)) {
                  inputRef.current.setAttribute('data-quantity-modified', 'true');
                  inputRef.current.setAttribute('data-item-id', item.id);
                }
              }}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              allowMouseWheel
              keepWithinRange={true}
            >
              <NumberInputField 
                ref={inputRef}
                textAlign="center"
                autoFocus
                data-quantity-input="true"
                data-item-id={item.id}
              />
            </NumberInput>
          ) : (
            <Text 
              fontWeight="medium" 
              w="10" 
              textAlign="center" 
              cursor="pointer"
              onClick={handleQuantityClick}
              bg={quantityBuffer ? "blue.100" : isRefund ? "red.100" : "gray.100"}
              color={quantityBuffer ? "blue.700" : isRefund ? "red.700" : "inherit"}
              borderRadius="md"
              py={1}
              position="relative"
              data-quantity-display="true"
            >
              {quantityBuffer || (isRefund ? Math.abs(displayQuantity) : displayQuantity)}
              {quantityBuffer && (
                <Box
                  position="absolute"
                  bottom="-2px"
                  left="50%"
                  transform="translateX(-50%)"
                  width="70%"
                  height="2px"
                  bg="blue.500"
                  borderRadius="full"
                />
              )}
            </Text>
          )}
          
          <IconButton
            size="xs"
            icon={<FiPlus />}
            aria-label="Increase quantity"
            onClick={(e) => {
              e.stopPropagation();
              
              // Make sure this item is focused first
              handleFocus();
              
              // For refund items, "adding" means making the negative quantity larger in magnitude
              let newQuantity;
              if (isRefund) {
                // Check if we're at the maximum refund quantity
                if (item.originalQuantity && Math.abs(item.quantity) >= item.originalQuantity) {
                  // Already at max, don't allow further increase
                  console.log(`[CartItem] Cannot increase refund quantity beyond original: ${item.originalQuantity}`);
                  toast({
                    title: "حداکثر مقدار مجاز",
                    description: `نمی‌توانید بیش از تعداد اصلی (${item.originalQuantity}) را بازگردانید.`,
                    status: "warning",
                    duration: 3000,
                    isClosable: true,
                  });
                  newQuantity = item.quantity;
                } else {
                  // Increase refund quantity (more negative)
                  newQuantity = item.quantity - 1;
                }
              } else {
                // Regular item, just add 1
                newQuantity = item.quantity + 1;
              }
              
              console.log(`[CartItem] Plus button: ${item.id} from ${item.quantity} to ${newQuantity}`);
              
              // Update both display and actual quantities
              setDisplayQuantity(newQuantity);
              // Use a small delay to ensure state is properly updated
              setTimeout(() => {
                onUpdateQuantity(item.id, newQuantity);
              }, 10);
            }}
          />
          
          <IconButton
            size="xs"
            icon={<FiPercent />}
            colorScheme={isDiscountMode ? "blue" : (item.discount > 0 ? "green" : "gray")}
            aria-label="Toggle discount mode"
            data-discount-button="true"
            onClick={(e) => {
              e.stopPropagation();
              
              // First focus this item
              handleFocus();
              
              // Toggle discount mode in global state
              const newMode = !isDiscountMode;
              console.log(`[CartItem] Percent button clicked for item ${item.id}, setting mode to ${newMode}`);
              
              // Set global state directly
              window.cartState.discountMode = newMode;
              
              // Notify this item about discount mode change
              setTimeout(() => {
              window.dispatchEvent(new CustomEvent('cartDiscountMode', { 
                detail: { 
                  itemId: item.id,
                  active: newMode
                } 
              }));
              }, 10);
            }}
          />
        </HStack>
      </Flex>
      
      {/* Show refund information if this is a refund item */}
      {isRefund && item.refundLabel && (
        <Box mt={2} p={2} bg="red.50" borderRadius="md">
          <Text fontSize="sm" color="red.600" fontWeight="bold">
            {item.refundLabel}
          </Text>
          <Text fontSize="sm" color="red.600">
            تعداد بازگشتی: {Math.abs(item.quantity)}
          </Text>
          <Text fontSize="sm" color="red.600">
            مبلغ بازگشتی: ${Math.abs(totalPrice).toFixed(2)}
          </Text>
        </Box>
      )}
      
      <Flex justify="flex-end" mt={1}>
        <Text fontWeight="bold" fontSize="sm" color={isRefund ? "red.600" : "inherit"}>
          ${totalPrice.toFixed(2)}
        </Text>
      </Flex>
    </Box>
  );
};

export default CartItem; 