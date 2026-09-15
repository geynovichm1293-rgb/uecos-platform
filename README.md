# 🎓 UECOS Platform - Universal Education Company Operating System

**Version:** 0.1.0 (MVP)  
**Status:** 🚀 Active Development  
**Specification:** [UECOS-DSL 4.0](./SPECIFICATION.md)

## Mission

Build a **world-class personalized education platform** that helps learners of all ages (2-88+) discover what to learn next, achieve their goals, and measure their progress.

## Core Principle

> **"What should I learn next?"**

UECOS answers this question through a personalized learning system that combines:
- Intelligent assessment
- Adaptive pathways
- Targeted practice
- Real-time feedback
- Measurable progress

## MVP Vision

The first release will be a **complete vertical slice** - not a huge incomplete platform, but a genuinely excellent, focused learning experience in one subject.

### Required User Journey
1. 👤 Visitor discovers platform
2. 🔍 Explore subjects
3. 🎯 Choose learning goal
4. 📝 Create account
5. 📊 Take diagnostic assessment
6. 🛤️ Receive personalized learning path
7. 📚 Work through lessons
8. ✍️ Practice and answer questions
9. 📈 Receive feedback and track progress
10. 🔄 Know what to do next

## Architecture

### Tech Stack
- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL
- **Auth:** JWT + bcrypt
- **API:** RESTful + future GraphQL
- **Logging:** JSON structured logging
- **Testing:** Node.js native test runner

### Project Structure
```
uecos-platform/
├── src/
│   ├── server.js              # Main app entry
│   ├── db/                    # Database layer
│   │   ├── init.js           # Initialization & migrations
│   │   ├── migrate.js        # Migration runner
│   │   └── seed.js           # Seed data
│   ├── middleware/            # Express middleware
│   │   ├── errorHandler.js
│   │   ├── auth.js
│   │   └── validation.js
│   ├── routes/                # API routes
│   │   ├── auth.js
│   │   ├── learner.js
│   │   ├── content.js
│   │   └── analytics.js
│   ├── services/              # Business logic
│   │   ├── learningPath.js
│   │   ├── assessment.js
│   │   ├── recommendation.js
│   │   └── feedback.js
│   ├── models/                # Data models
│   └── utils/                 # Utilities
│       └── logger.js
├── scripts/                   # Automation scripts
├── tests/                     # Test files
├── .env.example               # Environment template
└── package.json               # Dependencies
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/geynovichm1293-rgb/uecos-platform.git
cd uecos-platform

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npm run migrate

# Seed initial data (optional)
npm run seed

# Start development server
npm run dev
```

Server runs on `http://localhost:3000`

## Development

### Available Scripts

```bash
# Development
npm run dev              # Run with file watching

# Testing
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:security   # Security tests
npm run test:accessibility # Accessibility tests

# Database
npm run migrate         # Run migrations
npm run migrate:rollback # Rollback last migration
npm run seed            # Seed development data

# Production
npm run build           # Build for production
npm start               # Start production server
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - End session

### Learner
- `GET /api/learner/dashboard` - Dashboard overview
- `POST /api/learner/goal` - Set learning goal
- `GET /api/learner/path/:pathId` - Get learning path
- `GET /api/learner/lesson/:lessonId` - Get lesson
- `POST /api/learner/lesson/:lessonId/answer` - Submit answer
- `GET /api/learner/progress` - View progress

### Content (Admin)
- `GET /api/content/subjects` - List subjects
- `GET /api/content/search` - Search content
- `POST /api/content/admin/lesson` - Create lesson
- `PATCH /api/content/admin/lesson/:lessonId` - Update lesson
- `POST /api/content/admin/publish/:lessonId` - Publish lesson

### Analytics
- `POST /api/analytics/event` - Track event
- `GET /api/analytics/learner/:learnerId` - Get learner analytics

## Build Pipeline

### Phase 1: Discovery ✅
- [x] Initialize project
- [x] Setup database architecture
- [x] Create basic API structure
- [ ] Review existing implementations

### Phase 2: Core Architecture (🔄 In Progress)
- [ ] Authentication system
- [ ] Authorization/permissions
- [ ] User roles & management
- [ ] Learner profiles

### Phase 3: Learning Loop
- [ ] Assessment engine
- [ ] Learning path generation
- [ ] Lesson player
- [ ] Practice system
- [ ] Feedback mechanism

### Phase 4: Content Management
- [ ] Admin CMS
- [ ] Content publishing workflow
- [ ] Version control
- [ ] Quality gates

### Phase 5: Quality & Security
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Security audit
- [ ] Accessibility review

### Phase 6: Deployment
- [ ] Configuration
- [ ] Monitoring setup
- [ ] Backup strategy
- [ ] Launch

## Principles

### Absolute Rules
✅ **DO:**
- Build a complete vertical slice
- Test thoroughly
- Verify real behavior
- Document decisions
- Prioritize user value
- Measure everything

❌ **DON'T:**
- Fake functionality
- Fabricate data
- Invent testimonials/stats
- Hide errors
- Skip security
- Claim untested features work

### Priority Order
1. 🔒 Safety / Security / Privacy / Data Integrity
2. 🎓 Core Learning Functionality
3. ♿ Accessibility
4. 🛡️ Reliability
5. 🎯 Usability
6. 💎 Product Value
7. 💰 Business Value
8. ⚡ Performance
9. ✨ Polish
10. 🎁 Nice-to-haves

## Testing Strategy

### Testing Pyramid
- 🔺 Unit Tests (base)
- 🔷 Integration Tests
- 🔸 End-to-End Tests
- 🟨 Security Tests
- 🟩 Accessibility Tests

### Core E2E Test Sequence
1. Visitor → Homepage
2. Subject selection
3. Goal setting
4. Account creation
5. Diagnostic assessment
6. Learning path display
7. Lesson completion
8. Answer submission
9. Feedback delivery
10. Progress tracking
11. Next recommendation

## Security & Privacy

### Protected Areas
- ✅ Authentication & authorization
- ✅ Session handling
- ✅ Input validation
- ✅ Secret management
- ✅ Database permissions
- ✅ CSRF protection
- ✅ Rate limiting
- ✅ File uploads

### Environment Variables
Never commit `.env` file. Use `.env.example` as template.

### Data Lifecycle
- Minimal data collection
- Clear retention policies
- Secure deletion procedures
- Regular backups
- Audit logging

## Monitoring & Observability

- 📊 Structured JSON logging
- 🔍 Error tracking
- ⏱️ Performance monitoring
- 📈 Analytics events
- 🚨 Uptime monitoring

## Contributing

### Code Standards
- ES6+ JavaScript
- Clear variable names
- JSDoc comments
- Comprehensive tests
- Security-first approach

### Commit Convention
```
[PHASE] [TYPE] Brief description

Phase: Discovery, Architecture, Learning, Quality, Polish, Ops
Type: feat, fix, test, docs, refactor, security

Example:
[Architecture] feat: Add user authentication system
[Learning] fix: Correct lesson feedback logic
[Quality] test: Add E2E tests for learning path
```

## Performance Targets

- Homepage load: < 2 seconds
- Lesson load: < 1 second
- API response: < 200ms
- Assessment submit: < 500ms
- 99.9% uptime target

## Documentation

- [Specification](./SPECIFICATION.md) - Full UECOS-DSL 4.0
- [API Docs](./docs/API.md) - Endpoint reference
- [Database Schema](./docs/SCHEMA.md) - Data model
- [Architecture](./docs/ARCHITECTURE.md) - System design
- [Contributing](./CONTRIBUTING.md) - Development guide

## Learning Outcomes

UECOS learners should be able to:

✅ Set clear learning goals  
✅ Understand their current level  
✅ Follow a personalized path  
✅ Practice with immediate feedback  
✅ Measure their progress  
✅ Know what to learn next  
✅ Build sustainable learning habits  

## Business Model

### MVP Phase
- 🎁 Free core experience
- 📊 Basic analytics
- 1️⃣ One subject focus
- 👤 Individual learners

### Future Expansion
- 👨‍👩‍👧 Family plans
- 🎓 Premium courses
- 👨‍🏫 Educator tools
- 🏫 Institutional licenses
- 📱 Mobile apps
- 🌐 Multiple languages

## Success Metrics

### Learning Metrics
- ✅ Lesson completion rate
- ✅ Practice accuracy improvement
- ✅ Assessment score progression
- ✅ Concept mastery achievement

### Product Metrics
- ✅ User activation rate
- ✅ Daily/weekly active users
- ✅ Path completion rate
- ✅ Return user percentage

### Business Metrics
- ✅ User acquisition
- ✅ Retention rate
- ✅ Conversion rate
- ✅ Revenue per user

## Support & Feedback

- 🐛 [Report Issues](https://github.com/geynovichm1293-rgb/uecos-platform/issues)
- 💬 [Discussions](https://github.com/geynovichm1293-rgb/uecos-platform/discussions)
- 📧 Contact: [support email]

## License

MIT License - See LICENSE file for details

## Acknowledgments

Built with principles from:
- Learning science research
- Educational best practices
- User-centered design
- Agile methodology
- Security-first development

---

**UECOS Platform** - *Helping people learn what they need to learn, when they need to learn it.*

🚀 *Currently in active development. Follow progress [here](https://github.com/geynovichm1293-rgb/uecos-platform/projects)*