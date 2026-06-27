import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Documents from './pages/Documents';
import Copilot from './pages/Copilot';
import Compliance from './pages/Compliance';
import Graph from './pages/Graph';
import ToastContainer from './components/Toast';

// Initialize React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/documents" replace />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/copilot" element={<Copilot />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/graph" element={<Graph />} />
            <Route path="*" element={<Navigate to="/documents" replace />} />
          </Routes>
        </Layout>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
