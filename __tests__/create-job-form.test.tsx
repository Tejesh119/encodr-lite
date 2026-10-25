import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateJobForm } from "@/components/create-job-form";
import { api, ApiError } from "@/lib/client/api";
import type { Job } from "@/lib/types";

const mockJob: Job = {
  id: "j_test123",
  title: "Test Job",
  sourceUrl: "https://cdn.example.com/videos/clip.mp4",
  status: "NEW",
  createdAt: "2026-10-25T00:00:00.000Z",
};

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CreateJobForm />
    </QueryClientProvider>,
  );
}

describe("CreateJobForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an error and does not call the API when submitting with an invalid URL", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue(mockJob);
    const user = userEvent.setup();

    renderForm();

    const urlInput = screen.getByLabelText(/source url/i);
    await user.type(urlInput, "not a url");
    await user.click(screen.getByRole("button", { name: /create job/i }));

    expect(await screen.findByText("Enter a valid URL")).toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("shows an error and does not call the API when submitting with an empty URL", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue(mockJob);
    const user = userEvent.setup();

    renderForm();

    await user.click(screen.getByRole("button", { name: /create job/i }));

    expect(await screen.findByText("Source URL is required")).toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("calls api.post with correct payload and resets the form on successful submission", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue(mockJob);
    const user = userEvent.setup();

    renderForm();

    const urlInput = screen.getByLabelText(/source url/i);
    await user.type(urlInput, "https://cdn.example.com/videos/clip.mp4");
    await user.click(screen.getByRole("button", { name: /create job/i }));

    expect(postSpy).toHaveBeenCalledWith("/api/jobs", {
      sourceUrl: "https://cdn.example.com/videos/clip.mp4",
      title: "",
    });
    expect(await screen.findByLabelText(/source url/i)).toHaveValue("");
  });

  it("maps 422 fieldErrors from server back onto the form field", async () => {
    const serverError = new ApiError(422, "Validation failed", {
      sourceUrl: ["Server rejected this media URL"],
    });
    vi.spyOn(api, "post").mockRejectedValue(serverError);
    const user = userEvent.setup();

    renderForm();

    const urlInput = screen.getByLabelText(/source url/i);
    await user.type(urlInput, "https://cdn.example.com/videos/clip.mp4");
    await user.click(screen.getByRole("button", { name: /create job/i }));

    expect(await screen.findByText("Server rejected this media URL")).toBeInTheDocument();
  });
});
