import { z } from "zod";

// These schemas are used in TWO places:
//   1. in the browser, as the React Hook Form resolver (instant inline errors), and
//   2. on the server, inside the API route (never trust the browser).
// Sharing them means one set of rules, and the same error messages in both places.

export const sourceUrlSchema = z.string().superRefine((val, ctx) => {
  if (!val.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Source URL is required",
    });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(val);
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "Enter a valid URL",
    });
    return;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    ctx.addIssue({
      code: "custom",
      message: "Only http and https URLs are supported",
    });
    return;
  }

  const pathname = parsed.pathname.replace(/\/+$/, "");
  if (!pathname) {
    ctx.addIssue({
      code: "custom",
      message: "URL must include a file path",
    });
    return;
  }
});

export const createJobSchema = z.object({
  sourceUrl: sourceUrlSchema,
  title: z
    .string()
    .trim()
    .max(80, "Keep the title under 80 characters")
    .optional()
    .or(z.literal("")),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;

// Provided, and already used by the working sign-in page. Read it as a reference for the style
// we're after in sourceUrlSchema.
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const startRunSchema = z.object({
  jobId: z.string().min(1, "jobId is required"),
});
