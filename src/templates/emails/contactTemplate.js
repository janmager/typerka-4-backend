export const contactEmailTemplate = (email_sender, title, content, timestamp) => {
    return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Wiadomość kontaktowa - Typerka</title>
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
                width: 60px;
                height: 60px;
                margin: 0 auto 15px;
                background-color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .logo img {
                width: 35px;
                height: 35px;
                object-fit: contain;
            }
            .content {
                padding: 30px;
            }
            .message-box {
                background-color: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .message-title {
                color: #efb414;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
            }
            .message-meta {
                color: #6c757d;
                font-size: 14px;
                margin-bottom: 15px;
            }
            .message-content {
                background-color: white;
                padding: 15px;
                border-radius: 6px;
                border-left: 4px solid #efb414;
                white-space: pre-wrap;
                line-height: 1.5;
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
                <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Nowa wiadomość</h1>
                <p style="margin: 10px 0 0; opacity: 0.9;">Formularz kontaktowy</p>
            </div>
            
            <div class="content">
                <div class="message-box">
                    <div class="message-title">${title}</div>
                    <div class="message-meta">
                        <strong>Od:</strong> ${email_sender}<br>
                        <strong>Data:</strong> ${timestamp}
                    </div>
                    <div class="message-content">${content}</div>
                </div>
                
                <p style="text-align: center; margin-top: 25px;">
                    <strong>Odpowiedz:</strong> <a href="mailto:${email_sender}" style="color: #efb414;">${email_sender}</a>
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

export const contactEmailTextTemplate = (email_sender, title, content, timestamp) => {
    return `
Nowa wiadomość kontaktowa

Tytuł: ${title}
Od: ${email_sender}
Data: ${timestamp}

Treść:
${content}

Odpowiedz: ${email_sender}

© 2024 Typerka. Wszystkie prawa zastrzeżone.
    `;
};
