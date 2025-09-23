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
            .password-box {
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border: 2px solid #efb414;
                border-radius: 12px;
                padding: 25px;
                margin: 25px 0;
                text-align: center;
            }
            .password {
                font-family: 'Courier New', monospace;
                font-size: 20px;
                font-weight: bold;
                color: #333;
                background-color: white;
                padding: 15px 20px;
                border-radius: 8px;
                margin: 15px 0;
                border: 1px solid #dee2e6;
                letter-spacing: 1px;
            }
            .warning {
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
                <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Nowe hasło</h1>
                <p style="margin: 10px 0 0; opacity: 0.9;">Twoje dane logowania</p>
            </div>
            
            <div class="content">
                <p style="font-size: 18px; margin-bottom: 25px;">Oto Twoje nowe hasło do konta Typerka:</p>
                
                <div class="password-box">
                    <h3 style="color: #efb414; margin-bottom: 15px;">Twoje hasło:</h3>
                    <div class="password">${new_password}</div>
                </div>
                
                <div class="warning">
                    <strong>⚠️ Ważne:</strong> Zmień to hasło po pierwszym zalogowaniu dla bezpieczeństwa.
                </div>
                
                <p style="margin-top: 30px; font-size: 16px;">
                    <strong>Email:</strong> ${email_receiver}
                </p>
            </div>
            
            <div class="footer">
                <p style="margin: 0;">© 2024 Typerka. Wszystkie prawa zastrzeżone.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

export const newPasswordEmailTextTemplate = (email_receiver, new_password) => {
    return `
Nowe hasło - Typerka

Twoje nowe hasło: ${new_password}
Email: ${email_receiver}

WAŻNE: Zmień to hasło po pierwszym zalogowaniu.

© 2024 Typerka. Wszystkie prawa zastrzeżone.
    `;
};
