import type { LoaderFunctionArgs } from "@remix-run/server-runtime";
import { createContext } from "~/shared/context.server";
import { loadProductionCanvasData } from "~/shared/db";
import {
  generateStaticSite,
  type BuildData,
} from "@webstudio-is/static-export";
import { preventCrossOriginCookie } from "~/services/no-cross-origin-cookie";

/**
 * Find the build ID from the zip filename
 * The filename format is: {projectId}-{nanoid}.zip
 * We need to find the build that has this name in its deployment
 */
const findBuildIdByName = async (
  name: string,
  context: Awaited<ReturnType<typeof createContext>>
): Promise<string | null> => {
  // Query the Build table to find a build with this deployment name
  const result = await context.postgrest.client
    .from("Build")
    .select("id, deployment")
    .not("deployment", "is", null)
    .limit(100);

  if (result.error) {
    console.error("Error finding build:", result.error);
    return null;
  }

  // Find the build with matching deployment name
  for (const build of result.data) {
    try {
      const deployment = JSON.parse(build.deployment as string);
      if (deployment.destination === "static" && deployment.name === name) {
        return build.id;
      }
    } catch {
      // Skip builds with invalid deployment JSON
    }
  }

  return null;
};

/**
 * Convert canvas data to BuildData format for the generator
 */
const convertToBuildData = (
  canvasData: Awaited<ReturnType<typeof loadProductionCanvasData>>
): BuildData => {
  const pages: Record<string, typeof canvasData.page> = {};
  for (const page of canvasData.pages) {
    pages[page.id] = page;
  }

  return {
    build: {
      projectId: canvasData.build.projectId,
      createdAt: canvasData.build.createdAt,
      updatedAt: canvasData.build.updatedAt,
      instances: canvasData.build.instances as BuildData["build"]["instances"],
      props: canvasData.build.props as BuildData["build"]["props"],
      dataSources: canvasData.build
        .dataSources as BuildData["build"]["dataSources"],
      resources: canvasData.build.resources as BuildData["build"]["resources"],
      breakpoints: canvasData.build
        .breakpoints as BuildData["build"]["breakpoints"],
      styles: canvasData.build.styles as BuildData["build"]["styles"],
      styleSources: canvasData.build
        .styleSources as BuildData["build"]["styleSources"],
      styleSourceSelections: canvasData.build
        .styleSourceSelections as BuildData["build"]["styleSourceSelections"],
      pages: canvasData.build.pages,
      deployment: canvasData.build.deployment,
    },
    pages,
    assets: canvasData.assets,
  };
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  // Allow access from builder (static export is initiated from the builder UI)
  // No dashboard restriction needed here since the user must be authenticated
  // and have access to the project to trigger the export

  preventCrossOriginCookie(request);

  const name = params.name;
  if (!name) {
    throw new Response("Name is required", { status: 400 });
  }

  // Ensure the name ends with .zip
  const zipName = name.endsWith(".zip") ? name : `${name}.zip`;

  try {
    const context = await createContext(request);

    // Find the build ID from the name
    const buildId = await findBuildIdByName(zipName, context);

    if (!buildId) {
      throw new Response("Build not found", { status: 404 });
    }

    // Load the build data
    const canvasData = await loadProductionCanvasData(buildId, context);

    // Convert to BuildData format
    const buildData = convertToBuildData(canvasData);

    // Generate the static site
    const result = await generateStaticSite(buildData);

    // Note: Build status is already set to PUBLISHED by domain.ts
    // when the static export is initiated

    // Return the ZIP file
    // Convert Uint8Array to Buffer for proper Response handling
    const buffer = Buffer.from(result.zipBuffer);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    console.error("Error generating static site:", error);

    if (error instanceof Response) {
      throw error;
    }

    throw new Response(
      error instanceof Error ? error.message : "Unknown error",
      { status: 500 }
    );
  }
};
