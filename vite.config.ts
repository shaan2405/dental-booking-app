import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Polyfill process.env.API_KEY for the Gemini SDK using the key provided by the user
    'process.env.API_KEY': JSON.stringify("AIzaSyDaW0WSvolfyDhFscJ3IshuH0f2lOxtIus"),
    // Polyfill other process.env access if strictly needed, though mostly handled by Vite
    'process.env': {} 
  }
});