import { sql } from "../config/db.js";

export async function addActivity(req, res) {
  try {
    const { user_id, icon = null, type = null, title = null, message = null, action_url = null, is_read = false } = req.body;
    if (!user_id) {
      return res.status(400).json({ response: false, message: 'Brak wymaganych pól: user_id' });
    }
    const userRows = await sql`SELECT user_id FROM users WHERE user_id = ${user_id}`;
    if (userRows.length === 0) {
      return res.status(404).json({ response: false, message: 'Użytkownik nie istnieje' });
    }
    const rows = await sql`
      INSERT INTO activities (user_id, icon, type, title, message, is_read, action_url)
      VALUES (${user_id}, ${icon}, ${type}, ${title}, ${message}, ${is_read}, ${action_url})
      RETURNING *
    `;
    return res.status(201).json({ response: true, data: rows[0] });
  } catch (e) {
    console.error('Error adding activity:', e);
    return res.status(500).json({ response: false, message: 'Błąd serwera podczas dodawania aktywności' });
  }
}

export async function getActivities(req, res) {
  try {
    const { user_id } = req.query;
    const limitRaw = req.query.limit ? Number(req.query.limit) : 10;
    const beforeRaw = req.query.before ? String(req.query.before) : null;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 10;
    if (!user_id) {
      return res.status(400).json({ response: false, message: 'Brak wymaganych pól: user_id' });
    }
    const userRows = await sql`SELECT user_id FROM users WHERE user_id = ${user_id}`;
    if (userRows.length === 0) {
      return res.status(404).json({ response: false, message: 'Użytkownik nie istnieje' });
    }
    let rows = [];
    if (beforeRaw) {
      const beforeTs = new Date(beforeRaw);
      rows = await sql`
        SELECT * FROM activities 
        WHERE user_id = ${user_id} AND created_at < ${beforeTs}
        ORDER BY created_at DESC
        LIMIT ${limit + 1}
      `;
    } else {
      rows = await sql`
        SELECT * FROM activities 
        WHERE user_id = ${user_id}
        ORDER BY created_at DESC
        LIMIT ${limit + 1}
      `;
    }
    let next_cursor = null;
    if (rows.length > limit) {
      const last = rows[limit - 1];
      next_cursor = last.created_at;
      rows = rows.slice(0, limit);
    }
    return res.status(200).json({ response: true, data: rows, next_cursor });
  } catch (e) {
    console.error('Error getting activities:', e);
    return res.status(500).json({ response: false, message: 'Błąd serwera podczas pobierania aktywności' });
  }
}

// Internal helper for other controllers
export async function addActivityInternal(user_id, data = {}) {
  const {
    icon = null,
    type = null,
    title = null,
    message = null,
    action_url = null,
    is_read = false
  } = data;
  if (!user_id) return null;
  try {
    const rows = await sql`
      INSERT INTO activities (user_id, icon, type, title, message, is_read, action_url)
      VALUES (${user_id}, ${icon}, ${type}, ${title}, ${message}, ${is_read}, ${action_url})
      RETURNING *
    `;
    return rows[0];
  } catch (e) {
    console.error('addActivityInternal error:', e);
    return null;
  }
}


