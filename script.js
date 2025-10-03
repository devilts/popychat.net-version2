// ✅ CHANGE THIS TO YOUR RENDER BACKEND URL
const API_URL = "https://popychat-net-version2.onrender.com"; 

let currentUser = null;
let currentGroup = null;
let messageInterval = null;

// --- SIGNUP ---
async function signup() {
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;

  const res = await fetch(`${API_URL}signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  alert(data.message || data.error);
}

// --- LOGIN ---
async function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const res = await fetch(`${API_URL}login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();

  if (data.error) return alert(data.error);

  currentUser = { email, role: data.role };
  document.getElementById("userEmail").textContent = email;
  document.getElementById("userRole").textContent = data.role;
  document.getElementById("signup").style.display = "none";
  document.getElementById("login").style.display = "none";
  document.getElementById("chat").style.display = "block";

  loadGroups();
}

// --- GROUPS ---
async function createGroup() {
  const groupName = document.getElementById("groupName").value;
  const res = await fetch(`${API_URL}groups/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: currentUser.email, groupName })
  });
  const data = await res.json();
  alert(data.message || data.error);
  loadGroups();
}

async function joinGroup() {
  const groupName = document.getElementById("joinGroupName").value;
  const res = await fetch(`${API_URL}groups/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: currentUser.email, groupName })
  });
  const data = await res.json();
  alert(data.message || data.error);
  loadGroups();
}

async function loadGroups() {
  const res = await fetch(`${API_URL}groups`);
  const groups = await res.json();
  const list = document.getElementById("groupsList");
  list.innerHTML = "";
  groups.forEach(g => {
    const li = document.createElement("li");
    li.textContent = `${g.name} (members: ${g.members.length})`;
    li.onclick = () => openGroup(g.name);
    list.appendChild(li);
  });
}

// --- OPEN GROUP ---
function openGroup(groupName) {
  currentGroup = groupName;
  document.getElementById("currentGroupName").textContent = groupName;
  document.getElementById("groupMessages").innerHTML = "";
  if (messageInterval) clearInterval(messageInterval);
  loadMessages();
  messageInterval = setInterval(loadMessages, 3000);
}

// --- LOAD MESSAGES ---
async function loadMessages() {
  if (!currentGroup) return;
  const res = await fetch(`${API_URL}groups/messages/${currentGroup}`);
  const messages = await res.json();
  const container = document.getElementById("groupMessages");
  container.innerHTML = "";
  messages.forEach(m => {
    const div = document.createElement("div");
    div.textContent = `[${new Date(m.time).toLocaleTimeString()}] ${m.from}: ${m.text}`;
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

// --- SEND MESSAGE ---
async function sendMessage() {
  const text = document.getElementById("messageInput").value;
  if (!text || !currentGroup) return;
  const res = await fetch(`${API_URL}groups/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: currentUser.email, groupName: currentGroup, text })
  });
  const data = await res.json();
  if (data.error) return alert(data.error);
  document.getElementById("messageInput").value = "";
  loadMessages();
}
