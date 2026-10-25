"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/client/api";
import { useCreateJob } from "@/lib/client/hooks";
import { createJobSchema, type CreateJobInput } from "@/lib/schemas";

function isCreateJobField(field: string): field is keyof CreateJobInput {
  return field === "sourceUrl" || field === "title";
}

export function CreateJobForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const createJob = useCreateJob();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      sourceUrl: "",
      title: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await createJob.mutateAsync(values);
      reset();
    } catch (err) {
      let fieldErrorMapped = false;

      if (err instanceof ApiError && err.fieldErrors) {
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          if (isCreateJobField(field) && messages && messages.length > 0) {
            setError(field, { message: messages[0] });
            fieldErrorMapped = true;
          }
        }
      }

      if (!fieldErrorMapped) {
        setFormError(err instanceof Error ? err.message : "Failed to create job");
      }
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="sourceUrl" className="mb-1 block text-sm font-medium">
          Source URL
        </label>
        <input
          id="sourceUrl"
          {...register("sourceUrl")}
          type="url"
          placeholder="https://cdn.example.com/videos/clip.mp4"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {errors.sourceUrl && (
          <p className="mt-1 text-xs text-red-600">{errors.sourceUrl.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium">
          Title (optional)
        </label>
        <input
          id="title"
          {...register("title")}
          type="text"
          placeholder="Leave blank to derive from URL"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {errors.title && (
          <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
        )}
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? "Creating…" : "Create job"}
      </button>
    </form>
  );
}
