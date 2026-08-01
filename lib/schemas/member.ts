import { z } from "zod";

// Most fields are required at registration — a member with gaps in their
// identity/location/next-of-kin record is exactly the kind of incomplete
// data that makes loan risk assessment and recovery unreliable later. Only
// fields with a real reason to be absent (email, employer for the
// self-employed, finer address detail beyond district) stay optional.
export const memberSchema = z.object({
  firstName: z.string({ message: "First name is required" }).min(1, "First name is required").max(60),
  lastName: z.string({ message: "Last name is required" }).min(1, "Last name is required").max(60),
  phone: z.string({ message: "Phone number is required" }).regex(/^\+256\d{9}$/, "Enter a valid Uganda phone number"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  nin: z.string({ message: "National ID number is required" }).min(4, "National ID number is required").max(20),
  dob: z.coerce.date({ message: "Date of birth is required" }),
  gender: z.enum(["Male", "Female"], { message: "Gender is required" }),
  occupation: z.string({ message: "Occupation is required" }).min(1, "Occupation is required").max(80),
  employer: z.string().max(120).optional().or(z.literal("")),
  district: z.string({ message: "District is required" }).min(1, "District is required").max(80),
  subCounty: z.string().max(80).optional().or(z.literal("")),
  village: z.string().max(80).optional().or(z.literal("")),
  nextOfKinName: z.string({ message: "Next of kin name is required" }).min(2, "Next of kin name is required").max(120),
  nextOfKinPhone: z.string({ message: "Next of kin phone is required" }).regex(/^\+256\d{9}$/, "Enter a valid Uganda phone number"),
  emergencyContact: z.string().max(20).optional().or(z.literal("")),
  branchId: z.string().min(1, "Branch is required"),
  photoUrl: z.string({ message: "A passport photo is required" }).url("A passport photo is required"),
  signatureUrl: z.string({ message: "A signature is required" }).url("A signature is required"),
});

export type MemberInput = z.infer<typeof memberSchema>;

export const memberStatusSchema = z.object({
  status: z.enum(["Active", "Inactive", "Suspended"]),
});
