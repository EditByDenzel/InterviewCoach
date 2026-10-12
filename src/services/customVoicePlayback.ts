import { playBase64Audio } from './audioService';
import { CustomVoice, generateCustomVoiceAudio } from './customVoiceService';

/** Web and native decode the complete WAV through the existing cancellable player. */
export async function speakWithCustomVoice(apiKey: string, voice: CustomVoice, text: string): Promise<void> {
  await playBase64Audio(await generateCustomVoiceAudio(apiKey, { voice, text }), 'wav');
}
