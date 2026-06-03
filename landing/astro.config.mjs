// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'dtoolkit',
      logo: {
        src: './src/assets/logo.png',
      },
      favicon: '/favicon/favicon.svg',
      head: [
        {
          tag: 'link',
          attrs: { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/favicon/favicon-96x96.png' },
        },
        {
          tag: 'link',
          attrs: { rel: 'icon', type: 'image/x-icon', href: '/favicon/favicon.ico' },
        },
        {
          tag: 'link',
          attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon/apple-touch-icon.png' },
        },
        {
          tag: 'script',
          content: "document.documentElement.dataset.theme='light';try{localStorage.setItem('starlight-theme','light')}catch(e){}",
        },
      ],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/ivncmp/dtoolkit',
        },
      ],
      expressiveCode: {
        themes: ['night-owl'],
        styleOverrides: {
          borderRadius: '0.75rem',
          borderColor: 'transparent',
          frames: {
            terminalBackground: '#030712',
            terminalTitlebarBackground: '#030712',
            terminalTitlebarBorderBottomColor: '#1e293b',
            terminalTitlebarDotsForeground: '#ff5f56',
          },
        },
      },
      customCss: ['./src/styles/starlight.css'],
      components: {
        Header: './src/components/DocsHeader.astro',
        ThemeSelect: './src/components/DocsThemeForce.astro',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'docs/guides/introduction' },
            { label: 'Quickstart', slug: 'docs/guides/getting-started' },
            { label: 'Installation', slug: 'docs/guides/installation' },
            { label: 'Configuration', slug: 'docs/guides/configuration' },
            { label: 'Core Concepts', slug: 'docs/guides/core-concepts' },
          ],
        },
        {
          label: 'Products',
          items: [
            { label: 'dbrain — Memory', slug: 'docs/products/dbrain' },
            { label: 'dcontext — Context', slug: 'docs/products/dcontext' },
            { label: 'dwork — Projects', slug: 'docs/products/dwork' },
            { label: 'dproxy — Transport', slug: 'docs/products/dproxy' },
            { label: 'dops — Observability', slug: 'docs/products/dops' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'MCP Tools', slug: 'docs/reference/mcp-tools' },
            { label: 'CLI Commands', slug: 'docs/reference/cli' },
            { label: 'REST API', slug: 'docs/reference/rest-api' },
            { label: 'SDK', slug: 'docs/reference/sdk' },
          ],
        },
        {
          label: 'Help',
          items: [
            { label: 'Troubleshooting', slug: 'docs/troubleshooting' },
          ],
        },
      ],
    }),
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
  redirects: {
    '/docs/': '/docs/guides/introduction/',
  },
});
