import JSZip from "jszip";
import type { VirtualFile } from "./types";

/**
 * Create a ZIP archive from virtual files
 */
export const createZipFromFiles = async (
  files: VirtualFile[],
  rootFolder?: string
): Promise<Uint8Array> => {
  const zip = new JSZip();

  for (const file of files) {
    const filePath = rootFolder ? `${rootFolder}/${file.path}` : file.path;

    if (typeof file.content === "string") {
      zip.file(filePath, file.content);
    } else {
      zip.file(filePath, file.content);
    }
  }

  const buffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return buffer;
};

/**
 * Create a ZIP archive from a MemoryFileSystem instance
 */
export const createZipFromMemoryFS = async (
  fs: { listFiles(): VirtualFile[] },
  rootFolder?: string
): Promise<Uint8Array> => {
  return createZipFromFiles(fs.listFiles(), rootFolder);
};
