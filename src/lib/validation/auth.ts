import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ message: "Enter a valid email address." }),
  password: z.string().min(1, "Password is required."),
});

export const registerSchema = z.object({
  token: z.string().min(1, "Invite token required."),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters.")
    .max(128, "Password is too long."),
  displayName: z
    .string()
    .min(1, "Name is required.")
    .max(100, "Name is too long."),
});

export const forgotPasswordSchema = z.object({
  email: z.email({ message: "Enter a valid email address." }),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(12, "Password must be at least 12 characters.")
    .max(128, "Password is too long."),
});
