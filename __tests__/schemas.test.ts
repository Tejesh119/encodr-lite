import { describe, expect, it } from "vitest";
import { sourceUrlSchema } from "@/lib/schemas";

describe("sourceUrlSchema", () => {
  it("accepts valid http and https URLs with a file path", () => {
    const validUrls = [
      "https://cdn.example.com/videos/clip.mp4",
      "http://media.example.com/a/b/movie.mov",
    ];

    for (const url of validUrls) {
      const result = sourceUrlSchema.safeParse(url);
      expect(result.success).toBe(true);
    }
  });

  it("rejects an empty string with exactly one error message", () => {
    const result = sourceUrlSchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].message).toBe("Source URL is required");
    }
  });

  it("rejects strings that are not valid URLs", () => {
    const result = sourceUrlSchema.safeParse("not a url");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].message).toBe("Enter a valid URL");
    }
  });

  it("rejects protocols other than http and https", () => {
    const result = sourceUrlSchema.safeParse("ftp://cdn.example.com/clip.mp4");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].message).toBe("Only http and https URLs are supported");
    }
  });

  it("rejects URLs without a path", () => {
    const noPathUrls = ["https://cdn.example.com", "https://cdn.example.com/"];

    for (const url of noPathUrls) {
      const result = sourceUrlSchema.safeParse(url);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].message).toBe("URL must include a file path");
      }
    }
  });
});
