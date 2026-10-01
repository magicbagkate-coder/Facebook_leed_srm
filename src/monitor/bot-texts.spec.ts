import { isButtonOrLike, isLikeSticker, isPressHerePrompt, isPriceButton, isThanksOrRefusal } from '#app/monitor/bot-texts.js';

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

  it('recognizes the Facebook like sticker but not a real photo', () => {
    const sticker = 'https://scontent.xx.fbcdn.net/v/t39.1997-6/39178562_1505197616293642_n.png?stp=cp0';
    const photo = 'https://scontent.xx.fbcdn.net/v/t1.15752-9/825260946_2289111_n.jpg?stp=dst';
    expect(isLikeSticker({ messageType: 'image', text: '', attachmentUrl: sticker })).toBe(true);
    expect(isLikeSticker({ messageType: 'image', text: '', attachmentUrl: photo })).toBe(false);
    expect(isLikeSticker({ messageType: 'text', text: 'hello', attachmentUrl: sticker })).toBe(false);
  });

  it('treats the price button and a like as not a live message', () => {
    expect(isButtonOrLike({ text: 'дізнатись ціну' })).toBe(true);
    expect(isButtonOrLike({ text: 'бажаю замовити' })).toBe(false);
  });

  it('recognizes the press-here prompt', () => {
    expect(isPressHerePrompt('⬇натисніть тут⬇')).toBe(true);
    expect(isPressHerePrompt('Вітаю')).toBe(false);
  });
});
