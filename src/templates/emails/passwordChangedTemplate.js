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
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 0;
                background-color: #f8f9fa;
            }
            .container {
                background-color: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                margin: 20px;
            }
            .header {
                background: linear-gradient(135deg, #efb414 0%, #d4a017 100%);
                color: white;
                padding: 30px 20px;
                text-align: center;
            }
            .logo {
                width: 80px;
                height: 80px;
                margin: 0 auto 15px;
                background-color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .logo img {
                width: 50px;
                height: 50px;
                object-fit: contain;
            }
            .content {
                padding: 40px 30px;
                text-align: center;
            }
            .success-box {
                background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
                border: 2px solid #10b981;
                border-radius: 12px;
                padding: 25px;
                margin: 25px 0;
                text-align: center;
            }
            .success-icon {
                font-size: 48px;
                margin-bottom: 15px;
            }
            .details {
                background-color: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: left;
            }
            .warning-box {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                color: #856404;
                font-size: 14px;
            }
            .footer {
                text-align: center;
                padding: 20px 30px;
                color: #6c757d;
                font-size: 14px;
                background-color: #f8f9fa;
                border-top: 1px solid #e9ecef;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">
                    <img src="https://typerka-2026.vercel.app/assets/brand/logo.png" alt="Typerka Logo">
                </div>
                <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Hasło zmienione</h1>
                <p style="margin: 10px 0 0; opacity: 0.9;">Potwierdzenie zmiany</p>
            </div>
            
            <div class="content">
                <div class="success-box">
                    <div class="success-icon">✅</div>
                    <h3 style="color: #059669; margin: 0 0 10px;">Hasło zostało zmienione!</h3>
                    <p style="margin: 0; color: #047857;">Twoje konto jest bezpieczne</p>
                </div>
                
                <div class="details">
                    <p style="margin: 0 0 10px;"><strong>Email:</strong> ${email_receiver}</p>
                    <p style="margin: 0;"><strong>Data:</strong> ${new Date().toLocaleString('pl-PL')}</p>
                </div>
                
                <div class="warning-box">
                    <strong>⚠️ Ważne:</strong> Jeśli to nie Ty zmieniłeś hasło, natychmiast skontaktuj się z nami.
                </div>
            </div>
            
            <div class="footer">
                <p style="margin: 0;">© 2024 Typerka. Wszystkie prawa zastrzeżone.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

export const passwordChangedEmailTextTemplate = (email_receiver) => {
    return `
Hasło zostało zmienione - Typerka

✅ Twoje hasło zostało pomyślnie zmienione!

Email: ${email_receiver}
Data: ${new Date().toLocaleString('pl-PL')}

⚠️ Jeśli to nie Ty zmieniłeś hasło, natychmiast skontaktuj się z nami.

© 2024 Typerka. Wszystkie prawa zastrzeżone.
    `;
};
