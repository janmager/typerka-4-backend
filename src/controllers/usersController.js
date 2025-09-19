import { sql } from "../config/db.js";
import { hashPass, comparePass } from "../config/password.js";
import { sendConfirmAccountEmailInternal, sendRequestPasswordResetEmailInternal, sendPasswordChangedEmailInternal } from "./mailingController.js";

export async function createUser(req, res) {
  try {
    const { email, password } = req.body;
    console.log("Creating user: ", email, password);
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email i hasło są wymagane.", 
        response: false 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: "Proszę podać prawidłowy adres email.", 
        response: false 
      });
    }

    // Hash the password before storing
    const hashedPassword = hashPass(password);
    console.log("Hashed password: ", hashedPassword, 'before: ', password);
    console.log("Is password valid: ", comparePass(password, hashedPassword));
    
    const userId = crypto.randomUUID();
    const emailToken = crypto.randomUUID();
    const userName = email.split("@")[0];
    
    const user = await sql`
        INSERT INTO users (user_id, email, password, name, email_token, register_at) 
        VALUES (${userId}, ${email}, ${hashedPassword}, ${userName}, ${emailToken}, (NOW() + INTERVAL '2 hours'))
        RETURNING *
    `;

    // Send confirmation email to user
    try {
      const emailResult = await sendConfirmAccountEmailInternal(
        user[0].user_id,
        user[0].email_token,
        user[0].email
      );
      
      if (emailResult.success) {
        console.log('Confirmation email sent successfully:', emailResult.messageId);
      } else {
        console.error('Failed to send confirmation email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // Continue with user creation even if email fails
    }

    res.status(200).json({ 
      data: user[0], 
      response: true, 
      message: "Użytkownik został pomyślnie utworzony. Sprawdź swój email aby potwierdzić konto." 
    });
  } catch (e) {
    console.log("Error creating user: ", e);
    
    // Handle specific database errors
    if (e.code === '23505') { // Unique constraint violation
      return res.status(409).json({ 
        message: "Użytkownik z tym adresem email już istnieje.", 
        response: false 
      });
    }
    
    res.status(500).json({ message: "Coś poszło nie tak.", response: false });
  }
}

export async function checkAuthUser(req, res) {
  try {
    // Support both POST (body) and GET (query) parameters
    const { email, password } = req.method === 'POST' ? req.body : req.query;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email i hasło są wymagane.", 
        response: false 
      });
    }
    
    const user = await sql`
        SELECT * FROM users WHERE email = ${email}
    `;
    if (user.length === 0) {
      return res.status(404).json({ message: "Użytkownik nie został znaleziony.", response: false });
    }
    
    // Compare the provided password with the stored hashed password
    const isPasswordValid = comparePass(password, user[0].password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Nieprawidłowe hasło.", response: false });
    }
    
    // Update logged_at timestamp
    await sql`
        UPDATE users 
        SET logged_at = (NOW() + INTERVAL '2 hours'), updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user[0].user_id}
    `;
    
    // Get updated user data
    const updatedUser = await sql`
        SELECT * FROM users WHERE user_id = ${user[0].user_id}
    `;
    
    res.status(200).json({ data: updatedUser[0], response: true, message: "Użytkownik został pomyślnie uwierzytelniony." });
  } catch (e) {
    console.log("Error getting user: ", e);
    res.status(500).json({ message: "Coś poszło nie tak.", response: false });
  }
}

export async function getUser(req, res) {
  try {
    // Support both POST (body) and GET (query) parameters
    const { user_id } = req.method === 'POST' ? req.body : req.query;
    
    // Validate required fields
    if (!user_id) {
      return res.status(400).json({ 
        message: "ID użytkownika jest wymagane.", 
        response: false 
      });
    }
    
    const user = await sql`
        SELECT * FROM users WHERE user_id = ${user_id}
    `;
    if (user.length === 0) {
      return res.status(404).json({ message: "Użytkownik nie został znaleziony.", response: false });
    }
    res.status(200).json({ data: user[0], response: true, message: "Użytkownik został pomyślnie znaleziony." });
  } catch (e) {
    console.log("Error getting user: ", e);
    res.status(500).json({ message: "Coś poszło nie tak.", response: false });
  }
}

export async function confirmAccount(req, res) {
  try {
    // Support both PUT (body) and query parameters
    const { user_id, email_token } = req.method === 'PUT' ? req.body : req.query;
    
    // Validate required fields
    if (!user_id || !email_token) {
      return res.status(400).json({ 
        message: "ID użytkownika i token email są wymagane.", 
        response: false 
      });
    }
    
    // Check if user exists
    const user = await sql`
        SELECT * FROM users WHERE user_id = ${user_id}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ 
        message: "Użytkownik nie został znaleziony.", 
        response: false 
      });
    }
    
    // Check if user status is 'to-confirm'
    if (user[0].state !== 'to-confirm') {
      return res.status(400).json({ 
        message: "Konto zostało już potwierdzone lub ma nieprawidłowy status.", 
        response: false 
      });
    }
    
    // Check if email_token matches
    if (user[0].email_token !== email_token) {
      return res.status(400).json({ 
        message: "Nieprawidłowy token email.", 
        response: false 
      });
    }
    
    // Update user state to 'active' and generate new email_token
    const updatedUser = await sql`
        UPDATE users 
        SET state = 'active', 
            email_token = ${crypto.randomUUID()},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
    `;
    
    console.log('Account confirmed successfully for user:', user_id);
    
    res.status(200).json({ 
      data: updatedUser[0], 
      response: true, 
      message: "Konto zostało pomyślnie potwierdzone." 
    });
    
  } catch (e) {
    console.log("Error confirming account: ", e);
    res.status(500).json({ 
      message: "Coś poszło nie tak podczas potwierdzania konta.", 
      response: false 
    });
  }
}

export async function resetPassword(req, res) {
  try {
    // Support both PUT (body) and query parameters
    const { user_id, email_token, new_password } = req.method === 'PUT' ? req.body : req.query;
    
    // Validate required fields
    if (!user_id || !email_token || !new_password) {
      return res.status(400).json({ 
        message: "user_id, email_token i new_password są wymagane.", 
        response: false 
      });
    }
    
    // Check if user exists with matching user_id and email_token
    const user = await sql`
        SELECT * FROM users WHERE user_id = ${user_id} AND email_token = ${email_token}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ 
        message: "Użytkownik nie został znaleziony lub nieprawidłowy token email.", 
        response: false 
      });
    }
    
    // Hash the provided new password
    const hashedNewPassword = hashPass(new_password);
    
    // Get email from user data
    const userEmail = user[0].email;
    
    // Update user password and generate new email token
    const updatedUser = await sql`
        UPDATE users 
        SET password = ${hashedNewPassword}, 
            email_token = ${crypto.randomUUID()},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
    `;
    
    // Send password changed notification email
    try {
      const emailResult = await sendPasswordChangedEmailInternal(
        userEmail
      );
      
      if (emailResult.success) {
        console.log('Password reset notification email sent successfully:', emailResult.messageId);
      } else {
        console.error('Failed to send password reset notification email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending password reset notification email:', emailError);
      // Continue with password reset even if email fails
    }
    
    console.log('Password reset successfully for user:', userEmail);
    
    res.status(200).json({ 
      message: "Hasło zostało pomyślnie zresetowane. Otrzymasz email potwierdzający.", 
      response: true 
    });
    
  } catch (e) {
    console.log("Error resetting password: ", e);
    res.status(500).json({ 
      message: "Coś poszło nie tak podczas resetowania hasła.", 
      response: false 
    });
  }
}

export async function requestResetPassword(req, res) {
  try {
    const { email } = req.body;
    
    // Validate required fields
    if (!email) {
      return res.status(400).json({ 
        message: "Email jest wymagany.", 
        response: false 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: "Proszę podać prawidłowy adres email.", 
        response: false 
      });
    }
    
    // Check if user exists
    const user = await sql`
        SELECT * FROM users WHERE email = ${email}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ 
        message: "Użytkownik nie został znaleziony.", 
        response: false 
      });
    }
    
    // Generate new email token for password reset
    const newEmailToken = crypto.randomUUID();
    
    // Update user's email_token
    const updatedUser = await sql`
        UPDATE users 
        SET email_token = ${newEmailToken},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE email = ${email}
        RETURNING *
    `;
    
    // Send password reset request email
    try {
      const emailResult = await sendRequestPasswordResetEmailInternal(
        email,
        updatedUser[0].user_id,
        newEmailToken
      );
      
      if (emailResult.success) {
        console.log('Password reset request email sent successfully:', emailResult.messageId);
      } else {
        console.error('Failed to send password reset request email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending password reset request email:', emailError);
      // Continue with token update even if email fails
    }
    
    console.log('Password reset request processed for user:', email);
    
    res.status(200).json({ 
      message: "Żądanie resetowania hasła zostało przetworzone. Sprawdź swój email aby uzyskać dalsze instrukcje.", 
      response: true 
    });
    
  } catch (e) {
    console.log("Error processing password reset request: ", e);
    res.status(500).json({ 
      message: "Coś poszło nie tak podczas przetwarzania żądania resetowania hasła.", 
      response: false 
    });
  }
}

export async function changePassword(req, res) {
  try {
    // Support both PUT (body) and query parameters
    const { new_password, user_id } = req.method === 'PUT' ? req.body : req.query;
    
    // Validate required fields
    if (!new_password || !user_id) {
      return res.status(400).json({ 
        message: "new_password i user_id są wymagane.", 
        response: false 
      });
    }
    
    // Check if user exists
    const user = await sql`
        SELECT * FROM users WHERE user_id = ${user_id}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ 
        message: "Użytkownik nie został znaleziony.", 
        response: false 
      });
    }
    
    // Hash the new password
    const hashedNewPassword = hashPass(new_password);
    
    // Update user password and generate new email token
    const updatedUser = await sql`
        UPDATE users 
        SET password = ${hashedNewPassword}, 
            email_token = ${crypto.randomUUID()},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
    `;
    
    // Send password changed notification email
    try {
      const emailResult = await sendPasswordChangedEmailInternal(
        user[0].email
      );
      
      if (emailResult.success) {
        console.log('Password changed notification email sent successfully:', emailResult.messageId);
      } else {
        console.error('Failed to send password changed notification email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending password changed notification email:', emailError);
      // Continue with password change even if email fails
    }
    
    console.log('Password changed successfully for user:', user[0].email);
    
    res.status(200).json({ 
      message: "Hasło zostało pomyślnie zmienione. Otrzymasz email potwierdzający.", 
      response: true 
    });
    
  } catch (e) {
    console.log("Error changing password: ", e);
    res.status(500).json({ 
      message: "Coś poszło nie tak podczas zmiany hasła.", 
      response: false 
    });
  }
}

export async function editProfile(req, res) {
  try {
    // Support both PUT (body) and query parameters
    const { user_id, name, phone, active_room, push_notifications, type, avatar } = req.method === 'PUT' ? req.body : req.query;
    
    // Validate required fields
    if (!user_id) {
      return res.status(400).json({ 
        message: "user_id jest wymagany.", 
        response: false 
      });
    }
    
    // Check if user exists and get current values
    const user = await sql`
        SELECT * FROM users WHERE user_id = ${user_id}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ 
        message: "Użytkownik nie został znaleziony.", 
        response: false 
      });
    }
    
    const currentUser = user[0];
    
    // Helper function to normalize values for comparison
    const normalizeValue = (value) => {
      if (value === null || value === undefined || value === '') {
        return '';
      }
      return String(value).trim();
    };
    
    // Check which fields have actually changed
    const changes = {};
    let hasChanges = false;
    
    if (name !== undefined && normalizeValue(name) !== normalizeValue(currentUser.name)) {
      changes.name = name;
      hasChanges = true;
    }
    
    if (phone !== undefined && normalizeValue(phone) !== normalizeValue(currentUser.phone)) {
      changes.phone = phone;
      hasChanges = true;
    }
    
    if (active_room !== undefined && normalizeValue(active_room) !== normalizeValue(currentUser.active_room)) {
      changes.active_room = active_room;
      hasChanges = true;
    }
    
    if (push_notifications !== undefined) {
      const newPushNotifications = Boolean(push_notifications);
      const currentPushNotifications = Boolean(currentUser.push_notifications);
      if (newPushNotifications !== currentPushNotifications) {
        changes.push_notifications = newPushNotifications;
        hasChanges = true;
      }
    }
    
    if (type !== undefined && normalizeValue(type) !== normalizeValue(currentUser.type)) {
      changes.type = type;
      hasChanges = true;
    }
    
    if (avatar !== undefined && normalizeValue(avatar) !== normalizeValue(currentUser.avatar)) {
      changes.avatar = avatar;
      hasChanges = true;
    }
    
    
    // Check if at least one field is provided for update
    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ 
        message: "Nie wprowadzono żadnych zmian lub podane wartości są identyczne z obecnymi.", 
        response: false 
      });
    }
    
    // Execute UPDATE query with all changed fields using template literals
    let updatedUser;
    
    if (changes.name !== undefined && changes.phone !== undefined && changes.active_room !== undefined && changes.push_notifications !== undefined && changes.type !== undefined && changes.avatar !== undefined) {
      // Update all fields
      updatedUser = await sql`
        UPDATE users 
        SET name = ${changes.name},
            phone = ${changes.phone},
            active_room = ${changes.active_room},
            push_notifications = ${changes.push_notifications},
            type = ${changes.type},
            avatar = ${changes.avatar},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
      `;
    } else if (changes.name !== undefined && changes.active_room !== undefined && changes.push_notifications !== undefined && changes.type !== undefined && changes.avatar !== undefined) {
      // Update name, active_room, push_notifications, type
      updatedUser = await sql`
        UPDATE users 
        SET name = ${changes.name},
            active_room = ${changes.active_room},
            push_notifications = ${changes.push_notifications},
            type = ${changes.type},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
      `;
    } else if (changes.type !== undefined) {
      // Update type only
      updatedUser = await sql`
        UPDATE users 
        SET type = ${changes.type},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
      `;
    } else if (changes.avatar !== undefined) {
      // Update avatar only
      updatedUser = await sql`
        UPDATE users 
        SET avatar = ${changes.avatar},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
      `;
    } else if (changes.name !== undefined && changes.phone !== undefined) {
      // Update name and phone
      updatedUser = await sql`
        UPDATE users 
        SET name = ${changes.name},
            phone = ${changes.phone},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
      `;
    } else if (changes.name !== undefined) {
      // Update name only
      updatedUser = await sql`
        UPDATE users 
        SET name = ${changes.name},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
      `;
    } else if (changes.phone !== undefined) {
      // Update phone only
      updatedUser = await sql`
        UPDATE users 
        SET phone = ${changes.phone},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
      `;
    } else if (changes.active_room !== undefined) {
      // Update active_room only
      updatedUser = await sql`
        UPDATE users 
        SET active_room = ${changes.active_room},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
      `;
    } else if (changes.push_notifications !== undefined) {
      // Update push_notifications only
      updatedUser = await sql`
        UPDATE users 
        SET push_notifications = ${changes.push_notifications},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
      `;
    }
    
    
    if (!updatedUser || updatedUser.length === 0) {
      return res.status(500).json({ 
        message: "Błąd podczas aktualizacji profilu.", 
        response: false 
      });
    }
    
    res.status(200).json({ 
      data: updatedUser[0], 
      response: true, 
      message: "Profil został pomyślnie zaktualizowany." 
    });
    
  } catch (e) {
    console.log("Error updating profile: ", e);
    res.status(500).json({ 
      message: "Coś poszło nie tak podczas aktualizacji profilu.", 
      response: false 
    });
  }
}

export async function deleteAccount(req, res) {
  try {
    // Support both DELETE (body) and query parameters
    const { user_id, password } = req.method === 'DELETE' ? req.body : req.query;
    
    // Validate required fields
    if (!user_id || !password) {
      return res.status(400).json({ 
        message: "user_id i hasło są wymagane.", 
        response: false 
      });
    }
    
    // Check if user exists
    const user = await sql`
        SELECT * FROM users WHERE user_id = ${user_id}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ 
        message: "Użytkownik nie został znaleziony.", 
        response: false 
      });
    }
    
    // Check if user is already deleted
    if (user[0].state === 'deleted') {
      return res.status(400).json({ 
        message: "Konto zostało już usunięte.", 
        response: false 
      });
    }
    
    // Verify password
    const isPasswordValid = comparePass(password, user[0].password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Nieprawidłowe hasło.", 
        response: false 
      });
    }
    
    // Update user state to 'deleted'
    const updatedUser = await sql`
        UPDATE users 
        SET state = 'deleted',
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
    `;
    
    console.log('Account deleted successfully for user:', user_id);
    
    res.status(200).json({ 
      message: "Konto zostało pomyślnie usunięte.", 
      response: true 
    });
    
  } catch (e) {
    console.log("Error deleting account: ", e);
    res.status(500).json({ 
      message: "Coś poszło nie tak podczas usuwania konta.", 
      response: false 
    });
  }
}

export async function editAvatar(req, res) {
  try {
    // Support both PUT (body) and query parameters
    const { user_id, avatar } = req.method === 'PUT' ? req.body : req.query;
    
    // Validate required fields
    if (!user_id) {
      return res.status(400).json({ 
        message: "user_id jest wymagany.", 
        response: false 
      });
    }
    
    if (!avatar) {
      return res.status(400).json({ 
        message: "Avatar jest wymagany.", 
        response: false 
      });
    }
    
    // Check if user exists
    const user = await sql`
        SELECT * FROM users WHERE user_id = ${user_id}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ 
        message: "Użytkownik nie został znaleziony.", 
        response: false 
      });
    }
    
    // Update avatar
    const updatedUser = await sql`
        UPDATE users 
        SET avatar = ${avatar},
            updated_at = (NOW() + INTERVAL '2 hours')
        WHERE user_id = ${user_id}
        RETURNING *
    `;
    
    if (!updatedUser || updatedUser.length === 0) {
      return res.status(500).json({ 
        message: "Błąd podczas aktualizacji avatara.", 
        response: false 
      });
    }
    
    res.status(200).json({ 
      data: updatedUser[0], 
      response: true, 
      message: "Avatar został pomyślnie zaktualizowany." 
    });
  } catch (e) {
    console.log("Error updating avatar: ", e);
    res.status(500).json({ message: "Coś poszło nie tak.", response: false });
  }
}