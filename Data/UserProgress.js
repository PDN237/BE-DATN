class UserProgress {
    constructor(progressID, userID, lessonID, isCompleted, score, lastUpdated) {
        this.ProgressID = progressID;
        this.UserID = userID;
        this.LessonID = lessonID;
        this.IsCompleted = isCompleted;
        this.Score = score;
        this.LastUpdated = lastUpdated;
    }
}

module.exports = UserProgress;
