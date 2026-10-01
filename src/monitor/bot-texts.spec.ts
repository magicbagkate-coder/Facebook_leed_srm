import { isPressHerePrompt, isPriceButton } from '#app/monitor/bot-texts.js';

describe('bot texts', () => {
  it('recognizes the price button in any letter case', () => {
    expect(isPriceButton('дізнатись ціну')).toBe(true);
    expect(isPriceButton('Дізнатись ціну')).toBe(true);
    expect(isPriceButton('Добрий день, яка ціна?')).toBe(false);
    expect(isPriceButton(undefined)).toBe(false);
  });

  it('recognizes the press-here prompt', () => {
    expect(isPressHerePrompt('⬇натисніть тут⬇')).toBe(true);
    expect(isPressHerePrompt('Вітаю')).toBe(false);
  });
});
