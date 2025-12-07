# 📁 Project Structure Guide

## Complete File Tree

```
edtech-kurikulum-merdeka/
│
├── 📄 Configuration Files
│   ├── package.json                 # Dependencies & scripts
│   ├── tsconfig.json               # TypeScript configuration
│   ├── next.config.js              # Next.js configuration
│   ├── tailwind.config.ts          # Tailwind CSS configuration
│   ├── postcss.config.js           # PostCSS configuration
│   ├── components.json             # Shadcn/UI configuration
│   ├── .env.example                # Environment variables template
│   ├── .env                        # Your environment variables (gitignored)
│   └── .gitignore                  # Git ignore rules
│
├── 📚 Documentation
│   ├── README.md                   # Project overview
│   ├── SETUP.md                    # Setup instructions
│   ├── QUICKSTART.md              # Quick start guide
│   ├── ARCHITECTURE.md            # Technical architecture
│   ├── CHANGELOG.md               # Version history
│   ├── PROJECT_SUMMARY.md         # Complete project summary
│   ├── TESTING.md                 # Testing guide
│   └── STRUCTURE.md               # This file
│
├── 🔐 Firebase
│   └── firestore.rules            # Firestore security rules
│
├── 📱 App Directory (Next.js 14 App Router)
│   ├── layout.tsx                 # Root layout with AuthProvider
│   ├── page.tsx                   # Root page (redirects to login/dashboard)
│   ├── globals.css                # Global styles
│   │
│   ├── 🔑 login/
│   │   └── page.tsx              # Login & registration page
│   │
│   └── 🏠 dashboard/
│       ├── layout.tsx            # Dashboard layout with sidebar
│       ├── page.tsx              # Dashboard home
│       │
│       ├── 👥 master-data/
│       │   └── page.tsx          # Classes & students CRUD
│       │
│       ├── 📝 generate-tp/
│       │   ├── page.tsx          # TP generation UI
│       │   └── actions.ts        # Server actions for TP generation
│       │
│       ├── ❓ generate-soal/
│       │   ├── page.tsx          # Question generation UI
│       │   └── actions.ts        # Server actions for questions
│       │
│       ├── ✅ koreksi/
│       │   └── page.tsx          # Digital grading interface
│       │
│       └── 📈 rekap-nilai/
│           └── page.tsx          # Grade reports & statistics
│
├── 🧩 Components
│   └── ui/                        # Reusable UI components (Shadcn)
│       ├── button.tsx            # Button component
│       ├── input.tsx             # Input field component
│       ├── card.tsx              # Card component
│       ├── table.tsx             # Table component
│       ├── textarea.tsx          # Textarea component
│       └── select.tsx            # Select dropdown component
│
├── 🔄 Contexts
│   └── AuthContext.tsx           # Firebase authentication context
│
├── 🛠️ Library/Utils
│   ├── firebase.ts               # Firebase client SDK initialization
│   ├── firebase-admin.ts         # Firebase Admin SDK (server-side)
│   ├── gemini.ts                 # Gemini AI integration
│   ├── pdf-utils.ts              # PDF parsing utilities
│   ├── docx-utils.ts             # Word document generation
│   └── utils.ts                  # Helper functions & validators
│
└── 📦 Types
    └── index.ts                  # TypeScript type definitions
```

## Key Files Explained

### 🔧 Configuration Files

#### `package.json`
- **Purpose**: Defines project dependencies and scripts
- **Key Dependencies**: 
  - `next`, `react`, `react-dom` - Core framework
  - `firebase`, `firebase-admin` - Backend
  - `@google/generative-ai` - AI integration
  - `docx`, `pdf-parse` - Document processing
- **Scripts**:
  - `npm run dev` - Start development server
  - `npm run build` - Build for production
  - `npm start` - Run production build

#### `tsconfig.json`
- **Purpose**: TypeScript compiler configuration
- **Key Settings**:
  - `strict: true` - Enables strict type checking
  - Path aliases: `@/*` maps to project root
  - Target: ES2017

#### `tailwind.config.ts`
- **Purpose**: Tailwind CSS customization
- **Includes**: Custom colors, animations, themes
- **Plugin**: `tailwindcss-animate` for animations

#### `.env`
- **Purpose**: Stores sensitive configuration
- **Contains**: Firebase keys, Gemini API key
- **Security**: NEVER commit to git

### 📱 App Files

#### `app/layout.tsx`
```typescript
// Root layout - wraps entire app
- Applies global styles
- Provides AuthContext to all pages
- Sets up metadata (title, description)
```

#### `app/dashboard/layout.tsx`
```typescript
// Dashboard layout - for authenticated users
- Renders sidebar navigation
- Checks authentication status
- Handles logout
- Wraps all dashboard pages
```

### 🔐 Authentication

#### `contexts/AuthContext.tsx`
```typescript
// Provides authentication state globally
- user: Current user object
- loading: Loading state
- signIn(): Login function
- signUp(): Registration function
- signOut(): Logout function

// Usage in components:
const { user, loading, signIn } = useAuth();
```

### 🔥 Firebase

#### `lib/firebase.ts` (Client-side)
```typescript
// Initializes Firebase for browser
- auth: Authentication service
- db: Firestore database
- storage: File storage (unused for now)

// Usage:
import { db, auth } from '@/lib/firebase';
```

#### `lib/firebase-admin.ts` (Server-side)
```typescript
// Initializes Firebase Admin for server
- getAdminApp(): Admin app instance
- getAdminFirestore(): Admin Firestore
- getAdminAuth(): Admin Auth

// Used in Server Actions only
```

#### `firestore.rules`
```
// Database security rules
- Enforces user_id ownership
- Prevents cross-user data access
- Validates write operations

// Deploy from Firebase Console
```

### 🤖 AI Integration

#### `lib/gemini.ts`
```typescript
// Gemini AI service layer

Functions:
- generateLearningGoals(): Creates TPs from text
- generateQuestions(): Creates questions from TPs
- chunkText(): Splits large text for processing
- retryWithBackoff(): Handles API failures

Features:
- 3x retry logic
- JSON parsing & validation
- Error handling
- Response sanitization
```

### 📄 Document Processing

#### `lib/pdf-utils.ts`
```typescript
// PDF text extraction
- extractTextFromPDF(): Extracts text from PDF buffer
- sanitizeText(): Cleans extracted text
```

#### `lib/docx-utils.ts`
```typescript
// Word document generation
- generateQuestionDocument(): Creates question paper
- generateAnswerKeyDocument(): Creates answer key

Output format:
- Properly formatted headers
- Numbered questions
- Option lists (A-E)
- Optional TP references
```

### 🧰 Utilities

#### `lib/utils.ts`
```typescript
// Helper functions
- cn(): Tailwind class merging
- validateGrade(): Validates grade format
- validatePositiveInteger(): Number validation
- calculateTotalScore(): Score calculation
- formatDate(): Date formatting
- formatTimestamp(): Timestamp formatting
```

### 🎨 UI Components

All components in `components/ui/` follow Shadcn/UI patterns:

**button.tsx**
- Variants: default, destructive, outline, secondary, ghost, link
- Sizes: sm, default, lg, icon

**card.tsx**
- Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- Composable card structure

**input.tsx**
- Styled input field with focus states
- Supports all HTML input types

**table.tsx**
- Table, TableHeader, TableBody, TableRow, TableHead, TableCell
- Responsive with horizontal scroll

### 🗂️ Types

#### `types/index.ts`
```typescript
// TypeScript interfaces for data models

Interfaces:
- LearningGoal: TP structure
- QuestionBank: Question set structure
- MultipleChoiceQuestion: PG question
- EssayQuestion: Essay question
- Class: Class data
- Student: Student data
- Grade: Grade entry
- StudentGrade: Individual student grade
- UserProfile: User data
```

## File Naming Conventions

### Pages & Routes
- `page.tsx` - Page component (Next.js convention)
- `layout.tsx` - Layout wrapper (Next.js convention)
- `actions.ts` - Server actions (custom convention)

### Components
- `PascalCase.tsx` - React components
- `camelCase.ts` - Utilities and functions
- `kebab-case.css` - Stylesheets

### Documentation
- `UPPERCASE.md` - Documentation files
- `.extension` - Configuration files

## Import Aliases

Project uses path alias `@/` for cleaner imports:

```typescript
// Without alias
import { db } from '../../../lib/firebase'

// With alias
import { db } from '@/lib/firebase'

// Configured in tsconfig.json:
"paths": {
  "@/*": ["./*"]
}
```

## Data Flow Example

### Creating a Grade Entry

```
1. User Interface (koreksi/page.tsx)
   ↓ User inputs answers
   
2. Client State (useState)
   ↓ Calculate scores
   
3. Firebase Client SDK (lib/firebase.ts)
   ↓ Save to Firestore
   
4. Firestore Security Rules
   ↓ Validate user_id ownership
   
5. Database (Firestore)
   ↓ Store data
   
6. Real-time Update
   ↓ UI reflects changes
```

## Adding a New Feature

### Step-by-step guide:

1. **Create Page**
   ```
   app/dashboard/new-feature/page.tsx
   ```

2. **Add Navigation**
   ```typescript
   // In app/dashboard/layout.tsx
   <Link href="/dashboard/new-feature">
     New Feature
   </Link>
   ```

3. **Create Server Action (if needed)**
   ```
   app/dashboard/new-feature/actions.ts
   ```

4. **Add Types**
   ```typescript
   // In types/index.ts
   export interface NewFeatureData { ... }
   ```

5. **Update Firestore Rules**
   ```
   // In firestore.rules
   match /new_feature/{docId} {
     allow read, write: if ...
   }
   ```

6. **Add Documentation**
   ```markdown
   // Update README.md, CHANGELOG.md
   ```

## Environment Setup Files

### Development
```
.env                    # Your local config
.env.example           # Template for others
```

### Production (Vercel)
```
Vercel Dashboard > Settings > Environment Variables
- Add all variables from .env
- Restart deployment
```

## Build Output

After `npm run build`:

```
.next/
├── cache/             # Build cache
├── server/            # Server-side code
├── static/            # Static assets
└── ...
```

## Common File Patterns

### Page Component
```typescript
'use client'  // For client-side features

export default function MyPage() {
  const [data, setData] = useState([])
  
  useEffect(() => {
    loadData()
  }, [])
  
  return <div>...</div>
}
```

### Server Action
```typescript
'use server'  // Runs on server only

export async function myAction(params) {
  // Use Firebase Admin SDK
  // Use Gemini API
  // Return result
}
```

### Component
```typescript
interface Props {
  title: string
  onClick?: () => void
}

export function MyComponent({ title, onClick }: Props) {
  return <button onClick={onClick}>{title}</button>
}
```

## Quick Navigation Tips

### Find by Feature
- **Auth**: `contexts/AuthContext.tsx`
- **Master Data**: `app/dashboard/master-data/page.tsx`
- **TP Generation**: `app/dashboard/generate-tp/` folder
- **Questions**: `app/dashboard/generate-soal/` folder
- **Grading**: `app/dashboard/koreksi/page.tsx`
- **Reports**: `app/dashboard/rekap-nilai/page.tsx`

### Find by Technology
- **Firebase**: `lib/firebase*.ts`
- **AI**: `lib/gemini.ts`
- **Documents**: `lib/docx-utils.ts`, `lib/pdf-utils.ts`
- **UI**: `components/ui/`
- **Types**: `types/index.ts`
- **Styles**: `app/globals.css`, `tailwind.config.ts`

---

**Understanding this structure will help you navigate and modify the codebase efficiently! 🚀**
