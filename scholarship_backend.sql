
CREATE DATABASE IF NOT EXISTS scholarship_db;
USE scholarship_db;
CREATE TABLE IF NOT EXISTS Student (
    student_id    INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100)        NOT NULL,
    email         VARCHAR(100) UNIQUE NOT NULL,
    phone         VARCHAR(15)         NOT NULL,
    course        VARCHAR(100)        NOT NULL,
    year          INT                 NOT NULL,
    category      ENUM('General','OBC','SC','ST','EWS') NOT NULL,
    income        DECIMAL(10,2)       NOT NULL,
    password      VARCHAR(255)        NOT NULL,   -- store hashed password
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ADMIN TABLE
CREATE TABLE IF NOT EXISTS Admin (
    admin_id      INT AUTO_INCREMENT PRIMARY KEY,
    admin_name    VARCHAR(100)        NOT NULL,
    email         VARCHAR(100) UNIQUE NOT NULL,
    password      VARCHAR(255)        NOT NULL    -- store hashed password
);

-- SCHOLARSHIP TABLE
CREATE TABLE IF NOT EXISTS Scholarship (
    scholarship_id   INT AUTO_INCREMENT PRIMARY KEY,
    scholarship_name VARCHAR(150)       NOT NULL,
    provider         VARCHAR(100)       NOT NULL,
    amount           DECIMAL(10,2)      NOT NULL,
    eligibility      TEXT               NOT NULL,
    last_date        DATE               NOT NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- APPLICATION TABLE
CREATE TABLE IF NOT EXISTS Application (
    application_id   INT AUTO_INCREMENT PRIMARY KEY,
    student_id       INT  NOT NULL,
    scholarship_id   INT  NOT NULL,
    apply_date       DATE NOT NULL DEFAULT (CURRENT_DATE),
    status           ENUM('Pending','Under Review','Approved','Rejected') DEFAULT 'Pending',
    admin_remarks    TEXT,
    FOREIGN KEY (student_id)     REFERENCES Student(student_id)     ON DELETE CASCADE,
    FOREIGN KEY (scholarship_id) REFERENCES Scholarship(scholarship_id) ON DELETE CASCADE,
    UNIQUE KEY unique_application (student_id, scholarship_id)  -- one application per scholarship
);

-- DOCUMENT TABLE
CREATE TABLE IF NOT EXISTS Document (
    document_id      INT AUTO_INCREMENT PRIMARY KEY,
    application_id   INT          NOT NULL,
    document_type    ENUM('Income Certificate','Caste Certificate','Marksheet','Aadhaar','Bank Passbook','Other') NOT NULL,
    document_name    VARCHAR(255) NOT NULL,
    file_path        VARCHAR(500) NOT NULL,
    uploaded_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES Application(application_id) ON DELETE CASCADE
);


-- ============================================
-- 3. SAMPLE DATA (for testing)
-- ============================================

-- Insert Admin
INSERT INTO Admin (admin_name, email, password) VALUES
('Admin User', 'admin@scholarship.com', 'admin123');
-- NOTE: In production, use hashed passwords e.g. bcrypt

-- Insert Sample Scholarships
INSERT INTO Scholarship (scholarship_name, provider, amount, eligibility, last_date) VALUES
('Merit Excellence Award',   'Ministry of Education',   25000.00, 'Above 80% marks, Annual income below 2.5 LPA',          '2025-08-31'),
('National SC/ST Scholarship','Govt of India',           18000.00, 'SC/ST category students, income below 2 LPA',            '2025-09-15'),
('OBC Central Scholarship',  'Ministry of Social Welfare',15000.00,'OBC category, income below 1.5 LPA',                    '2025-09-30'),
('EWS Higher Education Fund','State Government',         20000.00, 'EWS category, enrolled in UG/PG course',                '2025-10-01'),
('Girls STEM Scholarship',   'Women & Child Department', 12000.00, 'Female students in Science/Tech/Engineering/Math course','2025-09-20');

-- Insert Sample Student (password: "student123")
INSERT INTO Student (name, email, phone, course, year, category, income, password) VALUES
('Aarav Sharma',  'aarav@email.com',  '9876543210', 'B.Tech CSE', 2, 'General', 180000.00, 'student123'),
('Priya Verma',   'priya@email.com',  '9876543211', 'B.Sc Physics', 1, 'OBC',    120000.00, 'student123'),
('Rahul Kumar',   'rahul@email.com',  '9876543212', 'B.Com',        3, 'SC',      95000.00, 'student123');

-- Sample Application
INSERT INTO Application (student_id, scholarship_id, apply_date, status) VALUES
(1, 1, CURRENT_DATE, 'Pending'),
(2, 3, CURRENT_DATE, 'Under Review'),
(3, 2, CURRENT_DATE, 'Approved');


-- ============================================
-- 4. USEFUL QUERIES
-- ============================================

-- [STUDENT] View all available scholarships
SELECT scholarship_id, scholarship_name, provider, amount, eligibility, last_date
FROM Scholarship
WHERE last_date >= CURRENT_DATE
ORDER BY last_date ASC;

-- [STUDENT] Check my application status
SELECT
    s.scholarship_name,
    s.provider,
    s.amount,
    a.apply_date,
    a.status,
    a.admin_remarks
FROM Application a
JOIN Scholarship s ON a.scholarship_id = s.scholarship_id
WHERE a.student_id = 1;  -- replace 1 with logged-in student_id

-- [STUDENT] Apply for a scholarship
INSERT INTO Application (student_id, scholarship_id, apply_date, status)
VALUES (1, 2, CURRENT_DATE, 'Pending');  -- replace IDs as needed

-- [STUDENT] Upload a document
INSERT INTO Document (application_id, document_type, document_name, file_path)
VALUES (1, 'Income Certificate', 'income_cert.pdf', '/uploads/1/income_cert.pdf');

-- [ADMIN] View all applications with student and scholarship info
SELECT
    a.application_id,
    st.name          AS student_name,
    st.email,
    st.category,
    sc.scholarship_name,
    sc.amount,
    a.apply_date,
    a.status
FROM Application a
JOIN Student     st ON a.student_id     = st.student_id
JOIN Scholarship sc ON a.scholarship_id = sc.scholarship_id
ORDER BY a.apply_date DESC;

-- [ADMIN] Approve an application
UPDATE Application
SET status = 'Approved', admin_remarks = 'Documents verified. Eligible.'
WHERE application_id = 1;

-- [ADMIN] Reject an application
UPDATE Application
SET status = 'Rejected', admin_remarks = 'Income exceeds eligibility limit.'
WHERE application_id = 2;

-- [ADMIN] View documents for an application
SELECT d.document_type, d.document_name, d.file_path, d.uploaded_at
FROM Document d
WHERE d.application_id = 1;

-- [ADMIN] Dashboard counts
SELECT
    (SELECT COUNT(*) FROM Application)                              AS total_applications,
    (SELECT COUNT(*) FROM Application WHERE status = 'Pending')    AS pending,
    (SELECT COUNT(*) FROM Application WHERE status = 'Approved')   AS approved,
    (SELECT COUNT(*) FROM Application WHERE status = 'Rejected')   AS rejected,
    (SELECT COUNT(*) FROM Student)                                  AS total_students,
    (SELECT COUNT(*) FROM Scholarship WHERE last_date >= CURRENT_DATE) AS active_scholarships;

-- [ADMIN] Add a new scholarship
INSERT INTO Scholarship (scholarship_name, provider, amount, eligibility, last_date)
VALUES ('New Scheme Name', 'Provider Name', 10000.00, 'Eligibility criteria here', '2025-12-31');

-- [STUDENT] Login check
SELECT student_id, name, email FROM Student
WHERE email = 'aarav@email.com' AND password = 'student123';
-- NOTE: In real app, compare hashed password using bcrypt

-- [ADMIN] Login check
SELECT admin_id, admin_name, email FROM Admin
WHERE email = 'admin@scholarship.com' AND password = 'admin123';
