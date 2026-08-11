import { z } from "zod";

/** Zod schema for creating a new part */
export const CreatePartSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(50),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional().nullable(),
  category: z.string().max(50).default("General"),
  unit: z.string().max(20).default("pcs"),
  price: z.number().min(0, "Price must be non-negative").default(0),
  min_stock: z.number().int().min(0).default(0),
  lead_days: z.number().int().min(0).default(30),
});

/** Zod schema for updating an existing part */
export const UpdatePartSchema = z.object({
  sku: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  category: z.string().max(50).optional(),
  unit: z.string().max(20).optional(),
  price: z.number().min(0).optional(),
  min_stock: z.number().int().min(0).optional(),
  lead_days: z.number().int().min(0).optional(),
});

/** Zod schema for creating a new location */
export const CreateLocationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.string().min(1, "Type is required").max(50),
  capacity: z.number().int().min(1).default(1000),
});

/** Zod schema for updating an existing location */
export const UpdateLocationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.string().min(1).max(50).optional(),
  capacity: z.number().int().min(1).optional(),
});

/** Zod schema for receiving stock */
export const ReceiveStockSchema = z.object({
  part_id: z.number().int().positive("Part ID is required"),
  location_id: z.number().int().positive("Location ID is required"),
  lot_number: z.string().min(1, "Lot number is required").max(100),
  date_code: z.string().max(50).optional().nullable(),
  received_date: z.string().optional(),
  expiry_date: z.string().optional().nullable(),
  quantity: z.number().int().positive("Quantity must be positive"),
  user_id: z.number().int().positive(),
  notes: z.string().optional().nullable(),
});

/** Zod schema for issuing stock (FEFO) */
export const IssueStockSchema = z.object({
  part_id: z.number().int().positive("Part ID is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  lot_id: z.number().int().positive().optional().nullable(),
  from_location_id: z.number().int().positive().optional().nullable(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  user_id: z.number().int().positive(),
});

/** Zod schema for login */
export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type CreatePartInput = z.infer<typeof CreatePartSchema>;
export type UpdatePartInput = z.infer<typeof UpdatePartSchema>;
export type CreateLocationInput = z.infer<typeof CreateLocationSchema>;
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>;
export type ReceiveStockInput = z.infer<typeof ReceiveStockSchema>;
export type IssueStockInput = z.infer<typeof IssueStockSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
