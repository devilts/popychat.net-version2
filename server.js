// server.js
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.json());
app.use(cors());

const USERS_FILE = "./data.json";
const GROUPS_FILE = "./groups.json";

// permanent admin emails
const ADMIN_EMAILS = ["youremail1@example.com", "youremail2@example.com"];

// helper functions
function load(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
}
function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// --- ROUTES ---

// homepage (fixes GET error)
app.get("/", (req, res) => {
  res.send("Welcome to PopyChat Backend API ✅ Use /signup /login /verify");
});

// signup
app.post("/signup", (req, res) => {
  const { email, password } = req.body;
  const users = load(USERS_FILE);

  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ error: "User already exists" });
  }

  const user = {
    email,
    password,
    verified: ADMIN_EMAILS.includes(email),
    role: ADMIN_EMAILS.includes(email) ? "admin" : "user",
  };

  users.push(user);
  save(USERS_FILE, users);

  if (ADMIN_EMAILS.includes(email)) {
    return res.json({ message: "Admin account created and verified" });
  }

  // email verification
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "YOUR_EMAIL@gmail.com",
      pass: "YOUR_APP_PASSWORD",
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
      text: `Click to verify your account: ${verifyLink}`,
    },
    (err) => {
      if (err) console.error("Email error:", err);
    }
  );

  res.json({ message: "Signup successful. Check your email to verify." });
});

// verify email
app.get("/verify", (req, res) => {
  const { email } = req.query;
  const users = load(USERS_FILE);
  const user = users.find((u) => u.email === email);

  if (!user) return res.status(400).send("User not found");

  user.verified = true;
  save(USERS_FILE, users);

  res.send("Your account has been verified ✅ You can now log in.");
});

// login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const users = load(USERS_FILE);
  let user = users.find((u) => u.email === email);

  if (!user) {
    if (ADMIN_EMAILS.includes(email)) {
      user = { email, password, verified: true, role: "admin" };
      users.push(user);
      save(USERS_FILE, users);
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

  if (ADMIN_EMAILS.includes(email)) {
    user.role = "admin";
  }

  res.json({ message: "Login successful", role: user.role });
});

// --- GROUP SYSTEM ---

// create group (admin only)
app.post("/groups/create", (req, res) => {
  const { email, groupName } = req.body;
  const users = load(USERS_FILE);
  const groups = load(GROUPS_FILE);

  const user = users.find((u) => u.email === email);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Only admins can create groups" });
  }

  if (groups.find((g) => g.name === groupName)) {
    return res.status(400).json({ error: "Group already exists" });
  }

  const group = {
    name: groupName,
    owner: email,
    admins: [email],
    members: [email],
  };

  groups.push(group);
  save(GROUPS_FILE, groups);

  res.json({ message: "Group created", group });
});

// join group
app.post("/groups/join", (req, res) => {
  const { email, groupName } = req.body;
  const groups = load(GROUPS_FILE);

  const group = groups.find((g) => g.name === groupName);
  if (!group) return res.status(404).json({ error: "Group not found" });

  if (!group.members.includes(email)) {
    group.members.push(email);
    save(GROUPS_FILE, groups);
  }

  res.json({ message: "Joined group", group });
});

// promote group admin
app.post("/groups/promote", (req, res) => {
  const { email, groupName, targetEmail } = req.body;
  const groups = load(GROUPS_FILE);

  const group = groups.find((g) => g.name === groupName);
  if (!group) return res.status(404).json({ error: "Group not found" });

  if (!group.admins.includes(email)) {
    return res.status(403).json({ error: "Only group admins can promote" });
  }

  if (!group.admins.includes(targetEmail)) {
    group.admins.push(targetEmail);
  }

  save(GROUPS_FILE, groups);
  res.json({ message: "User promoted to group admin", group });
});

// list groups
app.get("/groups", (req, res) => {
  const groups = load(GROUPS_FILE);
  res.json(groups);
});

// start server
app.listen(3000, () => console.log("✅ Server running on port 3000"));
console.log("application started")
