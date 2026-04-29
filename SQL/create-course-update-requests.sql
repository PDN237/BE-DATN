-- Table for storing course update requests from instructors
CREATE TABLE IF NOT EXISTS CourseUpdateRequests (
    RequestID SERIAL PRIMARY KEY,
    CourseID INTEGER NOT NULL,
    UserID INTEGER NOT NULL,
    Status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    RequestData JSONB NOT NULL, -- Stores the proposed changes (modules, lessons, etc.)
    Reason TEXT, -- Instructor's reason for the update
    AdminFeedback TEXT, -- Admin's feedback when rejecting
    CreatedAt TIMESTAMP DEFAULT NOW(),
    UpdatedAt TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (CourseID) REFERENCES Courses(CourseID) ON DELETE CASCADE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_course_update_requests_courseid ON CourseUpdateRequests(CourseID);
CREATE INDEX IF NOT EXISTS idx_course_update_requests_userid ON CourseUpdateRequests(UserID);
CREATE INDEX IF NOT EXISTS idx_course_update_requests_status ON CourseUpdateRequests(Status);
