/**
 * Seeded example — "Helping without boundaries".
 * All biblical text is original curator summary; no copyrighted
 * translation is reproduced. References only.
 */
import type {
  BiblicalArchetype,
  FormationEvent,
  PersonaFact,
  Practice,
  Prayer,
  Session,
  SourcePassage,
  WisdomResponse,
  PatternHypothesis,
} from "../schemas";

/* ── Passages (references + curator summaries only) ─────────────── */

const p_num11: SourcePassage = {
  id: "p_num11",
  reference: "Numbers 11:10–17",
  translationNote: "Founder default profile · reference only",
  tier: "S1_canonical_direct",
  curatorSummary:
    "Moses, overwhelmed by carrying the people alone, speaks honestly to God about his inability. God's response is not rebuke but distribution — the burden is shared among seventy elders.",
};

const p_gal6: SourcePassage = {
  id: "p_gal6",
  reference: "Galatians 6:2, 5",
  translationNote: "Founder default profile · reference only",
  tier: "S1_canonical_direct",
  curatorSummary:
    "Paul holds two verbs in tension: carry one another's crushing weights, and yet each person carries their own ordinary load. Help is a share, not a substitution.",
};

const p_neh2: SourcePassage = {
  id: "p_neh2",
  reference: "Nehemiah 2:4–5",
  translationNote: "Founder default profile · reference only",
  tier: "S1_canonical_direct",
  curatorSummary:
    "Before answering a king, Nehemiah pauses to pray. A short interior prayer precedes his commitment. Yes is not the first word.",
};

const p_ps51: SourcePassage = {
  id: "p_ps51",
  reference: "Psalm 51:6, 10",
  translationNote: "Founder default profile · reference only",
  tier: "S1_canonical_direct",
  curatorSummary:
    "David asks for truth in the inward parts and a renewed steady spirit — cleansing that goes underneath behavior to motive.",
};

const p_ps139: SourcePassage = {
  id: "p_ps139",
  reference: "Psalm 139:23–24",
  translationNote: "Founder default profile · reference only",
  tier: "S1_canonical_direct",
  curatorSummary:
    "The psalmist invites God to search the heart and to lead in the way everlasting — self-examination handed to God rather than performed alone.",
};

const p_lk10: SourcePassage = {
  id: "p_lk10",
  reference: "Luke 10:38–42",
  translationNote: "Founder default profile · reference only",
  tier: "S1_canonical_direct",
  curatorSummary:
    "Martha's distracted service, though sincere, is named as anxious and driven. Jesus honors the quieter attention that comes first.",
};

const p_founder1: SourcePassage = {
  id: "p_founder1",
  reference: "Founder framework · Companion vs Substitute",
  translationNote: "Founder authored — labeled as founder interpretation",
  tier: "S6_founder_framework",
  curatorSummary:
    "The founder distinguishes companion generosity (proportionate, prayerful, boundaried) from substitute generosity (taking on what belongs to another's own load in order to secure belonging).",
};

/* ── Archetypes ──────────────────────────────────────────────────── */

export const archetype_moses_overload: BiblicalArchetype = {
  id: "arch_moses_overload",
  person: "Moses",
  headline: "Overload and honest limitation",
  narrativeSummary:
    "Moses carries a load that was never designed for one person. He does not perform strength; he tells God plainly he cannot continue this way. The answer is not more willpower — it is redistribution.",
  eventChain: [
    "People bring their needs",
    "Burden concentrates on one leader",
    "Moses names his inability to God",
    "God directs shared responsibility",
  ],
  prayerMovements: ["truth", "request", "surrender"],
  practiceMovements: ["shared responsibility", "honest limitation"],
  primaryPassages: [p_num11],
  descriptiveOrPrescriptive: "mixed",
  curatorStatus: "approved",
};

export const archetype_martha_service: BiblicalArchetype = {
  id: "arch_martha_service",
  person: "Martha",
  headline: "Anxious service that displaces presence",
  narrativeSummary:
    "Martha's serving is real hospitality, not vice. But it grows anxious and driven, and it begins to resent the person who is not doing what she is doing. Presence, Jesus says, is not a lower priority than service.",
  eventChain: [
    "Genuine welcome",
    "Serving intensifies",
    "Attention narrows to what is undone",
    "Resentment surfaces",
    "Reordering invited",
  ],
  prayerMovements: ["truth", "surrender", "gratitude"],
  practiceMovements: ["boundary", "presence"],
  primaryPassages: [p_lk10],
  descriptiveOrPrescriptive: "descriptive",
  curatorStatus: "approved",
};

export const archetype_nehemiah_pause: BiblicalArchetype = {
  id: "arch_nehemiah_pause",
  person: "Nehemiah",
  headline: "Pause-before-yes prayer",
  narrativeSummary:
    "Before answering a powerful request, Nehemiah prays a short, interior prayer. The pause reorders his yes so that commitment follows discernment rather than pressure.",
  eventChain: ["Request lands", "Short interior prayer", "Considered answer", "Follow-through"],
  prayerMovements: ["truth", "request"],
  practiceMovements: ["pause before yes"],
  primaryPassages: [p_neh2],
  descriptiveOrPrescriptive: "mixed",
  curatorStatus: "approved",
};

export const archetype_david_ps51: BiblicalArchetype = {
  id: "arch_david_ps51",
  person: "David",
  headline: "Truth in the inward parts",
  narrativeSummary:
    "David asks for cleansing that reaches below behavior to motive, and for a steady spirit that is renewed rather than merely restarted.",
  eventChain: [
    "Behavior surfaces motive",
    "Honesty before God",
    "Request for renewal underneath",
  ],
  prayerMovements: ["truth", "confession", "request"],
  practiceMovements: ["self-examination"],
  primaryPassages: [p_ps51, p_ps139],
  descriptiveOrPrescriptive: "mixed",
  curatorStatus: "approved",
};

export const ARCHETYPE_INDEX: Record<string, BiblicalArchetype> = {
  [archetype_moses_overload.id]: archetype_moses_overload,
  [archetype_martha_service.id]: archetype_martha_service,
  [archetype_nehemiah_pause.id]: archetype_nehemiah_pause,
  [archetype_david_ps51.id]: archetype_david_ps51,
};

export const PASSAGE_INDEX: Record<string, SourcePassage> = {
  [p_num11.id]: p_num11,
  [p_gal6.id]: p_gal6,
  [p_neh2.id]: p_neh2,
  [p_ps51.id]: p_ps51,
  [p_ps139.id]: p_ps139,
  [p_lk10.id]: p_lk10,
  [p_founder1.id]: p_founder1,
};

/* ── Session with user story ─────────────────────────────────────── */

export const seededSession: Session = {
  id: "sess_helping_boundaries",
  title: "Helping again, and feeling used again",
  intent: "understand_pattern",
  depth: "deep",
  createdAt: "2026-07-14T09:20:00.000Z",
  messages: [
    {
      id: "msg_1",
      role: "user",
      createdAt: "2026-07-14T09:20:00.000Z",
      text:
        "It happened again. A friend asked to borrow money and I said yes before I even thought about it. Now I'm short on rent this month, and quietly angry at him. The strange part — I felt loved for a moment when I handed it over. This is the fourth time this year, across three different people. I don't know if I'm generous or afraid.",
    },
    {
      id: "msg_2",
      role: "user",
      createdAt: "2026-07-14T09:22:00.000Z",
      text:
        "I've prayed about generosity a lot. I don't want to become stingy. But something is off. When I try to say no, I feel like I'm failing at being a Christian.",
    },
  ],
};

/* ── Hypotheses ──────────────────────────────────────────────────── */

const hyp_primary: PatternHypothesis = {
  id: "hyp_helping_without_boundaries",
  name: "Helping without boundaries",
  description:
    "Generosity that arrives before discernment. The yes is often driven by an unspoken need to secure belonging, so it repeats even when the cost is disproportionate.",
  status: "proposed",
  confidence: 0.72,
  hiddenAgreementCandidate:
    "If I always say yes, I will be loved and not abandoned.",
  domains: ["money", "friendship", "identity", "faith practice"],
  evidenceSignalIds: ["sig_1", "sig_2", "sig_3", "sig_4", "sig_5"],
  counterOrMissingEvidence: [
    "It is not yet clear which relationships trigger this most strongly, or whether it happens with family in the same way.",
    "It is not yet clear whether the immediate warmth after giving comes from relief, from felt belonging, or from a specific memory.",
  ],
  distinguishingQuestion:
    "When you have said no to a request recently — even in a small way — what did you feel in the first thirty seconds after?",
  archetypes: [
    {
      archetypeId: archetype_moses_overload.id,
      whyThisConnection:
        "Like Moses, the load is real but was never meant to be carried alone or in this shape. Honest limitation before God is not failure; it is the entry point to redistribution.",
      fitScore: 0.78,
    },
    {
      archetypeId: archetype_nehemiah_pause.id,
      whyThisConnection:
        "Nehemiah's short pause-before-yes gives a scriptural pattern for reordering a reflex yes into a discerned yes — without becoming stingy.",
      fitScore: 0.71,
    },
    {
      archetypeId: archetype_martha_service.id,
      whyThisConnection:
        "Martha's service is genuine hospitality that grows anxious. The pattern is not that helping is wrong, but that helping can carry unspoken demands and quiet resentment.",
      fitScore: 0.62,
    },
  ],
};

const hyp_alt: PatternHypothesis = {
  id: "hyp_belonging_through_giving",
  name: "Belonging through giving",
  description:
    "The behavior looks like generosity, but the underlying transaction is belonging. Money is the currency used to buy a place at the table.",
  status: "proposed",
  confidence: 0.54,
  hiddenAgreementCandidate:
    "If I stop giving, I will lose my place among these friends.",
  domains: ["identity", "friendship", "money"],
  evidenceSignalIds: ["sig_2", "sig_4", "sig_5"],
  counterOrMissingEvidence: [
    "Would need to hear whether this happens as strongly with people whose belonging is already secure (family, long friends).",
  ],
  distinguishingQuestion:
    "If you knew, without any doubt, that these friends would still choose you if you gave nothing this year, what would change in the next request?",
  archetypes: [
    {
      archetypeId: archetype_martha_service.id,
      whyThisConnection:
        "Service tied to a felt need to be chosen mirrors Martha's anxious hospitality — the outward act is fine; the inward transaction is where the strain lives.",
      fitScore: 0.66,
    },
  ],
};

const hyp_third: PatternHypothesis = {
  id: "hyp_theology_of_no",
  name: "Undeveloped theology of no",
  description:
    "The behavior may not primarily be about belonging or fear of abandonment; it may be that the person has never received a compelling scriptural picture that a bounded no can be an act of faith rather than a failure of it.",
  status: "proposed",
  confidence: 0.41,
  hiddenAgreementCandidate:
    "Saying no is un-Christian.",
  domains: ["faith practice", "identity"],
  evidenceSignalIds: ["sig_6"],
  counterOrMissingEvidence: [
    "Explicitly named by the user ('I feel like I'm failing at being a Christian'), but the underlying interpretation ('unspoken belonging trade') would produce the same statement. Both may be true.",
  ],
  distinguishingQuestion:
    "If a trusted pastor told you, from Scripture, that a discerned no is faithful — would that change what you do next Wednesday, or only how you feel about it?",
  archetypes: [
    {
      archetypeId: archetype_nehemiah_pause.id,
      whyThisConnection:
        "Nehemiah's pause is a small scriptural picture of a boundaried yes that is not stingy but discerned.",
      fitScore: 0.6,
    },
  ],
};

/* ── Prayer with per-line lineage ────────────────────────────────── */

const prayer_seed: Prayer = {
  id: "pr_helping_boundaries_1",
  patternId: hyp_primary.id,
  archetypeIds: [archetype_moses_overload.id, archetype_david_ps51.id, archetype_nehemiah_pause.id],
  title: "For the yes that comes too quickly",
  mode: "full",
  createdAt: "2026-07-14T09:24:00.000Z",
  lines: [
    {
      id: "ln_1",
      movement: "truth",
      text:
        "God, I want to tell You plainly what happened, not what sounds right — I said yes again before I had thought, and part of me was buying something I was afraid to ask for.",
      sources: [
        {
          passageId: p_ps51.id,
          derivation: "movement_form",
          explanation:
            "Truth in the inward parts (Ps 51:6) — begin by naming the actual motive, not the presentable one.",
          tier: "S1_canonical_direct",
        },
        {
          passageId: p_num11.id,
          derivation: "narrative_pattern",
          explanation:
            "Moses' honest speech to God about being unable to carry what he has been carrying (Num 11:14).",
          tier: "S1_canonical_direct",
        },
      ],
      confidence: 0.9,
      userEdited: false,
    },
    {
      id: "ln_2",
      movement: "remembrance",
      text:
        "You have never asked me to secure belonging by carrying what another person's own life should carry. You have already chosen me.",
      sources: [
        {
          passageId: p_gal6.id,
          derivation: "paraphrase",
          explanation:
            "Gal 6:2 and 6:5 — bear one another's crushing weights, yet each carries their own ordinary load. Companion generosity, not substitution.",
          tier: "S1_canonical_direct",
        },
        {
          passageId: p_founder1.id,
          derivation: "founder_language",
          explanation:
            "Founder framework distinction between companion generosity and substitute generosity — labeled as founder interpretation, not direct Scripture.",
          tier: "S6_founder_framework",
        },
      ],
      confidence: 0.85,
      userEdited: false,
    },
    {
      id: "ln_3",
      movement: "request",
      text:
        "Teach me a pause before yes — the small interior prayer that lets my answer be discerned instead of reflexive.",
      sources: [
        {
          passageId: p_neh2.id,
          derivation: "narrative_pattern",
          explanation:
            "Nehemiah's short interior prayer before answering the king (Neh 2:4) as a scriptural picture of pause-before-yes.",
          tier: "S1_canonical_direct",
        },
      ],
      confidence: 0.88,
      userEdited: false,
    },
    {
      id: "ln_4",
      movement: "surrender",
      text:
        "I give You the fear underneath the generosity, and I give You the guilt underneath the no I am learning to say.",
      sources: [
        {
          passageId: p_ps139.id,
          derivation: "movement_form",
          explanation:
            "Ps 139:23–24 — invitation for God to search and lead, rather than the self-managing the fear alone.",
          tier: "S1_canonical_direct",
        },
      ],
      confidence: 0.82,
      userEdited: false,
    },
    {
      id: "ln_5",
      movement: "obedience",
      text:
        "This week, in the next request, I will pause before answering, and I will name — even quietly, to You — what I am really afraid of losing if I say no.",
      sources: [
        {
          passageId: p_neh2.id,
          derivation: "narrative_pattern",
          explanation:
            "Applied form of Nehemiah's pause into a specific, proportionate act — not a lifetime vow, not a rule against generosity.",
          tier: "S1_canonical_direct",
        },
      ],
      confidence: 0.86,
      userEdited: false,
    },
    {
      id: "ln_6",
      movement: "gratitude",
      text:
        "Thank You that You do not measure me by how quickly I give, and that a discerned no can be as faithful as a generous yes.",
      sources: [
        {
          passageId: p_lk10.id,
          derivation: "narrative_pattern",
          explanation:
            "Luke 10:38–42 — Jesus honors Mary's attention as not a lower form of faithfulness than Martha's service.",
          tier: "S1_canonical_direct",
        },
      ],
      confidence: 0.8,
      userEdited: false,
    },
  ],
};

/* ── Practices ───────────────────────────────────────────────────── */

const primary_act: Practice = {
  id: "prac_pause_before_yes",
  patternId: hyp_primary.id,
  kind: "boundary",
  title: "Pause before the next yes",
  rationale:
    "Targets the actual link in the pattern (choice happens before discernment). Small, proportionate, and repeatable — not a vow against generosity.",
  isPrimary: true,
};

const optional_1: Practice = {
  id: "prac_journal_after",
  patternId: hyp_primary.id,
  kind: "journaling",
  title: "Two-line journal after any request this week",
  rationale:
    "Names what you were afraid of losing if you said no. Turns a reflex into observable data, so next week's hypothesis can be tested against it.",
  isPrimary: false,
};

const optional_2: Practice = {
  id: "prac_accountability",
  patternId: hyp_primary.id,
  kind: "accountability",
  title: "One person who knows this pattern",
  rationale:
    "Not to police your giving — to give one trusted person permission to ask, gently, 'was that a paused yes or a reflex?'",
  isPrimary: false,
};

/* ── Proposed persona facts ──────────────────────────────────────── */

const proposedFacts: PersonaFact[] = [
  {
    id: "pf_1",
    domain: "values",
    key: "generosity_is_a_core_value",
    value: "generosity is a stated and lived core value",
    status: "accepted",
    sensitivity: "normal",
    confidence: 0.95,
    evidenceMessageIds: ["msg_1", "msg_2"],
    userEdited: false,
  },
  {
    id: "pf_2",
    domain: "pattern",
    key: "difficulty_saying_no",
    value: "possible difficulty saying no under felt belonging pressure",
    status: "proposed",
    sensitivity: "sensitive",
    confidence: 0.7,
    evidenceMessageIds: ["msg_1", "msg_2"],
    userEdited: false,
  },
  {
    id: "pf_3",
    domain: "identity",
    key: "no_feels_unchristian",
    value: "'saying no feels un-Christian' — user's own words",
    status: "proposed",
    sensitivity: "sensitive",
    confidence: 0.9,
    evidenceMessageIds: ["msg_2"],
    userEdited: false,
  },
];

/* ── The composed response ──────────────────────────────────────── */

export const seededResponse: WisdomResponse = {
  id: "resp_helping_boundaries_1",
  sessionId: seededSession.id,
  createdAt: "2026-07-14T09:25:00.000Z",
  whatIHear:
    "You did something loving, and it cost you real money you needed. You felt loved for a moment when you gave, and now you are quietly angry — at him, and maybe at yourself for not being sure whether that was generosity or fear. You have prayed about generosity, and you don't want to become stingy. And there is a Christian voice inside you that says a no might be a failure.",
  signals: [
    { id: "sig_1", kind: "event", evidenceMessageIds: ["msg_1"], paraphrase: "Fourth similar event this year, across three people.", explicit: true, confidence: 0.95 },
    { id: "sig_2", kind: "emotion", evidenceMessageIds: ["msg_1"], paraphrase: "Felt loved in the moment of giving.", explicit: true, confidence: 0.9 },
    { id: "sig_3", kind: "outcome", evidenceMessageIds: ["msg_1"], paraphrase: "Short on rent as a direct cost.", explicit: true, confidence: 0.95 },
    { id: "sig_4", kind: "emotion", evidenceMessageIds: ["msg_1"], paraphrase: "Quiet anger after the fact.", explicit: true, confidence: 0.85 },
    { id: "sig_5", kind: "belief", evidenceMessageIds: ["msg_1"], paraphrase: "Uncertain whether the drive is generosity or fear — user's own framing.", explicit: true, confidence: 0.9 },
    { id: "sig_6", kind: "spiritual_interpretation", evidenceMessageIds: ["msg_2"], paraphrase: "Saying no feels like failing at being a Christian.", explicit: true, confidence: 0.95 },
    { id: "sig_7", kind: "previous_effort", evidenceMessageIds: ["msg_2"], paraphrase: "Has prayed about generosity as a topic.", explicit: true, confidence: 0.85 },
  ],
  eventChain: [
    { id: "ec_1", kind: "context", fromUser: true, text: "A relationship where financial requests recur across a friend group." },
    { id: "ec_2", kind: "trigger", fromUser: true, text: "Friend asks to borrow money." },
    { id: "ec_3", kind: "interpretation", fromUser: false, text: "Unspoken interpretation: to remain loved and included, I must say yes." },
    { id: "ec_4", kind: "need", fromUser: false, text: "Underlying need: to be chosen and not abandoned." },
    { id: "ec_5", kind: "choice", fromUser: true, text: "Immediate yes — before deliberation." },
    { id: "ec_6", kind: "immediate_reward", fromUser: true, text: "Felt sense of being loved in the moment of giving." },
    { id: "ec_7", kind: "cost", fromUser: true, text: "Short on rent; strain in relationship; quiet anger at the friend and self." },
    { id: "ec_8", kind: "afterthought", fromUser: true, text: "Am I generous, or am I afraid?" },
    { id: "ec_9", kind: "re_entry", fromUser: false, text: "The next request re-enters the same environment; the pattern reactivates unless something between trigger and choice changes." },
  ],
  hypotheses: [hyp_primary, hyp_alt, hyp_third],
  primaryHypothesisId: hyp_primary.id,
  whyISeeIt:
    "Three things point together here. First, the repetition is real (four times this year, three different people). Second, you named the reward yourself — a felt sense of being loved in the moment of giving — which is a stronger signal than the giving itself. Third, you already carry a belief that a no would be un-Christian, which is exactly the belief that would keep the pattern in place. None of this is a verdict on you. It is a hypothesis we can test together.",
  discernment: {
    contextNote:
      "The primary hypothesis is 'Helping without boundaries', not 'You have a spirit of people-pleasing' and not 'Family curse.' There is no evidence for supernatural or generational verdicts here, and it would be dishonest to add one.",
    directVsInferred:
      "Direct from you: the events, the felt reward, the anger, the belief that no is un-Christian. Inferred by the model: that the felt reward is a belonging trade. That inference is a hypothesis, not a fact.",
    descriptiveVsPrescriptive:
      "Nehemiah's pause-before-yes is descriptive — it is what he did in one scene. It is offered here as a picture, not as a command that all yeses must be preceded by exactly this prayer.",
    counterEvidence: [
      "It is possible that recent events have concentrated in ways that make this look like a pattern when it is really a rough season.",
      "The theology-of-no hypothesis (H3) may be the primary driver rather than a belonging trade.",
    ],
    distinguishingQuestion:
      "When you have said no to a request recently — even in a small way — what did you feel in the first thirty seconds after?",
  },
  prayer: prayer_seed,
  primaryAct: primary_act,
  optionalPractices: [optional_1, optional_2],
  proposedPersonaFacts: proposedFacts,
  fruitToObserve: ["self_control", "clarity", "peace", "relationship_health"],
};

/* ── Timeline (seeded) ──────────────────────────────────────────── */

export const seededTimeline: FormationEvent[] = [
  {
    id: "fe_1",
    type: "story_shared",
    at: "2026-07-14T09:20:00.000Z",
    note: "Shared a repeating experience of giving money to friends and feeling used.",
  },
  {
    id: "fe_2",
    type: "pattern_proposed",
    at: "2026-07-14T09:25:00.000Z",
    patternId: hyp_primary.id,
    note: "Proposed: Helping without boundaries (confidence 0.72). Two alternative hypotheses also offered.",
  },
];

/* ── Convenience ─────────────────────────────────────────────────── */

export const SESSIONS: Session[] = [seededSession];
export const RESPONSES: Record<string, WisdomResponse> = { [seededSession.id]: seededResponse };
export const HYPOTHESES: Record<string, PatternHypothesis> = {
  [hyp_primary.id]: hyp_primary,
  [hyp_alt.id]: hyp_alt,
  [hyp_third.id]: hyp_third,
};
export const PRAYERS: Record<string, Prayer> = { [prayer_seed.id]: prayer_seed };
export const PRACTICES: Practice[] = [primary_act, optional_1, optional_2];
export const PERSONA_FACTS: PersonaFact[] = proposedFacts;
