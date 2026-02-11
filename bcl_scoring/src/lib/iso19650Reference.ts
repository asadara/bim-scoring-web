export type Iso19650ReferenceRow = {
  control_area: string;
  iso_reference: string;
  indicative_mapping: string;
};

export const ISO19650_REFERENCE_ONLY_LABEL = "Reference only — not a compliance claim";

export const ISO19650_REFERENCE_ROWS: Iso19650ReferenceRow[] = [
  {
    control_area: "Evidence Traceability",
    iso_reference: "ISO 19650-2 (information requirements and exchanges)",
    indicative_mapping: "Evidence linkage per indicator can help demonstrate traceable information exchange context.",
  },
  {
    control_area: "Review Governance",
    iso_reference: "ISO 19650-2 (information review and acceptance context)",
    indicative_mapping: "Role separation between project submitter and reviewer supports indicative governance alignment.",
  },
  {
    control_area: "Approval & Locking",
    iso_reference: "ISO 19650 principles for controlled information status transitions",
    indicative_mapping: "Period-level approval and lock provides an indicative status gate before final record issuance.",
  },
  {
    control_area: "Snapshot Record",
    iso_reference: "ISO 19650 information container lifecycle concepts (reference only)",
    indicative_mapping: "Immutable snapshot can be used as indicative historical record for internal audit trail.",
  },
];
