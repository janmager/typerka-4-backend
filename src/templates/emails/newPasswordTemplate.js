export const newPasswordEmailTemplate = (email_receiver, new_password) => {
    return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nowe hasło - Typerka</title>
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
            .password-box {
                background-color: white;
                border: 2px solid #3b82f6;
                border-radius: 6px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
            }
            .password {
                font-family: monospace;
                font-size: 18px;
                font-weight: bold;
                color: #1f2937;
                background-color: #f3f4f6;
                padding: 10px;
                border-radius: 4px;
                margin: 10px 0;
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
            <p>Twoje nowe hasło</p>
        </div>
        
        <div class="content">
            <h2>Oto Twoje nowe hasło</h2>
            <p>Cześć!</p>
            <p>Otrzymałeś nowe hasło do swojego konta w grze Typerka. Poniżej znajdziesz dane logowania:</p>
            
            <div class="password-box">
                <h3>Twoje nowe hasło:</h3>
                <div class="password">${new_password}</div>
                <p><small>Zalecamy zmianę tego hasła po pierwszym zalogowaniu</small></p>
            </div>
            
            <p><strong>Jak się zalogować:</strong></p>
            <ol>
                <li>Przejdź na stronę logowania</li>
                <li>Wpisz swój email: <strong>${email_receiver}</strong></li>
                <li>Wpisz nowe hasło z tego emaila</li>
                <li>Kliknij "Zaloguj się"</li>
            </ol>
            
            <p><strong>Bezpieczeństwo:</strong></p>
            <ul>
                <li>Nie udostępniaj tego hasła nikomu</li>
                <li>Zmień hasło po pierwszym zalogowaniu</li>
                <li>Używaj silnego hasła zawierającego litery, cyfry i znaki specjalne</li>
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

export const newPasswordEmailTextTemplate = (email_receiver, new_password) => {
    return `
Oto Twoje nowe hasło

Cześć!

Otrzymałeś nowe hasło do swojego konta w grze Typerka. Poniżej znajdziesz dane logowania:

Twoje nowe hasło: ${new_password}

Jak się zalogować:
1. Przejdź na stronę logowania
2. Wpisz swój email: ${email_receiver}
3. Wpisz nowe hasło z tego emaila
4. Kliknij "Zaloguj się"

Bezpieczeństwo:
- Nie udostępniaj tego hasła nikomu
- Zmień hasło po pierwszym zalogowaniu
- Używaj silnego hasła zawierającego litery, cyfry i znaki specjalne

To wiadomość została wysłana automatycznie. Nie odpowiadaj na nią.

© 2024 Typerka. Wszystkie prawa zastrzeżone.
    `;
};
