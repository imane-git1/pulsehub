import { describe, expect, it } from 'vitest';
import { Sequencer } from '../../src/hub/sequencer';

describe('Sequencer', () => {
  it('accepte la première trame sans compter de perte', () => {
    expect(new Sequencer().check(7, 5000)).toEqual({ accepted: true, lost: 0 });
  });

  it('accepte une suite normale sans perte', () => {
    const s = new Sequencer();
    s.check(7, 10);
    expect(s.check(7, 11)).toEqual({ accepted: true, lost: 0 });
  });

  it('compte les trames manquantes lors d\'un trou', () => {
    const s = new Sequencer();
    s.check(7, 11);
    expect(s.check(7, 14)).toEqual({ accepted: true, lost: 2 });
  });

  it('écarte un doublon', () => {
    const s = new Sequencer();
    s.check(7, 10);
    expect(s.check(7, 10)).toEqual({ accepted: false, lost: 0 });
  });

  it('écarte une trame en retard et ne revient pas en arrière', () => {
    const s = new Sequencer();
    s.check(7, 10);
    s.check(7, 14);
    expect(s.check(7, 12)).toEqual({ accepted: false, lost: 0 });
    // le dernier seq reste 14 : 15 est la suite normale
    expect(s.check(7, 15)).toEqual({ accepted: true, lost: 0 });
  });

  it('suit le scénario 10, 11, 14, 12', () => {
    const s = new Sequencer();
    const verdicts = [10, 11, 14, 12].map((seq) => s.check(7, seq));
    expect(verdicts).toEqual([
      { accepted: true, lost: 0 },
      { accepted: true, lost: 0 },
      { accepted: true, lost: 2 },
      { accepted: false, lost: 0 },
    ]);
  });

  it('suit chaque appareil indépendamment', () => {
    const s = new Sequencer();
    s.check(1, 100);
    expect(s.check(2, 3)).toEqual({ accepted: true, lost: 0 });
    expect(s.check(1, 101)).toEqual({ accepted: true, lost: 0 });
  });
});