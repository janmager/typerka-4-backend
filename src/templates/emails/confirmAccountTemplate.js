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
            .button {
                display: inline-block;
                background: linear-gradient(135deg, #efb414 0%, #d4a017 100%);
                color: white;
                padding: 16px 32px;
                text-decoration: none;
                border-radius: 8px;
                margin: 25px 0;
                font-weight: 600;
                font-size: 16px;
                box-shadow: 0 4px 12px rgba(239, 180, 20, 0.3);
                transition: transform 0.2s ease;
            }
            .button:hover {
                transform: translateY(-2px);
            }
            .link-box {
                background-color: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                word-break: break-all;
                font-size: 14px;
                color: #6c757d;
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
                <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Witaj w Typerka!</h1>
                <p style="margin: 10px 0 0; opacity: 0.9;">Aktywuj swoje konto</p>
            </div>
            
            <div class="content">
                <p style="font-size: 18px; margin-bottom: 25px;">Dziękujemy za rejestrację! Kliknij przycisk poniżej, aby aktywować konto:</p>
                
                <a href="${process.env.HOST}/potwierdz-konto?user_id=${user_id}&email_token=${email_token}" class="button">
                    Potwierdź konto
                </a>
                
                <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">Jeśli przycisk nie działa, skopiuj link:</p>
                <div class="link-box">
                    ${process.env.HOST}/potwierdz-konto?user_id=${user_id}&email_token=${email_token}
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

export const confirmAccountEmailTextTemplate = (email, email_token, user_id) => {
    return `
Witaj w Typerka!

Dziękujemy za rejestrację! Aby aktywować konto, kliknij link:

${process.env.HOST}/potwierdz-konto?user_id=${user_id}&email_token=${email_token}

© 2024 Typerka. Wszystkie prawa zastrzeżone.
    `;
};
