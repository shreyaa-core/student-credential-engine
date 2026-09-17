import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite Configuration
 * 
 * Configures Vite bundler with:
 * - @vitejs/plugin-react: Enables Fast Refresh and JSX transformation for React.
 * - @tailwindcss/vite: Integrates Tailwind CSS v4 into the Vite build pipeline.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    open: true,
  },
});
