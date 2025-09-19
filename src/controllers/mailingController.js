import nodemailer from 'nodemailer';
import 'dotenv/config';
import { contactEmailTemplate, contactEmailTextTemplate } from '../templates/emails/contactTemplate.js';
import { confirmAccountEmailTemplate, confirmAccountEmailTextTemplate } from '../templates/emails/confirmAccountTemplate.js';
import { newPasswordEmailTemplate, newPasswordEmailTextTemplate } from '../templates/emails/newPasswordTemplate.js';
import { requestPasswordResetEmailTemplate, requestPasswordResetEmailTextTemplate } from '../templates/emails/requestPasswordResetTemplate.js';
import { passwordChangedEmailTemplate, passwordChangedEmailTextTemplate } from '../templates/emails/passwordChangedTemplate.js';

// Create email transporter
const createTransporter = () => {
    const port = parseInt(process.env.SMTP_PORT);
    const isSecure = port === 465;
    
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: isSecure, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS?.replace(/['"]/g, '') // Remove quotes if present
        }
    });
};

export async function sendContactMessage(req, res) {
    try {
        const { title, content, email_sender } = req.body;
        
        // Validate required fields
        if (!title || !content || !email_sender) {
            return res.status(400).json({ 
                message: "Tytuł, treść i email_sender są wymagane.", 
                response: false 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email_sender)) {
            return res.status(400).json({ 
                message: "Proszę podać prawidłowy adres email.", 
                response: false 
            });
        }
        
        // Create transporter
        const transporter = createTransporter();
        
        // Verify transporter configuration
        try {
            await transporter.verify();
            console.log('SMTP connection verified successfully');
        } catch (error) {
            console.error('SMTP configuration error:', error);
            return res.status(500).json({ 
                message: "Błąd konfiguracji usługi email.", 
                response: false 
            });
        }
        
        // Generate timestamp
        const timestamp = new Date().toLocaleString('pl-PL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Email content using template
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: process.env.CONTACT_EMAIL,
            subject: `Wiadomość kontaktowa: ${title} | ${timestamp}`,
            html: contactEmailTemplate(email_sender, title, content, timestamp),
            text: contactEmailTextTemplate(email_sender, title, content, timestamp)
        };
        
        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('Contact email sent:', info.messageId);
        
        res.status(200).json({ 
            message: "Wiadomość kontaktowa została pomyślnie wysłana.", 
            response: true,
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('Error sending contact email:', error);
        res.status(500).json({ 
            message: "Nie udało się wysłać wiadomości kontaktowej. Spróbuj ponownie później.", 
            response: false 
        });
    }
}

export async function sendConfirmAccountEmail(req, res) {
    try {
        const { user_id, email_token, email_receiver } = req.body;
        
        // Validate required fields
        if (!user_id || !email_token || !email_receiver) {
            return res.status(400).json({ 
                message: "user_id, email_token i email_receiver są wymagane.", 
                response: false 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email_receiver)) {
            return res.status(400).json({ 
                message: "Proszę podać prawidłowy adres email.", 
                response: false 
            });
        }
        
        // Create transporter
        const transporter = createTransporter();
        
        // Verify transporter configuration
        try {
            await transporter.verify();
            console.log('SMTP connection verified successfully for account confirmation');
        } catch (error) {
            console.error('SMTP configuration error:', error);
            return res.status(500).json({ 
                message: "Błąd konfiguracji usługi email.", 
                response: false 
            });
        }
        
        // Email content using template
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email_receiver,
            subject: `Potwierdzenie konta - Typerka | ${new Date().toLocaleString()}`,
            html: confirmAccountEmailTemplate(email_receiver, email_token, user_id),
            text: confirmAccountEmailTextTemplate(email_receiver, email_token, user_id)
        };
        
        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('Account confirmation email sent:', info.messageId);
        
        res.status(200).json({ 
            message: "Email potwierdzenia konta został pomyślnie wysłany.", 
            response: true,
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('Error sending account confirmation email:', error);
        res.status(500).json({ 
            message: "Nie udało się wysłać emaila potwierdzenia konta. Spróbuj ponownie później.", 
            response: false 
        });
    }
}

// Helper function for internal use (without Express req/res)
export async function sendConfirmAccountEmailInternal(user_id, email_token, email_receiver) {
    try {
        // Validate required fields
        if (!user_id || !email_token || !email_receiver) {
            throw new Error("user_id, email_token, and email_receiver are required.");
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email_receiver)) {
            throw new Error("Please provide a valid email address.");
        }
        
        // Create transporter
        const transporter = createTransporter();
        
        // Verify transporter configuration
        await transporter.verify();
        console.log('SMTP connection verified successfully for account confirmation');
        
        // Email content using template
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email_receiver,
            subject: `Potwierdzenie konta - Typerka`,
            html: confirmAccountEmailTemplate(email_receiver, email_token, user_id),
            text: confirmAccountEmailTextTemplate(email_receiver, email_token, user_id)
        };
        
        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('Account confirmation email sent:', info.messageId);
        
        return {
            success: true,
            messageId: info.messageId,
            message: "Email potwierdzenia konta został pomyślnie wysłany."
        };
        
    } catch (error) {
        console.error('Error sending account confirmation email:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

export async function sendNewPasswordEmail(req, res) {
    try {
        const { email_receiver, new_password } = req.body;
        
        // Validate required fields
        if (!email_receiver || !new_password) {
            return res.status(400).json({ 
                message: "email_receiver i new_password są wymagane.", 
                response: false 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email_receiver)) {
            return res.status(400).json({ 
                message: "Proszę podać prawidłowy adres email.", 
                response: false 
            });
        }
        
        // Create transporter
        const transporter = createTransporter();
        
        // Verify transporter configuration
        try {
            await transporter.verify();
            console.log('SMTP connection verified successfully for new password email');
        } catch (error) {
            console.error('SMTP configuration error:', error);
            return res.status(500).json({ 
                message: "Błąd konfiguracji usługi email.", 
                response: false 
            });
        }
        
        // Email content using template
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email_receiver,
            subject: `Nowe hasło - Typerka | ${new Date().toLocaleString()}`,
            html: newPasswordEmailTemplate(email_receiver, new_password),
            text: newPasswordEmailTextTemplate(email_receiver, new_password)
        };
        
        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('New password email sent:', info.messageId);
        
        res.status(200).json({ 
            message: "Email z nowym hasłem został pomyślnie wysłany.", 
            response: true,
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('Error sending new password email:', error);
        res.status(500).json({ 
            message: "Nie udało się wysłać emaila z nowym hasłem. Spróbuj ponownie później.", 
            response: false 
        });
    }
}

export async function sendRequestPasswordResetEmail(req, res) {
    try {
        const { email_receiver, user_id, email_token } = req.body;
        
        // Validate required fields
        if (!email_receiver || !user_id || !email_token) {
            return res.status(400).json({ 
                message: "email_receiver, user_id i email_token są wymagane.", 
                response: false 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email_receiver)) {
            return res.status(400).json({ 
                message: "Proszę podać prawidłowy adres email.", 
                response: false 
            });
        }
        
        // Create transporter
        const transporter = createTransporter();
        
        // Verify transporter configuration
        try {
            await transporter.verify();
            console.log('SMTP connection verified successfully for password reset request email');
        } catch (error) {
            console.error('SMTP configuration error:', error);
            return res.status(500).json({ 
                message: "Błąd konfiguracji usługi email.", 
                response: false 
            });
        }
        
        // Email content using template
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email_receiver,
            subject: `Reset hasła - Typerka | ${new Date().toLocaleString()}`,
            html: requestPasswordResetEmailTemplate(email_receiver, user_id, email_token),
            text: requestPasswordResetEmailTextTemplate(email_receiver, user_id, email_token)
        };
        
        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('Password reset request email sent:', info.messageId);
        
        res.status(200).json({ 
            message: "Email żądania resetowania hasła został pomyślnie wysłany.", 
            response: true,
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('Error sending password reset request email:', error);
        res.status(500).json({ 
            message: "Nie udało się wysłać emaila żądania resetowania hasła. Spróbuj ponownie później.", 
            response: false 
        });
    }
}

// Helper function for internal use (without Express req/res)
export async function sendRequestPasswordResetEmailInternal(email_receiver, user_id, email_token) {
    try {
        // Validate required fields
        if (!email_receiver || !user_id || !email_token) {
            throw new Error("email_receiver, user_id, and email_token are required.");
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email_receiver)) {
            throw new Error("Please provide a valid email address.");
        }
        
        // Create transporter
        const transporter = createTransporter();
        
        // Verify transporter configuration
        await transporter.verify();
        console.log('SMTP connection verified successfully for password reset request email');
        
        // Email content using template
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email_receiver,
            subject: `Reset hasła - Typerka`,
            html: requestPasswordResetEmailTemplate(email_receiver, user_id, email_token),
            text: requestPasswordResetEmailTextTemplate(email_receiver, user_id, email_token)
        };
        
        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('Password reset request email sent:', info.messageId);
        
        return {
            success: true,
            messageId: info.messageId,
            message: "Email żądania resetowania hasła został pomyślnie wysłany."
        };
        
    } catch (error) {
        console.error('Error sending password reset request email:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

export async function sendPasswordChangedEmail(req, res) {
    try {
        const { email_receiver } = req.body;
        
        // Validate required fields
        if (!email_receiver) {
            return res.status(400).json({ 
                message: "email_receiver jest wymagany.", 
                response: false 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email_receiver)) {
            return res.status(400).json({ 
                message: "Proszę podać prawidłowy adres email.", 
                response: false 
            });
        }
        
        // Create transporter
        const transporter = createTransporter();
        
        // Verify transporter configuration
        try {
            await transporter.verify();
            console.log('SMTP connection verified successfully for password changed email');
        } catch (error) {
            console.error('SMTP configuration error:', error);
            return res.status(500).json({ 
                message: "Błąd konfiguracji usługi email.", 
                response: false 
            });
        }
        
        // Email content using template
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email_receiver,
            subject: `Hasło zostało zmienione - Typerka | ${new Date().toLocaleString()}`,
            html: passwordChangedEmailTemplate(email_receiver),
            text: passwordChangedEmailTextTemplate(email_receiver)
        };
        
        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('Password changed email sent:', info.messageId);
        
        res.status(200).json({ 
            message: "Email powiadomienia o zmianie hasła został pomyślnie wysłany.", 
            response: true,
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('Error sending password changed email:', error);
        res.status(500).json({ 
            message: "Nie udało się wysłać emaila powiadomienia o zmianie hasła. Spróbuj ponownie później.", 
            response: false 
        });
    }
}

// Helper function for internal use (without Express req/res)
export async function sendPasswordChangedEmailInternal(email_receiver) {
    try {
        // Validate required fields
        if (!email_receiver) {
            throw new Error("email_receiver is required.");
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email_receiver)) {
            throw new Error("Please provide a valid email address.");
        }
        
        // Create transporter
        const transporter = createTransporter();
        
        // Verify transporter configuration
        await transporter.verify();
        console.log('SMTP connection verified successfully for password changed email');
        
        // Email content using template
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email_receiver,
            subject: `Hasło zostało zmienione - Typerka`,
            html: passwordChangedEmailTemplate(email_receiver),
            text: passwordChangedEmailTextTemplate(email_receiver)
        };
        
        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('Password changed email sent:', info.messageId);
        
        return {
            success: true,
            messageId: info.messageId,
            message: "Email powiadomienia o zmianie hasła został pomyślnie wysłany."
        };
        
    } catch (error) {
        console.error('Error sending password changed email:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
