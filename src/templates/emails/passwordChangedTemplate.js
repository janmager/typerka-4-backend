export const passwordChangedEmailTemplate = (email_receiver) => {
    return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hasło zostało zmienione - Typerka</title>
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
            .success-box {
                background-color: #d1fae5;
                border: 1px solid #10b981;
                border-radius: 6px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
            }
            .warning-box {
                background-color: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 6px;
                padding: 20px;
                margin: 20px 0;
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
            <p>Hasło zostało zmienione</p>
        </div>
        
        <div class="content">
            <h2>Hasło zostało pomyślnie zmienione</h2>
            <p>Cześć!</p>
            
            <div class="success-box">
                <h3>✅ Hasło zostało zmienione</h3>
                <p>Twoje hasło do konta Typerka zostało pomyślnie zaktualizowane.</p>
            </div>
            
            <p><strong>Szczegóły zmiany:</strong></p>
            <ul>
                <li>Email: <strong>${email_receiver}</strong></li>
                <li>Data zmiany: <strong>${new Date().toLocaleString('pl-PL')}</strong></li>
                <li>Status: <strong>Zmienione pomyślnie</strong></li>
            </ul>
            
            <div class="warning-box">
                <h4>⚠️ Ważne informacje</h4>
                <ul>
                    <li>Jeśli to nie Ty zmieniłeś hasło, natychmiast skontaktuj się z nami</li>
                    <li>Upewnij się, że używasz silnego hasła</li>
                    <li>Nie udostępniaj swojego hasła nikomu</li>
                </ul>
            </div>
            
            <p><strong>Co dalej?</strong></p>
            <ul>
                <li>Możesz teraz zalogować się używając nowego hasła</li>
                <li>Twoje konto jest bezpieczne i gotowe do użycia</li>
                <li>Wszystkie aktywne sesje zostały zakończone dla bezpieczeństwa</li>
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

export const passwordChangedEmailTextTemplate = (email_receiver) => {
    return `
Hasło zostało pomyślnie zmienione

Cześć!

Twoje hasło do konta Typerka zostało pomyślnie zaktualizowane.

Szczegóły zmiany:
- Email: ${email_receiver}
- Data zmiany: ${new Date().toLocaleString('pl-PL')}
- Status: Zmienione pomyślnie

Ważne informacje:
- Jeśli to nie Ty zmieniłeś hasło, natychmiast skontaktuj się z nami
- Upewnij się, że używasz silnego hasła
- Nie udostępniaj swojego hasła nikomu

Co dalej?
- Możesz teraz zalogować się używając nowego hasła
- Twoje konto jest bezpieczne i gotowe do użycia
- Wszystkie aktywne sesje zostały zakończone dla bezpieczeństwa

To wiadomość została wysłana automatycznie. Nie odpowiadaj na nią.

© 2024 Typerka. Wszystkie prawa zastrzeżone.
    `;
};
