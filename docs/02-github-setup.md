# GitHub Repository Setup

This guide walks you through creating a private GitHub repository for your TaskTracker Pro instance.

---

## Step 1: Create a New Repository

1. Go to [github.com/new](https://github.com/new)

2. Fill in the details:
   - **Repository name:** `tasktracker` (or your preferred name)
   - **Description:** "My task management platform" (optional)
   - **Visibility:** Private (recommended)
   - **Initialize:** Leave all checkboxes UNCHECKED

3. Click **Create repository**

---

## Step 2: Push the Source Code

Open a terminal in the `source/` directory of your TaskTracker Pro package.

### Initialize Git (if not already done)

```bash
cd source
git init
```

### Add All Files

```bash
git add .
```

### Create Initial Commit

```bash
git commit -m "Initial commit - TaskTracker Pro"
```

### Add Your Repository as Remote

Replace `YOUR-USERNAME` with your GitHub username and `YOUR-REPO` with your repository name:

```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
```

### Push to GitHub

```bash
git branch -M main
git push -u origin main
```

---

## Step 3: Verify the Upload

1. Go to your repository on GitHub
2. You should see all the files:
   ```
   ├── client/
   ├── server/
   ├── package.json
   └── ...
   ```

3. Check that both `client/` and `server/` directories are present

---

## Repository Structure

Your repository should contain:

```
tasktracker/
├── client/                 # React frontend
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Express backend
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   └── .env.example
├── package.json            # Root package.json
└── README.md
```

---

## Troubleshooting

### "Repository not found"

Make sure:
- The repository exists on GitHub
- You have the correct username/repo in the URL
- You're signed into the correct GitHub account

```bash
# Check your remote URL
git remote -v

# Update if needed
git remote set-url origin https://github.com/CORRECT-USERNAME/CORRECT-REPO.git
```

### "Permission denied"

You may need to authenticate. Options:

**Option A: Personal Access Token (Recommended)**
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate a new token with `repo` scope
3. Use the token as your password when prompted

**Option B: GitHub CLI**
```bash
# Install GitHub CLI
brew install gh  # Mac
# or visit cli.github.com for other platforms

# Authenticate
gh auth login
```

### "Large files rejected"

If you have files over 100MB:
```bash
# Install Git LFS
brew install git-lfs  # Mac
git lfs install

# Track large files
git lfs track "*.zip"
git lfs track "*.sql"

# Re-add and commit
git add .gitattributes
git add .
git commit -m "Add large file tracking"
git push
```

---

## Security Best Practices

### 1. Keep Repository Private
Your repository contains your application code. Keep it private unless you intend to open-source it.

### 2. Never Commit Secrets
The `.gitignore` file already excludes `.env` files. Double-check:
```bash
# Should NOT show any .env files (except .env.example)
git status
```

### 3. Enable Branch Protection (Optional)
For teams:
1. Go to repository Settings → Branches
2. Add rule for `main` branch
3. Enable "Require pull request reviews"

---

## Next Steps

Your code is now on GitHub! Proceed to:

**[03 - Railway Deployment](03-railway-deploy.md)** →

Railway will connect to this repository to deploy your application.
