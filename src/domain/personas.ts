export interface VoicePersona { id: string; label: string; voice: string; style: string }
/** Character directions for audition, not a promise of perceived age or accent. */
export function personaProfiles(language: string): VoicePersona[] {
  const accent = language === 'Thai' ? 'Speak natural everyday Thai, with context-appropriate politeness.' :
    language === 'Nigerian English' ? 'Speak everyday Nigerian English. Do not substitute Pidgin or exaggerate the accent.' : 'Speak everyday English.';
  return [
    { id: `${language}-20s`, label: 'Casual adult · twenties', voice: 'Puck', style: `${accent} An ordinary adult in their twenties talking to another person. Relaxed, attentive, moderate pace. No presenter delivery, forced laughter or repeated hesitation.` },
    { id: `${language}-30s`, label: 'Calm adult · thirties', voice: 'Kore', style: `${accent} An ordinary adult in their thirties talking to another person. Calm, curious, conversational pace, subtle varied sentence stress. No announcer delivery or exaggerated emotion.` },
  ];
}
