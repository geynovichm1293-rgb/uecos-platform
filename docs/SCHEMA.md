# UECOS Platform - Database Schema

## Users Table

Stores all user accounts (learners, educators, administrators)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'learner',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id`: Unique identifier
- `email`: User's email address (unique)
- `password_hash`: Bcrypt hashed password
- `role`: User role - 'learner', 'educator', 'administrator'
- `status`: Account status - 'active', 'suspended', 'deleted'
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp

## Learners Table

Extends user profile with learning-specific information

```sql
CREATE TABLE learners (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  age INTEGER,
  grade_level VARCHAR(50),
  learning_preferences JSONB,
  accessibility_settings JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Columns:**
- `id`: Unique learner identifier
- `user_id`: Reference to user account (1:1)
- `first_name`, `last_name`: Learner's name
- `age`: Learner's age
- `grade_level`: School grade level
- `learning_preferences`: JSON object with learning preferences
- `accessibility_settings`: JSON object with accessibility options

## Subjects Table

Top-level content categories

```sql
CREATE TABLE subjects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(255),
  age_range_min INTEGER,
  age_range_max INTEGER,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id`: Unique subject identifier
- `name`: Subject name (e.g., "Mathematics")
- `description`: Subject description
- `icon`: Icon identifier for UI
- `age_range_min`, `age_range_max`: Age appropriateness
- `status`: 'draft', 'in_review', 'approved', 'published', 'archived'

## Topics Table

Sub-categories within subjects

```sql
CREATE TABLE topics (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  prerequisite_topic_id INTEGER,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (prerequisite_topic_id) REFERENCES topics(id)
);
```

## Skills Table

Learning objectives within topics

```sql
CREATE TABLE skills (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  difficulty_level VARCHAR(50),
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);
```

## Lessons Table

Actual instructional content

```sql
CREATE TABLE lessons (
  id SERIAL PRIMARY KEY,
  skill_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content JSONB,
  duration_minutes INTEGER,
  difficulty_level VARCHAR(50),
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);
```

**Content Structure (JSONB):**
```json
{
  "blocks": [
    {
      "type": "text",
      "content": "Lesson introduction..."
    },
    {
      "type": "question",
      "questionType": "multiple_choice",
      "question": "What is 2+2?",
      "options": ["3", "4", "5"],
      "correctAnswer": "4",
      "explanation": "..."
    }
  ]
}
```

## Learning Paths Table

Personalized learning journey for each learner

```sql
CREATE TABLE learning_paths (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  goal VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  estimated_duration_hours INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);
```

## Progress Table

Tracks learner's progress on individual lessons

```sql
CREATE TABLE progress (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'not_started',
  completion_percentage INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  mastery_level VARCHAR(50) DEFAULT 'not_assessed',
  last_attempt_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  UNIQUE(learner_id, lesson_id)
);
```

**Status Values:**
- `not_started`: Learner hasn't accessed lesson
- `in_progress`: Learner is working on lesson
- `completed`: Learner finished lesson

**Mastery Levels:**
- `not_assessed`: No data collected
- `introduced`: Learner has seen content
- `developing`: Learner is practicing
- `practicing`: Learner is consolidating knowledge
- `likely_mastered`: High accuracy achieved
- `needs_review`: Learner struggled

## Assessments Table

Stores diagnostic and summative assessments

```sql
CREATE TABLE assessments (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER NOT NULL,
  topic_id INTEGER NOT NULL,
  questions JSONB NOT NULL,
  responses JSONB,
  score INTEGER,
  assessment_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'in_progress',
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id)
);
```

## Indexes

For performance optimization:

```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_learners_user_id ON learners(user_id);
CREATE INDEX idx_progress_learner_id ON progress(learner_id);
CREATE INDEX idx_progress_lesson_id ON progress(lesson_id);
CREATE INDEX idx_learning_paths_learner_id ON learning_paths(learner_id);
CREATE INDEX idx_assessments_learner_id ON assessments(learner_id);
CREATE INDEX idx_topics_subject_id ON topics(subject_id);
CREATE INDEX idx_skills_topic_id ON skills(topic_id);
CREATE INDEX idx_lessons_skill_id ON lessons(skill_id);
```
