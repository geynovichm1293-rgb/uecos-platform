/**
 * API Documentation
 * UECOS Platform - Version 0.1.0
 */

# Authentication Endpoints

## POST /api/auth/register
Create new user account and learner profile

**Request:**
```json
{
  "email": "learner@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "age": 15,
  "gradeLevel": "10"
}
```

**Response:** 201 Created
```json
{
  "user": {
    "id": 1,
    "email": "learner@example.com",
    "role": "learner"
  },
  "learner": {
    "id": 1,
    "user_id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "age": 15,
    "grade_level": "10"
  }
}
```

## POST /api/auth/login
Authenticate user and return JWT token

**Request:**
```json
{
  "email": "learner@example.com",
  "password": "SecurePassword123!"
}
```

**Response:** 200 OK
```json
{
  "user": {
    "id": 1,
    "email": "learner@example.com",
    "role": "learner"
  },
  "learner": {...},
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

## POST /api/auth/logout
Invalidate session

**Headers:** `Authorization: Bearer <token>`

**Response:** 200 OK

## GET /api/auth/me
Get current authenticated user

**Headers:** `Authorization: Bearer <token>`

**Response:** 200 OK
```json
{
  "user": {...},
  "learner": {...}
}
```

# Learner Endpoints

## POST /api/learner/goal
Set learning goal and generate personalized path

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "subjectId": 1,
  "goalDescription": "Learn fractions"
}
```

**Response:** 201 Created
```json
{
  "path": {
    "id": 1,
    "learner_id": 1,
    "subject_id": 1,
    "goal": "Learn fractions",
    "status": "active"
  },
  "topics": [...],
  "startingLevel": "INTRODUCED"
}
```

## GET /api/learner/path/:pathId
Get learning path with progress

**Headers:** `Authorization: Bearer <token>`

**Response:** 200 OK
```json
{
  "path": {...},
  "topics": [
    {
      "id": 1,
      "name": "Fraction Basics",
      "lesson_count": 5,
      "completed_lessons": 2
    }
  ],
  "nextLesson": {
    "id": 7,
    "title": "Adding Fractions",
    "description": "Learn how to add fractions with common denominators"
  }
}
```

## GET /api/learner/lesson/:lessonId
Get lesson content

**Headers:** `Authorization: Bearer <token>`

**Response:** 200 OK
```json
{
  "lesson": {
    "id": 7,
    "title": "Adding Fractions",
    "description": "...",
    "content": {...}
  },
  "progress": {
    "status": "in_progress",
    "completion_percentage": 50,
    "attempts": 1
  },
  "content": [...]
}
```

## POST /api/learner/lesson/:lessonId/answer
Submit answer to lesson question

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "questionId": 1,
  "answer": "1/2",
  "correctAnswer": "1/2"
}
```

**Response:** 200 OK
```json
{
  "feedback": {
    "isCorrect": true,
    "message": "🎉 Great job! That's correct.",
    "explanation": "..."
  },
  "progress": 100
}
```

## POST /api/learner/lesson/:lessonId/complete
Mark lesson as completed

**Headers:** `Authorization: Bearer <token>`

**Response:** 200 OK
```json
{
  "status": "completed",
  "nextLesson": {
    "id": 8,
    "title": "Subtracting Fractions"
  },
  "message": "Great work! Next: Subtracting Fractions"
}
```

## GET /api/learner/progress
Get learner's overall progress

**Headers:** `Authorization: Bearer <token>`

**Query Params:** `subjectId` (optional)

**Response:** 200 OK
```json
{
  "overall": {
    "totalLessons": 50,
    "completedLessons": 15,
    "completionPercentage": 30,
    "totalSkills": 10,
    "masteredSkills": 2,
    "averageCompletion": 45,
    "lastActivity": "2026-09-15T10:30:00Z"
  },
  "bySkill": [...]
}
```

# Content Endpoints

## GET /api/content/subjects
List all published subjects

**Response:** 200 OK
```json
{
  "subjects": [
    {
      "id": 1,
      "name": "Mathematics",
      "description": "...",
      "icon": "math-icon",
      "age_range_min": 4,
      "age_range_max": 88
    }
  ]
}
```

## GET /api/content/search
Search content

**Query Params:**
- `q` (required): Search query (min 2 chars)
- `type` (optional): 'all' | 'subject' | 'topic' | 'lesson'

**Response:** 200 OK
```json
{
  "subjects": [...],
  "topics": [...],
  "lessons": [...]
}
```

## POST /api/content/admin/subject (ADMIN ONLY)
Create new subject

**Headers:** `Authorization: Bearer <admin-token>`

## POST /api/content/admin/topic (ADMIN ONLY)
Create new topic

## POST /api/content/admin/lesson (ADMIN ONLY)
Create new lesson

## PATCH /api/content/admin/lesson/:lessonId (ADMIN ONLY)
Update lesson content

## POST /api/content/admin/publish/:lessonId (ADMIN ONLY)
Publish lesson

# Analytics Endpoints

## POST /api/analytics/event
Track user event

**Request:**
```json
{
  "eventType": "lesson_started",
  "data": {...}
}
```

## GET /api/analytics/learner/:learnerId (ADMIN ONLY)
Get learner analytics

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "status": 400,
  "timestamp": "2026-09-15T10:30:00Z"
}
```

## Status Codes
- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate email)
- `500 Internal Server Error` - Server error
