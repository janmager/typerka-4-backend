import { API_URL, sql } from "../config/db.js";

export async function createUser(req, res) {
  try {
    const { user_id, email } = req.body;

    console.log("Creating user: ", user_id, email);

    if (!user_id) {
      return res.status(400).json({ message: "All fields are required." });
    }

    let username = "";
    if (email) {
      username = email.split("@")[0];
    }

    const if_is = await sql`
            SELECT * FROM users WHERE id = ${user_id} OR email = ${email}
        `;


    if (if_is.length > 0) {
        return res.status(409).json({ message: "User already exists.", response: false });
    }

    const users = await sql`
        INSERT INTO users (id, email, username) 
        VALUES (${user_id}, ${email}, ${email.split("@")[0]})
            RETURNING *`;
    res.status(200).json({ data: users[0], response: true, message: "User created successfully." });
  } catch (e) {
    console.log("Error creating user: ", e);
    res.status(500).json({ message: "Something went wrong.", response: false });
  }
}

export async function getUser(req, res) {
  try {
    const { user_id } = req.body;
    const user = await sql`
        SELECT * FROM users WHERE id = ${user_id}
    `;
    if (user.length === 0) {
      return res.status(404).json({ message: "User not found.", response: false });
    }
    res.status(200).json({ data: user[0], response: true, message: "User found successfully." });
  } catch (e) {
    console.log("Error getting user: ", e);
    res.status(500).json({ message: "Something went wrong.", response: false });
  }
}