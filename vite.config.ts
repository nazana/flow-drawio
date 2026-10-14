import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localAPI } from './server/api.ts';

export default defineConfig({plugins:[react(),localAPI()],server:{host:'127.0.0.1',port:5180,strictPort:true},preview:{host:'127.0.0.1',port:4173,strictPort:true}});
