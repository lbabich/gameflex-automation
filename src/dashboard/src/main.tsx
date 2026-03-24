import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { QUERY_KEY } from './queryKeys';
import type { RunRecord } from './types';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onSuccess: (data, query) => {
      if (query.queryKey[0] === 'run') {
        const run = data as RunRecord;

        if (run.status !== 'running') {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY.RUNS });
        }
      }
    },
  }),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
