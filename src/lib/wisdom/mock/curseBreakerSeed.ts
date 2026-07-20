/**
 * Seeded Curse Breaker example — mock only, no LLM output.
 * All Scripture references are references; no copyrighted translation text.
 */
import type { Session } from "../schemas";
import type {
  CurseBreakerResponse,
  CBInterpretation,
} from "../curseBreaker";
import { INTERPRETATION_CATEGORIES } from "../curseBreaker";
import { PASSAGE_INDEX } from "./seed";

export const cbSession: Session = {
  id: "sess_cb_anger_line",
  title: "The anger that keeps coming back down the line",
  intent: "understand_pattern",
  depth: "deep",
  createdAt: "2026-07-16T18:10:00.000Z",
  messages: [
    {
      id: "cb_msg_1",
      role: "user",
      createdAt: "2026-07-16T18:10:00.000Z",
      text:
        "I lost my temper again with my son. My father did the same with me. His father did the same with him. I have prayed, I have apologized, I have read about anger — and still it comes. I don't know if this is just a family habit, or something deeper I need to break in prayer.",
    },
  ],
};

/** Build a fully-enumerated 14-category interpretation set with realistic
 *  variance in cheap-score vs deep-analyzed vs confidence. */
function makeInterpretations(): CBInterpretation[] {
  const base = (cat: (typeof INTERPRETATION_CATEGORIES)[number]) => ({
    id: `int_${cat}`,
    category: cat,
    cheapScore: 0,
    deepAnalyzed: false,
    confidence: 0,
    supportingEvidence: [],
    counterEvidence: [],
    missingEvidence: [],
    alternativeExplanations: [],
    citations: [],
    pastoralNote: "",
  }) as CBInterpretation;

  const map: Record<string, CBInterpretation> = Object.fromEntries(
    INTERPRETATION_CATEGORIES.map((c) => [c, base(c)])
  );

  // Deep-analyzed, higher-signal categories
  map.family_learning = {
    ...map.family_learning,
    cheapScore: 0.82,
    deepAnalyzed: true,
    confidence: 0.78,
    supportingEvidence: [
      {
        id: "e_fl_1",
        text: "User explicitly names the same behavior in father and grandfather.",
        sourceMessageIds: ["cb_msg_1"],
        weight: 0.9,
      },
    ],
    counterEvidence: [
      {
        id: "e_fl_c1",
        text: "It is not yet clear whether the user's mother or siblings show the same pattern.",
        sourceMessageIds: [],
        weight: 0.4,
      },
    ],
    missingEvidence: [
      "The specific trigger environments in the father's and grandfather's episodes.",
    ],
    alternativeExplanations: [
      "Could equally be a physiological threshold learned as a coping response, not a moral script.",
    ],
    citations: [
      { passageId: "p_ps139", tier: "S1_canonical_direct", note: "Invitation for God to search inherited patterns." },
    ],
    pastoralNote:
      "Family learning is not blame of your father. It is naming a script you were handed, that you are now free to revise.",
  };

  map.generational_repetition = {
    ...map.generational_repetition,
    cheapScore: 0.74,
    deepAnalyzed: true,
    confidence: 0.66,
    supportingEvidence: [
      {
        id: "e_gr_1",
        text: "Three generations named with the same specific behavior.",
        sourceMessageIds: ["cb_msg_1"],
        weight: 0.85,
      },
    ],
    counterEvidence: [
      {
        id: "e_gr_c1",
        text: "Three generations of a common human behavior can look generational without being caused generationally.",
        sourceMessageIds: [],
        weight: 0.55,
      },
    ],
    missingEvidence: ["Whether the pattern also appears in relatives who left the family early."],
    alternativeExplanations: [
      "Family learning (map.family_learning) alone can explain three-generation repetition without invoking a supernatural line.",
    ],
    citations: [
      { passageId: "p_num11", tier: "S1_canonical_direct", note: "A load carried across many that God redistributes." },
    ],
    pastoralNote:
      "Repetition across generations is real evidence. It is not, by itself, evidence of a supernatural line.",
  };

  map.habit = {
    ...map.habit,
    cheapScore: 0.7,
    deepAnalyzed: true,
    confidence: 0.62,
    supportingEvidence: [
      {
        id: "e_h_1",
        text: "'It comes' — user's language suggests an automatic reaction rather than a deliberated choice.",
        sourceMessageIds: ["cb_msg_1"],
        weight: 0.75,
      },
    ],
    counterEvidence: [],
    missingEvidence: ["What happens in the two seconds between the trigger and the outburst."],
    alternativeExplanations: [
      "Could be an appetite (physiological arousal) rather than a habit strictly speaking.",
    ],
    citations: [
      { passageId: "p_ps51", tier: "S1_canonical_direct", note: "Renewal below the level of behavior." },
    ],
    pastoralNote:
      "Habit is not a small category. Under repetition, choice narrows — this is why the pattern feels involuntary.",
  };

  map.shame = {
    ...map.shame,
    cheapScore: 0.61,
    deepAnalyzed: true,
    confidence: 0.55,
    supportingEvidence: [
      {
        id: "e_sh_1",
        text: "'Still it comes' + years of effort suggests shame is layered under the behavior itself.",
        sourceMessageIds: ["cb_msg_1"],
        weight: 0.65,
      },
    ],
    counterEvidence: [],
    missingEvidence: ["Whether the user experiences self-attack after the episode, and for how long."],
    alternativeExplanations: [
      "Could be grief (over harm caused) rather than shame (a verdict on the self).",
    ],
    citations: [
      { passageId: "p_ps51", tier: "S1_canonical_direct", note: "Truth in the inward parts, not self-attack." },
    ],
    pastoralNote:
      "Shame after failure tends to feed the next failure. Naming it is not weakness; it is discernment.",
  };

  map.user_reported_spiritual_conflict = {
    ...map.user_reported_spiritual_conflict,
    cheapScore: 0.5,
    deepAnalyzed: true,
    confidence: 0.42,
    supportingEvidence: [
      {
        id: "e_urs_1",
        text: "User asks directly whether this is 'something deeper I need to break in prayer.'",
        sourceMessageIds: ["cb_msg_1"],
        weight: 0.7,
      },
    ],
    counterEvidence: [
      {
        id: "e_urs_c1",
        text: "The question is a genuine open question, not a settled report of felt spiritual attack.",
        sourceMessageIds: ["cb_msg_1"],
        weight: 0.6,
      },
    ],
    missingEvidence: [
      "Any recurring dreams, felt presence, or specific spiritual experiences the user has not yet named.",
    ],
    alternativeExplanations: [
      "The question itself may be the fruit of good pastoral instinct, not a report of conflict.",
    ],
    citations: [
      { passageId: "p_founder1", tier: "S6_founder_framework", note: "Founder frame: take the question seriously without answering it prematurely." },
    ],
    pastoralNote:
      "You asked the question. Wisdom will hold it open rather than answer yes or no on this much evidence.",
  };

  map.direct_biblical_curse_or_stronghold = {
    ...map.direct_biblical_curse_or_stronghold,
    cheapScore: 0.44,
    deepAnalyzed: true,
    confidence: 0.31,
    supportingEvidence: [
      {
        id: "e_dcs_1",
        text: "Three-generation repetition is a scriptural pattern for how consequences travel down family lines (see Ex 34:7 for context of the language).",
        sourceMessageIds: ["cb_msg_1"],
        weight: 0.55,
      },
    ],
    counterEvidence: [
      {
        id: "e_dcs_c1",
        text: "The same passage also holds that each person answers for their own sin (Ez 18:20). A three-generation observation is not itself proof of a curse.",
        sourceMessageIds: [],
        weight: 0.75,
      },
    ],
    missingEvidence: [
      "Any specific vow, dedication, occult involvement, or covenanted commitment in the family line that scripturally maps to stronghold categories.",
    ],
    alternativeExplanations: [
      "Family learning + habit + shame together already explain the observable pattern.",
    ],
    citations: [
      { passageId: "p_ps139", tier: "S1_canonical_direct", note: "Invitation for God to search — not for the model to declare." },
      { passageId: "p_founder1", tier: "S6_founder_framework", note: "Founder framing: name this category, hold it low-confidence, refuse a verdict either way." },
    ],
    pastoralNote:
      "This category is present in the discernment, held at low confidence. Wisdom does not declare you cursed on this evidence. It also does not remove the category from view.",
  };

  map.belief = {
    ...map.belief,
    cheapScore: 0.4,
    deepAnalyzed: true,
    confidence: 0.36,
    supportingEvidence: [
      {
        id: "e_b_1",
        text: "'I have prayed, I have apologized' — carries a belief that the right effort should have already resolved this.",
        sourceMessageIds: ["cb_msg_1"],
        weight: 0.6,
      },
    ],
    counterEvidence: [],
    missingEvidence: ["Whether the user believes anger, as such, is disqualifying rather than something to be led through."],
    alternativeExplanations: ["Could be closer to shame than to belief."],
    citations: [
      { passageId: "p_ps51", tier: "S1_canonical_direct", note: "Cleansing beneath behavior, addressing motive." },
    ],
    pastoralNote: "A belief about how quickly God should heal is worth naming and testing.",
  };

  // Low cheap-score, not deep-analyzed
  map.chosen_behavior = { ...map.chosen_behavior, cheapScore: 0.22 };
  map.appetite = { ...map.appetite, cheapScore: 0.28 };
  map.hidden_agreement = { ...map.hidden_agreement, cheapScore: 0.24 };
  map.relationship_pressure = { ...map.relationship_pressure, cheapScore: 0.18 };
  map.social_normalization = { ...map.social_normalization, cheapScore: 0.15 };
  map.material_conditions = { ...map.material_conditions, cheapScore: 0.12 };
  map.spiritual_practice_absence = { ...map.spiritual_practice_absence, cheapScore: 0.2 };

  return INTERPRETATION_CATEGORIES.map((c) => map[c]);
}

export const cbResponse: CurseBreakerResponse = {
  id: "cbr_1",
  sessionId: cbSession.id,
  createdAt: "2026-07-16T18:12:00.000Z",
  whatIHear:
    "You are not asking whether anger is wrong. You are asking why it keeps arriving in you the way it arrived in your father and his father, after years of real effort. You want the possibility of a spiritual dimension to be taken seriously without being handed a diagnosis.",
  timeline: [
    { id: "t_1", generation: "Great-grandparent", event: "Family lore of a temperamental patriarch.", fromUser: false },
    { id: "t_2", generation: "Grandparent", event: "Grandfather's outbursts with his son (your father).", fromUser: true },
    { id: "t_3", generation: "Parent", event: "Father's outbursts with you.", fromUser: true },
    { id: "t_4", generation: "You", event: "Your outburst with your son this week.", fromUser: true },
    { id: "t_5", generation: "Child", event: "The pattern is now positioned to enter a fourth generation.", fromUser: false },
  ],
  interpretations: makeInterpretations(),
  tensions: [
    {
      id: "tn_1",
      categoryA: "family_learning",
      categoryB: "direct_biblical_curse_or_stronghold",
      description:
        "Family learning explains most of what is visible without needing a supernatural cause. But refusing to name the biblical category at all would flatten the honest question you asked.",
      resolutionQuestion:
        "Is there any specific vow, dedication, or covenanted commitment in your family line you would want to bring into prayer directly?",
    },
    {
      id: "tn_2",
      categoryA: "habit",
      categoryB: "shame",
      description:
        "Habit and shame reinforce each other: shame after failure tightens the loop, making the next episode more likely. Addressing only one leaves the other intact.",
      resolutionQuestion:
        "In the two hours after the outburst, was the loudest voice inside you 'I hurt him' (grief) or 'I am the man who does this' (shame)?",
    },
  ],
  prayerLineage: {
    id: "pl_cb_1",
    title: "For the anger that keeps returning",
    lines: [
      {
        id: "pll_1",
        primaryMovement: "confession",
        movements: ["confession", "truth"],
        text: "God, I confess what I did — not the general shape of it, but the specific harm to my son this week.",
        citations: [
          { passageId: "p_ps51", tier: "S1_canonical_direct", note: "Confession begins by naming the specific act, not the category." },
        ],
      },
      {
        id: "pll_2",
        primaryMovement: "renunciation",
        movements: ["renunciation", "truth"],
        text: "I refuse the script that says this is simply who the men in this line become. I do not accept it as my inheritance.",
        citations: [
          { passageId: "p_founder1", tier: "S6_founder_framework", note: "Founder frame: renunciation as reclaiming choice inside a learned script." },
        ],
      },
      {
        id: "pll_3",
        primaryMovement: "deliverance",
        movements: ["deliverance", "request"],
        text: "Where any spiritual dimension of this is real and unseen by me, I ask You to name it, and to deal with it — not to leave it hidden under the ordinary.",
        citations: [
          { passageId: "p_ps139", tier: "S1_canonical_direct", note: "Invitation for God to search — deliverance held under the psalmist's invitation, not a formula." },
        ],
      },
      {
        id: "pll_4",
        primaryMovement: "restoration",
        movements: ["restoration", "obedience"],
        text: "Give me the specific words to speak to my son this week that repair, not perform. Let the repair be real to him, not comfortable to me.",
        citations: [
          { passageId: "p_neh2", tier: "S1_canonical_direct", note: "A short prayer that precedes a specific, costly next act." },
        ],
      },
      {
        id: "pll_5",
        primaryMovement: "blessing",
        movements: ["blessing", "identity_in_christ"],
        text: "Over my son, I speak the opposite of what has been handed down: gentleness, safety, and the freedom to be angry in ways that do not wound.",
        citations: [
          { passageId: "p_founder1", tier: "S6_founder_framework", note: "Founder frame: blessing as active reversal of the script, spoken aloud." },
        ],
      },
    ],
  },
  primaryAct: {
    id: "cb_act_1",
    title: "Name the specific harm to your son, out loud, this week.",
    rationale:
      "Targets the exact point in the pattern where restoration is possible without over-promising a full break. Small enough to actually do; specific enough to interrupt shame's abstraction.",
    scale: "small",
    proportionateNote:
      "Not a vow, not a public commitment, not a program. A single specific repair, appropriate to what happened.",
  },
  checkIn: {
    id: "cb_ci_1",
    scheduledFor: "2026-07-30T18:00:00.000Z",
    observePrompts: [
      "Did the specific repair happen? What did your son actually receive?",
      "In the two weeks, did the trigger arrive again? What was different in the two seconds before your response?",
      "Did any evidence surface — in either direction — for the biblical curse/stronghold category?",
    ],
    setbackHandling:
      "If it happened again, that is data. It is not a verdict on you and it does not undo the repair you already made.",
  },
  dignity: {
    refusalOfAutomaticVerdicts:
      "Wisdom will not declare you cursed on this evidence. Wisdom will also not remove the category from view because it is uncomfortable.",
    reversibilityPromise:
      "Every category, every prayer line, every act shown here is revisable. You can change your verdict; the pattern lifecycle allows it.",
    humanCounselPointer:
      "A trusted pastor, elder, or counselor who knows your family and story should be in this with you. Wisdom is a companion in that conversation, not a replacement for it.",
  },
  passageIndex: PASSAGE_INDEX,
};
