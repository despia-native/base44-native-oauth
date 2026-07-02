import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import { ActionSheetProvider } from '@/lib/actionSheet';
import AppFocusHandler from '@/components/AppFocusHandler';
import ScrollToTop from './components/ScrollToTop';
import AnimatedRoutes from '@/components/AnimatedRoutes';

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ActionSheetProvider>
          <AppFocusHandler />
          <Router>
            <ScrollToTop />
            <AnimatedRoutes />
          </Router>
          <Toaster />
        </ActionSheetProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App