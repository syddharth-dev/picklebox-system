import { z } from "zod";

export const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your full name.").max(120, "Use 120 characters or fewer for your name."),
  phone: z.string().trim().refine((value) => !value || (/^\+?[\d\s().-]+$/.test(value) && value.replace(/\D/g, "").length >= 7 && value.replace(/\D/g, "").length <= 15), "Enter a valid phone number with 7 to 15 digits."),
});
