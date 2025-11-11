# Quick Start Guide

Get started with the Google Jobs IT Scraper in 5 minutes!

## 🚀 Option 1: Run on Apify Platform (Easiest)

### Step 1: Sign Up
1. Go to [https://apify.com/sign-up](https://apify.com/sign-up)
2. Create a free account

### Step 2: Create Actor
1. Click **Actors** → **Create new**
2. Choose **Empty actor**
3. Name it `google-jobs-it-scraper`

### Step 3: Add Code
1. Copy all files from this repository into the actor
2. Click **Build** (wait 2-3 minutes)

### Step 4: Run
1. Go to **Input** tab
2. Paste this basic configuration:
```json
{
  "searchQueries": ["Software Developer"],
  "locations": ["Berlin"],
  "maxResults": 20
}
```
3. Click **Save & Run**
4. View results in **Dataset** tab

**Done! ✅ You've scraped your first IT jobs!**

---

## 💻 Option 2: Run Locally

### Prerequisites
- Node.js 20+
- npm

### Step 1: Clone & Install
```bash
git clone <repository-url>
cd google-jobs-it-scraper
npm install
```

### Step 2: Configure Input
Edit `.actor/INPUT.json`:
```json
{
  "searchQueries": ["DevOps Engineer"],
  "locations": ["München"],
  "maxResults": 10
}
```

### Step 3: Get Apify Token
1. Sign up at [https://apify.com](https://apify.com)
2. Go to **Settings** → **Integrations**
3. Copy your API token

### Step 4: Set Environment Variable
```bash
# Linux/Mac
export APIFY_TOKEN=your_token_here

# Windows
set APIFY_TOKEN=your_token_here
```

### Step 5: Run
```bash
npm start
```

### Step 6: View Results
Results are saved in `./apify_storage/datasets/default/`

**Done! ✅**

---

## 📝 Basic Configuration Examples

### Example 1: Single Query
```json
{
  "searchQueries": ["Python Developer"],
  "locations": ["Hamburg"],
  "maxResults": 50
}
```

### Example 2: Multiple Queries
```json
{
  "searchQueries": [
    "Frontend Developer",
    "React Developer",
    "Vue.js Developer"
  ],
  "locations": ["Berlin", "München"],
  "maxResults": 30
}
```

### Example 3: With Filtering
```json
{
  "searchQueries": ["Data Scientist"],
  "locations": ["Frankfurt", "Köln"],
  "maxResults": 40,
  "excludeWords": ["Praktikum", "Student"]
}
```

### Example 4: Remote Jobs Only
```json
{
  "searchQueries": ["Full Stack Developer"],
  "locations": ["Remote", "Deutschland"],
  "maxResults": 100,
  "includeRemote": true
}
```

---

## 📊 Understanding Output

### Output Fields

Each job contains:
- ✅ `title` - Job title (e.g., "Senior Software Engineer")
- ✅ `company` - Company name (e.g., "Google")
- ✅ `location` - Location (e.g., "Berlin")
- ✅ `workType` - Type (e.g., "Vollzeit")
- ✅ `experienceLevel` - Level (e.g., "Senior")
- ✅ `salary` - Salary range (if available)
- ✅ `description` - Job description
- ✅ `jobUrl` - Link to job posting
- ✅ `publishedDate` - When posted
- ✅ `industry` - Industry (e.g., "FinTech")

### Example Output
```json
{
  "id": "a1b2c3d4e5f6",
  "title": "Senior Software Engineer",
  "company": "Tech Company GmbH",
  "location": "Berlin",
  "workType": "Vollzeit",
  "experienceLevel": "Senior",
  "salary": {
    "min": 70000,
    "max": 90000,
    "currency": "€",
    "period": "per year"
  },
  "description": "We are looking for...",
  "jobUrl": "https://www.google.com/...",
  "publishedDate": "2025-01-10T12:00:00.000Z",
  "industry": "FinTech",
  "scrapedAt": "2025-01-11T10:30:00.000Z",
  "searchQuery": "Senior Software Engineer",
  "searchLocation": "Berlin"
}
```

---

## 🎯 Common Use Cases

### Use Case 1: Job Market Research
**Goal**: Understand the IT job market in Berlin

```json
{
  "searchQueries": [
    "Software Developer",
    "Data Scientist",
    "DevOps Engineer",
    "Product Manager"
  ],
  "locations": ["Berlin"],
  "maxResults": 100
}
```

**Result**: 400 jobs, analyze top companies, salary ranges, required skills

---

### Use Case 2: Remote Job Hunting
**Goal**: Find remote positions across Germany

```json
{
  "searchQueries": ["Backend Developer", "Frontend Developer"],
  "locations": ["Remote", "Deutschland"],
  "maxResults": 75,
  "includeRemote": true
}
```

**Result**: 150 remote jobs

---

### Use Case 3: Senior Position Search
**Goal**: Find senior-level opportunities

```json
{
  "searchQueries": [
    "Senior Software Engineer",
    "Lead Developer",
    "Engineering Manager"
  ],
  "locations": ["Berlin", "München", "Hamburg"],
  "maxResults": 50,
  "excludeWords": ["junior", "praktikum"]
}
```

**Result**: 150 senior-level positions

---

### Use Case 4: Specific Tech Stack
**Goal**: Find jobs with specific technologies

```json
{
  "searchQueries": [
    "Python Developer",
    "Django Developer",
    "FastAPI Developer"
  ],
  "locations": ["Berlin", "Remote"],
  "maxResults": 60
}
```

**Result**: 180 Python-related jobs

---

## 🔧 Troubleshooting

### Problem: "No jobs found"
**Solution**:
- Try broader search terms
- Check if locations are correct
- Reduce `excludeWords`

### Problem: "Actor fails/crashes"
**Solution**:
- Check input format is valid JSON
- Ensure `searchQueries` and `locations` are not empty
- Start with smaller `maxResults` (e.g., 10)

### Problem: "Missing Apify token"
**Solution**:
- Export `APIFY_TOKEN` environment variable
- Or create `.env` file with token

### Problem: "Slow scraping"
**Solution**:
- This is normal - scraping takes time
- Increase delays if getting blocked
- Use Apify Proxy (add `proxyConfiguration`)

---

## 📚 Next Steps

- ✅ Read full [README.md](README.md)
- ✅ Check [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- ✅ Review [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) to understand code
- ✅ Customize input parameters for your needs
- ✅ Schedule regular runs on Apify Platform

---

## 💡 Pro Tips

1. **Start Small**: Test with 10-20 jobs first
2. **Use Filters**: `excludeWords` saves time
3. **Export Data**: Download as CSV for analysis in Excel
4. **Schedule Runs**: Daily/weekly scraping for fresh data
5. **Use Proxy**: Add proxy for better success rate

---

## 🆘 Need Help?

- 📖 Check [README.md](README.md)
- 🐛 Open an issue on GitHub
- 💬 Contact Apify support

---

**Happy Job Hunting! 🎉**
