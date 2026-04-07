app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// DB Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Karan@456',
  database: 'scholarship_db'
});

db.connect(err => {
  if (err) throw err;
  console.log('MySQL Connected...');
});

// API: Get Scholarships
async function buildScholarships() {
  const res = await fetch('http://localhost:3000/scholarships');
  const data = await res.json();

  const grid = document.getElementById('scholarshipGrid');

  grid.innerHTML = data.map(s => `
    <div class="sc-card">
      <h3>${s.scholarship_name}</h3>
      <div class="provider">${s.provider}</div>
      <div class="sc-amount">₹${s.amount}</div>
      <p>${s.eligibility}</p>
    </div>
  `).join('');
}
async function doLogin() {
  const email = document.getElementById('loginEmail').value;
  const pass  = document.getElementById('loginPass').value;

  const res = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password: pass })
  });

  const data = await res.json();

  if (data.success) {
    alert("Login Successful");
  } else {
    alert("Invalid login");
  }
}

// API: Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM Student WHERE email=? AND password=?",
    [email, password],
    (err, result) => {
      if (result.length > 0) {
        res.json({ success: true, user: result[0] });
      } else {
        res.json({ success: false });
      }
    }
  );
});
// API: Get All Available Scholarships
app.get('/scholarships', (req, res) => {
  db.query("SELECT * FROM Scholarship", (err, result) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json(result);
    }
  });
});
app.post('/api/register', (req, res) => {
    // Destructure exactly what the HTML is sending
    const { name, email, phone, course, year, category, income, password } = req.body;

    const sql = `INSERT INTO Student (name, email, phone, course, year, category, income, password) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [name, email, phone, course, year, category, income, password], (err, result) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ success: false, message: "Database insertion failed" });
        }
        res.json({ success: true, message: "Student registered!" });
    });
});

app.listen(3000, () => console.log("Server running on port 3000"));