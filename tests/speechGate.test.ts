import { createSpeechGate } from '../src/services/speechGate';
describe('speech onset confirmation', () => {
  it('does not finalize a recording after a click or short noise', () => {
    const gate = createSpeechGate(); gate.sample(true, 0);
    expect(gate.sample(false, 80).confirmed).toBe(false);
    expect(gate.sample(false, 2500).ended).toBe(false);
  });
  it('keeps the 2.3 second cutoff after sustained speech', () => {
    const gate = createSpeechGate();
    for (let t = 0; t <= 240; t += 80) gate.sample(true, t);
    expect(gate.sample(false, 2500).ended).toBe(false);
    expect(gate.sample(false, 2600).ended).toBe(true);
  });
  it('does not join widely separated noises into speech', () => {
    const gate = createSpeechGate(); gate.sample(true, 0);
    expect(gate.sample(true, 500).confirmed).toBe(false);
    expect(gate.sample(false, 3000).ended).toBe(false);
  });
});
