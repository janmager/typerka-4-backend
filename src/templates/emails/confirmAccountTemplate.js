export const confirmAccountEmailTemplate = (email, email_token, user_id) => {
    return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Potwierdzenie konta - Typerka</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                background-color: #1f2937;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
            }
            .content {
                background-color: #f9fafb;
                padding: 30px;
                border-radius: 0 0 8px 8px;
            }
            .button {
                display: inline-block;
                background-color: #3b82f6;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
                font-weight: bold;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #6b7280;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>⚽ Typerka</h1>
            <p>Gra internetowa do typowania wyników meczów piłkarskich</p>
        </div>
        
        <div class="content">
            <h2>Witaj w Typerka!</h2>
            <p>Cześć!</p>
            <p>Dziękujemy za rejestrację w grze Typerka. Aby aktywować swoje konto, kliknij poniższy przycisk:</p>
            
            <div style="text-align: center;">
                <a href="${process.env.HOST}/potwierdz-konto?user_id=${user_id}&email_token=${email_token}" class="button">
                    Potwierdź konto
                </a>
            </div>
            
            <p>Jeśli przycisk nie działa, skopiuj i wklej poniższy link do przeglądarki:</p>
            <p style="word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 4px;">
                ${process.env.HOST}/potwierdz-konto?user_id=${user_id}&email_token=${email_token}
            </p>
            
            <p><strong>Co dalej?</strong></p>
            <ul>
                <li>Po potwierdzeniu konta będziesz mógł zalogować się do gry</li>
                <li>Stwórz lub dołącz do turnieju ze znajomymi</li>
                <li>Typuj dokładne wyniki meczów piłkarskich</li>
                <li>Rywalizuj o pierwsze miejsce w tabeli</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>To wiadomość została wysłana automatycznie. Nie odpowiadaj na nią.</p>
            <p>© 2024 Typerka. Wszystkie prawa zastrzeżone.</p>
        </div>
    </body>
    </html>
    `;
};

export const confirmAccountEmailTextTemplate = (email, email_token, user_id) => {
    return `
Witaj w Typerka!

Cześć!

Dziękujemy za rejestrację w grze Typerka. Aby aktywować swoje konto, skopiuj i wklej poniższy link do przeglądarki:

${process.env.HOST}/potwierdz-konto?user_id=${user_id}&email_token=${email_token}

Co dalej?
- Po potwierdzeniu konta będziesz mógł zalogować się do gry
- Stwórz lub dołącz do turnieju ze znajomymi
- Typuj dokładne wyniki meczów piłkarskich
- Rywalizuj o pierwsze miejsce w tabeli

To wiadomość została wysłana automatycznie. Nie odpowiadaj na nią.

© 2024 Typerka. Wszystkie prawa zastrzeżone.
    `;
};
