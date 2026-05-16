# Architecture Overview - EdTech Kurikulum Merdeka

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Side                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Next.js App (React 18)                    │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Pages & Components                              │ │ │
│  │  │  - Dashboard                                     │ │ │
│  │  │  - Master Data (Classes/Students)               │ │ │
│  │  │  - Generate TP                                   │ │ │
│  │  │  - Generate Soal                                 │ │ │
│  │  │  - Koreksi Digital                              │ │ │
│  │  │  - Rekap Nilai                                   │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  State Management                                │ │ │
│  │  │  - AuthContext (Firebase Auth)                  │ │ │
│  │  │  - Local State (useState, useEffect)            │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Firebase Client SDK                             │ │ │
│  │  │  - Authentication                                │ │ │
│  │  │  - Firestore (CRUD)                             │ │ │
│  │  │  - Storage (future)                              │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        Server Side                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Next.js Server Actions                       │ │
│  │  - generateTPFromText()                               │ │
│  │  - generateTPFromPDF()                                 │ │
│  │  - generateQuestionsAction()                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                 AI Services Layer                      │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Gemini AI Service (lib/gemini.ts)              │ │ │
│  │  │  - generateLearningGoals()                       │ │ │
│  │  │  - generateQuestions()                           │ │ │
│  │  │  - Retry Logic (3x)                              │ │ │
│  │  │  - JSON Parsing & Validation                     │ │ │
│  │  │  - Text Chunking                                 │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Utility Services                                │ │ │
│  │  │  - PDF Parser (lib/pdf-utils.ts)                │ │ │
│  │  │  - DOCX Generator (lib/docx-utils.ts)           │ │ │
│  │  │  - Validators (lib/utils.ts)                     │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ API Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Firebase        │  │  Google Gemini   │                │
│  │  - Firestore     │  │  API             │                │
│  │  - Auth          │  │  (1.5 Flash/Pro) │                │
│  │  - Security Rules│  │                  │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Authentication Flow
```
User Login → Firebase Auth → AuthContext → Protected Routes
```

### 2. Master Data Flow (CRUD)
```
UI Input → Client State → Firestore SDK → Security Rules Check → Database
```

### 3. Generate TP Flow
```
PDF/Text Input → Server Action → PDF Parser (if PDF)
    ↓
Text Chunking → Gemini API (with retry) → JSON Response
    ↓
Client Review/Edit → User Approval → Save to Firestore
```

### 4. Generate Soal Flow
```
Select TPs → Server Action → Gemini API → Questions JSON
    ↓
Client Preview → Word Export (docx.js) → Download
    ↓
Save to question_banks collection
```

### 5. Koreksi Digital Flow
```
Select Exam + Class → Load Students from Master Data
    ↓
Input Answers → Real-time Validation → Calculate Scores
    ↓
Save/Update → Firestore grades collection → Finalize (Lock)
```

### 6. Rekap Nilai Flow
```
Filter/Sort → Firestore Query (paginated) → Display Stats
    ↓
Export → CSV Generation → Download
```

## Security Architecture

### Client-Side Security
- Firebase Authentication tokens
- User session management via AuthContext
- Conditional rendering based on auth state

### Server-Side Security
- Server Actions hide API keys from client
- Environment variables for sensitive data
- Firebase Admin SDK for privileged operations

### Database Security
- Firestore Security Rules enforce user_id ownership
- All reads/writes checked against authenticated user
- No cross-user data access possible
- Grade finalization flag prevents unauthorized edits

### Rules Structure
```javascript
// Example rule
match /learning_goals/{goalId} {
  allow read: if isAuthenticated() && 
                 resource.data.user_id == request.auth.uid;
  allow write: if isAuthenticated() && 
                  request.resource.data.user_id == request.auth.uid;
}
```

## Performance Optimizations

### Firestore Optimizations
1. **Pagination**: Limit queries to 10 items per page
2. **Indexing**: Firestore auto-indexes on `user_id`
3. **Subcollections**: Students nested under classes
4. **Sparse Queries**: Filter before sorting

### AI API Optimizations
1. **Text Chunking**: Break large texts into 3KB chunks
2. **Retry Logic**: Exponential backoff (1s delay)
3. **Caching**: Store generated content in Firestore
4. **Batching**: Process multiple chunks sequentially

### Frontend Optimizations
1. **Lazy Loading**: Load data on-demand
2. **Client State**: Minimize re-renders
3. **Debouncing**: Delay validation on input
4. **Code Splitting**: Next.js automatic code splitting

## Scalability Considerations

### Current Limitations (Free Tier)
- **Firestore**: 50,000 reads/day, 20,000 writes/day
- **Gemini API**: Check Google AI Studio for limits
- **Authentication**: 10,000 users (free tier)

### Scaling Strategy
1. **Horizontal Scaling**: Deploy to Vercel/Firebase Hosting
2. **Database**: Upgrade to Firestore paid plan
3. **API**: Implement request queueing for Gemini
4. **Caching**: Add Redis for frequently accessed data
5. **CDN**: Static assets via Vercel Edge Network

## Error Handling Strategy

### Frontend Errors
- Try-catch blocks around async operations
- User-friendly error messages
- Loading states prevent double submissions
- Validation before API calls

### Backend Errors
- Retry logic for transient failures
- Fallback responses
- Detailed error logging
- Graceful degradation

### AI Errors
- JSON parsing errors → Re-prompt with stricter instructions
- API quota exceeded → Queue requests
- Malformed responses → Retry up to 3x

## Monitoring & Logging

### Client-Side
- Console errors for debugging
- User action tracking (optional)
- Performance metrics via Next.js

### Server-Side
- Firebase Console logs
- Gemini API usage tracking
- Error aggregation (Sentry - optional)

### Database
- Firestore usage dashboard
- Query performance monitoring
- Storage size tracking

## Deployment Architecture

### Development
```
Local Dev → http://localhost:3000
Firebase Emulator (optional) → Local Firestore/Auth
```

### Production
```
GitHub Repo → Vercel CI/CD → Edge Network
                    ↓
              Firebase Project
              - Firestore (Production)
              - Authentication
              - Security Rules
```

## Technology Stack Decision Rationale

| Technology | Reason for Choice |
|------------|-------------------|
| **Next.js 14** | App Router, Server Actions, excellent DX |
| **TypeScript** | Type safety, better IDE support |
| **Firebase** | Real-time, easy auth, generous free tier |
| **Gemini AI** | Latest Google AI, good Indonesian support |
| **Tailwind CSS** | Rapid UI development, small bundle |
| **Shadcn/UI** | Accessible, customizable components |
| **docx.js** | No external dependencies for Word export |
| **pdf-parse** | Simple PDF text extraction |

## Future Architecture Enhancements

1. **Microservices**: Separate AI service from main app
2. **Message Queue**: RabbitMQ/Redis for async tasks
3. **Caching Layer**: Redis for frequently accessed data
4. **CDN**: Cloudflare for static assets
5. **Load Balancer**: Multiple Next.js instances
6. **Database Sharding**: Partition by school/district
7. **Analytics**: BigQuery for data warehousing
8. **Monitoring**: Datadog/New Relic for APM
