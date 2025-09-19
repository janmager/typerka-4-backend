export const requestPasswordResetEmailTemplate = (email_receiver, user_id, email_token) => {
    return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset hasła - Typerka</title>
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
            <p>Reset hasła</p>
        </div>
        
        <div class="content">
            <h2>Żądanie resetowania hasła</h2>
            <p>Cześć!</p>
            <p>Otrzymałeś ten email, ponieważ ktoś (prawdopodobnie Ty) poprosił o zresetowanie hasła do Twojego konta w grze Typerka.</p>
            
            <div style="text-align: center;">
                <a href="${process.env.API_URL}/api/users/resetPassword?user_id=${user_id}&email_token=${email_token}" class="button">
                    Zresetuj hasło
                </a>
            </div>
            
            <p>Jeśli przycisk nie działa, skopiuj i wklej poniższy link do przeglądarki:</p>
            <p style="word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 4px;">
                ${process.env.API_URL}/api/users/resetPassword?user_id=${user_id}&email_token=${email_token}
            </p>
            
            <p><strong>Ważne informacje:</strong></p>
            <ul>
                <li>Ten link jest ważny przez 24 godziny</li>
                <li>Po kliknięciu w link będziesz mógł ustawić nowe hasło</li>
                <li>Jeśli nie prosiłeś o reset hasła, zignoruj ten email</li>
            </ul>
            
            <p><strong>Bezpieczeństwo:</strong></p>
            <ul>
                <li>Nigdy nie udostępniaj tego linku nikomu</li>
                <li>Używaj silnego hasła zawierającego litery, cyfry i znaki specjalne</li>
                <li>Jeśli podejrzewasz nieautoryzowany dostęp, skontaktuj się z nami</li>
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

export const requestPasswordResetEmailTextTemplate = (email_receiver, user_id, email_token) => {
    return `
Żądanie resetowania hasła

Cześć!

Otrzymałeś ten email, ponieważ ktoś (prawdopodobnie Ty) poprosił o zresetowanie hasła do Twojego konta w grze Typerka.

Aby zresetować hasło, skopiuj i wklej poniższy link do przeglądarki:

${process.env.API_URL}/api/users/resetPassword?user_id=${user_id}&email_token=${email_token}

Ważne informacje:
- Ten link jest ważny przez 24 godziny
- Po kliknięciu w link będziesz mógł ustawić nowe hasło
- Jeśli nie prosiłeś o reset hasła, zignoruj ten email

Bezpieczeństwo:
- Nigdy nie udostępniaj tego linku nikomu
- Używaj silnego hasła zawierającego litery, cyfry i znaki specjalne
- Jeśli podejrzewasz nieautoryzowany dostęp, skontaktuj się z nami

To wiadomość została wysłana automatycznie. Nie odpowiadaj na nią.

© 2024 Typerka. Wszystkie prawa zastrzeżone.
    `;
};
