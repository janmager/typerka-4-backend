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
            .message-box {
                background-color: white;
                border: 1px solid #d1d5db;
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
            <p>Nowa wiadomość kontaktowa</p>
        </div>
        
        <div class="content">
            <h2>Otrzymano nową wiadomość kontaktową</h2>
            
            <div class="message-box">
                <h3>Tytuł: ${title}</h3>
                <p><strong>Od:</strong> ${email_sender}</p>
                <p><strong>Data:</strong> ${timestamp}</p>
                
                <h4>Treść wiadomości:</h4>
                <p style="white-space: pre-wrap;">${content}</p>
            </div>
            
            <p><strong>Odpowiedz na wiadomość:</strong> ${email_sender}</p>
        </div>
        
        <div class="footer">
            <p>To wiadomość została wysłana automatycznie z formularza kontaktowego Typerka.</p>
            <p>© 2024 Typerka. Wszystkie prawa zastrzeżone.</p>
        </div>
    </body>
    </html>
    `;
};

export const contactEmailTextTemplate = (email_sender, title, content, timestamp) => {
    return `
Otrzymano nową wiadomość kontaktową

Tytuł: ${title}
Od: ${email_sender}
Data: ${timestamp}

Treść wiadomości:
${content}

Odpowiedz na wiadomość: ${email_sender}

To wiadomość została wysłana automatycznie z formularza kontaktowego Typerka.

© 2024 Typerka. Wszystkie prawa zastrzeżone.
    `;
};
