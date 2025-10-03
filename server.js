// server.js
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.json());
app.use(cors());

// file for storing user data
const USERS_FILE = "./data.json";

// your permanent admin emails
const ADMIN_EMAILS = ["tobysaltmarsh@hotmail.com", "saltmarshtoby@gmai.com"];

// load users
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

// save users
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// signup endpoint
app.post("/signup", (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();

  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ error: "User already exists" });
  }

  const user = {
    email,
    password,
    verified: false,
    role: ADMIN_EMAILS.includes(email) ? "admin" : "user",
  };

  users.push(user);
  saveUsers(users);

  // if it's one of your permanent admins → auto-verify
  if (ADMIN_EMAILS.includes(email)) {
    user.verified = true;
    saveUsers(users);
    return res.json({ message: "Admin account created and verified." });
  }

  // send email verification link
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "YOUR_EMAIL@gmail.com",
      pass: "YOUR_APP_PASSWORD", // generate an app password in Gmail
    },
  });

  const verifyLink = `https://popychat-net-version2.onrender.com/verify?email=${encodeURIComponent(
    email
  )}`;

  transporter.sendMail(
    {
      from: "YOUR_EMAIL@gmail.com",
      to: email,
      subject: "Verify your PopyChat account",
      text: `Click this link to verify: ${verifyLink}`,
    },
    (err) => {
      if (err) console.error("Email error:", err);
    }
  );

  res.json({ message: "Signup successful, please check your email." });
});

// verification endpoint
app.get("/verify", (req, res) => {
  const { email } = req.query;
  const users = loadUsers();
  const user = users.find((u) => u.email === email);

  if (!user) return res.status(400).send("User not found");

  user.verified = true;
  saveUsers(users);

  res.send("Your account has been verified! You can now log in.");
});

// login endpoint
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  let user = users.find((u) => u.email === email);

  if (!user) {
    // auto-create if email is one of the permanent admins
    if (ADMIN_EMAILS.includes(email)) {
      user = { email, password, verified: true, role: "admin" };
      users.push(user);
      saveUsers(users);
    } else {
      return res.status(400).json({ error: "User not found" });
    }
  }

  if (user.password !== password) {
    return res.status(400).json({ error: "Invalid password" });
  }

  if (!user.verified) {
    return res.status(400).json({ error: "Account not verified" });
  }

  // make sure admins can never be demoted
  if (ADMIN_EMAILS.includes(email)) {
    user.role = "admin";
  }

  res.json({ message: "Login successful", role: user.role });
});

app.listen(3000, () => console.log("Server running on port 3000"));
