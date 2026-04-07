// ============================================================
//  ScholarTrack — Backend Server
//  Stack : Node.js + Express + MySQL2
//  Port  : 3000
// ============================================================

const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');

const app  = express();
const PORT = 3000;

// ─── MIDDLEWARE ──────────────────────────────────────────────
app.use(cors());                        // Allow frontend on any origin
app.use(express.json());                // Parse JSON request bodies
app.use(express.urlencoded({ extended: true }));


// ─── DATABASE CONNECTION POOL ────────────────────────────────
//  Change host / user / password to match your MySQL setup
const db = mysql.createPool({
  host     : 'localhost',
  user     : 'root',          // ← your MySQL username
  password : 'Karan@456',              // ← your MySQL password
  database : 'scholarship_db',q
  waitForConnections : true,
  connectionLimit    : 10,
  queueLimit         : 0
});

// Quick connectivity check on startup
(async () => {
  try {
    const conn = await db.getConnection();
    console.log('✅  MySQL connected successfully');
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
    console.error('    Make sure MySQL is running and credentials in server.js are correct.');
    process.exit(1);
  }
})();


// ============================================================
//  HELPER
// ============================================================
function sendError(res, status, message) {
  return res.status(status).json({ success: false, message });
}


// ============================================================
//  AUTH ROUTES
// ============================================================

// ── POST /api/register  (Student Registration) ──────────────
//  Adds a new row to the Student table.
//  Frontend sends: name, email, phone, course, year,
//                  category, income, password
app.post('/api/register', async (req, res) => {
  const { name, email, phone, course, year, category, income, password } = req.body;

  // Basic validation
  if (!name || !email || !phone || !course || !year || !category || !income || !password) {
    return sendError(res, 400, 'All fields are required.');
  }

  const validCategories = ['General', 'OBC', 'SC', 'ST', 'EWS'];
  if (!validCategories.includes(category)) {
    return sendError(res, 400, 'Invalid category value.');
  }

  try {
    // Check if email already exists
    const [existing] = await db.query(
      'SELECT student_id FROM Student WHERE email = ?', [email]
    );
    if (existing.length > 0) {
      return sendError(res, 409, 'Email is already registered. Please login.');
    }

    // NOTE: In production use bcrypt to hash the password before storing.
    //       Example: const hashed = await bcrypt.hash(password, 10);
    //       Then store 'hashed' instead of 'password' below.
    const [result] = await db.query(
      `INSERT INTO Student (name, email, phone, course, year, category, income, password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, phone, course, parseInt(year), category, parseFloat(income), password]
    );

    console.log(`📝  New student registered: ${name} (${email}) — ID ${result.insertId}`);

    return res.status(201).json({
      success   : true,
      message   : 'Student registered successfully!',
      student_id: result.insertId
    });

  } catch (err) {
    console.error('Register error:', err.message);
    return sendError(res, 500, 'Server error during registration.');
  }
});


// ── POST /login  (Student Login) ────────────────────────────
//  Used by the frontend's doLogin() function.
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 400, 'Email and password are required.');
  }

  try {
    // NOTE: In production, use bcrypt.compare(password, row.password)
    const [rows] = await db.query(
      'SELECT student_id, name, email, course, year, category FROM Student WHERE email = ? AND password = ?',
      [email, password]
    );

    if (rows.length === 0) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    console.log(`🔐  Student login: ${rows[0].name} (${email})`);
    return res.json({ success: true, user: rows[0], role: 'student' });

  } catch (err) {
    console.error('Login error:', err.message);
    return sendError(res, 500, 'Server error during login.');
  }
});


// ── POST /admin/login  (Admin Login) ─────────────────────────
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 400, 'Email and password are required.');
  }

  try {
    const [rows] = await db.query(
      'SELECT admin_id, admin_name AS name, email FROM Admin WHERE email = ? AND password = ?',
      [email, password]
    );

    if (rows.length === 0) {
      return sendError(res, 401, 'Invalid admin credentials.');
    }

    console.log(`🔐  Admin login: ${rows[0].name}`);
    return res.json({ success: true, user: rows[0], role: 'admin' });

  } catch (err) {
    console.error('Admin login error:', err.message);
    return sendError(res, 500, 'Server error during admin login.');
  }
});


// ============================================================
//  SCHOLARSHIP ROUTES
// ============================================================

// ── GET /scholarships  (List all active scholarships) ────────
app.get('/scholarships', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT scholarship_id, scholarship_name, provider, amount, eligibility, last_date
       FROM Scholarship
       WHERE last_date >= CURRENT_DATE
       ORDER BY last_date ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Scholarships fetch error:', err.message);
    return sendError(res, 500, 'Could not fetch scholarships.');
  }
});

// ── GET /scholarships/:id  (Single scholarship detail) ───────
app.get('/scholarships/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM Scholarship WHERE scholarship_id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return sendError(res, 404, 'Scholarship not found.');
    return res.json(rows[0]);
  } catch (err) {
    console.error('Scholarship detail error:', err.message);
    return sendError(res, 500, 'Could not fetch scholarship.');
  }
});

// ── POST /scholarships  (Admin: Add new scholarship) ─────────
app.post('/scholarships', async (req, res) => {
  const { scholarship_name, provider, amount, eligibility, last_date } = req.body;

  if (!scholarship_name || !provider || !amount || !eligibility || !last_date) {
    return sendError(res, 400, 'All scholarship fields are required.');
  }

  try {
    const [result] = await db.query(
      `INSERT INTO Scholarship (scholarship_name, provider, amount, eligibility, last_date)
       VALUES (?, ?, ?, ?, ?)`,
      [scholarship_name, provider, parseFloat(amount), eligibility, last_date]
    );
    console.log(`🎓  New scholarship added: ${scholarship_name} — ID ${result.insertId}`);
    return res.status(201).json({
      success        : true,
      message        : 'Scholarship added successfully!',
      scholarship_id : result.insertId
    });
  } catch (err) {
    console.error('Add scholarship error:', err.message);
    return sendError(res, 500, 'Could not add scholarship.');
  }
});


// ============================================================
//  APPLICATION ROUTES
// ============================================================

// ── POST /applications  (Student: Apply for a scholarship) ───
app.post('/applications', async (req, res) => {
  const { student_id, scholarship_id } = req.body;

  if (!student_id || !scholarship_id) {
    return sendError(res, 400, 'student_id and scholarship_id are required.');
  }

  try {
    // Prevent duplicate applications
    const [dup] = await db.query(
      'SELECT application_id FROM Application WHERE student_id = ? AND scholarship_id = ?',
      [student_id, scholarship_id]
    );
    if (dup.length > 0) {
      return sendError(res, 409, 'You have already applied for this scholarship.');
    }

    const [result] = await db.query(
      `INSERT INTO Application (student_id, scholarship_id, apply_date, status)
       VALUES (?, ?, CURRENT_DATE, 'Pending')`,
      [student_id, scholarship_id]
    );
    console.log(`📋  Application submitted — student ${student_id} → scholarship ${scholarship_id}`);
    return res.status(201).json({
      success        : true,
      message        : 'Application submitted successfully!',
      application_id : result.insertId
    });
  } catch (err) {
    console.error('Apply error:', err.message);
    return sendError(res, 500, 'Could not submit application.');
  }
});

// ── GET /applications/student/:student_id  (Student: My apps) 
app.get('/applications/student/:student_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
          a.application_id,
          sc.scholarship_name,
          sc.provider,
          sc.amount,
          a.apply_date,
          a.status,
          a.admin_remarks
       FROM Application a
       JOIN Scholarship sc ON a.scholarship_id = sc.scholarship_id
       WHERE a.student_id = ?
       ORDER BY a.apply_date DESC`,
      [req.params.student_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Student applications error:', err.message);
    return sendError(res, 500, 'Could not fetch applications.');
  }
});

// ── GET /applications  (Admin: All applications) ─────────────
app.get('/applications', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
          a.application_id,
          st.name          AS student_name,
          st.email,
          st.category,
          sc.scholarship_name,
          sc.amount,
          a.apply_date,
          a.status,
          a.admin_remarks
       FROM Application a
       JOIN Student     st ON a.student_id     = st.student_id
       JOIN Scholarship sc ON a.scholarship_id = sc.scholarship_id
       ORDER BY a.apply_date DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('All applications error:', err.message);
    return sendError(res, 500, 'Could not fetch applications.');
  }
});

// ── PATCH /applications/:id  (Admin: Approve / Reject) ───────
app.patch('/applications/:id', async (req, res) => {
  const { status, admin_remarks } = req.body;
  const validStatuses = ['Pending', 'Under Review', 'Approved', 'Rejected'];

  if (!status || !validStatuses.includes(status)) {
    return sendError(res, 400, `Status must be one of: ${validStatuses.join(', ')}`);
  }

  try {
    const [result] = await db.query(
      'UPDATE Application SET status = ?, admin_remarks = ? WHERE application_id = ?',
      [status, admin_remarks || null, req.params.id]
    );
    if (result.affectedRows === 0) return sendError(res, 404, 'Application not found.');

    console.log(`✏️  Application ${req.params.id} → ${status}`);
    return res.json({ success: true, message: `Application marked as ${status}.` });
  } catch (err) {
    console.error('Update application error:', err.message);
    return sendError(res, 500, 'Could not update application.');
  }
});


// ============================================================
//  STUDENT ROUTES
// ============================================================

// ── GET /students  (Admin: All students) ─────────────────────
app.get('/students', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT student_id, name, email, phone, course, year, category, income, created_at
       FROM Student ORDER BY created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Students list error:', err.message);
    return sendError(res, 500, 'Could not fetch students.');
  }
});

// ── GET /students/:id  (Single student profile) ──────────────
app.get('/students/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT student_id, name, email, phone, course, year, category, income, created_at
       FROM Student WHERE student_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return sendError(res, 404, 'Student not found.');
    return res.json(rows[0]);
  } catch (err) {
    console.error('Student profile error:', err.message);
    return sendError(res, 500, 'Could not fetch student.');
  }
});


// ============================================================
//  ADMIN DASHBOARD STATS
// ============================================================

// ── GET /admin/stats  (Dashboard counters) ───────────────────
app.get('/admin/stats', async (req, res) => {
  try {
    const [[stats]] = await db.query(
      `SELECT
          (SELECT COUNT(*) FROM Application)                                    AS total_applications,
          (SELECT COUNT(*) FROM Application WHERE status = 'Pending')           AS pending,
          (SELECT COUNT(*) FROM Application WHERE status = 'Under Review')      AS under_review,
          (SELECT COUNT(*) FROM Application WHERE status = 'Approved')          AS approved,
          (SELECT COUNT(*) FROM Application WHERE status = 'Rejected')          AS rejected,
          (SELECT COUNT(*) FROM Student)                                         AS total_students,
          (SELECT COUNT(*) FROM Scholarship WHERE last_date >= CURRENT_DATE)    AS active_scholarships`
    );
    return res.json(stats);
  } catch (err) {
    console.error('Stats error:', err.message);
    return sendError(res, 500, 'Could not fetch stats.');
  }
});


// ============================================================
//  DOCUMENT ROUTES
// ============================================================

// ── POST /documents  (Student: Log an uploaded document) ─────
//  In a real app you'd use multer for file uploads.
//  This route just records the document metadata in DB.
app.post('/documents', async (req, res) => {
  const { application_id, document_type, document_name, file_path } = req.body;

  const validTypes = ['Income Certificate','Caste Certificate','Marksheet','Aadhaar','Bank Passbook','Other'];
  if (!application_id || !document_type || !document_name || !file_path) {
    return sendError(res, 400, 'All document fields are required.');
  }
  if (!validTypes.includes(document_type)) {
    return sendError(res, 400, 'Invalid document_type.');
  }

  try {
    const [result] = await db.query(
      `INSERT INTO Document (application_id, document_type, document_name, file_path)
       VALUES (?, ?, ?, ?)`,
      [application_id, document_type, document_name, file_path]
    );
    return res.status(201).json({
      success     : true,
      message     : 'Document recorded successfully.',
      document_id : result.insertId
    });
  } catch (err) {
    console.error('Document upload error:', err.message);
    return sendError(res, 500, 'Could not save document record.');
  }
});

// ── GET /documents/:application_id  (Documents for an app) ───
app.get('/documents/:application_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT document_id, document_type, document_name, file_path, uploaded_at
       FROM Document WHERE application_id = ?`,
      [req.params.application_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Fetch documents error:', err.message);
    return sendError(res, 500, 'Could not fetch documents.');
  }
});


// ============================================================
//  HEALTH CHECK
// ============================================================
app.get('/', (req, res) => {
  res.json({
    status  : 'running',
    service : 'ScholarTrack API',
    version : '1.0.0',
    routes  : {
      auth          : ['POST /api/register', 'POST /login', 'POST /admin/login'],
      scholarships  : ['GET /scholarships', 'GET /scholarships/:id', 'POST /scholarships'],
      applications  : ['POST /applications', 'GET /applications', 'GET /applications/student/:id', 'PATCH /applications/:id'],
      students      : ['GET /students', 'GET /students/:id'],
      documents     : ['POST /documents', 'GET /documents/:application_id'],
      admin         : ['GET /admin/stats']
    }
  });
});


// ============================================================
//  START
// ============================================================
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   ScholarTrack API Server                    ║');
  console.log(`║   http://localhost:${PORT}                      ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('Available endpoints:');
  console.log('  POST   /api/register                  ← Student Registration');
  console.log('  POST   /login                         ← Student Login');
  console.log('  POST   /admin/login                   ← Admin Login');
  console.log('  GET    /scholarships                  ← List scholarships');
  console.log('  POST   /scholarships                  ← Add scholarship (admin)');
  console.log('  POST   /applications                  ← Apply for scholarship');
  console.log('  GET    /applications                  ← All applications (admin)');
  console.log('  GET    /applications/student/:id      ← My applications (student)');
  console.log('  PATCH  /applications/:id              ← Approve / Reject (admin)');
  console.log('  GET    /students                      ← All students (admin)');
  console.log('  GET    /admin/stats                   ← Dashboard stats');
  console.log('');
});
