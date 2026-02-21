export const GATE_C_ALIGNMENT_CONFIG = {
  default_status: {
    active: "optional",
    inactive: "excluded",
  },
  compare_project_codes: ["PJU", "MRT", "HSP"],
  expected_alignment: [
    {
      indicator_code: "P3-09",
      expected_presence: ["HSP"],
      note: "Expected difference: healthcare project validates federation health more strictly.",
    },
    {
      indicator_code: "P5-05",
      expected_presence: ["MRT", "PJU"],
      note: "Expected difference: transport and road projects emphasize 4D-based schedule risk tracking.",
    },
  ],
  global_notes: [
    "Gate C is alignment-only: no impact to existing score output.",
    "Indicator differences are accepted when linked to BIM Use context.",
    "Potential misalignment is a flag for review, not an automatic error.",
  ],
  projects: {
    PJU: {
      display_name: "Project Jalan Utama",
      bim_uses: ["Coordination", "Quantity take-off", "4D planning"],
      alignment_notes: [
        "Coordination and progress tracking prioritized for linear infrastructure.",
        "Digital handover requirements follow owner policy for roads.",
      ],
      indicator_overrides: {
        "P1-01": { status: "core", perspective_id: "P1", title: "Governance baseline" },
        "P2-03": { status: "core", perspective_id: "P2", title: "Coordination workflow compliance" },
        "P5-05": { status: "optional", perspective_id: "P5", title: "4D-based schedule risk identification" },
        "P3-09": {
          status: "excluded",
          perspective_id: "P3",
          title: "Federation health verification",
          reason: "Excluded by design for non-healthcare project type.",
        },
      },
    },
    MRT: {
      display_name: "Project MRT Corridor",
      bim_uses: ["Coordination", "4D planning", "Risk-based construction sequencing"],
      alignment_notes: [
        "Transit interface coordination requires strong P2 process controls.",
        "Safety and staging constraints drive sequencing indicators.",
      ],
      indicator_overrides: {
        "P1-01": { status: "core", perspective_id: "P1", title: "Governance baseline" },
        "P2-03": { status: "core", perspective_id: "P2", title: "Coordination workflow compliance" },
        "P5-05": { status: "core", perspective_id: "P5", title: "4D-based schedule risk identification" },
      },
    },
    HSP: {
      display_name: "Project Hospital Expansion",
      bim_uses: ["Coordination", "Information quality assurance", "Digital handover readiness"],
      alignment_notes: [
        "Information reliability is critical for operational facility handover.",
        "Asset information requirements require stricter quality indicators.",
      ],
      indicator_overrides: {
        "P1-01": { status: "core", perspective_id: "P1", title: "Governance baseline" },
        "P3-09": { status: "core", perspective_id: "P3", title: "Federation health verification" },
        "P5-05": {
          status: "excluded",
          perspective_id: "P5",
          title: "4D-based schedule risk identification",
          reason: "Excluded by design for single-campus operational handover model.",
        },
      },
    },
  },
};
