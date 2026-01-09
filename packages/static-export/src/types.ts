import type {
  Instance,
  Prop,
  Page,
  DataSource,
  Deployment,
  Asset,
  Resource,
  Breakpoint,
  StyleSource,
  StyleSourceSelection,
  StyleDecl,
  Pages,
} from "@webstudio-is/sdk";

export interface VirtualFile {
  path: string;
  content: string | Uint8Array;
}

export interface BuildData {
  build: {
    projectId: string;
    createdAt: string;
    updatedAt: string;
    instances: [Instance["id"], Instance][];
    props: [Prop["id"], Prop][];
    dataSources: [DataSource["id"], DataSource][];
    resources: [Resource["id"], Resource][];
    breakpoints: [Breakpoint["id"], Breakpoint][];
    styles: [string, StyleDecl][];
    styleSources: [StyleSource["id"], StyleSource][];
    styleSourceSelections: [Instance["id"], StyleSourceSelection][];
    pages: Pages;
    deployment?: Deployment;
  };
  pages: Record<Page["id"], Page>;
  assets: Asset[];
  origin?: string;
  user?: { email: string | null };
}

export interface StaticExportOptions {
  buildData: BuildData;
  assetBaseUrl?: string;
  includeAssets?: boolean;
}

export interface StaticExportResult {
  files: VirtualFile[];
  zipBuffer: Uint8Array;
}

export interface PageData {
  page: Page;
  build: {
    props: [Prop["id"], Prop][];
    instances: [Instance["id"], Instance][];
    dataSources: [DataSource["id"], DataSource][];
    resources: [Resource["id"], Resource][];
  };
  assets: Asset[];
  pages: Page[];
}

export type SiteDataByPage = Record<Page["id"], PageData>;
