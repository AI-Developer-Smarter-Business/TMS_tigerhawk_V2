# TigerHawk TMS - GitHub Setup Guide

## Quick Start

This guide helps you set up version control and collaboration for the TigerHawk TMS project using GitHub.

---

## Initial Setup (One-Time)

### 1. Create GitHub Repository

**Partner A** creates the repository (only one person does this):

1. Go to [github.com](https://github.com) and log in
2. Click the "+" icon → "New repository"
3. Repository settings:
   - **Name**: `tigerhawk-tms`
   - **Description**: "Custom TMS for TigerHawk Logistics drayage operations"
   - **Private** ✓ (keep code private)
   - **Add .gitignore**: Select "Node"
   - **Add README**: ✓ Yes
4. Click "Create repository"

### 2. Add Collaborator

**Partner A** adds **Partner B**:

1. Go to repository → Settings → Collaborators
2. Click "Add people"
3. Enter Partner B's GitHub username or email
4. Partner B accepts the invitation email

### 3. Clone Repository (Both Partners)

On your local computer:

```bash
# Navigate to where you want the project
cd ~/projects

# Clone the repository (replace USERNAME with Partner A's GitHub username)
git clone https://github.com/USERNAME/tigerhawk-tms.git

# Enter the project directory
cd tigerhawk-tms
```

---

## Project Structure

Create this folder structure in your repository:

```
tigerhawk-tms/
├── .env.local                 # Environment variables (NOT committed)
├── .env.example              # Example env file (committed)
├── .gitignore                # Files to exclude from Git
├── README_ENGLISH.md         # Project documentation (English)
├── README_SPANISH.md         # Project documentation (Spanish)
├── package.json              # Dependencies
├── next.config.js            # Next.js configuration
├── tailwind.config.js        # Tailwind CSS config
├── app/                      # Next.js app directory
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Home page
│   ├── dashboard/           # Dashboard routes
│   ├── vessels/             # Vessel tracking
│   ├── containers/          # Container management
│   ├── shipments/           # Shipment tracking
│   ├── drivers/             # Driver management
│   ├── warehouse/           # Warehouse module
│   └── api/                 # API routes
│       ├── vessels/
│       ├── containers/
│       └── port-houston/    # Port Houston integration
├── components/               # Reusable React components
│   ├── ui/                  # shadcn/ui components
│   ├── forms/               # Form components
│   ├── tables/              # Data tables
│   └── layout/              # Layout components
├── lib/                      # Utility functions
│   ├── supabase.ts          # Supabase client
│   ├── api.ts               # API helpers
│   └── utils.ts             # General utilities
├── types/                    # TypeScript type definitions
│   ├── database.ts          # Database types
│   └── models.ts            # Data models
├── scripts/                  # Build and utility scripts
│   └── sync-vessels.ts      # Port Houston sync script
└── public/                   # Static assets
    └── images/
```

---

## Git Workflow

### Daily Workflow (Both Partners)

**1. Start Your Day - Pull Latest Changes**

```bash
# Get latest code before starting work
git pull origin main
```

**2. Create a Feature Branch**

```bash
# Create and switch to a new branch for your feature
git checkout -b feature/vessel-dashboard

# Branch naming conventions:
# feature/description  - New features
# fix/description      - Bug fixes
# update/description   - Updates to existing features
```

**3. Make Your Changes**

Work on your code, then check what changed:

```bash
# See what files you changed
git status

# See detailed changes
git diff
```

**4. Commit Your Changes**

```bash
# Add specific files
git add app/vessels/page.tsx components/VesselCard.tsx

# Or add all changed files
git add .

# Commit with descriptive message
git commit -m "Add vessel tracking dashboard with ETA display"
```

**Good commit messages:**
- "Add vessel tracking dashboard"
- "Fix container status not updating"
- "Update shipment form validation"
- "Integrate Port Houston API for appointments"

**Bad commit messages:**
- "changes"
- "update"
- "fixed stuff"

**5. Push to GitHub**

```bash
# First time pushing a new branch
git push -u origin feature/vessel-dashboard

# Subsequent pushes
git push
```

**6. Merge Your Work**

Option A: **Merge directly** (for small team):
```bash
# Switch to main branch
git checkout main

# Pull latest changes
git pull origin main

# Merge your feature branch
git merge feature/vessel-dashboard

# Push to GitHub
git push origin main

# Delete feature branch (optional)
git branch -d feature/vessel-dashboard
```

Option B: **Create Pull Request** (more formal):
1. Go to GitHub repository
2. Click "Pull requests" → "New pull request"
3. Select your branch → "Create pull request"
4. Add description → "Create pull request"
5. Partner reviews and merges

---

## Collaboration Strategies

### Strategy 1: Divide by Layer (Recommended)

**Partner A: Frontend**
- UI components
- Pages and routing
- Form handling
- Dashboards and visualizations

**Partner B: Backend**
- API routes
- Database operations
- External API integrations (Port Houston)
- Authentication logic

**Sync Points:**
- Daily standup (15 min)
- Agree on API contracts
- Test integration weekly

### Strategy 2: Divide by Feature

**Week 1-2:**
- Partner A: Vessel dashboard
- Partner B: Port Houston API + database

**Week 3-4:**
- Partner A: Container tracking UI
- Partner B: Shipment APIs + gate appointments

**Week 5-6:**
- Partner A: Warehouse module
- Partner B: Notifications + automation

**Week 7-8:**
- Partner A: Customer portal
- Partner B: Billing + invoices

### Strategy 3: Pair Programming

- Work together on one computer
- One person writes code, other reviews
- Switch roles every hour
- Use one Claude account at a time

---

## Handling Conflicts

If Git says you have conflicts when pulling or merging:

```bash
# Pull latest changes
git pull origin main

# Git will tell you which files have conflicts
# Open those files and look for:
<<<<<<< HEAD
Your changes
=======
Partner's changes
>>>>>>> branch-name

# Manually edit to keep the right code
# Remove the conflict markers (<<<<, ====, >>>>)

# After fixing all conflicts:
git add .
git commit -m "Resolve merge conflicts"
git push
```

**Avoid conflicts by:**
- Communicating what files you're working on
- Pulling latest changes before starting work
- Committing and pushing frequently
- Working on different files when possible

---

## Important Files to NOT Commit

Your `.gitignore` should include:

```
# Dependencies
node_modules/
.pnp
.pnp.js

# Environment variables (CONTAINS SECRETS!)
.env
.env.local
.env.*.local

# Next.js
.next/
out/
build/

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/
```

**CRITICAL:** Never commit `.env.local` - it contains sensitive API keys!

### Sharing Environment Variables

Create `.env.example` (this DOES get committed):

```bash
# Port Houston API
PORT_HOUSTON_CLIENT_ID=your_client_id_here
PORT_HOUSTON_CLIENT_SECRET=your_client_secret_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email
RESEND_API_KEY=your_resend_key
```

Each partner copies this to `.env.local` and fills in real values.

---

## Useful Git Commands

```bash
# See commit history
git log --oneline

# Undo last commit (keeps changes)
git reset --soft HEAD~1

# Discard all local changes (CAREFUL!)
git reset --hard HEAD

# Switch branches
git checkout main
git checkout feature/container-tracking

# See all branches
git branch -a

# Delete a branch
git branch -d feature/old-feature

# Stash changes temporarily
git stash
git stash pop

# See who changed what
git blame app/vessels/page.tsx
```

---

## Deployment Setup

### Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up
2. Click "New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./
   - **Build Command**: `next build`
   - **Output Directory**: `.next`
5. Add environment variables (from your `.env.local`)
6. Click "Deploy"

**Automatic Deployments:**
- Every push to `main` branch → automatic production deploy
- Preview deployments for other branches

---

## Troubleshooting

**Problem: "Permission denied"**
```bash
# Set up SSH key or use HTTPS with personal access token
# GitHub docs: https://docs.github.com/en/authentication
```

**Problem: "Your branch is behind"**
```bash
git pull origin main
```

**Problem: "You have uncommitted changes"**
```bash
# Either commit them:
git add .
git commit -m "Work in progress"

# Or stash them temporarily:
git stash
git pull
git stash pop
```

**Problem: "Merge conflict"**
- See "Handling Conflicts" section above

---

## Best Practices

✅ **DO:**
- Commit frequently (multiple times per day)
- Write clear commit messages
- Pull before starting work each day
- Push your changes daily
- Communicate what you're working on
- Use branches for features
- Test before committing

❌ **DON'T:**
- Commit broken code
- Commit secrets/API keys
- Make huge commits (break into smaller ones)
- Work for days without pushing
- Commit `node_modules` or `.env` files

---

## Quick Reference Card

```bash
# Daily routine
git pull origin main              # Start of day
git checkout -b feature/my-work   # Create branch
# ... do your work ...
git add .                         # Stage changes
git commit -m "Description"       # Commit
git push -u origin feature/my-work # Push
git checkout main                 # Back to main
git merge feature/my-work         # Merge
git push origin main              # Push to remote

# Common commands
git status        # What changed?
git diff          # Show changes
git log           # Commit history
git branch        # List branches
```

---

## Getting Help

- **Git documentation**: [git-scm.com/doc](https://git-scm.com/doc)
- **GitHub guides**: [guides.github.com](https://guides.github.com)
- **Ask Claude**: "How do I [git operation] in Git?"

---

**Next Steps:**
1. Create GitHub repository
2. Add collaborator
3. Both clone repository
4. Review Project Structure
5. Start coding with git workflow!
