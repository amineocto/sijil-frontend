import { z } from "zod";
import type { Schemas } from "@/shared/api";

export interface ReviewForm {
  decision: "APPROVE" | "REQUEST_CHANGES";
  effectiveFrom: string;
  reason: string;
  comment: string;
}

/** Date du jour au format ISO (UTC, comme le catalogue). */
export function today(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Validation en ligne de la revue ; le catalogue reste juge (date, quatre yeux). */
export const reviewSchema = z
  .object({
    decision: z.enum(["APPROVE", "REQUEST_CHANGES"]),
    effectiveFrom: z.string(),
    reason: z.string().max(1000, "1 000 caractères au plus"),
    comment: z.string().max(4000, "4 000 caractères au plus"),
  })
  .superRefine((form, ctx) => {
    if (form.decision === "APPROVE" && !/^\d{4}-\d{2}-\d{2}$/.test(form.effectiveFrom)) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveFrom"],
        message: "Date d'effet obligatoire",
      });
    } else if (form.decision === "APPROVE" && form.effectiveFrom < today()) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveFrom"],
        message: "La date d'effet ne peut pas être passée",
      });
    }
    if (form.decision === "REQUEST_CHANGES" && form.reason.trim() === "") {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Motif obligatoire" });
    }
  })
  .transform((form): Schemas["Review"] =>
    form.decision === "APPROVE"
      ? {
          decision: "APPROVE",
          effectiveFrom: form.effectiveFrom,
          ...(form.comment.trim() ? { comment: form.comment.trim() } : {}),
        }
      : {
          decision: "REQUEST_CHANGES",
          reason: form.reason.trim(),
          ...(form.comment.trim() ? { comment: form.comment.trim() } : {}),
        },
  );
