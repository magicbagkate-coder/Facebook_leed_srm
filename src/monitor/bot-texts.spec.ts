import { isButtonOrLike, isLikeSticker, isManagerHandoff, isPressHerePrompt, isPriceButton, isThanksOrRefusal } from '#app/monitor/bot-texts.js';

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

  it('treats a short "no interest" answer as a refusal', () => {
    expect(isThanksOrRefusal('Дорого')).toBe(true);
    expect(isThanksOrRefusal('Ні')).toBe(true);
    expect(isThanksOrRefusal('Не цікаво')).toBe(true);
    expect(isThanksOrRefusal('Не хочу, дякую')).toBe(true);
    expect(isThanksOrRefusal('Подумаю')).toBe(true);
  });

  it('treats interest, agreement and unclear answers as a live reply', () => {
    expect(isThanksOrRefusal('Так, цікаво')).toBe(false);
    expect(isThanksOrRefusal('Дякую, так')).toBe(false);
    expect(isThanksOrRefusal('Цікаво')).toBe(false);
    expect(isThanksOrRefusal('ок')).toBe(false);
    expect(isThanksOrRefusal('🙂')).toBe(false);
    expect(isThanksOrRefusal('Чому так дорого?')).toBe(false);
    expect(isThanksOrRefusal('Покажіть ще')).toBe(false);
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

  it('recognizes the bot messages that hand the client over to a manager', () => {
    expect(isManagerHandoff('Звісно🤍 Менеджер зараз підбере для Вас інші моделі')).toBe(true);
    expect(isManagerHandoff('Зараз наш менеджер відправить вам більше фото')).toBe(true);
    expect(isManagerHandoff('Зараз допоможемо оформити вам замовлення')).toBe(true);
    expect(isManagerHandoff('Вітаю💛 Гарний вибір! Вартість сумки 1595 грн')).toBe(false);
    expect(isManagerHandoff('⬇натисніть тут⬇')).toBe(false);
    expect(isManagerHandoff(undefined)).toBe(false);
  });

  it('recognizes the press-here prompt', () => {
    expect(isPressHerePrompt('⬇натисніть тут⬇')).toBe(true);
    expect(isPressHerePrompt('Вітаю')).toBe(false);
  });
});
