import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View, StyleSheet, Image } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import type { Scenario } from '../domain/abSession';
import { SettingsPage, Action, S } from '../components/SettingsDesign';
import { DESIGN } from '../components/CoachieDesign';
import { LiveDots, MotionPressable } from '../components/Motion';
import { loadSettings } from '../store/settingsStore';
import { extractScenario, ScenarioInput, validateScenarioImport } from '../services/scenarioImportService';
import { pickScenarioImage, recoverScenarioImage } from '../services/scenarioImagePicker';

type Props = StackScreenProps<RootStackParamList, 'Scenario'>;
type Review = { title: string; objective: string; role: string; facts: string; constraints: string; language: string; minimum: string; maximum: string; turns: string; priorities: string; search: string };
const toReview = (scenario: Scenario): Review => ({ title: scenario.title, objective: scenario.objective, role: scenario.role, facts: scenario.facts.join('\n'), constraints: scenario.constraints.join('\n'), language: scenario.language, minimum: String(scenario.minMinutes), maximum: String(scenario.maxMinutes), turns: scenario.minTurns == null ? '' : String(scenario.minTurns), priorities: scenario.evaluationPriorities?.join('\n') || '', search: scenario.searchRequired === undefined ? 'Not specified' : scenario.searchRequired ? 'Required' : 'Not required' });
const languages = ['English', 'Thai', 'Nigerian English'];

export default function ScenarioScreen({ route, navigation }: Props) {
  const [draft, setDraft] = useState(route.params.draft);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [photo, setPhoto] = useState<string | undefined>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const operation = useRef(0);
  const active = useRef(true);
  const pending = useRef(false);

  useEffect(() => {
    active.current = true;
    void recoverScenarioImage().then(image => {
      if (!active.current) return;
      if (image) void importScenario({ image });
      else if (!route.params.photo && route.params.draft.trim()) void importScenario({ text: route.params.draft });
    }).catch(caught => { if (active.current) setError(caught instanceof Error ? caught.message : 'Choose the scenario photo again.'); });
    return () => { active.current = false; operation.current++; controller.current?.abort(); pending.current = false; };
  }, []);

  function cancel() {
    operation.current++;
    controller.current?.abort();
    pending.current = false;
    setBusy(false);
  }

  async function importScenario(input?: ScenarioInput, source?: 'camera' | 'library') {
    if (pending.current) return;
    pending.current = true;
    const request = ++operation.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true); setError('');
    try {
      let data = input;
      if (source) {
        const image = await pickScenarioImage(source);
        if (!image || request !== operation.current || !active.current) return;
        data = { image };
      }
      if (!data) return;
      const settings = await loadSettings();
      if (request !== operation.current || !active.current) return;
      const imported = await extractScenario(settings.geminiApiKey, data, review?.language || settings.language || 'English', abort.signal);
      if (request !== operation.current || !active.current) return;
      setScenario(imported); setReview(toReview(imported)); setPhoto(data.image?.uri);
    } catch (caught) {
      if (request === operation.current && active.current && !abort.signal.aborted) setError(caught instanceof Error ? caught.message : 'Could not import the scenario. Your draft is safe; try again.');
    } finally {
      if (request === operation.current && active.current) { pending.current = false; setBusy(false); }
    }
  }

  async function accept() {
    if (!review || !scenario || pending.current) return;
    const request = ++operation.current;
    try {
      if (!review.minimum.trim() || !review.maximum.trim()) throw new Error('Enter the minimum and maximum duration.');
      const approved = validateScenarioImport({
        ...scenario, title: review.title, objective: review.objective, role: review.role,
        facts: review.facts.split('\n'), constraints: review.constraints.split('\n'), language: review.language,
        minMinutes: Number(review.minimum), maxMinutes: Number(review.maximum), minTurns: review.turns.trim() ? Number(review.turns) : undefined,
        evaluationPriorities: review.priorities.trim() ? review.priorities.split('\n') : undefined,
        searchRequired: review.search === 'Not specified' ? undefined : review.search === 'Required',
      });
      pending.current = true; setBusy(true); setError('');
      const settings = await loadSettings();
      if (!active.current || request !== operation.current) return;
      if (!settings.geminiApiKey.trim()) throw new Error('Add your Gemini API key in Settings before starting.');
      navigation.navigate('ABSession', { scenario: approved });
    } catch (caught) { if (active.current && request === operation.current) setError(caught instanceof Error ? caught.message : 'Could not start the session.'); }
    finally { if (request === operation.current) { pending.current = false; if (active.current) setBusy(false); } }
  }

  function field(key: keyof Review, label: string, multiline = false, numeric = false) {
    if (!review) return null;
    return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={review[key]} onChangeText={text => setReview(current => current ? { ...current, [key]: text } : current)} editable={!busy} multiline={multiline} keyboardType={numeric ? 'decimal-pad' : 'default'} maxLength={key === 'title' ? 300 : 6000} style={[S.input, { flex: undefined }, multiline && styles.multiline]} placeholderTextColor="#9E928A" /></View>;
  }

  return <SettingsPage title="Set up your scenario" back={() => navigation.goBack()} footer={review ? <Action title="Use scenario · Continue to Model A" onPress={() => void accept()} disabled={busy} /> : undefined}>
    <View style={{ gap: 12 }}><Text style={S.heading}>What do you want to explore?</Text><Text style={S.body}>Enter a topic or photograph the scenario. Review its English details before starting both conversations.</Text></View>
    <View style={styles.field}><Text style={styles.label}>Topic or scenario text</Text><TextInput accessibilityLabel="Topic or scenario text" multiline value={draft} editable={!busy} onChangeText={setDraft} maxLength={20000} placeholder="Paste the scenario in any language…" placeholderTextColor="#9E928A" style={[S.input, styles.multiline, { flex: undefined }]} /><Action title={review ? 'Extract this text again' : 'Build scenario review'} secondary disabled={busy || !draft.trim()} onPress={() => void importScenario({ text: draft })} /></View>
    <View style={styles.photoActions}><MotionPressable accessibilityRole="button" accessibilityLabel="Take scenario photo" disabled={busy} onPress={() => void importScenario(undefined, 'camera')} style={styles.photoButton}><Text style={styles.photoText}>Take photo</Text></MotionPressable><MotionPressable accessibilityRole="button" accessibilityLabel="Choose scenario screenshot" disabled={busy} onPress={() => void importScenario(undefined, 'library')} style={styles.photoButton}><Text style={styles.photoText}>Choose screenshot</Text></MotionPressable></View>
    <Text style={styles.hint}>Only the image you select is sent to Gemini when extracting. Cancelling keeps your draft and current review.</Text>
    {busy && <View style={{ gap: 12 }}><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Text accessibilityLiveRegion="polite" style={S.message}>Preparing your scenario…</Text><LiveDots active /></View><Action title="Cancel extraction" secondary onPress={cancel} /></View>}
    {!!error && <View style={{ gap: 12 }}><Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={S.error}>{error}</Text>{error.includes('API key') && <Action title="Open API key settings" secondary onPress={() => navigation.navigate('Preferences', { page: 'keys' })} />}</View>}
    {review && <View style={styles.review}>
      <Text style={S.heading}>English review</Text>
      {photo && <Image source={{ uri: photo }} accessibilityLabel="Selected scenario photo" style={{ width: '100%', height: 150, borderRadius: 16 }} resizeMode="contain" />}
      {!!scenario?.uncertainties?.length && <View style={styles.notice}><Text style={styles.label}>Please check</Text>{scenario.uncertainties.map((item, index) => <Text key={index} style={styles.hint}>{item}</Text>)}</View>}
      {field('title', 'Scenario title')}{field('objective', 'What you want to achieve', true)}{field('role', 'Your character', true)}{field('facts', 'Known facts · one per line', true)}{field('constraints', 'Important constraints · one per line', true)}
      <View style={styles.field}><Text style={styles.label}>Speaking language</Text><View style={styles.languages}>{languages.map(language => <MotionPressable key={language} accessibilityRole="button" accessibilityState={{ selected: review.language === language }} disabled={busy} onPress={() => setReview(current => current ? { ...current, language } : current)} style={[styles.languageButton, review.language === language && styles.selected]}><Text style={styles.photoText}>{language}</Text></MotionPressable>)}</View><Text style={styles.hint}>Questions and recordings use the selected language. Your conversation text appears in English.</Text></View>
      {field('minimum', 'Minimum minutes per model', false, true)}{field('maximum', 'Maximum minutes per model', false, true)}{field('turns', 'Minimum turns if required · otherwise leave blank', false, true)}
      {field('priorities', 'Evaluation priorities · highest first, one per line', true)}
      <View style={styles.field}><Text style={styles.label}>Does the scenario require search?</Text><View style={styles.languages}>{['Not specified', 'Required', 'Not required'].map(search => <MotionPressable key={search} accessibilityRole="button" accessibilityLabel={`Search: ${search}`} accessibilityState={{ selected: review.search === search }} disabled={busy} onPress={() => setReview(current => current ? { ...current, search } : current)} style={[styles.languageButton, review.search === search && styles.selected]}><Text style={styles.photoText}>{search}</Text></MotionPressable>)}</View><Text style={styles.hint}>A spoken claim of searching is recorded as a claim. It does not establish that a model used a search tool.</Text></View>
      <Text style={styles.hint}>The same scenario, character and opening are used for A and B. Follow-ups adapt to each model's own answers. There is no fixed five-question limit.</Text>
    </View>}
  </SettingsPage>;
}
const styles = StyleSheet.create({
  field: { gap: 10 }, label: { color: '#EAD9CE', fontFamily: DESIGN.medium, fontSize: 13, lineHeight: 20 },
  multiline: { minHeight: 96, textAlignVertical: 'top', lineHeight: 23 }, review: { gap: 20 },
  hint: { color: '#B8ADA7', fontFamily: DESIGN.font, fontSize: 12, lineHeight: 19 },
  photoActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, photoButton: { minHeight: 46, flexGrow: 1, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255,255,255,.08)' },
  photoText: { color: '#FFF', fontFamily: DESIGN.medium, fontSize: 13 }, notice: { gap: 6, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,170,85,.08)' },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, languageButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: '#574338' }, selected: { borderColor: '#FFB083', backgroundColor: 'rgba(255,176,131,.13)' },
});
