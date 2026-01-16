import { defineConfig, Plugin } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';
import fs from 'fs';

function pagesRewritePlugin(): Plugin {
  return {
    name: 'pages-rewrite',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] || '';
        const langMatch = url.match(/^\/(en|de|zh|vi)(\/.*)?$/);
        if (langMatch) {
          const lang = langMatch[1];
          const restOfPath = langMatch[2] || '/';
          if (!langMatch[2]) {
            res.writeHead(302, { Location: `/${lang}/` });
            res.end();
            return;
          }
          if (restOfPath === '/') {
            req.url = '/index.html';
            return next();
          }
          const pagePath = restOfPath.slice(1);
          if (pagePath.endsWith('.html')) {
            const srcPath = resolve(__dirname, 'src/pages', pagePath);
            const rootPath = resolve(__dirname, pagePath);
            if (fs.existsSync(srcPath)) req.url = `/src/pages/${pagePath}`;
            else if (fs.existsSync(rootPath)) req.url = `/${pagePath}`;
          } else if (!pagePath.includes('.')) {
            const htmlPath = pagePath + '.html';
            const srcPath = resolve(__dirname, 'src/pages', htmlPath);
            const rootPath = resolve(__dirname, htmlPath);
            if (fs.existsSync(srcPath)) req.url = `/src/pages/${htmlPath}`;
            else if (fs.existsSync(rootPath)) req.url = `/${htmlPath}`;
          } else {
            req.url = restOfPath;
          }
          return next();
        }
        if (url.endsWith('.html') && !url.startsWith('/src/')) {
          const pageName = url.slice(1);
          const pagePath = resolve(__dirname, 'src/pages', pageName);
          if (fs.existsSync(pagePath)) req.url = `/src/pages${url}`;
        }
        next();
      });
    },
  };
}

function flattenPagesPlugin(): Plugin {
  return {
    name: 'flatten-pages',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (fileName.startsWith('src/pages/') && fileName.endsWith('.html')) {
          const newFileName = fileName.replace('src/pages/', '');
          bundle[newFileName] = bundle[fileName];
          bundle[newFileName].fileName = newFileName;
          delete bundle[fileName];
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: process.env.BASE_URL || '/',
  plugins: [
    pagesRewritePlugin(),
    flattenPagesPlugin(),
    tailwindcss(),
    nodePolyfills({
      include: ['buffer', 'stream', 'util', 'zlib', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  define: {
    __SIMPLE_MODE__: JSON.stringify(process.env.SIMPLE_MODE === 'true'),
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      zlib: 'browserify-zlib',
    },
  },
  optimizeDeps: {
    include: ['pdfkit', 'blob-stream'],
    exclude: ['coherentpdf'],
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      'heliacal-janis-securable.ngrok-free.dev',
      'plus-calling-series-introducing.trycloudflare.com'  // <-- add this
    ],
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // about: resolve(__dirname, 'about.html'),
        // contact: resolve(__dirname, 'contact.html'),
        // faq: resolve(__dirname, 'faq.html'),
        // privacy: resolve(__dirname, 'privacy.html'),
        // terms: resolve(__dirname, 'terms.html'),
        bookmark: resolve(__dirname, 'src/pages/bookmark.html'),
        // licensing: resolve(__dirname, 'licensing.html'),
        'table-of-contents': resolve(__dirname, 'src/pages/table-of-contents.html'),
        'pdf-to-json': resolve(__dirname, 'src/pages/pdf-to-json.html'),
        'json-to-pdf': resolve(__dirname, 'src/pages/json-to-pdf.html'),
        // ... aap baaki pages bhi isi tarah add kar sakte ho
      },
    },
  },
  
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/tests/', '*.config.ts', '**/*.d.ts', 'dist/'],
    },
  },
}));
