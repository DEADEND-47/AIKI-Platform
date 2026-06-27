import { useState, useEffect } from 'react';

let toastListeners = [];
let toasts = [];

export function addToast(message, type = 'info') {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast = { id, message, type };
  toasts = [...toasts, newToast];
  toastListeners.forEach(listener => listener(toasts));
  
  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    removeToast(id);
  }, 3000);
}

export function removeToast(id) {
  toasts = toasts.filter(t => t.id !== id);
  toastListeners.forEach(listener => listener(toasts));
}

export function useToast() {
  const [activeToasts, setActiveToasts] = useState(toasts);
  
  useEffect(() => {
    toastListeners.push(setActiveToasts);
    return () => {
      toastListeners = toastListeners.filter(l => l !== setActiveToasts);
    };
  }, []);
  
  return {
    toasts: activeToasts,
    toast: (msg, type) => addToast(msg, type),
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
    remove: removeToast
  };
}
