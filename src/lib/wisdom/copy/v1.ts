/**
 * Deterministic copy deck — v1.
 *
 * Every user-visible label, eyebrow, empty-state and disclaimer used inside
 * the Curse Breaker flow lives here. Rendering must import strings from this
 * module and never string-interpolate LLM output into structural copy.
 *
 * A future CI check will fail the build if a Curse Breaker card imports
 * a string literal that is not present in this deck.
 */

export const COPY = {
  modes: {
    companion: {
      label: "Companion",
      hint: "Gentle listening — no pattern yet.",
    },
    pattern: {
      label: "Pattern",
      hint: "1–3 competing hypotheses with evidence.",
    },
    deep: {
      label: "Deep Wisdom",
      hint: "Signals, event chain, mirrors, lineage, act.",
    },
    curse_breaker: {
      label: "Curse Breaker",
      hint: "Discern across 14 categories — spiritual and ordinary.",
    },
  },

  curseBreaker: {
    heroEyebrow: "Curse Breaker",
    heroTitle: "A pattern that will not leave.",
    heroTilePrompt:
      "Something keeps returning across years or generations. I want to look at it honestly — spiritually and ordinarily — ",

    preambleTitle: "Before we begin.",
    preambleBody: [
      "Curse Breaker is a serious mode. It examines biblical categories of curse and stronghold alongside ordinary explanations — choice, habit, learned behavior, shame, environment.",
      "It will not automatically declare you cursed. It will also not automatically reduce every experience to psychology. Both would be dishonest.",
      "You will see fourteen independent categories, each with its own evidence, competing explanations, and uncertainty. You choose what to carry forward.",
    ],
    preambleConsent: "I understand. Begin.",

    cardTitles: {
      generationalTimeline: "Generational timeline",
      fourteenCategories: "Fourteen categories of discernment",
      competingExplanations: "Competing explanations",
      tensionAnalysis: "Where the categories pull against each other",
      prayerLineage: "Prayer lineage",
      patternBreakingAct: "One pattern-breaking act",
      formationCheckIn: "Formation check-in",
      dignityAndSafety: "Dignity and safety",
    },

    cardEyebrows: {
      generationalTimeline: "Repeated experience",
      fourteenCategories: "Discernment layer",
      competingExplanations: "What could this be instead?",
      tensionAnalysis: "Held in tension",
      prayerLineage: "Grounded prayer",
      patternBreakingAct: "One next act",
      formationCheckIn: "In two weeks",
      dignityAndSafety: "How Wisdom holds this",
    },

    empty: {
      noSupport: "No supporting evidence in this session.",
      noCounter: "No counter-evidence in this session.",
      noAlternatives: "No competing explanation offered here.",
    },

    disclaimers: {
      notADeclaration:
        "Nothing here declares you cursed or free. These are hypotheses with cited evidence — for prayer, discernment, and conversation with trusted people.",
      referenceOnly:
        "Scripture references are provided so you can read them in your own translation. Wisdom does not reproduce copyrighted translation text.",
      dignity:
        "Curse and stronghold language can be misused to shame. Wisdom holds this mode with care — every claim is evidence-bounded and revisable.",
    },

    categoryOrder: [
      "chosen_behavior",
      "habit",
      "appetite",
      "belief",
      "shame",
      "hidden_agreement",
      "relationship_pressure",
      "social_normalization",
      "family_learning",
      "generational_repetition",
      "material_conditions",
      "spiritual_practice_absence",
      "user_reported_spiritual_conflict",
      "direct_biblical_curse_or_stronghold",
    ] as const,

    categoryLabels: {
      chosen_behavior: "Chosen behavior",
      habit: "Habit",
      appetite: "Appetite",
      belief: "Belief",
      shame: "Shame",
      hidden_agreement: "Hidden agreement",
      relationship_pressure: "Relationship pressure",
      social_normalization: "Social normalization",
      family_learning: "Family learning",
      generational_repetition: "Generational repetition",
      material_conditions: "Material conditions",
      spiritual_practice_absence: "Absence of spiritual practice",
      user_reported_spiritual_conflict: "Reported spiritual conflict",
      direct_biblical_curse_or_stronghold: "Direct biblical curse / stronghold",
    },

    categoryOneLiners: {
      chosen_behavior:
        "A deliberate act, freely chosen, with the person aware of options.",
      habit:
        "A behavior that has become automatic through repetition; choice is dulled but not removed.",
      appetite:
        "A recurring hunger — physical, emotional, or attentional — that shapes the choice before deliberation.",
      belief:
        "An interior claim about God, self, others, or the world that is treated as true and steers action.",
      shame:
        "A felt sense of being wrong-as-a-person that drives concealment, avoidance, or over-performance.",
      hidden_agreement:
        "An unspoken 'if X, then I am loved/safe/enough' that runs beneath the visible behavior.",
      relationship_pressure:
        "A specific person or role whose real or imagined expectations are shaping the choice.",
      social_normalization:
        "A wider group treats this as normal or expected, dulling the sense that anything is wrong.",
      family_learning:
        "Learned in one's family of origin as a script for how life works — not necessarily generational curse.",
      generational_repetition:
        "The same pattern recurs across two or more generations in observable ways.",
      material_conditions:
        "Money, housing, sleep, health, or physical environment materially constrain the choice.",
      spiritual_practice_absence:
        "The absence of ordinary practices (prayer, Scripture, Sabbath, community) leaves the space unattended.",
      user_reported_spiritual_conflict:
        "The user themselves reports spiritual conflict, oppression, or interference and asks for it to be taken seriously.",
      direct_biblical_curse_or_stronghold:
        "A hypothesis, held with care and evidence, that biblical curse or stronghold categories are directly in view.",
    },
  },
} as const;

export type CopyDeck = typeof COPY;
