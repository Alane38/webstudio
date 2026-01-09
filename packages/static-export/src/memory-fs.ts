import type { VirtualFile } from "./types";

/**
 * In-memory file system for generating static site files without disk I/O
 */
export class MemoryFileSystem {
  private files: Map<string, VirtualFile> = new Map();

  /**
   * Write a file to the virtual file system
   */
  writeFile(path: string, content: string | Uint8Array): void {
    const normalizedPath = this.normalizePath(path);
    this.files.set(normalizedPath, {
      path: normalizedPath,
      content,
    });
  }

  /**
   * Read a file from the virtual file system
   */
  readFile(path: string): string | Uint8Array | undefined {
    const normalizedPath = this.normalizePath(path);
    return this.files.get(normalizedPath)?.content;
  }

  /**
   * Check if a file exists
   */
  exists(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    return this.files.has(normalizedPath);
  }

  /**
   * Delete a file
   */
  deleteFile(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    return this.files.delete(normalizedPath);
  }

  /**
   * List all files
   */
  listFiles(): VirtualFile[] {
    return Array.from(this.files.values());
  }

  /**
   * List files matching a pattern (simple glob support)
   */
  listFilesMatching(pattern: string): VirtualFile[] {
    const regex = this.globToRegex(pattern);
    return this.listFiles().filter((file) => regex.test(file.path));
  }

  /**
   * Get all files as a Map
   */
  getFilesMap(): Map<string, VirtualFile> {
    return new Map(this.files);
  }

  /**
   * Clear all files
   */
  clear(): void {
    this.files.clear();
  }

  /**
   * Get total size of all files in bytes
   */
  getTotalSize(): number {
    let total = 0;
    for (const file of this.files.values()) {
      if (typeof file.content === "string") {
        total += new TextEncoder().encode(file.content).length;
      } else {
        total += file.content.length;
      }
    }
    return total;
  }

  /**
   * Normalize path by removing leading slashes and ./
   */
  private normalizePath(path: string): string {
    return path.replace(/^\.?\//, "").replace(/\\/g, "/");
  }

  /**
   * Convert glob pattern to regex
   */
  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "{{DOUBLE_STAR}}")
      .replace(/\*/g, "[^/]*")
      .replace(/{{DOUBLE_STAR}}/g, ".*");
    return new RegExp(`^${escaped}$`);
  }
}
