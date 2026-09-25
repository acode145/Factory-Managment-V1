export const WORKSTATION_DEPARTMENTS = [
  "STORE",
  "EMBROIDERY",
  "CROPPING_AND_CUTTING",
  "FINISHING_AND_PACKAGING",
  // Legacy support for backward compatibility:
  "CROPPING",
  "CUTTING",
  "FINISHING",
  "PACKAGING",
] as const;

export type WorkstationDepartment = (typeof WORKSTATION_DEPARTMENTS)[number];

export const CONSOLIDATED_WORKSTATIONS: WorkstationDepartment[] = [
  "STORE",
  "EMBROIDERY",
  "CROPPING_AND_CUTTING",
  "FINISHING_AND_PACKAGING",
];

export const INTERNAL_WORKSTATION_DEPARTMENTS: WorkstationDepartment[] = [
  "STORE",
  "CROPPING_AND_CUTTING",
  "FINISHING_AND_PACKAGING",
];

export const DEPT_LABELS: Record<string, string> = {
  STORE: "Raw & Fabric Store",
  EMBROIDERY: "Embroidery (Machines)",
  CROPPING_AND_CUTTING: "Cropping & Cutting (Prep & Tables)",
  FINISHING_AND_PACKAGING: "Finishing & Packaging (QC, Press & Packing)",
  // Legacy aliases
  CROPPING: "Cropping & Cutting",
  CUTTING: "Cropping & Cutting",
  FINISHING: "Finishing & Packaging",
  PACKAGING: "Finishing & Packaging",
};
