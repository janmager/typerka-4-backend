import express from "express";
import { sendContactMessage, sendConfirmAccountEmail, sendNewPasswordEmail, sendRequestPasswordResetEmail, sendPasswordChangedEmail } from "../controllers/mailingController.js";

const router = express.Router();

// POST /api/mailing/contact - Send contact form message
router.post("/contact", sendContactMessage);

// POST /api/mailing/confirmAccount - Send account confirmation email
router.post("/confirmAccount", sendConfirmAccountEmail);

// POST /api/mailing/newPassword - Send new password email
router.post("/newPassword", sendNewPasswordEmail);

// POST /api/mailing/requestNewPassword - Send password reset request email
router.post("/requestNewPassword", sendRequestPasswordResetEmail);

// POST /api/mailing/passwordChanged - Send password changed notification email
router.post("/passwordChanged", sendPasswordChangedEmail);

export default router;
