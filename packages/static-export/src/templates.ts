/**
 * SSG Templates for static export
 * These are embedded versions of the CLI templates
 */

export const SSG_PACKAGE_JSON = `{
  "type": "module",
  "private": true,
  "sideEffects": false,
  "scripts": {
    "build": "vite build",
    "dev": "vite dev",
    "preview": "vite preview",
    "typecheck": "tsc"
  },
  "dependencies": {
    "@webstudio-is/image": "^0.238.0",
    "@webstudio-is/react-sdk": "^0.238.0",
    "@webstudio-is/sdk": "^0.238.0",
    "@webstudio-is/sdk-components-react": "^0.238.0",
    "@webstudio-is/sdk-components-animation": "^0.238.0",
    "@webstudio-is/sdk-components-react-radix": "^0.238.0",
    "react": "18.3.0-canary-14898b6a9-20240318",
    "react-dom": "18.3.0-canary-14898b6a9-20240318",
    "vike": "^0.4.229"
  },
  "devDependencies": {
    "@types/react": "^18.2.70",
    "@types/react-dom": "^18.2.25",
    "@vitejs/plugin-react": "^4.4.1",
    "typescript": "5.8.2",
    "vite": "^6.3.4"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}`;

export const SSG_TSCONFIG = `{
  "include": ["**/*.ts", "**/*.tsx", "**/*.mjs"],
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "types": [
      "vite/client",
      "@webstudio-is/react-sdk/placeholder",
      "./vike.d.ts"
    ],
    "isolatedModules": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "strict": true,
    "allowJs": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "skipLibCheck": true
  }
}`;

export const SSG_VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import vike from "vike/plugin";

export default defineConfig({
  plugins: [react(), vike({ prerender: true })],
  resolve: {
    conditions: ["browser", "development|production"],
  },
  ssr: {
    resolve: {
      conditions: ["node", "development|production"],
    },
  },
});`;

export const SSG_VIKE_DTS = `import type { ImageLoader } from "@webstudio-is/image";
import type { PageMeta, System } from "@webstudio-is/sdk";

declare global {
  namespace Vike {
    interface Config {
      lang?: (props: { data: PageData }) => string;
      Head?: (props: { data: PageData }) => React.ReactNode;
    }

    interface PageContext {
      constants: {
        assetBaseUrl: string;
        imageLoader: ImageLoader;
      };
      data: {
        url: string;
        system: System;
        resources: Record<string, unknown>;
        pageMeta: PageMeta;
      };
      Page?: (props: { data: PageData }) => React.ReactNode;
    }
  }
}`;

export const SSG_CONSTANTS_MJS = `/**
 * We use mjs extension as constants in this file is shared with the build script
 * and we use \`node --eval\` to extract the constants.
 */

export const assetBaseUrl = "/assets/";

/**
 * @type {import("@webstudio-is/image").ImageLoader}
 */
export const imageLoader = ({ src }) => {
  return src;
};`;

export const SSG_PAGES_CONFIG = `import type { Config } from "vike/types";

export default {
  meta: {
    Head: {
      env: { server: true, client: true },
    },
    lang: {
      env: { server: true, client: true },
    },
  },
} satisfies Config;`;

export const SSG_ON_RENDER_HTML = `import { renderToString } from "react-dom/server";
import { dangerouslySkipEscape, escapeInject } from "vike/server";
import type { OnRenderHtmlSync } from "vike/types";
import {
  CustomCode,
  projectId,
  lastPublished,
  // @ts-ignore
} from "../app/__generated__/_index";

export const onRenderHtml: OnRenderHtmlSync = (pageContext) => {
  const lang = pageContext.data.pageMeta.language || "en";
  const Head = pageContext.config.Head ?? (() => <></>);
  const Page = pageContext.Page ?? (() => <></>);
  const html = dangerouslySkipEscape(
    renderToString(
      <html
        lang={lang}
        data-ws-project={projectId}
        data-ws-last-published={lastPublished}
      >
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <Head data={pageContext.data} />
          <CustomCode />
        </head>
        <Page data={pageContext.data} />
      </html>
    )
  );
  return escapeInject\`<!DOCTYPE html>
\${html}
\`;
};`;

export const SSG_ON_RENDER_CLIENT = `import { type Root, createRoot } from "react-dom/client";
import type { OnRenderClientSync } from "vike/types";

let root: Root;

export const onRenderClient: OnRenderClientSync = (pageContext) => {
  const lang = pageContext.data.pageMeta.language || "en";
  const Head = pageContext.config.Head ?? (() => <></>);
  const Page = pageContext.Page ?? (() => <></>);
  const htmlContent = (
    <>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Head data={pageContext.data} />
        {/* avoid hydrating custom code on client, it will duplicate all scripts */}
      </head>
      <Page data={pageContext.data} />
    </>
  );
  if (root === undefined) {
    root = createRoot(document.documentElement);
  }
  document.documentElement.lang = lang;
  root.render(htmlContent);
};`;

export const SSG_PAGE_TEMPLATE = `import type { PageContext } from "vike/types";
import {
  PageSettingsMeta,
  PageSettingsTitle,
  ReactSdkContext,
} from "@webstudio-is/react-sdk/runtime";
import { assetBaseUrl, imageLoader } from "__CONSTANTS__";
import { Page, breakpoints, siteName } from "__CLIENT__";

const PageComponent = ({ data }: { data: PageContext["data"] }) => {
  const { system, resources, url, pageMeta } = data;
  return (
    <ReactSdkContext.Provider
      value={{
        imageLoader,
        assetBaseUrl,
        resources,
        breakpoints,
        onError: console.error,
      }}
    >
      {/* Use the URL as the key to force scripts in HTML Embed to reload on dynamic pages */}
      <Page key={url} system={system} />
      <PageSettingsMeta
        url={url}
        pageMeta={pageMeta}
        siteName={siteName}
        imageLoader={imageLoader}
        assetBaseUrl={assetBaseUrl}
      />
      <PageSettingsTitle>{pageMeta.title}</PageSettingsTitle>
    </ReactSdkContext.Provider>
  );
};
export default PageComponent;`;

export const SSG_HEAD_TEMPLATE = `import type { PageContext } from "vike/types";
import { assetBaseUrl, imageLoader } from "__CONSTANTS__";
import {
  favIconAsset,
  pageBackgroundImageAssets,
  pageFontAssets,
  siteName,
} from "__CLIENT__";
import "__CSS__";

export const Head = ({}: { data: PageContext["data"] }) => {
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
  };
  return (
    <>
      {siteName && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ldJson, null, 2),
          }}
        ></script>
      )}
      {favIconAsset && (
        <link
          rel="icon"
          href={imageLoader({
            src: \`\${assetBaseUrl}\${favIconAsset}\`,
            // width,height must be multiple of 48 https://developers.google.com/search/docs/appearance/favicon-in-search
            width: 144,
            height: 144,
            fit: "pad",
            quality: 100,
            format: "auto",
          })}
        />
      )}
      {pageFontAssets.map((asset) => (
        <link
          key={asset}
          rel="preload"
          href={\`\${assetBaseUrl}\${asset}\`}
          as="font"
          crossOrigin="anonymous"
        />
      ))}
      {pageBackgroundImageAssets.map((asset) => (
        <link
          key={asset}
          rel="preload"
          href={\`\${assetBaseUrl}\${asset}\`}
          as="image"
        />
      ))}
    </>
  );
};`;

export const SSG_DATA_TEMPLATE = `import type { PageContextServer } from "vike/types";
import { isLocalResource, loadResources } from "@webstudio-is/sdk/runtime";
import { getPageMeta, getResources } from "__SERVER__";

const customFetch: typeof fetch = (input, init) => {
  if (typeof input !== "string") {
    return fetch(input, init);
  }

  if (isLocalResource(input, "current-date")) {
    const now = new Date();
    // Normalize to midnight UTC to prevent hydration mismatches
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const data = {
      iso: startOfDay.toISOString(),
      year: startOfDay.getUTCFullYear(),
      month: startOfDay.getUTCMonth() + 1, // 1-12 instead of 0-11
      day: startOfDay.getUTCDate(),
      timestamp: startOfDay.getTime(),
    };
    const response = new Response(JSON.stringify(data));
    response.headers.set("content-type", "application/json; charset=utf-8");
    return Promise.resolve(response);
  }

  return fetch(input, init);
};

export const data = async (pageContext: PageContextServer) => {
  const url = new URL(pageContext.urlOriginal, "http://url");
  const headers = new Headers(pageContext.headers ?? {});
  const host = headers.get("x-forwarded-host") || headers.get("host") || "";
  url.host = host;
  url.protocol = "https";

  const params = pageContext.routeParams;
  const system = {
    params,
    search: Object.fromEntries(url.searchParams),
    origin: url.origin,
    pathname: url.pathname,
  };

  const resources = await loadResources(
    customFetch,
    getResources({ system }).data
  );
  const pageMeta = getPageMeta({ system, resources });

  return {
    url: url.href,
    system,
    resources,
    pageMeta,
  } satisfies PageContextServer["data"];
};`;

export const NPMRC_CONTENT = `force=true
loglevel=error
audit=false
fund=false
`;

export const README_CONTENT = `# Webstudio Static Export

Site statique exporté depuis Webstudio.

## Démarrage rapide

\`\`\`bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de développement
npm run dev

# 3. Ou builder pour la production
npm run build

# 4. Prévisualiser le build
npm run preview
\`\`\`

## Commandes

| Commande | Description |
|----------|-------------|
| \`npm install\` | Installe les dépendances |
| \`npm run dev\` | Lance le serveur de développement |
| \`npm run build\` | Build le site statique dans \`dist/client/\` |
| \`npm run preview\` | Prévisualise le build de production |

## Déploiement

Après \`npm run build\`, déployez le contenu du dossier \`dist/client/\` sur :
- **Netlify** : Glissez-déposez le dossier ou connectez votre repo
- **Vercel** : \`npx vercel --prod\`
- **GitHub Pages** : Copiez dans le dossier \`docs/\` ou utilisez une Action
- **Tout hébergeur statique** : Uploadez le contenu de \`dist/client/\`

## Structure

\`\`\`
├── app/
│   ├── constants.mjs      # Configuration (URLs, loaders)
│   └── __generated__/     # Composants et CSS générés
├── pages/                 # Routes Vike
├── renderer/              # Rendu HTML/Client
├── dist/client/           # Build de production (après npm run build)
├── package.json
└── vite.config.ts
\`\`\`

## Prérequis

- Node.js >= 20.0.0
- npm ou pnpm

---
Généré par [Webstudio](https://webstudio.is)
`;
