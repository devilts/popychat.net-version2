const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = "./data.json";
const GROUPS_FILE = "./groups.json";
const ADMIN_EMAILS = ["youremail1@example.com","youremail2@example.com"];

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serve frontend

// --- helpers ---
function load(file){ return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : []; }
function save(file,data){ fs.writeFileSync(file, JSON.stringify(data,null,2)); }

// --- signup ---
app.post("/signup", (req,res)=>{
  const {email,password} = req.body;
  const users = load(USERS_FILE);
  if(users.find(u=>u.email===email)) return res.status(400).json({error:"User exists"});
  
  const user = { email, password, verified: ADMIN_EMAILS.includes(email), role: ADMIN_EMAILS.includes(email)?"admin":"user" };
  users.push(user);
  save(USERS_FILE, users);

  if(!ADMIN_EMAILS.includes(email)){
    const transporter = nodemailer.createTransport({
      service:"gmail",
      auth:{ user:"YOUR_EMAIL@gmail.com", pass:"YOUR_APP_PASSWORD" }
    });
    const verifyLink = `https://popychat-net-version2.onrender.com/verify?email=${encodeURIComponent(email)}`;
    transporter.sendMail({
      from:"YOUR_EMAIL@gmail.com",
      to:email,
      subject:"Verify PopyChat",
      text:`Click to verify: ${verifyLink}`
    }, err=>{ if(err) console.error(err); });
  }

  res.json({ message: ADMIN_EMAILS.includes(email) ? "Admin account created & verified" : "Signup successful, check email" });
});

// --- verify ---
app.get("/verify",(req,res)=>{
  const {email} = req.query;
  const users = load(USERS_FILE);
  const user = users.find(u=>u.email===email);
  if(!user) return res.status(400).send("User not found");
  user.verified = true;
  save(USERS_FILE, users);
  res.send("Verified ✅");
});

// --- login ---
app.post("/login",(req,res)=>{
  const {email,password} = req.body;
  const users = load(USERS_FILE);
  let user = users.find(u=>u.email===email);

  if(!user && ADMIN_EMAILS.includes(email)){
    user = {email,password,verified:true,role:"admin"};
    users.push(user); save(USERS_FILE, users);
  }

  if(!user) return res.status(400).json({error:"User not found"});
  if(user.password!==password) return res.status(400).json({error:"Invalid password"});
  if(!user.verified) return res.status(400).json({error:"Account not verified"});
  if(ADMIN_EMAILS.includes(email)) user.role="admin";
  res.json({ message:"Login successful", role:user.role });
});

// --- groups ---
app.post("/groups/create",(req,res)=>{
  const {email,groupName} = req.body;
  const users = load(USERS_FILE);
  const groups = load(GROUPS_FILE);
  const user = users.find(u=>u.email===email);
  if(!user || user.role!=="admin") return res.status(403).json({error:"Only admins"});
  if(groups.find(g=>g.name===groupName)) return res.status(400).json({error:"Group exists"});
  const group = { name: groupName, owner: email, admins: [email], members: [email], messages: [] };
  groups.push(group);
  save(GROUPS_FILE, groups);
  res.json({message:"Group created", group});
});

app.post("/groups/join",(req,res)=>{
  const {email,groupName}=req.body;
  const groups=load(GROUPS_FILE);
  const group=groups.find(g=>g.name===groupName);
  if(!group) return res.status(404).json({error:"Group not found"});
  if(!group.members.includes(email)) group.members.push(email);
  save(GROUPS_FILE,groups);
  res.json({message:"Joined group", group});
});

app.get("/groups",(req,res)=>{ res.json(load(GROUPS_FILE)); });

app.get("/groups/messages/:groupName",(req,res)=>{
  const groups=load(GROUPS_FILE);
  const group=groups.find(g=>g.name===req.params.groupName);
  if(!group) return res.status(404).json({error:"Group not found"});
  res.json(group.messages || []);
});

app.post("/groups/message",(req,res)=>{
  const {email,groupName,text}=req.body;
  const groups=load(GROUPS_FILE);
  const group=groups.find(g=>g.name===groupName);
  if(!group) return res.status(404).json({error:"Group not found"});
  group.messages.push({ from: email, text, time: Date.now() });
  save(GROUPS_FILE,groups);
  res.json({message:"Message sent"});
});

// --- catch-all for frontend ---
app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
