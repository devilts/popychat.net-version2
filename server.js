const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("."));

const DATA_FILE = "data.json";
let DB = { users: {}, groups: {} };

// -------- CONFIG -----------
const MAIN_ADMIN = "mainadmin"; 
const ADMIN_EMAILS = ["your1@gmail.com","your2@gmail.com"]; 

// Load DB
if(fs.existsSync(DATA_FILE)){
  DB = JSON.parse(fs.readFileSync(DATA_FILE));
}else{
  const hash = crypto.createHash("sha256").update("YourPasswordHere").digest("hex");
  DB.users[MAIN_ADMIN] = {
    password: hash,
    email: ADMIN_EMAILS[0],
    role: "admin",
    verified: true,
    messages: []
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(DB,null,2));
}

// Helper
function saveDB(){ fs.writeFileSync(DATA_FILE, JSON.stringify(DB,null,2)); }
function hashPass(pw){ return crypto.createHash("sha256").update(pw).digest("hex"); }

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service:"gmail",
  auth:{
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// -------- SIGNUP --------
app.post("/signup",(req,res)=>{
  const { username,password,email } = req.body;
  if(DB.users[username]) return res.json({ok:false,msg:"Username exists"});
  const token = crypto.randomBytes(20).toString("hex");

  DB.users[username] = {
    password: hashPass(password),
    email,
    verified:false,
    token,
    role:"user",
    messages:[]
  };
  saveDB();

  const verifyLink = `https://popychat-net-version2.onrender.com/verify?token=${token}`;
  transporter.sendMail({
    from:`"PoppyChat" <${process.env.EMAIL_USER}>`,
    to: email,
    subject:"Verify your PoppyChat account",
    text:`Click here to verify: ${verifyLink}`
  });

  res.json({ok:true,msg:"Account created. Check email to verify."});
});

// -------- VERIFY EMAIL --------
app.get("/verify",(req,res)=>{
  const { token } = req.query;
  const user = Object.values(DB.users).find(u=>u.token===token);
  if(!user) return res.status(400).send("Invalid token");
  user.verified = true;
  delete user.token;
  saveDB();
  res.send("Email verified! You can now log in.");
});

// -------- LOGIN --------
app.post("/login",(req,res)=>{
  const { username,password } = req.body;
  const user = DB.users[username];
  if(!user) return res.json({ok:false,msg:"User not found"});
  if(user.password!==hashPass(password)) return res.json({ok:false,msg:"Wrong password"});
  if(!user.verified) return res.json({ok:false,msg:"Email not verified"});

  // Auto-admin if your emails
  if(ADMIN_EMAILS.includes(user.email)) user.role="admin";

  res.json({ok:true,role:user.role});
});

// -------- ADMIN ACTIONS --------
app.post("/adminAction",(req,res)=>{
  const { action, actor, target } = req.body;
  const user = DB.users[actor];
  if(!user || user.role!=="admin") return res.json({ok:false,msg:"Not an admin"});
  const targetUser = DB.users[target];
  if(!targetUser) return res.json({ok:false,msg:"Target not found"});
  if(target===MAIN_ADMIN) return res.json({ok:false,msg:"Cannot modify main admin"});

  if(action==="ban") delete DB.users[target];
  else if(action==="promote") targetUser.role="admin";
  else if(action==="demote") targetUser.role="user";
  else return res.json({ok:false,msg:"Unknown action"});
  saveDB();
  res.json({ok:true});
});

// -------- PRIVATE MESSAGES --------
app.post("/sendPM",(req,res)=>{
  const { from,to,text } = req.body;
  if(!DB.users[to]) return res.json({ok:false,msg:"Recipient not found"});
  DB.users[to].messages.push({from,text});
  saveDB();
  res.json({ok:true});
});

app.get("/inbox/:username",(req,res)=>{
  const user = DB.users[req.params.username];
  if(!user) return res.json({ok:false,msg:"User not found"});
  res.json({ok:true,messages:user.messages});
});

app.post("/deleteMsg",(req,res)=>{
  const { username,index } = req.body;
  const user = DB.users[username];
  if(!user) return res.json({ok:false,msg:"User not found"});
  if(!user.messages[index]) return res.json({ok:false,msg:"Invalid index"});
  user.messages.splice(index,1);
  saveDB();
  res.json({ok:true});
});

// -------- GROUPS --------
app.post("/createGroup",(req,res)=>{
  const { currentUser,name,privacy } = req.body;
  if(!DB.users[currentUser]) return res.json({ok:false,msg:"User not found"});
  if(DB.groups[name]) return res.json({ok:false,msg:"Group exists"});
  DB.groups[name] = { members:[currentUser], admins:[currentUser], messages:[], privacy };
  saveDB();
  res.json({ok:true});
});

app.post("/groupAction",(req,res)=>{
  const { action, actor, groupName, target, text } = req.body;
  const g = DB.groups[groupName];
  if(!g) return res.json({ok:false,msg:"Group not found"});
  const user = DB.users[actor];
  if(!user || !g.members.includes(actor)) return res.json({ok:false,msg:"Not a member"});

  if(action==="invite"){
    if(!g.admins.includes(actor)) return res.json({ok:false,msg:"Only admins can invite"});
    if(!DB.users[target]) return res.json({ok:false,msg:"User not found"});
    if(!g.members.includes(target)) g.members.push(target);
  } else if(action==="promote"){
    if(!g.admins.includes(actor)) return res.json({ok:false,msg:"Only admins can promote"});
    if(!g.members.includes(target)) return res.json({ok:false,msg:"Target not in group"}) ;
    if(!g.admins.includes(target)) g.admins.push(target);
  } else if(action==="demote"){
    if(!g.admins.includes(actor)) return res.json({ok:false,msg:"Only admins can demote"});
    g.admins = g.admins.filter(u=>u!==target);
  } else if(action==="kick"){
    if(!g.admins.includes(actor)) return res.json({ok:false,msg:"Only admins can kick"});
    g.members = g.members.filter(u=>u!==target);
  } else if(action==="send"){
    if(!g.members.includes(actor)) return res.json({ok:false,msg:"Not a member"});
    g.messages.push({from:actor,text});
  } else return res.json({ok:false,msg:"Unknown action"});
  saveDB();
  res.json({ok:true});
});

app.get("/groupMessages/:groupName/:username",(req,res)=>{
  const g = DB.groups[req.params.groupName];
  if(!g) return res.json({ok:false,msg:"Group not found"});
  if(!g.members.includes(req.params.username)) return res.json({ok:false,msg:"Not a member"});
  res.json({ok:true,messages:g.messages});
});

// -------- START SERVER --------
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
