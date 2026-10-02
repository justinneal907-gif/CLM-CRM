import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{outDir:'../submission-manager-live',emptyOutDir:true,rollupOptions:{input:{main:'index.html',auth:'auth.html'}}}});
