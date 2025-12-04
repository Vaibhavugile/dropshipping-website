// src/contexts/CartContext.jsx
import React, { createContext, useContext, useReducer } from "react";

const CartStateContext = createContext();
const CartDispatchContext = createContext();

const initialState = { items: [] };
// item shape: { categoryId, productId, qty, variant? }

function cartReducer(state, action) {
  switch (action.type) {
    case "ADD_ITEM": {
      const { item } = action;
      // if same product+variant exists, increase qty
      const keyMatch = (it) => it.productId === item.productId && JSON.stringify(it.variant||{}) === JSON.stringify(item.variant||{}) && it.categoryId === item.categoryId;
      const found = state.items.find(keyMatch);
      if (found) {
        return {
          ...state,
          items: state.items.map(it => keyMatch(it) ? { ...it, qty: it.qty + item.qty } : it)
        };
      } else {
        return { ...state, items: [...state.items, item] };
      }
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((_, idx) => idx !== action.index) };
    case "UPDATE_QTY":
      return { ...state, items: state.items.map((it, idx) => idx === action.index ? { ...it, qty: action.qty } : it) };
    case "CLEAR_CART":
      return initialState;
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  return (
    <CartStateContext.Provider value={state}>
      <CartDispatchContext.Provider value={dispatch}>
        {children}
      </CartDispatchContext.Provider>
    </CartStateContext.Provider>
  );
}

export function useCartState() {
  return useContext(CartStateContext);
}

export function useCartDispatch() {
  return useContext(CartDispatchContext);
}
