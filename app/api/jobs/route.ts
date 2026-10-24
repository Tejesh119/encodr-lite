import { json, readJson, validationError, withAuth } from "@/lib/server/http";
import { createJobSchema } from "@/lib/schemas";
import { createJob, listJobs } from "@/lib/server/store";

export async function GET(req: Request) {
  return withAuth(req, () => json(listJobs()));
}

export async function POST(req: Request) {
  return withAuth(req, async () => {
    const body = await readJson(req);
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const job = createJob(parsed.data);
    return json(job, 201);
  });
}
