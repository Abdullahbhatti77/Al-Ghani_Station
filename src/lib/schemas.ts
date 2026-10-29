import { z } from "zod";

// Messages are translation keys, rendered through FormField.
export const emailSchema = z.string().trim().min(1, "validation.required").email("validation.email").max(255);
export const passwordSchema = z.string().min(8, "validation.passwordMin").max(72);

export const stationSchema = z.object({
  name: z.string().trim().min(2, "validation.min2").max(120),
  city: z.string().trim().min(2, "validation.min2").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{6,18}$/, "validation.phone"),
  language: z.enum(["en", "ur"]),
});
export type StationForm = z.infer<typeof stationSchema>;
