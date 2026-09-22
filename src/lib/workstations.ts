export const WORKSTATION_DEPARTMENTS = [
  "STORE",
  "EMBROIDERY",
  "CROPPING",
  "CUTTING",
  "FINISHING",
  "PACKAGING",
] as const;

export type WorkstationDepartment = (typeof WORKSTATION_DEPARTMENTS)[number];
