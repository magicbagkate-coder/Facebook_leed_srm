import { isPressHerePrompt, isPriceButton, isThanksOrRefusal } from '#app/monitor/bot-texts.js';

describe('bot texts', () => {
  it('recognizes the price button in any letter case', () => {
    expect(isPriceButton('дізнатись ціну')).toBe(true);
    expect(isPriceButton('Дізнатись ціну')).toBe(true);
    expect(isPriceButton('Добрий день, яка ціна?')).toBe(false);
    expect(isPriceButton(undefined)).toBe(false);
  });

  it('recognizes short thanks and refusals but not real questions', () => {
    expect(isThanksOrRefusal('Ні,не потрібно')).toBe(true);
    expect(isThanksOrRefusal('Дякую 🌺')).toBe(true);
    expect(isThanksOrRefusal('Благодарю')).toBe(true);
    expect(isThanksOrRefusal('Дякую, а скільки коштує?')).toBe(false);
    expect(isThanksOrRefusal('Доброго дня! Дякую за інформацію, покажіть ще моделі')).toBe(false);
    expect(isThanksOrRefusal('бажаю замовити')).toBe(false);
    expect(isThanksOrRefusal(undefined)).toBe(false);
  });

  it('recognizes the press-here prompt', () => {
    expect(isPressHerePrompt('⬇натисніть тут⬇')).toBe(true);
    expect(isPressHerePrompt('Вітаю')).toBe(false);
  });
});
