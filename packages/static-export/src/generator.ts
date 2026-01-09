import {
  generateWebstudioComponent,
  normalizeProps,
  generateRemixRoute,
  generateRemixParams,
} from "@webstudio-is/react-sdk";
import type {
  Instance,
  Prop,
  Page,
  DataSource,
  Resource,
  WsComponentMeta,
} from "@webstudio-is/sdk";
import {
  createScope,
  findTreeInstanceIds,
  getPagePath,
  generateResources,
  generatePageMeta,
  getStaticSiteMapXml,
  replaceFormActionsWithResources,
  isCoreComponent,
  coreMetas,
  SYSTEM_VARIABLE_ID,
  generateCss,
  ROOT_INSTANCE_ID,
  elementComponent,
  isPathnamePattern,
} from "@webstudio-is/sdk";
import { compareMedia } from "@webstudio-is/css-engine";

import * as baseComponentMetas from "@webstudio-is/sdk-components-react/metas";
import * as animationComponentMetas from "@webstudio-is/sdk-components-animation/metas";
import * as radixComponentMetas from "@webstudio-is/sdk-components-react-radix/metas";

import { MemoryFileSystem } from "./memory-fs";
import { createZipFromMemoryFS } from "./zip-builder";
import type { BuildData, SiteDataByPage, StaticExportResult } from "./types";
import {
  SSG_PACKAGE_JSON,
  SSG_TSCONFIG,
  SSG_VITE_CONFIG,
  SSG_VIKE_DTS,
  SSG_CONSTANTS_MJS,
  SSG_PAGES_CONFIG,
  SSG_ON_RENDER_HTML,
  SSG_ON_RENDER_CLIENT,
  SSG_PAGE_TEMPLATE,
  SSG_HEAD_TEMPLATE,
  SSG_DATA_TEMPLATE,
  NPMRC_CONTENT,
  README_CONTENT,
} from "./templates";

const base = "@webstudio-is/sdk-components-react";
const reactRadix = "@webstudio-is/sdk-components-react-radix";
const animation = "@webstudio-is/sdk-components-animation";

/**
 * Build component metadata and import mappings
 */
const buildFrameworkMeta = (): {
  metas: Record<string, WsComponentMeta>;
  components: Record<string, string>;
  tags: Record<string, string>;
} => {
  const components: Record<string, string> = {};
  const metas: Record<string, WsComponentMeta> = {};

  for (const [name, meta] of Object.entries(baseComponentMetas) as [
    string,
    WsComponentMeta,
  ][]) {
    components[name] = `${base}:${name}`;
    metas[name] = meta;
  }
  for (const [name, meta] of Object.entries(radixComponentMetas) as [
    string,
    WsComponentMeta,
  ][]) {
    components[`${reactRadix}:${name}`] = `${reactRadix}:${name}`;
    metas[`${reactRadix}:${name}`] = meta;
  }
  for (const [name, meta] of Object.entries(animationComponentMetas) as [
    string,
    WsComponentMeta,
  ][]) {
    components[`${animation}:${name}`] = `${animation}:${name}`;
    metas[`${animation}:${name}`] = meta;
  }

  return {
    metas,
    components,
    tags: {
      textarea: `${base}:Textarea`,
      input: `${base}:Input`,
      select: `${base}:Select`,
    },
  };
};

/**
 * Generate Vike route path from page path
 */
const generateVikeRoute = (pagePath: string): string => {
  if (pagePath === "/") {
    return "index";
  }
  return pagePath;
};

/**
 * Calculate relative import path
 */
const importFrom = (importee: string, importer: string): string => {
  const importerParts = importer.split("/").slice(0, -1);
  const importeeParts = importee.split("/");

  // Find common prefix
  let commonLength = 0;
  while (
    commonLength < importerParts.length &&
    commonLength < importeeParts.length &&
    importerParts[commonLength] === importeeParts[commonLength]
  ) {
    commonLength++;
  }

  const upCount = importerParts.length - commonLength;
  const relativeParts = importeeParts.slice(commonLength);

  if (upCount === 0) {
    return "./" + relativeParts.join("/");
  }

  return "../".repeat(upCount) + relativeParts.join("/");
};

/**
 * Simple HTML to JSX converter for custom code
 * This is a simplified version - in production, use a proper parser
 */
const htmlToJsx = (html: string): string => {
  // Basic conversion - in real implementation, use proper HTML parser
  return html
    .replace(/class=/g, "className=")
    .replace(/for=/g, "htmlFor=")
    .replace(/<br>/g, "<br />")
    .replace(/<hr>/g, "<hr />")
    .replace(/<img([^>]*)>/g, "<img$1 />")
    .replace(/<input([^>]*)>/g, "<input$1 />")
    .replace(/<meta([^>]*)>/g, "<meta$1 />")
    .replace(/<link([^>]*)>/g, "<link$1 />");
};

/**
 * Generate a static site from build data
 */
export const generateStaticSite = async (
  buildData: BuildData,
  assetBaseUrl = "/assets/"
): Promise<StaticExportResult> => {
  const fs = new MemoryFileSystem();
  const framework = buildFrameworkMeta();

  // Write static template files
  fs.writeFile("package.json", SSG_PACKAGE_JSON);
  fs.writeFile("tsconfig.json", SSG_TSCONFIG);
  fs.writeFile("vite.config.ts", SSG_VITE_CONFIG);
  fs.writeFile("vike.d.ts", SSG_VIKE_DTS);
  fs.writeFile("app/constants.mjs", SSG_CONSTANTS_MJS);
  fs.writeFile("pages/+config.ts", SSG_PAGES_CONFIG);
  fs.writeFile("renderer/+onRenderHtml.tsx", SSG_ON_RENDER_HTML);
  fs.writeFile("renderer/+onRenderClient.tsx", SSG_ON_RENDER_CLIENT);
  fs.writeFile(".npmrc", NPMRC_CONTENT);
  fs.writeFile("README.md", README_CONTENT);

  const siteData = buildData;
  const usedMetas = new Map<Instance["component"], WsComponentMeta>(
    Object.entries(coreMetas)
  );
  const siteDataByPage: SiteDataByPage = {};
  const fontAssetsByPage: Record<Page["id"], string[]> = {};
  const backgroundImageAssetsByPage: Record<Page["id"], string[]> = {};

  // Normalize props
  const normalizedProps = normalizeProps({
    props: siteData.build.props.map(([_id, prop]) => prop),
    assetBaseUrl,
    assets: new Map(siteData.assets.map((asset) => [asset.id, asset])),
    uploadingImageAssets: [],
    pages: siteData.build.pages,
    source: "prebuild",
  });

  // Process each page
  for (const page of Object.values(siteData.pages)) {
    const instanceMap = new Map(siteData.build.instances);
    const pageInstanceSet = findTreeInstanceIds(
      instanceMap,
      page.rootInstanceId
    );
    pageInstanceSet.add(ROOT_INSTANCE_ID);

    // Collect used instances and metas
    const instances: [Instance["id"], Instance][] = [];
    for (const [_instanceId, instance] of siteData.build.instances) {
      if (pageInstanceSet.has(instance.id)) {
        instances.push([instance.id, instance]);
        const meta = framework.metas[instance.component];
        if (meta) {
          usedMetas.set(instance.component, meta);
        }
      }
    }

    const resourceIds = new Set<Resource["id"]>();
    const props: [Prop["id"], Prop][] = [];
    for (const prop of normalizedProps) {
      if (pageInstanceSet.has(prop.instanceId)) {
        props.push([prop.id, prop]);
        if (prop.type === "resource") {
          resourceIds.add(prop.value);
        }
      }
    }

    const dataSources: [DataSource["id"], DataSource][] = [];
    for (const [dataSourceId, dataSource] of siteData.build.dataSources) {
      if (pageInstanceSet.has(dataSource.scopeInstanceId ?? "")) {
        dataSources.push([dataSourceId, dataSource]);
        if (dataSource.type === "resource") {
          resourceIds.add(dataSource.resourceId);
        }
      }
    }

    const resources: [Resource["id"], Resource][] = [];
    for (const [resourceId, resource] of siteData.build.resources ?? []) {
      if (resourceIds.has(resourceId)) {
        resources.push([resourceId, resource]);
      }
    }

    siteDataByPage[page.id] = {
      build: {
        props,
        instances,
        dataSources,
        resources,
      },
      pages: Object.values(siteData.pages),
      page,
      assets: siteData.assets,
    };

    // Extract font and background image assets
    const styleSourceSelections = siteData.build?.styleSourceSelections ?? [];
    const pageStyleSourceIds = new Set(
      styleSourceSelections
        .filter(([, { instanceId }]) => pageInstanceSet.has(instanceId))
        .map(([, { values }]) => values)
        .flat()
    );

    const pageStyles = siteData.build?.styles?.filter(([, { styleSourceId }]) =>
      pageStyleSourceIds.has(styleSourceId)
    );

    // Extract fonts
    const pageFontFamilySet = new Set(
      pageStyles
        .filter(([, { property }]) => property === "fontFamily")
        .map(([, { value }]) =>
          value.type === "fontFamily" ? value.value : undefined
        )
        .flat()
        .filter(<T>(value: T): value is NonNullable<T> => value !== undefined)
    );

    const pageFontAssets = siteData.assets
      .filter((asset) => asset.type === "font")
      .filter((fontAsset) => pageFontFamilySet.has(fontAsset.meta.family))
      .map((asset) => asset.name);

    fontAssetsByPage[page.id] = pageFontAssets;

    // Extract background images
    const backgroundImageAssetIdSet = new Set(
      pageStyles
        .filter(([, { property }]) => property === "backgroundImage")
        .map(([, { value }]) => {
          if (value.type !== "layers") {
            return undefined;
          }
          return value.value.map((layer) => {
            if (layer.type !== "image") {
              return undefined;
            }
            if (layer.value.type !== "asset") {
              return undefined;
            }
            return layer.value.value;
          });
        })
        .flat()
        .filter(<T>(value: T): value is NonNullable<T> => value !== undefined)
    );

    const backgroundImageAssets = siteData.assets
      .filter((asset) => asset.type === "image")
      .filter((imageAsset) => backgroundImageAssetIdSet.has(imageAsset.id))
      .map((asset) => asset.name);

    backgroundImageAssetsByPage[page.id] = backgroundImageAssets;
  }

  // Generate CSS
  const assets = new Map(siteData.assets.map((asset) => [asset.id, asset]));
  const { cssText, classes } = generateCss({
    instances: new Map(siteData.build.instances),
    props: new Map(siteData.build.props),
    assets,
    breakpoints: new Map(siteData.build?.breakpoints),
    styles: new Map(siteData.build?.styles),
    styleSourceSelections: new Map(siteData.build?.styleSourceSelections),
    componentMetas: usedMetas,
    assetBaseUrl,
    atomic: siteData.build.pages.compiler?.atomicStyles ?? true,
  });

  fs.writeFile("app/__generated__/index.css", cssText);

  // Generate page components
  for (const page of Object.values(siteData.pages)) {
    const pagePath = getPagePath(page.id, siteData.build.pages);

    // Skip dynamic pages in static export
    if (isPathnamePattern(pagePath)) {
      continue;
    }

    const scope = createScope([
      "useState",
      "Fragment",
      "useResource",
      "useVariableState",
      "Page",
      "_props",
    ]);

    const pageData = siteDataByPage[page.id];
    const instances = new Map(pageData.build.instances);
    const documentType = page.meta.documentType ?? "html";
    let rootInstanceId = page.rootInstanceId;

    // Cleanup XML markup
    if (documentType === "xml") {
      const bodyInstance = instances.get(rootInstanceId);
      const firstChild = bodyInstance?.children.at(0);
      if (firstChild?.type === "id") {
        rootInstanceId = firstChild.value;
      }
      for (const instance of instances.values()) {
        if (isCoreComponent(instance.component)) {
          continue;
        }
        if (usedMetas.get(instance.component)?.category === "xml") {
          continue;
        }
        instances.delete(instance.id);
      }
    }

    // Generate component imports
    const imports = new Map<string, Map<string, string>>();
    for (const instance of instances.values()) {
      let descriptor = framework.components[instance.component];
      let id = instance.component;
      if (instance.component === elementComponent && instance.tag) {
        descriptor = framework.tags[instance.tag];
        id = descriptor;
      }
      if (descriptor === undefined) {
        continue;
      }
      const [importSource, importSpecifier] = descriptor.split(":");
      let specifiers = imports.get(importSource);
      if (specifiers === undefined) {
        specifiers = new Map();
        imports.set(importSource, specifiers);
      }
      specifiers.set(id, importSpecifier);
    }

    let importsString = "";
    for (const [importSource, specifiers] of imports) {
      const specifiersString = Array.from(specifiers)
        .map(
          ([id, importSpecifier]) =>
            `${importSpecifier} as ${scope.getName(id, importSpecifier)}`
        )
        .join(", ");
      importsString += `import { ${specifiersString} } from "${importSource}";\n`;
    }

    const pageFontAssets = fontAssetsByPage[page.id];
    const pageBackgroundImageAssets = backgroundImageAssetsByPage[page.id];

    const propsMap = new Map(pageData.build.props);
    const dataSourcesMap = new Map(pageData.build.dataSources);
    const resourcesMap = new Map(pageData.build.resources);

    replaceFormActionsWithResources({
      instances,
      resources: resourcesMap,
      props: propsMap,
    });

    const pageComponent = generateWebstudioComponent({
      scope,
      name: "Page",
      rootInstanceId,
      parameters: [
        {
          id: `page-system`,
          instanceId: "",
          name: "system",
          type: "parameter",
          value: page.systemDataSourceId ?? "",
        },
        {
          id: "global-system",
          type: "parameter",
          instanceId: "",
          name: "system",
          value: SYSTEM_VARIABLE_ID,
        },
      ],
      instances,
      props: propsMap,
      dataSources: dataSourcesMap,
      classesMap: classes,
      metas: usedMetas,
      tagsOverrides: framework.tags,
    });

    const projectMeta = siteData.build.pages.meta;
    const contactEmail: undefined | string =
      projectMeta?.contactEmail || siteData.user?.email || undefined;
    const favIconAsset = assets.get(projectMeta?.faviconAssetId ?? "")?.name;

    const breakpoints = siteData.build.breakpoints
      .map(([_, value]) => ({
        id: value.id,
        minWidth: value.minWidth,
        maxWidth: value.maxWidth,
      }))
      .sort(compareMedia);

    // Generate page exports (client-side)
    const pageExports = `/* eslint-disable */
/* This is a auto generated file for building the project */

import { Fragment, useState } from "react";
import { useResource, useVariableState } from "@webstudio-is/react-sdk/runtime";
${importsString}

export const projectId = "${siteData.build.projectId}";

export const lastPublished = "${new Date(siteData.build.createdAt).toISOString()}";

export const siteName = ${JSON.stringify(projectMeta?.siteName)};

export const breakpoints = ${JSON.stringify(breakpoints)};

export const favIconAsset: string | undefined =
  ${JSON.stringify(favIconAsset)};

// Font assets on current page (can be preloaded)
export const pageFontAssets: string[] =
  ${JSON.stringify(pageFontAssets)}

export const pageBackgroundImageAssets: string[] =
  ${JSON.stringify(pageBackgroundImageAssets)}

${
  pagePath === "/"
    ? `
${
  projectMeta?.code
    ? `
const Script = ({children, ...props}: Record<string, string | boolean>) => {
  if (children == null) {
    return <script {...props} />;
  }

  return <script {...props} dangerouslySetInnerHTML={{__html: children}} />;
};
const Style = ({children, ...props}: Record<string, string | boolean>) => {
  if (children == null) {
    return <style {...props} />;
  }

  return <style {...props} dangerouslySetInnerHTML={{__html: children}} />;
};
`
    : ""
}

export const CustomCode = () => {
  return (<>${projectMeta?.code ? htmlToJsx(projectMeta.code) : ""}</>);
}
`
    : ""
}

${pageComponent}

export { Page }
`;

    // Generate server exports
    const serverExports = `/* eslint-disable */
/* This is a auto generated file for building the project */

import type { PageMeta } from "@webstudio-is/sdk";
${generateResources({
  scope,
  page,
  dataSources: dataSourcesMap,
  props: propsMap,
  resources: resourcesMap,
})}

${generatePageMeta({
  globalScope: scope,
  page,
  dataSources: dataSourcesMap,
  assets,
})}

${generateRemixParams(page.path)}

export const contactEmail = ${JSON.stringify(contactEmail)};
`;

    const generatedBasename = generateRemixRoute(pagePath);
    fs.writeFile(`app/__generated__/${generatedBasename}.tsx`, pageExports);
    fs.writeFile(
      `app/__generated__/${generatedBasename}.server.tsx`,
      serverExports
    );

    // Generate Vike page files
    const vikeRoute = generateVikeRoute(pagePath);
    const clientPath = `app/__generated__/${generatedBasename}`;
    const serverPath = `app/__generated__/${generatedBasename}.server`;
    const constantsPath = "app/constants.mjs";
    const cssPath = "app/__generated__/index.css";

    const pageFile = `pages/${vikeRoute}/+Page.tsx`;
    const headFile = `pages/${vikeRoute}/+Head.tsx`;
    const dataFile = `pages/${vikeRoute}/+data.ts`;

    fs.writeFile(
      pageFile,
      SSG_PAGE_TEMPLATE.replaceAll(
        "__CONSTANTS__",
        importFrom(constantsPath, pageFile)
      ).replaceAll("__CLIENT__", importFrom(clientPath, pageFile))
    );

    fs.writeFile(
      headFile,
      SSG_HEAD_TEMPLATE.replaceAll(
        "__CONSTANTS__",
        importFrom(constantsPath, headFile)
      )
        .replaceAll("__CLIENT__", importFrom(clientPath, headFile))
        .replaceAll("__CSS__", importFrom(cssPath, headFile))
    );

    fs.writeFile(
      dataFile,
      SSG_DATA_TEMPLATE.replaceAll(
        "__SERVER__",
        importFrom(serverPath, dataFile)
      )
    );
  }

  // Generate sitemap
  fs.writeFile(
    "app/__generated__/$resources.sitemap.xml.ts",
    `export const sitemap = ${JSON.stringify(
      getStaticSiteMapXml(siteData.build.pages, siteData.build.updatedAt),
      null,
      2
    )};`
  );

  // Generate redirects
  const redirects = siteData.build.pages?.redirects;
  if (redirects !== undefined && redirects.length > 0) {
    for (const redirect of redirects) {
      const generatedBasename = generateRemixRoute(redirect.old);
      fs.writeFile(
        `app/__generated__/${generatedBasename}.ts`,
        `export const url = "${redirect.new}";
export const status = ${redirect.status ?? 301};`
      );
    }
  }

  // Create ZIP
  const zipBuffer = await createZipFromMemoryFS(fs);

  return {
    files: fs.listFiles(),
    zipBuffer,
  };
};
